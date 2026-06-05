'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDayLabel, type Artist, type LineupData } from '@/types/lineup';
import type { SpotifyPlaylistSummary } from '@/types/spotify';
import TimetableView from './timetable/TimetableView';
import SelectedArtistsPanel, { SpotifyMark } from './SelectedArtistsPanel';
import PlaylistWizard from './PlaylistWizard';

interface SpotifyUser {
  id: string;
  displayName: string;
}

interface Props {
  event: { slug: string; name: string };
  initialLineup: LineupData;
  initialSpotifyUser: SpotifyUser | null;
}

export default function PlannerClient({ event, initialLineup, initialSpotifyUser }: Props) {
  const [lineup] = useState<LineupData>(initialLineup);
  const [activeDay, setActiveDay] = useState<string>(initialLineup[0]?.day ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(initialSpotifyUser);

  const [showWizard, setShowWizard] = useState(false);
  const [showSelectionSheet, setShowSelectionSheet] = useState(false);
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);

  // Selection persistence (Supabase, keyed by Spotify user)
  const [selectionSynced, setSelectionSynced] = useState(false);
  const [persistenceEnabled, setPersistenceEnabled] = useState(false);

  const activeDaySchedule = lineup.find((d) => d.day === activeDay);
  const allArtists = lineup.flatMap((d) => d.stages.flatMap((s) => s.artists));
  const selectedArtists = allArtists.filter((a) => selectedIds.has(a.id));

  const dayLabels = useMemo(
    () => new Map(lineup.map((day) => [day.day, formatDayLabel(day)])),
    [lineup],
  );

  const toggleArtist = useCallback((artist: Artist) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(artist.id)) {
        next.delete(artist.id);
      } else {
        next.add(artist.id);
      }
      return next;
    });
  }, []);

  const selectAllForDay = useCallback(() => {
    if (!activeDaySchedule) return;
    const dayArtists = activeDaySchedule.stages.flatMap((s) => s.artists);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      dayArtists.forEach((a) => next.add(a.id));
      return next;
    });
  }, [activeDaySchedule]);

  const clearAllForDay = useCallback(() => {
    if (!activeDaySchedule) return;
    const dayIds = new Set(activeDaySchedule.stages.flatMap((s) => s.artists.map((a) => a.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      dayIds.forEach((id) => next.delete(id));
      return next;
    });
  }, [activeDaySchedule]);

  const clearAll = useCallback(() => setSelectedIds(new Set()), []);

  const removeArtist = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Load saved selection from Supabase once the Spotify user is known
  useEffect(() => {
    if (!spotifyUser) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/selections?event=${encodeURIComponent(event.slug)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        setPersistenceEnabled(data.persistence === 'enabled');
        const saved: string[] = data.selection?.artistIds ?? [];
        if (saved.length > 0) {
          setSelectedIds((prev) => new Set([...prev, ...saved]));
        }
      } catch (e) {
        console.error('Failed to load saved selection:', e);
      } finally {
        if (!cancelled) setSelectionSynced(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [spotifyUser, event.slug]);

  // Debounced save of the selection whenever it changes
  useEffect(() => {
    if (!spotifyUser || !selectionSynced || !persistenceEnabled) return;

    const handle = setTimeout(() => {
      fetch('/api/selections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistIds: [...selectedIds], eventSlug: event.slug }),
      }).catch((e) => console.error('Failed to save selection:', e));
    }, 800);

    return () => clearTimeout(handle);
  }, [selectedIds, spotifyUser, selectionSynced, persistenceEnabled, event.slug]);

  const fetchPlaylists = useCallback(async () => {
    setPlaylistsLoading(true);
    try {
      const res = await fetch('/api/spotify/playlists');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load playlists');
      setPlaylists(data.playlists ?? []);
    } catch (e) {
      console.error('Playlists error:', e);
      setPlaylists([]);
    } finally {
      setPlaylistsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showWizard || !spotifyUser) return;
    fetchPlaylists();
  }, [fetchPlaylists, showWizard, spotifyUser]);

  const handleDisconnect = async () => {
    await fetch('/api/spotify/me', { method: 'DELETE' });
    setSpotifyUser(null);
  };

  const openWizard = () => {
    setShowSelectionSheet(false);
    setShowWizard(true);
  };

  return (
    <div className="flex flex-col h-full bg-coal text-cream overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 border-b border-line bg-soot/90 backdrop-blur pt-safe">
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <Link
            href="/"
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-card text-fog hover:text-cream transition-colors"
            aria-label="Naar alle events"
          >
            ‹
          </Link>
          <h1 className="font-display text-lg leading-none text-cream uppercase truncate">
            {event.name}
          </h1>

          <div className="ml-auto shrink-0">
            {spotifyUser ? (
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-spotify"
                title="Klik om te ontkoppelen"
              >
                <SpotifyMark />
                <span className="max-w-28 truncate">{spotifyUser.displayName}</span>
              </button>
            ) : (
              <a
                href="/api/spotify/auth"
                className="flex items-center gap-1.5 rounded-full bg-spotify hover:bg-spotify-hi px-3.5 py-1.5 text-xs font-bold text-white transition-colors"
              >
                <SpotifyMark /> Verbind Spotify
              </a>
            )}
          </div>
        </div>

        {/* Day pills */}
        {lineup.length > 1 && (
          <nav className="flex gap-1.5 px-4 pb-2.5 overflow-x-auto no-scrollbar">
            {lineup.map((day) => {
              const count = day.stages
                .flatMap((s) => s.artists)
                .filter((a) => selectedIds.has(a.id)).length;
              const active = activeDay === day.day;
              return (
                <button
                  key={day.day}
                  onClick={() => setActiveDay(day.day)}
                  className={[
                    'shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
                    active
                      ? 'bg-ember text-white'
                      : 'bg-card text-fog hover:text-cream',
                  ].join(' ')}
                >
                  {dayLabels.get(day.day) ?? day.day}
                  {count > 0 && (
                    <span
                      className={[
                        'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]',
                        active ? 'bg-white/25' : 'bg-ember/20 text-ember-soft',
                      ].join(' ')}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {activeDaySchedule ? (
            <TimetableView
              daySchedule={activeDaySchedule}
              selectedIds={selectedIds}
              onToggle={toggleArtist}
              onSelectAll={selectAllForDay}
              onClearAll={clearAllForDay}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-fog-dim">
              Geen programma voor deze dag.
            </div>
          )}
          {/* Spacer so floating bar never covers the last stage row on mobile */}
          <div className="h-24 lg:hidden" />
        </main>

        {/* Desktop side panel */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col border-l border-line">
          <SelectedArtistsPanel
            selectedArtists={selectedArtists}
            dayLabels={dayLabels}
            onRemove={removeArtist}
            onClearAll={clearAll}
            onMakePlaylist={openWizard}
            isAuthenticated={!!spotifyUser}
          />
        </aside>
      </div>

      {/* Mobile floating action bar */}
      {selectedArtists.length > 0 && (
        <div className="lg:hidden absolute bottom-16 left-0 right-0 px-4 pb-2 pointer-events-none">
          <div className="pointer-events-auto animate-rise mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-line bg-soot/95 backdrop-blur p-2 shadow-2xl">
            <button
              onClick={() => setShowSelectionSheet(true)}
              className="flex-1 text-left px-3 py-2"
            >
              <p className="text-xs font-bold text-cream">
                {selectedArtists.length} artiest{selectedArtists.length !== 1 ? 'en' : ''}
              </p>
              <p className="text-[10px] text-fog">Tik om je selectie te bekijken</p>
            </button>
            {spotifyUser ? (
              <button
                onClick={openWizard}
                className="animate-pulse-ember rounded-xl bg-ember hover:bg-ember-soft px-4 py-2.5 text-sm font-bold text-white transition-colors"
              >
                Playlist maken
              </button>
            ) : (
              <a
                href="/api/spotify/auth"
                className="flex items-center gap-1.5 rounded-xl bg-spotify px-4 py-2.5 text-sm font-bold text-white"
              >
                <SpotifyMark /> Verbind
              </a>
            )}
          </div>
        </div>
      )}

      {/* Mobile selection sheet */}
      {showSelectionSheet && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end"
          onClick={() => setShowSelectionSheet(false)}
        >
          <div
            className="animate-sheet w-full max-h-[80dvh] rounded-t-2xl border-t border-line bg-soot flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line shrink-0" />
            <SelectedArtistsPanel
              selectedArtists={selectedArtists}
              dayLabels={dayLabels}
              onRemove={removeArtist}
              onClearAll={clearAll}
              onMakePlaylist={openWizard}
              isAuthenticated={!!spotifyUser}
            />
          </div>
        </div>
      )}

      {/* Playlist wizard */}
      {showWizard && (
        <PlaylistWizard
          eventSlug={event.slug}
          eventName={event.name}
          selectedArtists={selectedArtists}
          playlists={playlists}
          playlistsLoading={playlistsLoading}
          onClose={() => setShowWizard(false)}
          onSaved={fetchPlaylists}
        />
      )}
    </div>
  );
}

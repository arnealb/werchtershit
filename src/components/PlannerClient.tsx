'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Artist, Day, LineupData } from '@/types/lineup';
import { DAY_DATES, DAY_LABELS } from '@/types/lineup';
import type { PlaylistPreviewData } from '@/types/spotify';
import TimetableView from './timetable/TimetableView';
import SelectedArtistsPanel from './SelectedArtistsPanel';
import PlaylistPreview from './PlaylistPreview';
import DebugPanel from './DebugPanel';

const DAYS: Day[] = ['thursday', 'friday', 'saturday', 'sunday'];

interface SpotifyUser {
  id: string;
  displayName: string;
}

interface Props {
  initialLineup: LineupData;
  initialSpotifyUser: SpotifyUser | null;
}

export default function PlannerClient({ initialLineup, initialSpotifyUser }: Props) {
  const [lineup] = useState<LineupData>(initialLineup);
  const [activeDay, setActiveDay] = useState<Day>('thursday');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(initialSpotifyUser);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<PlaylistPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [maxTracksPerArtist, setMaxTracksPerArtist] = useState(5);
  const [isCreating, setIsCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | undefined>();

  const activeDaySchedule = lineup.find((d) => d.day === activeDay)!;

  // Collect all artists for selected panel
  const allArtists = lineup.flatMap((d) => d.stages.flatMap((s) => s.artists));
  const selectedArtists = allArtists.filter((a) => selectedIds.has(a.id));

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
    const dayArtists = activeDaySchedule.stages.flatMap((s) => s.artists);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      dayArtists.forEach((a) => next.add(a.id));
      return next;
    });
  }, [activeDaySchedule]);

  const clearAllForDay = useCallback(() => {
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

  // Fetch preview (and re-fetch when maxTracksPerArtist changes)
  const fetchPreview = useCallback(
    async (artistIds: string[], max: number) => {
      setPreviewLoading(true);
      try {
        const res = await fetch('/api/spotify/playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artistIds: [...artistIds], maxTracksPerArtist: max }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setPreview(data);
      } catch (e) {
        console.error('Preview error:', e);
        alert('Failed to load preview: ' + String(e));
      } finally {
        setPreviewLoading(false);
      }
    },
    [],
  );

  const handlePreview = useCallback(async () => {
    await fetchPreview([...selectedIds], maxTracksPerArtist);
    setCreatedUrl(undefined);
    setShowPreview(true);
  }, [selectedIds, maxTracksPerArtist, fetchPreview]);

  // Re-fetch when slider changes while preview is open
  useEffect(() => {
    if (!showPreview || selectedIds.size === 0) return;
    fetchPreview([...selectedIds], maxTracksPerArtist);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxTracksPerArtist]);

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/spotify/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistIds: [...selectedIds],
          maxTracksPerArtist,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCreatedUrl(data.playlistUrl);
    } catch (e) {
      alert('Failed to create playlist: ' + String(e));
    } finally {
      setIsCreating(false);
    }
  }, [selectedIds, maxTracksPerArtist]);

  const handleDisconnect = async () => {
    await fetch('/api/spotify/me', { method: 'DELETE' });
    setSpotifyUser(null);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-5 py-3 border-b border-gray-800 bg-gray-950 shrink-0">
        <div>
          <h1 className="text-base font-bold tracking-tight text-white">
            Rock Werchter 2026
          </h1>
          <p className="text-xs text-gray-500">Lineup Planner</p>
        </div>

        {/* Day tabs */}
        <nav className="flex gap-1 ml-4">
          {DAYS.map((day) => {
            const count = lineup
              .find((d) => d.day === day)
              ?.stages.flatMap((s) => s.artists)
              .filter((a) => selectedIds.has(a.id)).length ?? 0;
            return (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                className={[
                  'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                  activeDay === day
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800',
                ].join(' ')}
              >
                {DAY_LABELS[day]}
                {count > 0 && (
                  <span className="ml-1.5 bg-blue-500/30 text-blue-300 rounded-full px-1.5 py-0.5 text-[10px]">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Spotify status */}
        <div className="ml-auto flex items-center gap-3">
          {spotifyUser ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-400 font-medium">
                ✓ {spotifyUser.displayName}
              </span>
              <button
                onClick={handleDisconnect}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <a
              href="/api/spotify/auth"
              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-green-700/80 hover:bg-green-600 text-white transition-colors"
            >
              Connect Spotify
            </a>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Timetable */}
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
            <div className="flex items-center justify-center h-64 text-gray-600">
              No schedule data for this day.
            </div>
          )}
        </main>

        {/* Right panel */}
        <aside className="w-64 shrink-0 overflow-hidden flex flex-col border-l border-gray-800">
          <SelectedArtistsPanel
            selectedArtists={selectedArtists}
            onRemove={removeArtist}
            onClearAll={clearAll}
            onPreview={handlePreview}
            isAuthenticated={!!spotifyUser}
            isPreviewLoading={previewLoading}
          />
        </aside>
      </div>

      {/* Preview modal */}
      {showPreview && preview && (
        <PlaylistPreview
          preview={preview}
          maxTracksPerArtist={maxTracksPerArtist}
          onMaxTracksChange={setMaxTracksPerArtist}
          onConfirm={handleCreate}
          onCancel={() => {
            setShowPreview(false);
            setCreatedUrl(undefined);
          }}
          isCreating={isCreating}
          createdUrl={createdUrl}
        />
      )}

      {/* Debug panel */}
      <DebugPanel
        preview={preview}
        lineupLoaded={lineup.length > 0}
        artistCount={allArtists.length}
      />
    </div>
  );
}

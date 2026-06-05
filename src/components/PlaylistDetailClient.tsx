'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { PlaylistDetails } from '@/lib/spotify';
import type { PlaylistGenerationSummary } from '@/lib/playlist-meta';
import type { SpotifyTrack } from '@/types/spotify';

interface Props {
  details: PlaylistDetails;
  initialTracks: SpotifyTrack[];
  generation: PlaylistGenerationSummary | null;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function PlaylistDetailClient({ details, initialTracks, generation }: Props) {
  const [tracks, setTracks] = useState<SpotifyTrack[]>(initialTracks);
  const [removingUri, setRemovingUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rename
  const [name, setName] = useState(details.name);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(details.name);
  const [isSavingName, setIsSavingName] = useState(false);

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === name) {
      setIsEditingName(false);
      setNameDraft(name);
      return;
    }
    setIsSavingName(true);
    setError(null);
    try {
      const res = await fetch(`/api/spotify/playlist/${details.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Hernoemen mislukt');
      setName(trimmed);
      setIsEditingName(false);
    } catch (e) {
      console.error('Rename failed:', e);
      setError('Hernoemen is mislukt. Probeer het opnieuw.');
    } finally {
      setIsSavingName(false);
    }
  };

  const totalMs = tracks.reduce((sum, track) => sum + track.durationMs, 0);
  const totalMinutes = Math.round(totalMs / 60000);

  const removeTrack = async (uri: string) => {
    setRemovingUri(uri);
    setError(null);
    try {
      const res = await fetch(`/api/spotify/playlist/${details.id}/tracks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [uri] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Verwijderen mislukt');
      }
      setTracks((prev) => prev.filter((track) => track.uri !== uri));
    } catch (e) {
      console.error('Remove track failed:', e);
      setError('Nummer verwijderen is mislukt. Probeer het opnieuw.');
    } finally {
      setRemovingUri(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-coal">
      <header className="sticky top-0 z-10 border-b border-line bg-soot/90 backdrop-blur px-4 pt-3 pb-3 pt-safe">
        <Link href="/playlists" className="text-xs font-semibold text-ember-soft hover:text-ember">
          ← Mijn playlists
        </Link>
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {details.imageUrl && (
              <Image
                src={details.imageUrl}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
                unoptimized
              />
            )}
            <div className="min-w-0">
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveName();
                      if (e.key === 'Escape') {
                        setIsEditingName(false);
                        setNameDraft(name);
                      }
                    }}
                    maxLength={100}
                    autoFocus
                    className="w-full max-w-xs rounded-lg border border-ember bg-card px-2.5 py-1.5 text-sm font-bold text-cream focus:outline-none"
                  />
                  <button
                    onClick={saveName}
                    disabled={isSavingName}
                    className="shrink-0 rounded-lg bg-ember px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {isSavingName ? '…' : 'OK'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setNameDraft(name);
                    setIsEditingName(true);
                  }}
                  className="group flex items-center gap-1.5 text-left min-w-0"
                  title="Klik om te hernoemen"
                >
                  <h1 className="font-display text-lg text-cream uppercase leading-tight truncate">
                    {name}
                  </h1>
                  <span className="shrink-0 text-xs text-fog-dim transition-colors group-hover:text-ember-soft">
                    ✏️
                  </span>
                </button>
              )}
              <p className="text-xs text-fog mt-0.5">
                {tracks.length} nummers · ±{totalMinutes} min
                {details.collaborative && ' · samen met vrienden'}
              </p>
            </div>
          </div>
          <a
            href={details.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full bg-spotify hover:bg-spotify-hi px-3.5 py-1.5 text-xs font-bold text-white transition-colors"
          >
            Spotify ↗
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-4">
        {error && (
          <div className="mb-3 rounded-lg bg-ember-deep/25 border border-ember-deep px-3 py-2 text-sm text-ember-soft">
            {error}
          </div>
        )}

        {generation && (
          <div className="mb-4 rounded-xl border border-line bg-card p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ember-soft">
              ✨ Gemaakt met Festival Planner
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fog">
              <span>
                Event: <span className="font-semibold text-cream">{generation.eventName || '—'}</span>
              </span>
              <span>
                Modus:{' '}
                <span className="font-semibold text-cream">
                  {generation.mode === 'smart' ? 'Slim (AI)' : 'Snel'}
                </span>
              </span>
              <span>
                ±{generation.tracksPerArtist} nummers/artiest
              </span>
              <span>
                Laatst gegenereerd:{' '}
                <span className="font-semibold text-cream">
                  {new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' }).format(
                    new Date(generation.createdAt),
                  )}
                </span>
              </span>
              {generation.generationCount > 1 && (
                <span>{generation.generationCount}× aangevuld</span>
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {generation.allArtistNames.map((artistName) => (
                <span
                  key={artistName}
                  className="rounded-full bg-card-hi px-2.5 py-1 text-[11px] font-semibold text-cream"
                >
                  {artistName}
                </span>
              ))}
            </div>
          </div>
        )}

        {tracks.length === 0 ? (
          <p className="mt-16 text-center text-sm text-fog">Deze playlist is leeg.</p>
        ) : (
          <ul className="space-y-1">
            {tracks.map((track, index) => (
              <li
                key={`${track.uri}-${index}`}
                className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5"
              >
                <span className="w-6 shrink-0 text-right text-xs text-fog-dim tabular-nums">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-cream truncate">{track.name}</p>
                  <p className="text-xs text-fog truncate mt-0.5">{track.primaryArtist}</p>
                </div>
                <span className="shrink-0 text-xs text-fog-dim tabular-nums">
                  {formatDuration(track.durationMs)}
                </span>
                <button
                  onClick={() => removeTrack(track.uri)}
                  disabled={removingUri === track.uri}
                  className="h-7 w-7 shrink-0 rounded-full text-fog-dim hover:text-ember hover:bg-ember/10 disabled:opacity-40 text-sm transition-colors"
                  aria-label={`${track.name} verwijderen`}
                >
                  {removingUri === track.uri ? '…' : '✕'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

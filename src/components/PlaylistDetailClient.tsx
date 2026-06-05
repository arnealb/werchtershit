'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PlaylistDetails } from '@/lib/spotify';
import type { SpotifyTrack } from '@/types/spotify';

interface Props {
  details: PlaylistDetails;
  initialTracks: SpotifyTrack[];
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function PlaylistDetailClient({ details, initialTracks }: Props) {
  const [tracks, setTracks] = useState<SpotifyTrack[]>(initialTracks);
  const [removingUri, setRemovingUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <div className="min-w-0">
            <h1 className="font-display text-lg text-cream uppercase leading-tight truncate">
              {details.name}
            </h1>
            <p className="text-xs text-fog mt-0.5">
              {tracks.length} nummers · ±{totalMinutes} min
              {details.collaborative && ' · samen met vrienden'}
            </p>
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

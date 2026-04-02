'use client';

import { useState } from 'react';
import type { PlaylistPreviewData } from '@/types/spotify';

interface Props {
  preview: PlaylistPreviewData | null;
  lineupLoaded: boolean;
  artistCount: number;
}

export default function DebugPanel({ preview, lineupLoaded, artistCount }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs bg-gray-900 border border-gray-700 text-gray-500 hover:text-white px-3 py-1.5 rounded-full shadow-lg transition-colors"
      >
        {open ? '✕ Debug' : '⚙ Debug'}
      </button>

      {open && (
        <div className="absolute bottom-10 right-0 w-96 max-h-[70vh] overflow-y-auto bg-gray-950 border border-gray-700 rounded-xl shadow-2xl p-4 text-xs">
          <h3 className="font-bold text-white mb-3">Debug Info</h3>

          <section className="mb-3">
            <p className="text-gray-500 font-semibold mb-1">Lineup</p>
            <p className="text-gray-300">
              Loaded: {lineupLoaded ? '✓' : '✗'} · {artistCount} total acts
            </p>
          </section>

          {preview && (
            <>
              <section className="mb-3">
                <p className="text-gray-500 font-semibold mb-1">Matching results</p>
                <p className="text-gray-300">
                  Matched: {preview.matchedArtists.filter((a) => a.matched).length} /{' '}
                  {preview.matchedArtists.length}
                </p>
                <p className="text-gray-300">Total tracks: {preview.totalTracks}</p>
              </section>

              <section className="mb-3">
                <p className="text-gray-500 font-semibold mb-1">Matched artists</p>
                {preview.matchedArtists
                  .filter((a) => a.matched)
                  .map((a) => (
                    <div key={a.festivalArtistId} className="mb-1">
                      <span className="text-green-400">✓ {a.festivalArtistName}</span>
                      {a.matchedSpotifyName !== a.festivalArtistName && (
                        <span className="text-gray-600"> → "{a.matchedSpotifyName}"</span>
                      )}
                      <span className="text-gray-600"> ({a.tracks.length} tracks)</span>
                    </div>
                  ))}
              </section>

              {preview.unmatchedArtists.length > 0 && (
                <section>
                  <p className="text-gray-500 font-semibold mb-1">Unmatched artists</p>
                  {preview.unmatchedArtists.map((a) => (
                    <div key={a.id} className="text-yellow-500">
                      ⚠ {a.name}
                      <span className="text-gray-600"> — not in RW playlist</span>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}

          {!preview && (
            <p className="text-gray-600">
              Select artists and click "Preview & Create Playlist" to see matching results.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

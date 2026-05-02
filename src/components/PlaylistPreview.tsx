'use client';

import type { PlaylistPreviewData } from '@/types/spotify';

interface Props {
  preview: PlaylistPreviewData;
  maxTracksPerArtist: number;
  onMaxTracksChange: (n: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isCreating: boolean;
  createdUrl?: string;
}

export default function PlaylistPreview({
  preview,
  maxTracksPerArtist,
  onMaxTracksChange,
  onConfirm,
  onCancel,
  isCreating,
  createdUrl,
}: Props) {
  const matched = preview.matchedArtists.filter((a) => a.matched);
  const unmatched = preview.unmatchedArtists;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Playlist Preview</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {matched.length} artists matched · {preview.totalTracks} tracks total
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Controls */}
        <div className="px-6 py-3 border-b border-gray-800 flex items-center gap-4">
          <label className="text-xs text-gray-400">Max tracks per artist:</label>
          <select
            value={maxTracksPerArtist}
            onChange={(e) => onMaxTracksChange(Number(e.target.value))}
            className="text-xs bg-gray-800 border border-gray-700 text-white rounded px-2 py-1"
          >
            {[1, 2, 3, 5, 8, 10, 0].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'All' : n}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-600">
            (playlist will have {preview.totalTracks} tracks)
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Matched */}
          {matched.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-3">
                ✓ Matched — {matched.length} artists
              </h3>
              <div className="space-y-3">
                {matched.map((artist) => (
                  <div key={artist.festivalArtistId}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-semibold text-white">
                        {artist.festivalArtistName}
                      </span>
                      {artist.matchedSpotifyName &&
                        artist.matchedSpotifyName !== artist.festivalArtistName && (
                          <span className="text-xs text-gray-500">
                            → matched as &quot;{artist.matchedSpotifyName}&quot;
                          </span>
                        )}
                      <span className="text-xs text-gray-600 ml-auto">
                        {artist.tracks.length} track{artist.tracks.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <ul className="space-y-0.5 pl-3 border-l border-gray-800">
                      {artist.tracks.map((track) => (
                        <li key={track.id} className="text-xs text-gray-400 truncate">
                          {track.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Unmatched */}
          {unmatched.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-yellow-500 uppercase tracking-widest mb-2">
                ⚠ No tracks found — {unmatched.length} artists
              </h3>
              <div className="flex flex-wrap gap-2">
                {unmatched.map((a) => (
                  <span
                    key={a.id}
                    className="text-xs bg-gray-800 text-gray-400 rounded px-2 py-1"
                  >
                    {a.name}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                No Spotify tracks were found for these artists.
              </p>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700">
          {createdUrl ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-green-400 font-semibold">✓ Playlist created!</p>
              <a
                href={createdUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm font-bold py-2.5 px-6 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors"
              >
                Open in Spotify ↗
              </a>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 text-sm py-2.5 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isCreating || preview.totalTracks === 0}
                className="flex-1 text-sm font-bold py-2.5 px-4 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-600 text-white transition-colors"
              >
                {isCreating ? 'Creating…' : `Create Playlist (${preview.totalTracks} tracks)`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import type { PlaylistPreviewData, SpotifyPlaylistSummary } from '@/types/spotify';

interface Props {
  preview: PlaylistPreviewData | null;
  isSmartPreview: boolean;
  playlists: SpotifyPlaylistSummary[];
  playlistsLoading: boolean;
  playlistsError: string | null;
  maxTracksPerArtist: number;
  onMaxTracksChange: (n: number) => void;
  onConfirm: (targetPlaylistId?: string) => void;
  onCancel: () => void;
  isCreating: boolean;
  createdUrl?: string;
  savedMode?: 'new' | 'existing';
  saveResult?: {
    mode: 'new' | 'existing';
    addedTracks: number;
    skippedTracks: number;
    requestedTracks: number;
  };
  onBuildSmartPrep?: (targetPlaylistId?: string) => void;
  isBuildingSmartPrep?: boolean;
}

export default function PlaylistPreview({
  preview,
  isSmartPreview,
  playlists,
  playlistsLoading,
  playlistsError,
  maxTracksPerArtist,
  onMaxTracksChange,
  onConfirm,
  onCancel,
  isCreating,
  createdUrl,
  savedMode,
  saveResult,
  onBuildSmartPrep,
  isBuildingSmartPrep = false,
}: Props) {
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const matched = preview?.matchedArtists.filter((a) => a.matched) ?? [];
  const unmatched = preview?.unmatchedArtists ?? [];
  const canUseExisting = playlists.length > 0;
  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId),
    [playlists, selectedPlaylistId],
  );

  const handleConfirm = () => {
    if (!preview && isSmartPreview && onBuildSmartPrep) {
      onBuildSmartPrep(mode === 'existing' ? selectedPlaylistId : undefined);
      return;
    }

    if (mode === 'existing') {
      if (!selectedPlaylistId) return;
      onConfirm(selectedPlaylistId);
      return;
    }

    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Playlist Preview</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {isSmartPreview ? 'Smart prep' : 'Quick match'} · {matched.length} artists matched ·{' '}
              {preview?.totalTracks ?? 0} tracks total
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
            (playlist will have {preview?.totalTracks ?? 0} tracks)
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {!preview && isSmartPreview && (
            <section>
              <h3 className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-3">
                Choose target first
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Smart Prep compares broad Spotify candidates against the target playlist before
                asking AI to choose what you still need.
              </p>
            </section>
          )}

          {/* Matched */}
          {preview && matched.length > 0 && (
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
                          {track.prepReason && (
                            <span className="ml-2 text-gray-600">— {track.prepReason}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Unmatched */}
          {preview && unmatched.length > 0 && (
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
              <p className="text-sm text-green-400 font-semibold">
                ✓ Playlist {savedMode === 'existing' ? 'updated' : 'created'}!
              </p>
              {saveResult && (
                <p className="text-xs text-gray-400">
                  {saveResult.addedTracks} added
                  {saveResult.skippedTracks > 0
                    ? ` · ${saveResult.skippedTracks} already in playlist`
                    : ''}
                </p>
              )}
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
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('new')}
                  className={[
                    'text-xs font-semibold py-2 px-3 rounded-md border transition-colors',
                    mode === 'new'
                      ? 'bg-green-600 border-green-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700',
                  ].join(' ')}
                >
                  New playlist
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('existing');
                    if (!selectedPlaylistId && playlists[0]) setSelectedPlaylistId(playlists[0].id);
                  }}
                  disabled={!canUseExisting || playlistsLoading}
                  className={[
                    'text-xs font-semibold py-2 px-3 rounded-md border transition-colors',
                    mode === 'existing'
                      ? 'bg-green-600 border-green-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700',
                    !canUseExisting || playlistsLoading ? 'opacity-50 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  Existing playlist
                </button>
              </div>

              {mode === 'existing' && (
                <div className="space-y-2">
                  <select
                    value={selectedPlaylistId}
                    onChange={(e) => setSelectedPlaylistId(e.target.value)}
                    disabled={playlistsLoading || playlists.length === 0}
                    className="w-full text-sm bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2"
                  >
                    <option value="">Choose playlist</option>
                    {playlists.map((playlist) => (
                      <option key={playlist.id} value={playlist.id}>
                        {playlist.name} ({playlist.trackCount} tracks)
                      </option>
                    ))}
                  </select>
                  {playlistsLoading && (
                    <p className="text-xs text-gray-500">Loading playlists...</p>
                  )}
                  {playlistsError && (
                    <p className="text-xs text-yellow-500">{playlistsError}</p>
                  )}
                  {selectedPlaylist && (
                    <p className="text-xs text-gray-500">
                      Tracks will be appended to {selectedPlaylist.name}.
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 text-sm py-2.5 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={
                    isCreating ||
                    (!preview && mode === 'existing' && !selectedPlaylistId) ||
                    (preview?.totalTracks ?? 1) === 0 ||
                    (mode === 'existing' && !selectedPlaylistId)
                  }
                  className="flex-1 text-sm font-bold py-2.5 px-4 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-600 text-white transition-colors"
                >
                  {isCreating || isBuildingSmartPrep
                    ? (isBuildingSmartPrep ? 'Building smart prep...' : 'Saving...')
                    : !preview
                      ? 'Build Smart Prep'
                      : mode === 'existing'
                        ? `Add ${preview.totalTracks} tracks`
                        : `Create Playlist (${preview.totalTracks} tracks)`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

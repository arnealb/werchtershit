'use client';

import type { Artist } from '@/types/lineup';
import { DAY_LABELS } from '@/types/lineup';

interface Props {
  selectedArtists: Artist[];
  onRemove: (artistId: string) => void;
  onClearAll: () => void;
  onPreview: () => void;
  onSmartPreview: () => void;
  isAuthenticated: boolean;
  isPreviewLoading: boolean;
  isSmartPreviewLoading: boolean;
}

export default function SelectedArtistsPanel({
  selectedArtists,
  onRemove,
  onClearAll,
  onPreview,
  onSmartPreview,
  isAuthenticated,
  isPreviewLoading,
  isSmartPreviewLoading,
}: Props) {
  const isLoading = isPreviewLoading || isSmartPreviewLoading;
  const byDay = selectedArtists.reduce<Record<string, Artist[]>>((acc, a) => {
    (acc[a.day] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-gray-950 border-l border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <h2 className="text-sm font-bold text-white">My Selection</h2>
          <p className="text-xs text-gray-500 mt-0.5">{selectedArtists.length} artists</p>
        </div>
        {selectedArtists.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Artist list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {selectedArtists.length === 0 ? (
          <p className="text-xs text-gray-600 text-center pt-6 leading-relaxed">
            Click any artist block<br />in the timetable to select
          </p>
        ) : (
          Object.entries(byDay).map(([day, artists]) => (
            <div key={day}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                {DAY_LABELS[day as keyof typeof DAY_LABELS]}
              </p>
              <div className="space-y-1">
                {artists.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{a.name}</p>
                      <p className="text-[10px] text-gray-600">
                        {a.stage} · {a.startTime.display}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemove(a.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs transition-all shrink-0"
                      aria-label={`Remove ${a.name}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action */}
      <div className="px-3 py-3 border-t border-gray-800 space-y-2">
        {!isAuthenticated ? (
          <a
            href="/api/spotify/auth"
            className="block w-full text-center text-xs font-bold py-2.5 px-3 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors"
          >
            Connect Spotify
          </a>
        ) : (
          <div className="space-y-2">
            <button
              onClick={onSmartPreview}
              disabled={selectedArtists.length === 0 || isLoading}
              className="w-full text-xs font-bold py-2.5 px-3 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-600 text-white transition-colors"
            >
              {isSmartPreviewLoading ? 'Building smart prep...' : 'Smart Prep Playlist'}
            </button>
            <button
              onClick={onPreview}
              disabled={selectedArtists.length === 0 || isLoading}
              className="w-full text-xs font-semibold py-2 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-700 text-gray-300 transition-colors"
            >
              {isPreviewLoading ? 'Matching tracks...' : 'Quick Playlist'}
            </button>
          </div>
        )}
        <p className="text-[10px] text-gray-700 text-center">
          smart prep uses Spotify candidates and AI ranking
        </p>
      </div>
    </div>
  );
}

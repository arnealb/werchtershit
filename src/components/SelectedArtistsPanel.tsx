'use client';

import type { Artist } from '@/types/lineup';
import { DAY_LABELS_NL } from './dayLabels';

interface Props {
  selectedArtists: Artist[];
  onRemove: (artistId: string) => void;
  onClearAll: () => void;
  onMakePlaylist: () => void;
  isAuthenticated: boolean;
}

export default function SelectedArtistsPanel({
  selectedArtists,
  onRemove,
  onClearAll,
  onMakePlaylist,
  isAuthenticated,
}: Props) {
  const byDay = selectedArtists.reduce<Record<string, Artist[]>>((acc, a) => {
    (acc[a.day] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-soot">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
        <div>
          <h2 className="font-display text-base text-cream uppercase">Mijn selectie</h2>
          <p className="text-xs text-fog mt-0.5">{selectedArtists.length} artiesten</p>
        </div>
        {selectedArtists.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs font-semibold text-fog-dim hover:text-ember transition-colors"
          >
            Alles wissen
          </button>
        )}
      </div>

      {/* Artist list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {selectedArtists.length === 0 ? (
          <div className="text-center pt-10 px-4">
            <p className="text-3xl mb-3">👆</p>
            <p className="text-sm text-fog leading-relaxed">
              Tik op artiesten in de timetable om je selectie te maken
            </p>
          </div>
        ) : (
          Object.entries(byDay).map(([day, artists]) => (
            <div key={day}>
              <p className="text-[10px] font-bold text-ember-soft uppercase tracking-widest mb-1.5 px-1">
                {DAY_LABELS_NL[day as keyof typeof DAY_LABELS_NL] ?? day}
              </p>
              <div className="space-y-1">
                {artists.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-cream truncate">{a.name}</p>
                      <p className="text-[10px] text-fog-dim mt-0.5">
                        {a.stage} · {a.startTime.display}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemove(a.id)}
                      className="h-6 w-6 shrink-0 rounded-full text-fog-dim hover:text-ember hover:bg-ember/10 text-xs transition-colors"
                      aria-label={`${a.name} verwijderen`}
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
      <div className="px-3 py-3 border-t border-line shrink-0 pb-safe">
        {!isAuthenticated ? (
          <a
            href="/api/spotify/auth"
            className="flex items-center justify-center gap-2 w-full text-sm font-bold py-3 px-3 rounded-xl bg-spotify hover:bg-spotify-hi text-white transition-colors"
          >
            <SpotifyMark /> Verbind met Spotify
          </a>
        ) : (
          <button
            onClick={onMakePlaylist}
            disabled={selectedArtists.length === 0}
            className="w-full text-sm font-bold py-3 px-3 rounded-xl bg-ember hover:bg-ember-soft disabled:bg-card disabled:text-fog-dim text-white transition-colors"
          >
            Playlist maken →
          </button>
        )}
      </div>
    </div>
  );
}

export function SpotifyMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.34a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.16a.75.75 0 1 1-.33-1.46c4.57-1.04 8.5-.59 11.66 1.34.35.21.46.67.25 1.03zm1.47-3.26a.94.94 0 0 1-1.29.3c-3.23-1.98-8.15-2.56-11.97-1.4a.94.94 0 1 1-.55-1.79c4.37-1.33 9.8-.68 13.51 1.6.44.27.58.85.3 1.29zm.13-3.4C15.24 8.39 8.83 8.18 5.14 9.3a1.12 1.12 0 1 1-.65-2.15C8.73 5.86 15.78 6.11 20.25 8.76a1.12 1.12 0 0 1-1.15 1.93z" />
    </svg>
  );
}

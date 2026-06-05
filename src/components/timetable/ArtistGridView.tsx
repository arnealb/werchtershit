'use client';

import type { Artist, DaySchedule } from '@/types/lineup';

interface Props {
  daySchedule: DaySchedule;
  selectedIds: Set<string>;
  onToggle: (artist: Artist) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

/**
 * Grid of selectable artists for days where the source only published a
 * lineup (no set times yet) — a timeline would be meaningless there.
 */
export default function ArtistGridView({
  daySchedule,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
}: Props) {
  const allArtists = daySchedule.stages.flatMap((s) => s.artists);
  const selectedCount = allArtists.filter((a) => selectedIds.has(a.id)).length;

  // Hide the stage grouping when it's just one generic stage
  const showStages =
    daySchedule.stages.length > 1 ||
    (daySchedule.stages[0] && !/^main$/i.test(daySchedule.stages[0].stageName));

  return (
    <div>
      {/* Controls bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-line bg-soot">
        <span className="text-xs text-fog">
          <span className="text-cream font-semibold">{selectedCount}</span>/{allArtists.length} gekozen
        </span>
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={onSelectAll}
            className="text-xs font-semibold px-2.5 py-1 rounded-full bg-card-hi text-cream hover:bg-line transition-colors"
          >
            Alles
          </button>
          <button
            onClick={onClearAll}
            className="text-xs font-semibold px-2.5 py-1 rounded-full bg-card text-fog hover:text-cream transition-colors"
          >
            Wis dag
          </button>
        </div>
      </div>

      {/* No-times notice */}
      <div className="mx-4 mt-3 rounded-xl border border-line bg-card px-3.5 py-2.5 text-xs text-fog leading-relaxed">
        ⏱️ <span className="font-semibold text-cream">Settijden zijn nog niet bekend</span> — dit is
        de line-up van deze dag. Tik op artiesten om ze te kiezen; de playlist-functie werkt gewoon.
      </div>

      {/* Artist grid */}
      <div className="px-4 py-4 space-y-5">
        {daySchedule.stages.map((stage) => (
          <div key={stage.stageName}>
            {showStages && (
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ember-soft">
                {stage.stageName}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {stage.artists.map((artist) => {
                const selected = selectedIds.has(artist.id);
                return (
                  <button
                    key={artist.id}
                    onClick={() => onToggle(artist)}
                    aria-pressed={selected}
                    className={[
                      'rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition-all',
                      selected
                        ? 'bg-ember text-white shadow-lg shadow-ember/25 scale-[1.02]'
                        : 'bg-card text-fog hover:text-cream hover:bg-card-hi',
                    ].join(' ')}
                  >
                    {selected ? '✓ ' : ''}
                    {artist.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

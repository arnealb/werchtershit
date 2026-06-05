'use client';

import type { Artist, DaySchedule } from '@/types/lineup';
import StageRow from './StageRow';
import TimeAxis from './TimeAxis';

interface Props {
  daySchedule: DaySchedule;
  selectedIds: Set<string>;
  onToggle: (artist: Artist) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export default function TimetableView({
  daySchedule,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
}: Props) {
  const { stages, dayStartMinutes, dayEndMinutes } = daySchedule;
  const allArtists = stages.flatMap((s) => s.artists);
  const selectedCount = allArtists.filter((a) => selectedIds.has(a.id)).length;

  return (
    <div>
      {/* Controls bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-line bg-soot">
        <span className="text-xs text-fog">
          Tik op een artiest om te kiezen · <span className="text-cream font-semibold">{selectedCount}</span>/{allArtists.length} gekozen
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

      {/* Scrollable grid */}
      <div style={{ overflowX: 'auto', overflowY: 'visible' }} className="relative">
        <div style={{ minWidth: 'max-content' }}>
          <TimeAxis dayStartMinutes={dayStartMinutes} dayEndMinutes={dayEndMinutes} />
          {stages.map((stage) => (
            <StageRow
              key={stage.stageName}
              stage={stage}
              dayStartMinutes={dayStartMinutes}
              dayEndMinutes={dayEndMinutes}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

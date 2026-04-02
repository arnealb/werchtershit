'use client';

import type { Artist, DaySchedule } from '@/types/lineup';
import StageRow from './StageRow';
import TimeAxis from './TimeAxis';
import { STAGE_LABEL_WIDTH } from './constants';

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
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800 bg-gray-950">
        <span className="text-xs text-gray-500">
          {allArtists.length} acts · {selectedCount} selected
        </span>
        <button
          onClick={onSelectAll}
          className="text-xs px-2 py-1 rounded bg-blue-900/60 text-blue-300 hover:bg-blue-800/80 transition-colors"
        >
          Select all
        </button>
        <button
          onClick={onClearAll}
          className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Scrollable grid */}
      <div
        style={{ overflowX: 'auto', overflowY: 'visible' }}
        className="relative"
      >
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

'use client';

import type { Artist, StageSchedule } from '@/types/lineup';
import ArtistBlock from './ArtistBlock';
import {
  GRID_BG,
  GRID_LINE,
  LABEL_BG,
  LABEL_BORDER,
  PX_PER_MINUTE,
  ROW_HEIGHT,
  STAGE_LABEL_WIDTH,
} from './constants';

interface Props {
  stage: StageSchedule;
  dayStartMinutes: number;
  dayEndMinutes: number;
  selectedIds: Set<string>;
  onToggle: (artist: Artist) => void;
}

export default function StageRow({
  stage,
  dayStartMinutes,
  dayEndMinutes,
  selectedIds,
  onToggle,
}: Props) {
  const totalMinutes = dayEndMinutes - dayStartMinutes;
  const totalWidth = totalMinutes * PX_PER_MINUTE;

  const startHour = Math.floor(dayStartMinutes / 60);
  const endHour = Math.ceil(dayEndMinutes / 60);
  const hourTicks: number[] = [];
  for (let h = startHour; h <= endHour; h++) {
    hourTicks.push((h * 60 - dayStartMinutes) * PX_PER_MINUTE);
  }

  return (
    <div
      style={{
        display: 'flex',
        height: ROW_HEIGHT,
        borderBottom: `1px solid ${GRID_LINE}`,
      }}
    >
      {/* Stage name - sticky left */}
      <div
        style={{
          width: STAGE_LABEL_WIDTH,
          flexShrink: 0,
          position: 'sticky',
          left: 0,
          zIndex: 10,
          backgroundColor: LABEL_BG,
          borderRight: `1px solid ${LABEL_BORDER}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#ff6a54',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            lineHeight: 1.25,
          }}
        >
          {stage.stageName}
        </span>
      </div>

      {/* Timeline area */}
      <div
        style={{
          position: 'relative',
          width: totalWidth,
          flexShrink: 0,
          backgroundColor: GRID_BG,
          overflow: 'hidden',
        }}
      >
        {hourTicks.map((left, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: GRID_LINE,
              zIndex: 0,
            }}
          />
        ))}

        {stage.artists.map((artist) => (
          <ArtistBlock
            key={artist.id}
            artist={artist}
            dayStartMinutes={dayStartMinutes}
            isSelected={selectedIds.has(artist.id)}
            onToggle={onToggle}
          />
        ))}

        {stage.artists.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 12,
            }}
          >
            <span style={{ fontSize: 10, color: '#4d4138', fontStyle: 'italic' }}>—</span>
          </div>
        )}
      </div>
    </div>
  );
}

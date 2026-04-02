'use client';

import {
  HOUR_TICK_WIDTH,
  PX_PER_MINUTE,
  STAGE_LABEL_WIDTH,
  TIME_AXIS_HEIGHT,
} from './constants';

interface Props {
  dayStartMinutes: number;
  dayEndMinutes: number;
}

export default function TimeAxis({ dayStartMinutes, dayEndMinutes }: Props) {
  // Round down to nearest hour for start, up for end
  const startHour = Math.floor(dayStartMinutes / 60);
  const endHour = Math.ceil(dayEndMinutes / 60);

  const totalMinutes = dayEndMinutes - dayStartMinutes;
  const totalWidth = totalMinutes * PX_PER_MINUTE;

  const ticks: { hour: number; label: string; left: number }[] = [];
  for (let h = startHour; h <= endHour; h++) {
    const normalizedHour = h % 24;
    const left = (h * 60 - dayStartMinutes) * PX_PER_MINUTE;
    ticks.push({
      hour: h,
      label: `${String(normalizedHour).padStart(2, '0')}:00`,
      left,
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        height: TIME_AXIS_HEIGHT,
        position: 'sticky',
        top: 0,
        zIndex: 20,
        backgroundColor: '#111827',
        borderBottom: '1px solid #374151',
      }}
    >
      {/* Stage label spacer */}
      <div
        style={{
          width: STAGE_LABEL_WIDTH,
          flexShrink: 0,
          position: 'sticky',
          left: 0,
          zIndex: 30,
          backgroundColor: '#111827',
          borderRight: '1px solid #374151',
        }}
      />

      {/* Hour ticks */}
      <div style={{ position: 'relative', width: totalWidth, flexShrink: 0 }}>
        {ticks.map(({ label, left, hour }) => (
          <div
            key={hour}
            style={{
              position: 'absolute',
              left,
              top: 0,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 6,
              borderLeft: '1px solid #374151',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: '#9ca3af',
                fontWeight: 600,
                letterSpacing: '0.05em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {label}
            </span>
          </div>
        ))}

        {/* 30-minute minor ticks */}
        {ticks.map(({ left, hour }) => (
          <div
            key={`half-${hour}`}
            style={{
              position: 'absolute',
              left: left + HOUR_TICK_WIDTH / 2,
              top: '60%',
              height: '40%',
              borderLeft: '1px solid #1f2937',
            }}
          />
        ))}
      </div>
    </div>
  );
}

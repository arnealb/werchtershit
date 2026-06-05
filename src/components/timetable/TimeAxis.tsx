'use client';

import {
  GRID_LINE,
  HOUR_TICK_WIDTH,
  LABEL_BG,
  LABEL_BORDER,
  PX_PER_MINUTE,
  STAGE_LABEL_WIDTH,
  TIME_AXIS_HEIGHT,
} from './constants';

interface Props {
  dayStartMinutes: number;
  dayEndMinutes: number;
}

export default function TimeAxis({ dayStartMinutes, dayEndMinutes }: Props) {
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
        backgroundColor: LABEL_BG,
        borderBottom: `1px solid ${LABEL_BORDER}`,
      }}
    >
      <div
        style={{
          width: STAGE_LABEL_WIDTH,
          flexShrink: 0,
          position: 'sticky',
          left: 0,
          zIndex: 30,
          backgroundColor: LABEL_BG,
          borderRight: `1px solid ${LABEL_BORDER}`,
        }}
      />

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
              borderLeft: `1px solid ${LABEL_BORDER}`,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: '#a89e90',
                fontWeight: 700,
                letterSpacing: '0.05em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {label}
            </span>
          </div>
        ))}

        {ticks.map(({ left, hour }) => (
          <div
            key={`half-${hour}`}
            style={{
              position: 'absolute',
              left: left + HOUR_TICK_WIDTH / 2,
              top: '60%',
              height: '40%',
              borderLeft: `1px solid ${GRID_LINE}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

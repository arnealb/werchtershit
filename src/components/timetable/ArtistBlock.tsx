'use client';

import type { Artist } from '@/types/lineup';
import {
  COLOR_STYLES,
  PX_PER_MINUTE,
  ROW_HEIGHT,
  STAGE_LABEL_WIDTH,
} from './constants';

interface Props {
  artist: Artist;
  dayStartMinutes: number;
  isSelected: boolean;
  onToggle: (artist: Artist) => void;
}

export default function ArtistBlock({ artist, dayStartMinutes, isSelected, onToggle }: Props) {
  const colorKey = artist.color in COLOR_STYLES ? artist.color : 'default';
  const colors = COLOR_STYLES[colorKey];

  const leftPx = (artist.startTime.minutesFromMidnight - dayStartMinutes) * PX_PER_MINUTE;
  const widthPx = Math.max(artist.durationMinutes * PX_PER_MINUTE - 2, 20);

  const bgColor = isSelected ? colors.selectedBg : colors.bg;
  const textColor = isSelected ? colors.text : '#d1d5db'; // dimmer when not selected

  return (
    <button
      onClick={() => onToggle(artist)}
      title={`${artist.name}\n${artist.startTime.display} – ${artist.endTime.display}`}
      style={{
        position: 'absolute',
        left: leftPx,
        width: widthPx,
        height: ROW_HEIGHT - 8,
        top: 4,
        backgroundColor: bgColor,
        color: textColor,
        borderRadius: 6,
        padding: '4px 6px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'background-color 0.15s, box-shadow 0.15s, transform 0.1s',
        boxShadow: isSelected
          ? `0 0 0 2px #fff, 0 0 0 4px ${colors.selectedBg}`
          : '0 1px 3px rgba(0,0,0,0.4)',
        transform: isSelected ? 'translateY(-1px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        userSelect: 'none',
        zIndex: isSelected ? 10 : 1,
        border: 'none',
        textAlign: 'left',
      }}
      aria-pressed={isSelected}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'block',
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}
      >
        {artist.name}
      </span>
      {artist.durationMinutes >= 20 && (
        <span
          style={{
            fontSize: 9,
            opacity: 0.8,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
            marginTop: 2,
          }}
        >
          {artist.startTime.display}–{artist.endTime.display}
        </span>
      )}
    </button>
  );
}

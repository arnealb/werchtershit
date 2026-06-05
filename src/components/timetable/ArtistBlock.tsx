'use client';

import type { Artist } from '@/types/lineup';
import { COLOR_STYLES, PX_PER_MINUTE, ROW_HEIGHT } from './constants';

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
  const widthPx = Math.max(artist.durationMinutes * PX_PER_MINUTE - 3, 24);

  return (
    <button
      onClick={() => onToggle(artist)}
      title={`${artist.name}\n${artist.startTime.display} – ${artist.endTime.display}`}
      style={{
        position: 'absolute',
        left: leftPx,
        width: widthPx,
        height: ROW_HEIGHT - 10,
        top: 5,
        backgroundColor: isSelected ? colors.selectedBg : colors.bg,
        color: isSelected ? colors.text : '#cfc6ba',
        borderRadius: 10,
        padding: '5px 8px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'background-color 0.15s, box-shadow 0.15s, transform 0.12s',
        boxShadow: isSelected
          ? `0 0 0 2px #f3ede2, 0 4px 16px ${colors.selectedBg}66`
          : 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 1px 3px rgba(0,0,0,0.5)',
        transform: isSelected ? 'translateY(-1px) scale(1.01)' : 'none',
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
          fontSize: 12,
          fontWeight: 800,
          lineHeight: 1.15,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'block',
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}
      >
        {isSelected ? '✓ ' : ''}
        {artist.name}
      </span>
      {artist.durationMinutes >= 20 && (
        <span
          style={{
            fontSize: 10,
            opacity: 0.82,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'block',
            marginTop: 2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {artist.startTime.display}–{artist.endTime.display}
        </span>
      )}
    </button>
  );
}

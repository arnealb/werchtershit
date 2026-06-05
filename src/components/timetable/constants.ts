export const PX_PER_MINUTE = 3; // pixels per minute → 180px/hour
export const ROW_HEIGHT = 80; // px height per stage row
export const STAGE_LABEL_WIDTH = 116; // px width for stage name column
export const TIME_AXIS_HEIGHT = 38; // px height for time axis row
export const HOUR_TICK_WIDTH = PX_PER_MINUTE * 60; // 180px per hour

// Warm festival-night surfaces (matches globals.css palette)
export const GRID_BG = '#0e0c0b';
export const GRID_LINE = '#241e1a';
export const LABEL_BG = '#141110';
export const LABEL_BORDER = '#2d2521';

export const COLOR_STYLES: Record<string, { bg: string; selectedBg: string; text: string }> = {
  red:     { bg: '#7f1d1d', selectedBg: '#ef4444', text: '#fff' },
  orange:  { bg: '#7c2d12', selectedBg: '#f97316', text: '#fff' },
  yellow:  { bg: '#713f12', selectedBg: '#eab308', text: '#1a1205' },
  green:   { bg: '#14532d', selectedBg: '#22c55e', text: '#06170c' },
  pink:    { bg: '#831843', selectedBg: '#ec4899', text: '#fff' },
  blue:    { bg: '#1e3a8a', selectedBg: '#3b82f6', text: '#fff' },
  purple:  { bg: '#581c87', selectedBg: '#a855f7', text: '#fff' },
  default: { bg: '#33291f', selectedBg: '#a8a29e', text: '#fff' },
};

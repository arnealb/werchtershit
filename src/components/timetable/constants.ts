export const PX_PER_MINUTE = 3; // pixels per minute → 180px/hour
export const ROW_HEIGHT = 76; // px height per stage row
export const STAGE_LABEL_WIDTH = 152; // px width for stage name column
export const TIME_AXIS_HEIGHT = 40; // px height for time axis row
export const HOUR_TICK_WIDTH = PX_PER_MINUTE * 60; // 180px per hour

export const COLOR_STYLES: Record<string, { bg: string; selectedBg: string; text: string }> = {
  red:     { bg: '#b91c1c', selectedBg: '#ef4444', text: '#fff' },
  orange:  { bg: '#c2410c', selectedBg: '#f97316', text: '#fff' },
  yellow:  { bg: '#a16207', selectedBg: '#eab308', text: '#000' },
  green:   { bg: '#15803d', selectedBg: '#22c55e', text: '#000' },
  pink:    { bg: '#be185d', selectedBg: '#ec4899', text: '#fff' },
  blue:    { bg: '#1d4ed8', selectedBg: '#3b82f6', text: '#fff' },
  purple:  { bg: '#7e22ce', selectedBg: '#a855f7', text: '#fff' },
  default: { bg: '#374151', selectedBg: '#6b7280', text: '#fff' },
};

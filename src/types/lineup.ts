export type Day = 'thursday' | 'friday' | 'saturday' | 'sunday';

export const DAY_LABELS: Record<Day, string> = {
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const DAY_DATES: Record<Day, string> = {
  thursday: 'Thu 2 Jul',
  friday: 'Fri 3 Jul',
  saturday: 'Sat 4 Jul',
  sunday: 'Sun 5 Jul',
};

export const DAY_URLS: Record<Day, string> = {
  thursday: 'https://www.rockwerchter.be/nl/line-up/donderdag/schedule',
  friday: 'https://www.rockwerchter.be/nl/line-up/vrijdag/schedule',
  saturday: 'https://www.rockwerchter.be/nl/line-up/zaterdag/schedule',
  sunday: 'https://www.rockwerchter.be/nl/line-up/zondag/schedule',
};

export const STAGES = ['Main Stage', 'The Barn', 'KluB C', 'The Slope'] as const;
export type Stage = (typeof STAGES)[number];

export interface PerformanceTime {
  /** e.g. "13:00" */
  display: string;
  /** minutes since midnight (may exceed 1440 for post-midnight acts) */
  minutesFromMidnight: number;
}

export interface Artist {
  /** URL slug, e.g. "a-perfect-circle" */
  id: string;
  name: string;
  /** Day key within the event (e.g. "thursday" or an ISO date) */
  day: string;
  stage: string;
  startTime: PerformanceTime;
  endTime: PerformanceTime;
  durationMinutes: number;
  color: string;
  imageUrl?: string;
}

export interface StageSchedule {
  stageName: string;
  artists: Artist[];
}

export interface DaySchedule {
  /** Day key within the event (e.g. "thursday" or an ISO date) */
  day: string;
  /** ISO date string e.g. "2026-07-02" */
  date: string;
  /**
   * False when the source only listed artists per day without set times
   * (placeholder times were generated). Undefined means times are real.
   */
  hasTimes?: boolean;
  stages: StageSchedule[];
  /** Earliest start in minutes from midnight across all acts */
  dayStartMinutes: number;
  /** Latest end in minutes from midnight (may exceed 1440) */
  dayEndMinutes: number;
}

export type LineupData = DaySchedule[];

/**
 * Timetable order derived from the lineup itself: day order as listed,
 * then set start time — playlists follow the festival.
 */
export function makeChronologicalComparator(lineup: LineupData): (a: Artist, b: Artist) => number {
  const dayIndex = new Map(lineup.map((day, index) => [day.day, index]));
  return (a, b) =>
    (dayIndex.get(a.day) ?? 0) - (dayIndex.get(b.day) ?? 0) ||
    a.startTime.minutesFromMidnight - b.startTime.minutesFromMidnight;
}

/** Human label for a day: prefer the date ("vr 3 jul"), fall back to the raw key. */
export function formatDayLabel(daySchedule: { day: string; date: string }): string {
  if (daySchedule.date) {
    const parsed = new Date(`${daySchedule.date}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat('nl-BE', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(parsed);
    }
  }
  return daySchedule.day;
}

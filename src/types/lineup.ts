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
  day: Day;
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
  day: Day;
  /** ISO date string e.g. "2026-07-02" */
  date: string;
  stages: StageSchedule[];
  /** Earliest start in minutes from midnight across all acts */
  dayStartMinutes: number;
  /** Latest end in minutes from midnight (may exceed 1440) */
  dayEndMinutes: number;
}

export type LineupData = DaySchedule[];

export const DAY_ORDER: Record<Day, number> = {
  thursday: 0,
  friday: 1,
  saturday: 2,
  sunday: 3,
};

/** Timetable order: day first, then set start time — playlists follow the festival. */
export function compareArtistsChronologically(a: Artist, b: Artist): number {
  return (
    (DAY_ORDER[a.day] ?? 0) - (DAY_ORDER[b.day] ?? 0) ||
    a.startTime.minutesFromMidnight - b.startTime.minutesFromMidnight
  );
}

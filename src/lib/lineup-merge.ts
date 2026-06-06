/**
 * Merging helpers for lineup extraction results:
 * - mergeVisionDays: combine text extraction (exact names) with vision
 *   extraction (day assignment read from rendered artist cards)
 * - mergeLineupDays: merge an imported draft into an existing event lineup
 */
import type { LineupData } from '@/types/lineup';
import type { ExtractedArtist, ExtractedDay, ExtractedEvent } from './lineup-extract';

function normalizeArtistName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    // Letters NFD can't decompose but OCR/typography swaps freely
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[œŒ]/g, 'oe')
    .replace(/[łŁ]/g, 'l')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/** Levenshtein distance, capped input length — only used for short artist names. */
function editDistance(a: string, b: string): number {
  const s = a.slice(0, 40);
  const t = b.slice(0, 40);
  if (s === t) return 0;
  const prev = new Array<number>(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const next = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diagonal + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
      diagonal = prev[j];
      prev[j] = next;
    }
  }
  return prev[t.length];
}

/** True when a big lineup landed on a single day without set times — the
 * page probably shows days only visually (baked into card images). */
export function lacksDayInfo(extracted: ExtractedEvent): boolean {
  // Days the model created but left empty don't count as real day info
  const daysWithArtists = extracted.days.filter((day) =>
    day.stages.some((stage) => stage.artists.length > 0),
  );
  if (daysWithArtists.length > 1) return false;
  const artists = daysWithArtists.flatMap((day) => day.stages.flatMap((stage) => stage.artists));
  if (artists.length < 20) return false;
  const timed = artists.filter((artist) => artist.startTime.trim().length > 0).length;
  return timed < artists.length / 2;
}

/**
 * Re-assign the artists of a text extraction to the days a vision extraction
 * saw. Text names are exact (good for Spotify matching later); vision names
 * can carry OCR slips, so matching is normalized + small-edit-distance fuzzy.
 * Unmatched artists stay on the first day.
 */
export function mergeVisionDays(base: ExtractedEvent, vision: ExtractedEvent): ExtractedEvent {
  if (vision.days.length <= 1) return base;

  const visionEntries = vision.days.flatMap((day, dayIndex) =>
    day.stages.flatMap((stage) =>
      stage.artists.map((artist) => ({ key: normalizeArtistName(artist.name), dayIndex })),
    ),
  );
  const exactLookup = new Map(visionEntries.map((entry) => [entry.key, entry.dayIndex]));

  const findDayIndex = (name: string): number | null => {
    const key = normalizeArtistName(name);
    if (key.length === 0) return null;
    const exact = exactLookup.get(key);
    if (exact !== undefined) return exact;
    // OCR slips: BEZGO→BEZOS, BIIANCO→BIANCO — allow a small edit distance
    const maxDistance = Math.max(2, Math.floor(key.length / 8));
    let best: { dayIndex: number; distance: number } | null = null;
    for (const entry of visionEntries) {
      const distance = editDistance(key, entry.key);
      if (distance <= maxDistance && (best === null || distance < best.distance)) {
        best = { dayIndex: entry.dayIndex, distance };
      }
    }
    return best ? best.dayIndex : null;
  };

  const days: ExtractedDay[] = vision.days.map((day) => ({
    date: day.date,
    label: day.label,
    stages: [],
  }));

  const placeArtist = (dayIndex: number, stageName: string, artist: ExtractedArtist) => {
    const day = days[dayIndex];
    const existing = day.stages.find((stage) => stage.stageName === stageName);
    if (existing) {
      existing.artists.push(artist);
    } else {
      day.stages.push({ stageName, artists: [artist] });
    }
  };

  base.days.forEach((day) =>
    day.stages.forEach((stage) =>
      stage.artists.forEach((artist) => {
        placeArtist(findDayIndex(artist.name) ?? 0, stage.stageName, artist);
      }),
    ),
  );

  return { ...base, days: days.filter((day) => day.stages.length > 0) };
}

/**
 * Merge an imported draft into an existing event lineup: incoming days
 * replace same-key days, new days are added, result sorted by date.
 */
export function mergeLineupDays(existing: LineupData, incoming: LineupData): LineupData {
  const incomingKeys = new Set(incoming.map((day) => day.day));
  const merged = [...existing.filter((day) => !incomingKeys.has(day.day)), ...incoming];
  return [...merged].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
}

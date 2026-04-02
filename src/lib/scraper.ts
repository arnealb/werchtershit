import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { Artist, Day, DaySchedule, LineupData, PerformanceTime, Stage } from '@/types/lineup';
import { DAY_URLS, STAGES } from '@/types/lineup';

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'nl-BE,nl;q=0.9,en;q=0.8',
};

/** Parse "2026-07-02 13.00" datetime attribute → PerformanceTime */
function parseDatetime(raw: string): PerformanceTime | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/\d{4}-\d{2}-\d{2}\s+(\d{1,2})[.:](\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const total = hours * 60 + minutes;
  const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return { display, minutesFromMidnight: total };
}

/** Parse a bare time string like "13.40" or "01:30" → minutes from midnight */
function parseTimeText(text: string): number | null {
  const match = text.trim().match(/^(\d{1,2})[.:](\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

function minutesToDisplay(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Extract --performance-minutes or --minutes-before from inline style string */
function extractCssVar(style: string, varName: string): number {
  const m = style.match(new RegExp(`${varName}:\\s*(\\d+)`));
  return m ? parseInt(m[1], 10) : 0;
}

/** Derive a consistent slug/id from artist name */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Extract color from data-color attribute */
function extractColor(el: cheerio.Cheerio<Element>): string {
  return el.attr('data-color') || 'default';
}

/** Normalize stage name to canonical form */
function normalizeStage(raw: string): string {
  const trimmed = raw.trim();
  // Map common variations
  const map: Record<string, string> = {
    'main stage': 'Main Stage',
    'the barn': 'The Barn',
    'klub c': 'KluB C',
    'the slope': 'The Slope',
  };
  return map[trimmed.toLowerCase()] ?? trimmed;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function scrapeDaySchedule(day: Day): Promise<DaySchedule> {
  const url = DAY_URLS[day];
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const stages: DaySchedule['stages'] = [];
  let globalStart = Infinity;
  let globalEnd = -Infinity;
  let dateStr = '';

  // Each stage is a <section class="act-schedule__stage">
  $('section.act-schedule__stage').each((_, sectionEl) => {
    const $section = $(sectionEl);
    const rawStageName = $section.find('h2.act-schedule__title').first().text().trim();
    const stageName = normalizeStage(rawStageName);
    const artists: Artist[] = [];

    $section.find('li.act-schedule__acts-item').each((_, liEl) => {
      const $li = $(liEl);
      const $a = $li.find('a.act-schedule__acts-act').first();

      // Artist name
      const name = $li.find('h3').first().text().trim();
      if (!name) return;

      // Find start/end <time> elements by iterating (avoids CSS class-starts-with-dash issues)
      let startRaw = '';
      let endTimeText = '';
      $li.find('time').each((_, timeEl) => {
        const $t = $(timeEl);
        if ($t.hasClass('-start')) startRaw = $t.attr('datetime') || '';
        if ($t.hasClass('-end')) endTimeText = $t.text().trim(); // e.g. "13.40"
      });

      const startParsed = parseDatetime(startRaw);
      if (!startParsed) {
        console.warn(`[scraper] Could not parse start time for "${name}" on ${day}: "${startRaw}"`);
        return;
      }

      // Extract date from start datetime
      if (!dateStr) {
        const m = startRaw.match(/(\d{4}-\d{2}-\d{2})/);
        if (m) dateStr = m[1];
      }

      // Prefer --performance-minutes CSS var; fall back to end time text content
      const aStyle = $a.attr('style') || '';
      const liStyle = $li.attr('style') || '';
      let durationMinutes = extractCssVar(aStyle, '--performance-minutes') ||
                            extractCssVar(liStyle, '--performance-minutes');

      let endMinutes: number;
      if (durationMinutes > 0) {
        endMinutes = startParsed.minutesFromMidnight + durationMinutes;
      } else {
        // Parse the text of the end time element e.g. "13.40"
        const endRaw = parseTimeText(endTimeText);
        if (endRaw !== null) {
          endMinutes = endRaw < startParsed.minutesFromMidnight ? endRaw + 24 * 60 : endRaw;
          durationMinutes = endMinutes - startParsed.minutesFromMidnight;
        } else {
          // Last resort: 60 min default
          durationMinutes = 60;
          endMinutes = startParsed.minutesFromMidnight + 60;
        }
      }

      // Slug from href, or from name as fallback
      const href = $a.attr('href') || '';
      const slugFromHref = href.split('/acts/')[1]?.replace(/\/$/, '') || slugify(name);

      // Color from the link element
      const color = extractColor($a);

      if (startParsed.minutesFromMidnight < globalStart) globalStart = startParsed.minutesFromMidnight;
      if (endMinutes > globalEnd) globalEnd = endMinutes;

      artists.push({
        id: slugFromHref,
        name,
        day,
        stage: stageName,
        startTime: startParsed,
        endTime: {
          display: minutesToDisplay(endMinutes),
          minutesFromMidnight: endMinutes,
        },
        durationMinutes,
        color,
      });
    });

    if (artists.length > 0 || STAGES.includes(stageName as Stage)) {
      stages.push({ stageName, artists });
    }
  });

  // Ensure all 4 stages are present (empty ones too)
  for (const stage of STAGES) {
    if (!stages.find((s) => s.stageName === stage)) {
      stages.push({ stageName: stage, artists: [] });
    }
  }

  // Sort stages to match canonical order
  stages.sort(
    (a, b) =>
      (STAGES.indexOf(a.stageName as Stage) ?? 99) -
      (STAGES.indexOf(b.stageName as Stage) ?? 99),
  );

  return {
    day,
    date: dateStr,
    stages,
    dayStartMinutes: globalStart === Infinity ? 12 * 60 : globalStart,
    dayEndMinutes: globalEnd === -Infinity ? 26 * 60 : globalEnd,
  };
}

export async function scrapeFullLineup(): Promise<LineupData> {
  const days: Day[] = ['thursday', 'friday', 'saturday', 'sunday'];
  const results: LineupData = [];

  for (const day of days) {
    try {
      console.log(`[scraper] Fetching ${day}...`);
      const schedule = await scrapeDaySchedule(day);
      const totalActs = schedule.stages.reduce((sum, s) => sum + s.artists.length, 0);
      console.log(`[scraper] ${day}: ${totalActs} acts across ${schedule.stages.length} stages`);
      results.push(schedule);
    } catch (err) {
      console.error(`[scraper] Failed to scrape ${day}:`, err);
      // Push empty schedule so app doesn't crash
      results.push({
        day,
        date: '',
        stages: STAGES.map((s) => ({ stageName: s, artists: [] })),
        dayStartMinutes: 12 * 60,
        dayEndMinutes: 26 * 60,
      });
    }
  }

  return results;
}

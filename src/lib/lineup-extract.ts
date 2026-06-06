/**
 * AI extraction of event timetables: from page text, from screenshots, and
 * web search for events by name. Shared by the /api/events/* routes.
 */
import type { Artist, DaySchedule, LineupData } from '@/types/lineup';
import { activeProvider, callOpenAI, generateStructuredJson, groundedSearchText } from './llm';

export interface ExtractedArtist {
  name: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export interface ExtractedDay {
  date: string; // "YYYY-MM-DD" ("" when unknown)
  label: string;
  stages: { stageName: string; artists: ExtractedArtist[] }[];
}

export interface ExtractedEvent {
  name: string;
  location: string;
  days: ExtractedDay[];
}

export interface EventCandidate {
  name: string;
  location: string;
  datesText: string;
  url: string;
}

// Timetable extraction is rare but precision-critical (day/stage/time
// association) — on OpenAI use a stronger model; Gemini Flash handles it well
const extractModel = () =>
  activeProvider() === 'openai' ? process.env.OPENAI_EXTRACT_MODEL ?? 'gpt-4o' : undefined;

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'location', 'days'],
  properties: {
    name: { type: 'string' },
    location: { type: 'string' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['date', 'label', 'stages'],
        properties: {
          date: { type: 'string', description: 'ISO date YYYY-MM-DD, empty string if unknown' },
          label: { type: 'string', description: 'Day label like "Vrijdag" if no date known' },
          stages: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['stageName', 'artists'],
              properties: {
                stageName: { type: 'string' },
                artists: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['name', 'startTime', 'endTime'],
                    properties: {
                      name: { type: 'string' },
                      startTime: { type: 'string', description: '24h HH:MM, empty if unknown' },
                      endTime: { type: 'string', description: '24h HH:MM, empty if unknown' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

const EXTRACTION_INSTRUCTIONS = [
  'You extract festival/concert timetables into structured data.',
  'Extract EVERY artist with their stage and set times. Use 24h HH:MM times.',
  'The input may contain multiple pages, each starting with a line "=== PAGINA: <url> ===". The page URL often states the day (e.g. a path ending in /vrijdag means every artist in that section plays on Friday). All artists in a page section belong to that page\'s day — day names from navigation menus or tabs do NOT change this.',
  'CRITICAL: assign each artist to the EXACT day stated in the source. Sources often show a day label directly next to or below each artist name (e.g. "VR 21 AUG.", "FRI 21 AUG", "Saturday"), or group artists under day sections/tabs. Follow those labels precisely — NEVER guess or distribute artists over days yourself. If a day cannot be determined for an artist, put them on the first day rather than inventing a spread.',
  'Stage names often appear as a header line directly above a group of artists (e.g. "The Beach (Vrijdag)" or "Main Stage"). Assign the artists below such a header to that stage until the next header.',
  'Dutch day abbreviations: DO=Thursday, VR=Friday, ZA=Saturday, ZO=Sunday, WO=Wednesday, MA=Monday, DI=Tuesday.',
  'If only a lineup without times is shown, still list the artists and use empty strings for times.',
  'If stages are unknown, use a single stage named "Main".',
  'Dates as YYYY-MM-DD; if the year is missing, infer it from context (upcoming editions).',
  'Do not invent artists that are not in the source.',
].join(' ');

function parseExtracted(json: string): ExtractedEvent {
  const parsed = JSON.parse(json) as ExtractedEvent;
  if (!parsed || typeof parsed.name !== 'string' || !Array.isArray(parsed.days)) {
    throw new Error('Extraction result did not match the expected shape');
  }
  return parsed;
}

export async function extractEventFromText(pageText: string, hint?: string): Promise<ExtractedEvent> {
  const output = await generateStructuredJson({
    instructions: EXTRACTION_INSTRUCTIONS,
    input: [
      hint ? `Event hint: ${hint}` : '',
      'Extract the timetable from this page content:',
      pageText.slice(0, 120_000),
    ].join('\n\n'),
    schema: EXTRACTION_SCHEMA,
    schemaName: 'event_timetable',
    model: extractModel(),
  });
  return parseExtracted(output);
}

export async function extractEventFromImage(imageDataUrl: string, hint?: string): Promise<ExtractedEvent> {
  const output = await generateStructuredJson({
    instructions: EXTRACTION_INSTRUCTIONS,
    input: `Extract the full timetable from this poster/screenshot.${hint ? ` Event hint: ${hint}` : ''}`,
    imageDataUrl,
    schema: EXTRACTION_SCHEMA,
    schemaName: 'event_timetable',
    model: extractModel(),
  });
  return parseExtracted(output);
}

const SEARCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'location', 'datesText', 'url'],
        properties: {
          name: { type: 'string' },
          location: { type: 'string' },
          datesText: { type: 'string' },
          url: { type: 'string', description: 'Best page with lineup/timetable info' },
        },
      },
    },
  },
} as const;

const SEARCH_INSTRUCTIONS = [
  'You help users find music festivals and concerts.',
  'Search the web for events matching the query and return up to 5 candidates.',
  'Prefer official festival/venue pages with lineup or timetable info as the url.',
  'datesText is a short human-readable date range (e.g. "3–5 juli 2026").',
].join(' ');

export async function searchEventCandidates(query: string): Promise<EventCandidate[]> {
  let output: string;

  if (activeProvider() === 'gemini') {
    // Gemini can't combine Google Search grounding with JSON mode, so:
    // step 1 grounded answer → step 2 structured parse
    const grounded = await groundedSearchText(
      [
        `Search the web for the music festival or concert: "${query}".`,
        'List up to 5 matching events. For each give: official name, location,',
        'date range, and the URL of the official page with the lineup or timetable.',
        'Include full URLs.',
      ].join(' '),
    );
    output = await generateStructuredJson({
      instructions: SEARCH_INSTRUCTIONS,
      input: `Convert this search summary into structured candidates:\n\n${grounded}`,
      schema: SEARCH_SCHEMA,
      schemaName: 'event_candidates',
    });
  } else {
    output = await callOpenAI({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      tools: [{ type: 'web_search' }],
      instructions: SEARCH_INSTRUCTIONS,
      input: `Find the music festival or concert: "${query}"`,
      text: {
        format: {
          type: 'json_schema',
          name: 'event_candidates',
          strict: true,
          schema: SEARCH_SCHEMA,
        },
      },
    });
  }

  const parsed = JSON.parse(output) as { candidates?: EventCandidate[] };
  return (parsed.candidates ?? []).slice(0, 5);
}

// ─── Page text extraction ─────────────────────────────────────────────────────

const PAGE_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
} as const;

// Last path segment of a per-day lineup page, e.g. /line-up/vrijdag or /timetable/day-2
const DAY_PATH_SEGMENT =
  /^(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|monday|tuesday|wednesday|thursday|friday|saturday|sunday|(?:day|dag)[-_]?\d{1,2})\/?$/i;

const MAX_DAY_PAGES = 7;

interface FetchedPage {
  url: string;
  text: string;
  dayLinks: string[];
}

async function fetchPage(url: string): Promise<FetchedPage> {
  const cheerio = await import('cheerio');
  const res = await fetch(url, {
    headers: PAGE_FETCH_HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Page fetch failed: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe').remove();
  // Image-heavy lineup pages often carry stage/artist names only in alt text
  // (e.g. <img alt="The Beach (Vrijdag)">) — surface those as text lines
  $('img[alt]').each((_, el) => {
    const alt = $(el).attr('alt')?.trim();
    if (alt && alt.length > 1) {
      $(el).replaceWith($('<span>').text(alt));
    }
  });
  $('br').replaceWith('\n');
  $('div, p, li, h1, h2, h3, h4, h5, h6, section, article, tr, figcaption, a, span').each(
    (_, el) => {
      $(el).append('\n');
    },
  );

  // Sibling per-day pages (festivals often split the lineup over
  // /line-up/vrijdag, /line-up/zaterdag, ...) — collect them so the import
  // can crawl the whole event instead of a single day
  const dayLinks: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const resolved = new URL(href, url);
      if (resolved.origin !== new URL(url).origin) return;
      const lastSegment = resolved.pathname.split('/').filter(Boolean).pop() ?? '';
      if (!DAY_PATH_SEGMENT.test(lastSegment)) return;
      const normalized = `${resolved.origin}${resolved.pathname.replace(/\/+$/, '')}`;
      if (!dayLinks.includes(normalized)) dayLinks.push(normalized);
    } catch {
      // unparseable href — skip
    }
  });

  const title = $('title').text().trim();
  const text = $('body')
    .text()
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { url, text: `${title}\n\n${text}`, dayLinks };
}

/**
 * Fetch a lineup page AND its sibling per-day pages (e.g. /line-up/vrijdag →
 * also zaterdag/zondag), merged into one text with "=== PAGINA: url ===" headers
 * so the extraction model can anchor each section to the right day.
 *
 * Page text PRESERVES line structure — day labels next to artist names must
 * stay on adjacent lines, otherwise the model can't associate artists with
 * the right day.
 */
export async function fetchEventPagesText(url: string): Promise<string> {
  const mainPage = await fetchPage(url);
  const normalizedMain = `${new URL(url).origin}${new URL(url).pathname.replace(/\/+$/, '')}`;

  const siblingUrls = mainPage.dayLinks
    .filter((link) => link !== normalizedMain)
    .slice(0, MAX_DAY_PAGES - 1);
  if (siblingUrls.length === 0) {
    return mainPage.text;
  }

  const siblingPages = await Promise.all(
    siblingUrls.map(async (link) => {
      try {
        return await fetchPage(link);
      } catch {
        return null; // one broken day page must not sink the whole import
      }
    }),
  );

  const pages = [mainPage, ...siblingPages.filter((page): page is FetchedPage => page !== null)];
  return pages.map((page) => `=== PAGINA: ${page.url} ===\n\n${page.text}`).join('\n\n');
}

// ─── Transform extracted data into the app's LineupData ──────────────────────

const COLOR_CYCLE = ['red', 'orange', 'yellow', 'green', 'pink', 'blue', 'purple'] as const;

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "HH:MM" → minutes from midnight; times before 06:00 count as after midnight. */
function toMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2})[:.h](\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 29 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return hours < 6 ? total + 1440 : total;
}

export function transformExtractedToLineup(extracted: ExtractedEvent): LineupData {
  const lineup: LineupData = [];

  extracted.days.forEach((day, dayIndex) => {
    const dayKey = day.date || slugify(day.label) || `dag-${dayIndex + 1}`;
    let colorIndex = dayIndex;

    // Lineup-only detection: when most artists lack set times, the day is a
    // plain lineup (rendered as a grid, not a timeline)
    const allDayArtists = day.stages.flatMap((stage) => stage.artists);
    const timedCount = allDayArtists.filter((artist) => toMinutes(artist.startTime) !== null).length;
    const hasTimes = allDayArtists.length > 0 && timedCount >= allDayArtists.length / 2;

    const stages = day.stages
      .filter((stage) => stage.artists.length > 0)
      .map((stage) => {
        const artists: Artist[] = stage.artists
          .filter((artist) => artist.name.trim().length > 0)
          .map((artist, artistIndex) => {
            // Lineup-only days get a uniform placeholder slot (positions are
            // never rendered); timed days fall back to sequential slots for
            // the odd artist missing a time
            let start = hasTimes
              ? toMinutes(artist.startTime) ?? 12 * 60 + artistIndex * 60
              : toMinutes(artist.startTime) ?? 12 * 60;
            let end = toMinutes(artist.endTime) ?? start + 60;
            if (end <= start) end = start + 60;
            if (end - start > 6 * 60) end = start + 90; // guard against bogus spans

            colorIndex += 1;
            return {
              id: `${dayKey}-${slugify(stage.stageName)}-${slugify(artist.name)}`,
              name: artist.name.trim(),
              day: dayKey,
              stage: stage.stageName.trim() || 'Main',
              startTime: {
                display: artist.startTime.trim() || formatMinutes(start),
                minutesFromMidnight: start,
              },
              endTime: {
                display: artist.endTime.trim() || formatMinutes(end),
                minutesFromMidnight: end,
              },
              durationMinutes: end - start,
              color: COLOR_CYCLE[colorIndex % COLOR_CYCLE.length],
            };
          });
        return { stageName: stage.stageName.trim() || 'Main', artists };
      })
      .filter((stage) => stage.artists.length > 0);

    if (stages.length === 0) return;

    const allMinutes = stages.flatMap((stage) =>
      stage.artists.flatMap((artist) => [
        artist.startTime.minutesFromMidnight,
        artist.endTime.minutesFromMidnight,
      ]),
    );

    const daySchedule: DaySchedule = {
      day: dayKey,
      date: day.date || '',
      hasTimes,
      stages,
      dayStartMinutes: Math.min(...allMinutes),
      dayEndMinutes: Math.max(...allMinutes),
    };
    lineup.push(daySchedule);
  });

  return lineup;
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

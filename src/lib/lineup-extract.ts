/**
 * AI extraction of event timetables: from page text, from screenshots, and
 * web search for events by name. Shared by the /api/events/* routes.
 */
import type { Artist, DaySchedule, LineupData } from '@/types/lineup';

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

const OPENAI_MODEL = () => process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

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
  'If only a lineup without times is shown, still list the artists and use empty strings for times.',
  'If stages are unknown, use a single stage named "Main".',
  'Dates as YYYY-MM-DD; if the year is missing, infer it from context (upcoming editions).',
  'Do not invent artists that are not in the source.',
].join(' ');

async function callOpenAI(body: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  if (data.output_text) return data.output_text;
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if ((content.type === 'output_text' || content.type === 'text') && content.text) {
        return content.text;
      }
    }
  }
  throw new Error('OpenAI response did not contain output text');
}

function parseExtracted(json: string): ExtractedEvent {
  const parsed = JSON.parse(json) as ExtractedEvent;
  if (!parsed || typeof parsed.name !== 'string' || !Array.isArray(parsed.days)) {
    throw new Error('Extraction result did not match the expected shape');
  }
  return parsed;
}

const extractionFormat = {
  format: {
    type: 'json_schema',
    name: 'event_timetable',
    strict: true,
    schema: EXTRACTION_SCHEMA,
  },
};

export async function extractEventFromText(pageText: string, hint?: string): Promise<ExtractedEvent> {
  const output = await callOpenAI({
    model: OPENAI_MODEL(),
    instructions: EXTRACTION_INSTRUCTIONS,
    input: [
      hint ? `Event hint: ${hint}` : '',
      'Extract the timetable from this page content:',
      pageText.slice(0, 60_000),
    ].join('\n\n'),
    text: extractionFormat,
  });
  return parseExtracted(output);
}

export async function extractEventFromImage(imageDataUrl: string, hint?: string): Promise<ExtractedEvent> {
  const output = await callOpenAI({
    model: OPENAI_MODEL(),
    instructions: EXTRACTION_INSTRUCTIONS,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `Extract the full timetable from this poster/screenshot.${hint ? ` Event hint: ${hint}` : ''}`,
          },
          { type: 'input_image', image_url: imageDataUrl },
        ],
      },
    ],
    text: extractionFormat,
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

export async function searchEventCandidates(query: string): Promise<EventCandidate[]> {
  const output = await callOpenAI({
    model: OPENAI_MODEL(),
    tools: [{ type: 'web_search' }],
    instructions: [
      'You help users find music festivals and concerts.',
      'Search the web for events matching the query and return up to 5 candidates.',
      'Prefer official festival/venue pages with lineup or timetable info as the url.',
      'datesText is a short human-readable date range (e.g. "3–5 juli 2026").',
    ].join(' '),
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
  const parsed = JSON.parse(output) as { candidates?: EventCandidate[] };
  return (parsed.candidates ?? []).slice(0, 5);
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

    const stages = day.stages
      .filter((stage) => stage.artists.length > 0)
      .map((stage) => {
        const artists: Artist[] = stage.artists
          .filter((artist) => artist.name.trim().length > 0)
          .map((artist, artistIndex) => {
            // Default to sequential one-hour slots when times are unknown
            let start = toMinutes(artist.startTime) ?? 12 * 60 + artistIndex * 60;
            let end = toMinutes(artist.endTime) ?? start + 50;
            if (end <= start) end = start + 50;
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

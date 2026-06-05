import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyUser, getValidTokens } from '@/lib/spotify';
import { createEvent } from '@/lib/events';
import type { LineupData } from '@/types/lineup';

const VALID_SOURCE_TYPES = ['ai_url', 'ai_screenshot', 'ai_search'] as const;
type SourceType = (typeof VALID_SOURCE_TYPES)[number];

export async function POST(request: NextRequest) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, location, lineup, sourceUrl, sourceType } = body as {
    name?: unknown;
    location?: unknown;
    lineup?: unknown;
    sourceUrl?: unknown;
    sourceType?: unknown;
  };

  if (typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ error: 'Geef het event een naam' }, { status: 400 });
  }
  if (!Array.isArray(lineup) || lineup.length === 0) {
    return NextResponse.json({ error: 'De timetable is leeg' }, { status: 400 });
  }
  const resolvedSourceType: SourceType = VALID_SOURCE_TYPES.includes(sourceType as SourceType)
    ? (sourceType as SourceType)
    : 'ai_url';

  try {
    const user = await getSpotifyUser(tokens.accessToken);
    const event = await createEvent({
      name,
      location: typeof location === 'string' ? location : '',
      lineup: lineup as LineupData,
      sourceUrl: typeof sourceUrl === 'string' ? sourceUrl : undefined,
      sourceType: resolvedSourceType,
      createdBy: user.id,
    });
    return NextResponse.json({ ok: true, event: { slug: event.slug, name: event.name } });
  } catch (err) {
    console.error('[/api/events] Create error:', err);
    const message = err instanceof Error ? err.message : 'Event opslaan is mislukt';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

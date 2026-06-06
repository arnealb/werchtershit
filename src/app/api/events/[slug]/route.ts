import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyUser, getValidTokens } from '@/lib/spotify';
import { deleteEvent, mergeEventLineup } from '@/lib/events';
import type { LineupData } from '@/types/lineup';

/** Merge an imported lineup draft into this event (extra days, corrections). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { slug } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { lineup } = body as { lineup?: unknown };
  if (!Array.isArray(lineup) || lineup.length === 0) {
    return NextResponse.json({ error: 'De aanvulling bevat geen timetable' }, { status: 400 });
  }

  try {
    const user = await getSpotifyUser(tokens.accessToken);
    const event = await mergeEventLineup(slug, user.id, lineup as LineupData);
    return NextResponse.json({ ok: true, event: { slug: event.slug, name: event.name } });
  } catch (err) {
    console.error('[/api/events/[slug]] PATCH error:', err);
    const message = err instanceof Error ? err.message : 'Aanvullen mislukt';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { slug } = await params;

  try {
    const user = await getSpotifyUser(tokens.accessToken);
    await deleteEvent(slug, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/events/[slug]] DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Verwijderen mislukt';
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

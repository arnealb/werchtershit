import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyUser, getValidTokens } from '@/lib/spotify';
import { deleteEvent } from '@/lib/events';

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

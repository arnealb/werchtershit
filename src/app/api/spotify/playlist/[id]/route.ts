import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens, renamePlaylist, SpotifyApiError } from '@/lib/spotify';

/** Rename a playlist. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = (body as { name?: unknown })?.name;
  if (typeof name !== 'string' || name.trim().length < 1 || name.length > 100) {
    return NextResponse.json({ error: 'Geef een naam van 1-100 tekens' }, { status: 400 });
  }

  try {
    await renamePlaylist(id, name.trim(), tokens.accessToken);
    return NextResponse.json({ ok: true, name: name.trim() });
  } catch (err) {
    if (err instanceof SpotifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.details.status });
    }
    console.error('[/api/spotify/playlist/[id]] PATCH error:', err);
    return NextResponse.json({ error: 'Hernoemen mislukt' }, { status: 500 });
  }
}

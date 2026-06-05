import { NextRequest, NextResponse } from 'next/server';
import {
  getPlaylistTracks,
  getValidTokens,
  removeTracksFromPlaylist,
  SpotifyApiError,
} from '@/lib/spotify';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const tracks = await getPlaylistTracks(id, tokens.accessToken);
    return NextResponse.json({ tracks });
  } catch (err) {
    if (err instanceof SpotifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.details.status });
    }
    console.error('[/api/spotify/playlist/[id]/tracks] GET error:', err);
    return NextResponse.json({ error: 'Failed to load tracks' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

  const uris = (body as { uris?: unknown })?.uris;
  if (!Array.isArray(uris) || uris.length === 0 || !uris.every((u) => typeof u === 'string')) {
    return NextResponse.json({ error: 'uris must be a non-empty string array' }, { status: 400 });
  }

  try {
    await removeTracksFromPlaylist(id, uris, tokens.accessToken);
    return NextResponse.json({ ok: true, removed: uris.length });
  } catch (err) {
    if (err instanceof SpotifyApiError) {
      return NextResponse.json({ error: err.message }, { status: err.details.status });
    }
    console.error('[/api/spotify/playlist/[id]/tracks] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to remove tracks' }, { status: 500 });
  }
}

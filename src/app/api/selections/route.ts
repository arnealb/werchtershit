import { NextRequest, NextResponse } from 'next/server';
import { getUserSelection, saveUserSelection } from '@/lib/selections';
import { getSpotifyUser, getValidTokens } from '@/lib/spotify';
import { isSupabaseConfigured } from '@/lib/supabase';

async function getAuthenticatedUser() {
  const tokens = await getValidTokens();
  if (!tokens) return null;
  try {
    return await getSpotifyUser(tokens.accessToken);
  } catch {
    return null;
  }
}

/** Load the saved artist selection for the logged-in Spotify user. */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ selection: null, persistence: 'disabled' });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const selection = await getUserSelection(user.id);
    return NextResponse.json({ selection, persistence: 'enabled' });
  } catch (err) {
    console.error('[/api/selections] GET error:', err);
    return NextResponse.json({ error: 'Failed to load selection' }, { status: 500 });
  }
}

/** Save the artist selection for the logged-in Spotify user. */
export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Selection persistence is not configured' }, { status: 503 });
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const artistIds = (body as { artistIds?: unknown })?.artistIds;

  try {
    const selection = await saveUserSelection(user.id, user.displayName, artistIds);
    return NextResponse.json({ ok: true, selection });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save selection';
    const status = message.startsWith('artistIds') ? 400 : 500;
    console.error('[/api/selections] PUT error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}

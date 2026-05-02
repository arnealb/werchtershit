import { NextResponse } from 'next/server';
import { getEditablePlaylists, getValidTokens, SpotifyApiError } from '@/lib/spotify';

export async function GET() {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const playlists = await getEditablePlaylists(tokens.accessToken);
    return NextResponse.json({ playlists });
  } catch (err) {
    if (err instanceof SpotifyApiError) {
      console.error('[/api/spotify/playlists] Spotify API error', err.details);
      return NextResponse.json({ error: err.message, spotify: err.details }, { status: err.details.status });
    }

    console.error('[/api/spotify/playlists] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

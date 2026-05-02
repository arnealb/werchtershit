import { NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/spotify';

export async function GET() {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  const body = await res.json();

  if (!res.ok) {
    console.error('[/api/spotify/playlists] Spotify error:', body);
    return NextResponse.json({ error: body }, { status: res.status });
  }

  return NextResponse.json(body);
}

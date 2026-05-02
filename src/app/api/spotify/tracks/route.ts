import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/spotify';

export async function GET(request: NextRequest) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const artistName = request.nextUrl.searchParams.get('artist') ?? 'Rammstein';

  const searchRes = await fetch(
    `https://api.spotify.com/v1/search?${new URLSearchParams({ q: `artist:${artistName}`, type: 'track', limit: '3' })}`,
    { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
  );
  const searchBody = await searchRes.json();
  const tracks = searchBody.tracks?.items?.map((t: { name: string; uri: string; artists: { name: string }[] }) => ({
    name: t.name,
    uri: t.uri,
    artist: t.artists[0]?.name,
  })) ?? [];

  return NextResponse.json({
    search: { status: searchRes.status, artist: artistName, tracks },
  });
}

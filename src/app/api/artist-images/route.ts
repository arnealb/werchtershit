import { NextRequest, NextResponse } from 'next/server';
import { getAppAccessToken, searchSpotifyArtist } from '@/lib/spotify';

export const maxDuration = 30;

const MAX_NAMES = 100;

// In-memory cache per server instance: artist name → image url (null = not found)
const imageCache = new Map<string, string | null>();

function cacheKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Resolve Spotify artist images for a list of names. Public data, app token. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const names = (body as { names?: unknown })?.names;
  if (
    !Array.isArray(names) ||
    names.length === 0 ||
    names.length > MAX_NAMES ||
    !names.every((name) => typeof name === 'string' && name.length <= 200)
  ) {
    return NextResponse.json(
      { error: `names must be a string array (1-${MAX_NAMES})` },
      { status: 400 },
    );
  }

  try {
    const token = await getAppAccessToken();
    const uncached = [...new Set(names.map(cacheKey))].filter((key) => !imageCache.has(key));

    await Promise.allSettled(
      uncached.map(async (key) => {
        try {
          const artist = await searchSpotifyArtist(key, token);
          imageCache.set(key, artist?.imageUrl ?? null);
        } catch {
          // Leave uncached so a later request can retry
        }
      }),
    );

    const images: Record<string, string | null> = {};
    for (const name of names) {
      images[name] = imageCache.get(cacheKey(name)) ?? null;
    }
    return NextResponse.json({ images });
  } catch (err) {
    console.error('[/api/artist-images] Error:', err);
    return NextResponse.json({ error: 'Failed to load artist images' }, { status: 500 });
  }
}

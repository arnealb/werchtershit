import type { SpotifyTokens, SpotifyTrack, SpotifyUser } from '@/types/spotify';
import { cookies } from 'next/headers';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!;

export const SPOTIFY_SCOPES = [
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
  'user-read-email',
].join(' ');

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    public readonly details: {
      status: number;
      method: string;
      path: string;
      body: string;
      headers: Record<string, string | null>;
    },
  ) {
    super(message);
    this.name = 'SpotifyApiError';
  }
}

// ─── Token helpers ────────────────────────────────────────────────────────────

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state,
    scope: SPOTIFY_SCOPES,
    show_dialog: 'true',
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<SpotifyTokens> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

const TOKEN_COOKIE_OPTS = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30,
};

/** Read tokens from cookies, refresh if needed. Returns null if not authenticated. */
export async function getValidTokens(): Promise<SpotifyTokens | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sp_access_token')?.value;
  const refreshToken = cookieStore.get('sp_refresh_token')?.value;
  const expiresAtStr = cookieStore.get('sp_expires_at')?.value;

  if (!accessToken || !refreshToken || !expiresAtStr) return null;

  const expiresAt = parseInt(expiresAtStr, 10);
  // Refresh 5 minutes early
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    try {
      const newTokens = await refreshAccessToken(refreshToken);
      // Persist refreshed tokens — works in Route Handlers, silently fails in RSC (that's fine)
      try {
        cookieStore.set('sp_access_token', newTokens.accessToken, TOKEN_COOKIE_OPTS);
        cookieStore.set('sp_refresh_token', newTokens.refreshToken, TOKEN_COOKIE_OPTS);
        cookieStore.set('sp_expires_at', String(newTokens.expiresAt), TOKEN_COOKIE_OPTS);
      } catch {
        // RSC render context — cookies can't be written here, next request will retry
      }
      return newTokens;
    } catch {
      return null;
    }
  }

  return { accessToken, refreshToken, expiresAt };
}

// ─── API calls ───────────────────────────────────────────────────────────────

async function spotifyFetch(path: string, token: string, opts?: RequestInit): Promise<Response> {
  const method = opts?.method?.toUpperCase() ?? 'GET';
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  return fetch(`https://api.spotify.com/v1${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(opts?.headers ?? {}),
    },
  });
}

function getDebugHeaders(res: Response): Record<string, string | null> {
  return {
    'www-authenticate': res.headers.get('www-authenticate'),
    'retry-after': res.headers.get('retry-after'),
    'spotify-request-id': res.headers.get('spotify-request-id'),
    'x-spotify-request-id': res.headers.get('x-spotify-request-id'),
    'x-request-id': res.headers.get('x-request-id'),
    'content-type': res.headers.get('content-type'),
  };
}

async function readSpotifyError(
  action: string,
  method: string,
  path: string,
  res: Response,
): Promise<SpotifyApiError> {
  const body = await res.text();
  return new SpotifyApiError(`${action}: ${res.status} ${body}`, {
    status: res.status,
    method,
    path,
    body,
    headers: getDebugHeaders(res),
  });
}

export async function getSpotifyUser(token: string): Promise<SpotifyUser> {
  const res = await spotifyFetch('/me', token);
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
  const data = await res.json();
  return {
    id: data.id,
    displayName: data.display_name ?? data.id,
    email: data.email ?? '',
  };
}

/** Search Spotify for tracks by a specific artist name, returns up to `limit` tracks. */
export async function searchTracksByArtist(
  artistName: string,
  token: string,
  limit = 5,
): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({
    q: `artist:${artistName}`,
    type: 'track',
    limit: String(Math.min(limit, 50)),
  });
  const res = await spotifyFetch(`/search?${params}`, token);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Search failed for "${artistName}": ${res.status} — ${body}`);
  }
  const data = await res.json();
  return (data.tracks?.items ?? []).map((track: {
    id: string;
    uri: string;
    name: string;
    artists: { id: string; name: string }[];
    duration_ms: number;
  }) => ({
    id: track.id,
    uri: track.uri,
    name: track.name,
    artists: track.artists.map((a) => ({ id: a.id, name: a.name })),
    primaryArtist: track.artists[0]?.name ?? '',
    durationMs: track.duration_ms,
    previewUrl: null,
  }));
}

export async function createPlaylist(
  name: string,
  description: string,
  trackUris: string[],
  token: string,
): Promise<{ id: string; url: string }> {
  // 1. Create playlist
  const createPath = '/me/playlists';
  const createRes = await spotifyFetch(createPath, token, {
    method: 'POST',
    body: JSON.stringify({ name, description, public: false }),
  });
  if (!createRes.ok) {
    throw await readSpotifyError('Failed to create playlist', 'POST', createPath, createRes);
  }
  const playlist = await createRes.json();

  // 2. Add tracks in batches of 100
  for (let i = 0; i < trackUris.length; i += 100) {
    const batch = trackUris.slice(i, i + 100);
    const addPath = `/playlists/${playlist.id}/items`;
    const addRes = await spotifyFetch(addPath, token, {
      method: 'POST',
      body: JSON.stringify({ uris: batch }),
    });
    if (!addRes.ok) {
      throw await readSpotifyError('Failed to add tracks', 'POST', addPath, addRes);
    }
  }

  return { id: playlist.id, url: playlist.external_urls?.spotify ?? '' };
}

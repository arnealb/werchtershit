import type { SpotifyTokens, SpotifyTrack, SpotifyUser } from '@/types/spotify';
import { cookies } from 'next/headers';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!;
const RW_PLAYLIST_ID = '63I9phrPUwQMKKBIjj52mU';

export const SPOTIFY_SCOPES = [
  'playlist-read-public',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-private',
  'user-read-email',
].join(' ');

// ─── Token helpers ────────────────────────────────────────────────────────────

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_SCOPES,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state,
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
      return await refreshAccessToken(refreshToken);
    } catch {
      return null;
    }
  }

  return { accessToken, refreshToken, expiresAt };
}

// ─── API calls ───────────────────────────────────────────────────────────────

async function spotifyFetch(path: string, token: string, opts?: RequestInit): Promise<Response> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts?.headers ?? {}),
    },
  });
  return res;
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

/** Fetch ALL tracks from a playlist, handling pagination */
export async function getPlaylistTracks(
  playlistId: string,
  token: string,
): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let url: string | null = `/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(id,uri,name,duration_ms,preview_url,artists(id,name)))`;

  while (url) {
    const res = await spotifyFetch(url, token);
    if (!res.ok) throw new Error(`Failed to fetch playlist: ${res.status}`);
    const data = await res.json();

    for (const item of data.items ?? []) {
      const track = item.track;
      if (!track || !track.id) continue;
      tracks.push({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artists: (track.artists ?? []).map((a: { id: string; name: string }) => ({
          id: a.id,
          name: a.name,
        })),
        primaryArtist: track.artists?.[0]?.name ?? '',
        durationMs: track.duration_ms,
        previewUrl: track.preview_url ?? null,
      });
    }

    // next is a full URL like https://api.spotify.com/v1/playlists/...
    if (data.next) {
      url = data.next.replace('https://api.spotify.com/v1', '');
    } else {
      url = null;
    }
  }

  return tracks;
}

export async function getRWPlaylistTracks(token: string): Promise<SpotifyTrack[]> {
  return getPlaylistTracks(RW_PLAYLIST_ID, token);
}

export async function createPlaylist(
  userId: string,
  name: string,
  description: string,
  trackUris: string[],
  token: string,
): Promise<{ id: string; url: string }> {
  // 1. Create playlist
  const createRes = await spotifyFetch(`/users/${userId}/playlists`, token, {
    method: 'POST',
    body: JSON.stringify({ name, description, public: false }),
  });
  if (!createRes.ok) throw new Error(`Failed to create playlist: ${createRes.status}`);
  const playlist = await createRes.json();

  // 2. Add tracks in batches of 100
  for (let i = 0; i < trackUris.length; i += 100) {
    const batch = trackUris.slice(i, i + 100);
    const addRes = await spotifyFetch(`/playlists/${playlist.id}/tracks`, token, {
      method: 'POST',
      body: JSON.stringify({ uris: batch }),
    });
    if (!addRes.ok) throw new Error(`Failed to add tracks: ${addRes.status}`);
  }

  return { id: playlist.id, url: playlist.external_urls?.spotify ?? '' };
}

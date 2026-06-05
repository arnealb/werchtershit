import type {
  SpotifyPlaylistSummary,
  SpotifyTokens,
  SpotifyTrack,
  SpotifyTrackCandidate,
  SpotifyUser,
} from '@/types/spotify';
import type { Artist } from '@/types/lineup';
import { cookies } from 'next/headers';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!;

export const SPOTIFY_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
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
  const safeLimit = limit <= 0 ? 50 : Math.max(1, Math.min(limit, 50));
  const params = new URLSearchParams({
    q: `artist:"${artistName}"`,
    type: 'track',
    market: 'BE',
    limit: String(safeLimit),
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
    popularity?: number;
    album?: { name?: string; release_date?: string };
  }) => ({
    id: track.id,
    uri: track.uri,
    name: track.name,
    artists: track.artists.map((a) => ({ id: a.id, name: a.name })),
    primaryArtist: track.artists[0]?.name ?? '',
    durationMs: track.duration_ms,
    previewUrl: null,
    popularity: track.popularity,
    albumName: track.album?.name,
    releaseDate: track.album?.release_date,
  }));
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function spotifyTrackFromApi(track: {
  id: string;
  uri: string;
  name: string;
  artists?: { id: string; name: string }[];
  duration_ms?: number;
  preview_url?: string | null;
  popularity?: number;
  album?: { name?: string; release_date?: string };
}): SpotifyTrack {
  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artists: (track.artists ?? []).map((a) => ({ id: a.id, name: a.name })),
    primaryArtist: track.artists?.[0]?.name ?? '',
    durationMs: track.duration_ms ?? 0,
    previewUrl: track.preview_url ?? null,
    popularity: track.popularity,
    albumName: track.album?.name,
    releaseDate: track.album?.release_date,
  };
}

async function searchSpotifyArtist(artistName: string, token: string): Promise<{ id: string; name: string } | null> {
  const params = new URLSearchParams({
    q: artistName,
    type: 'artist',
    market: 'BE',
    limit: '10',
  });
  const path = `/search?${params}`;
  const res = await spotifyFetch(path, token);
  if (!res.ok) {
    throw await readSpotifyError(`Failed to search artist "${artistName}"`, 'GET', path, res);
  }

  const data = await res.json();
  const artists = data.artists?.items ?? [];
  const normalizedName = normalizeName(artistName);
  return (
    artists.find((artist: { name: string }) => normalizeName(artist.name) === normalizedName) ??
    artists.find((artist: { name: string }) => normalizeName(artist.name).includes(normalizedName)) ??
    artists.find((artist: { name: string }) => normalizedName.includes(normalizeName(artist.name))) ??
    null
  );
}

async function getArtistTopTracks(artistId: string, token: string): Promise<SpotifyTrack[]> {
  const path = `/artists/${artistId}/top-tracks?market=BE`;
  const res = await spotifyFetch(path, token);
  if (!res.ok) {
    throw await readSpotifyError('Failed to fetch artist top tracks', 'GET', path, res);
  }

  const data = await res.json();
  return (data.tracks ?? []).map(spotifyTrackFromApi);
}

async function getRecentArtistAlbumTracks(
  artistId: string,
  token: string,
  maxAlbums = 4,
): Promise<SpotifyTrack[]> {
  const albumsPath = `/artists/${artistId}/albums?include_groups=album,single&market=BE&limit=10`;
  const albumsRes = await spotifyFetch(albumsPath, token);
  if (!albumsRes.ok) {
    throw await readSpotifyError('Failed to fetch artist albums', 'GET', albumsPath, albumsRes);
  }

  const albumData = await albumsRes.json();
  const albums = (albumData.items ?? [])
    .filter((album: { id?: string }) => album.id)
    .sort((a: { release_date?: string }, b: { release_date?: string }) =>
      String(b.release_date ?? '').localeCompare(String(a.release_date ?? '')),
    )
    .slice(0, maxAlbums);

  const albumTracks = await Promise.allSettled(
    albums.map(async (album: { id: string; name?: string; release_date?: string }) => {
      const tracksPath = `/albums/${album.id}/tracks?market=BE&limit=20`;
      const tracksRes = await spotifyFetch(tracksPath, token);
      if (!tracksRes.ok) {
        throw await readSpotifyError('Failed to fetch album tracks', 'GET', tracksPath, tracksRes);
      }
      const tracksData = await tracksRes.json();
      return (tracksData.items ?? []).map((track: {
        id: string;
        uri: string;
        name: string;
        artists?: { id: string; name: string }[];
        duration_ms?: number;
        preview_url?: string | null;
      }) => ({
        ...spotifyTrackFromApi({
          ...track,
          album: { name: album.name, release_date: album.release_date },
        }),
      }));
    }),
  );

  return albumTracks.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
}

export async function getArtistPrepCandidates(
  festivalArtist: Artist,
  token: string,
  existingUris = new Set<string>(),
): Promise<SpotifyTrackCandidate[]> {
  const spotifyArtist = await searchSpotifyArtist(festivalArtist.name, token);
  if (!spotifyArtist) return [];

  const sources = await Promise.allSettled([
    getArtistTopTracks(spotifyArtist.id, token),
    searchTracksByArtist(spotifyArtist.name, token, 10),
    getRecentArtistAlbumTracks(spotifyArtist.id, token),
  ]);
  const sourceNames = ['spotify_top_tracks', 'spotify_search', 'recent_release'] as const;
  const normalizedSpotifyArtistName = normalizeName(spotifyArtist.name);

  const byUri = new Map<string, SpotifyTrackCandidate>();
  const addTracks = (tracks: SpotifyTrack[], source: string) => {
    for (const track of tracks) {
      if (!track.uri) continue;
      if (!track.artists.some((artist) => normalizeName(artist.name) === normalizedSpotifyArtistName)) {
        continue;
      }

      const existing = byUri.get(track.uri);
      if (existing) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
        existing.popularity ??= track.popularity;
        existing.albumName ??= track.albumName;
        existing.releaseDate ??= track.releaseDate;
        continue;
      }

      byUri.set(track.uri, {
        ...track,
        festivalArtistId: festivalArtist.id,
        festivalArtistName: festivalArtist.name,
        spotifyArtistName: spotifyArtist.name,
        sources: [source],
        alreadyInPlaylist: existingUris.has(track.uri),
      });
    }
  };

  sources.forEach((result, index) => {
    const source = sourceNames[index];
    if (result.status === 'fulfilled') {
      addTracks(result.value, source);
      return;
    }

    console.warn('[spotify] Failed to build smart prep source', {
      festivalArtist: festivalArtist.name,
      spotifyArtist: spotifyArtist.name,
      source,
      error: String(result.reason),
    });
  });

  console.info('[spotify] Built prep candidates for artist', {
    festivalArtist: festivalArtist.name,
    spotifyArtist: spotifyArtist.name,
    candidateCount: byUri.size,
    sourceCounts: [...byUri.values()].reduce<Record<string, number>>((acc, track) => {
      for (const source of track.sources) acc[source] = (acc[source] ?? 0) + 1;
      return acc;
    }, {}),
  });

  return [...byUri.values()];
}

export async function getEditablePlaylists(token: string): Promise<SpotifyPlaylistSummary[]> {
  const user = await getSpotifyUser(token);
  const playlists: SpotifyPlaylistSummary[] = [];
  const seenPlaylistIds = new Set<string>();
  let path: string | null = '/me/playlists?limit=50';

  while (path) {
    const res = await spotifyFetch(path, token);
    if (!res.ok) {
      throw await readSpotifyError('Failed to fetch playlists', 'GET', path, res);
    }

    const data = await res.json();
    for (const playlist of data.items ?? []) {
      const isOwner = playlist.owner?.id === user.id;
      const collaborative = Boolean(playlist.collaborative);
      if (!isOwner || seenPlaylistIds.has(playlist.id)) continue;
      seenPlaylistIds.add(playlist.id);

      const trackCount =
        playlist.tracks?.total ??
        playlist.items?.total ??
        playlist.total_tracks ??
        playlist.totalTracks ??
        0;

      playlists.push({
        id: playlist.id,
        name: playlist.name,
        url: playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlist.id}`,
        trackCount,
        ownerName: playlist.owner?.display_name ?? playlist.owner?.id ?? '',
        isOwner,
        collaborative,
        public: playlist.public ?? null,
      });
    }

    path = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
  }

  return Promise.all(
    playlists.map(async (playlist) => ({
      ...playlist,
      trackCount:
        playlist.trackCount > 0
          ? playlist.trackCount
          : await getPlaylistItemCount(playlist.id, token),
    })),
  );
}

async function getPlaylistItemCount(playlistId: string, token: string): Promise<number> {
  const path = `/playlists/${playlistId}/items?limit=1&additional_types=track`;
  const res = await spotifyFetch(path, token);
  if (!res.ok) return 0;
  const data = await res.json();
  return data.total ?? 0;
}

export async function addTracksToPlaylist(
  playlistId: string,
  trackUris: string[],
  token: string,
): Promise<{ addedCount: number }> {
  const uniqueTrackUris = [...new Set(trackUris)];
  for (let i = 0; i < uniqueTrackUris.length; i += 100) {
    const batch = uniqueTrackUris.slice(i, i + 100);
    const addPath = `/playlists/${playlistId}/items`;
    const addRes = await spotifyFetch(addPath, token, {
      method: 'POST',
      body: JSON.stringify({ uris: batch }),
    });
    if (!addRes.ok) {
      throw await readSpotifyError('Failed to add tracks', 'POST', addPath, addRes);
    }
  }

  return { addedCount: uniqueTrackUris.length };
}

export async function getPlaylistTrackUris(
  playlistId: string,
  token: string,
): Promise<{ uris: Set<string>; ids: Set<string> }> {
  const uris = new Set<string>();
  const ids = new Set<string>();
  let path: string | null = `/playlists/${playlistId}/items?limit=100&additional_types=track`;

  while (path) {
    const res = await spotifyFetch(path, token);
    if (!res.ok) {
      throw await readSpotifyError('Failed to fetch playlist tracks', 'GET', path, res);
    }

    const data = await res.json();
    for (const item of data.items ?? []) {
      const track = item.track ?? item.item;
      if (!track) continue;
      if (track.uri) uris.add(track.uri);
      if (track.id) ids.add(track.id);
    }

    path = data.next ? data.next.replace('https://api.spotify.com/v1', '') : null;
  }

  return { uris, ids };
}

function trackIdFromUri(uri: string): string | null {
  const parts = uri.split(':');
  if (parts.length !== 3 || parts[0] !== 'spotify' || parts[1] !== 'track') return null;
  return parts[2] || null;
}

export async function addMissingTracksToPlaylist(
  playlistId: string,
  trackUris: string[],
  token: string,
): Promise<{ addedCount: number; skippedCount: number; requestedCount: number }> {
  const uniqueTrackUris = [...new Set(trackUris)];
  const existing = await getPlaylistTrackUris(playlistId, token);
  const missingUris = uniqueTrackUris.filter((uri) => {
    const trackId = trackIdFromUri(uri);
    return !existing.uris.has(uri) && (!trackId || !existing.ids.has(trackId));
  });

  if (missingUris.length > 0) {
    await addTracksToPlaylist(playlistId, missingUris, token);
  }

  return {
    addedCount: missingUris.length,
    skippedCount: uniqueTrackUris.length - missingUris.length,
    requestedCount: uniqueTrackUris.length,
  };
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
  await addTracksToPlaylist(playlist.id, trackUris, token);

  return { id: playlist.id, url: playlist.external_urls?.spotify ?? '' };
}

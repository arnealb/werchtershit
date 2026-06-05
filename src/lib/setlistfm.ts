/**
 * setlist.fm client — fetches what an artist actually played live recently.
 * Free API key: https://www.setlist.fm/settings/api
 * Rate limit on the free tier is ~2 req/sec, so all calls go through a
 * serialized queue with a fixed interval.
 */

const SETLISTFM_BASE = 'https://api.setlist.fm/rest/1.0';
const REQUEST_INTERVAL_MS = 600;
const MAX_SETLISTS = 20;

export interface LiveSong {
  name: string;
  /** In how many of the recent setlists this song appeared */
  playCount: number;
}

export function isSetlistFmConfigured(): boolean {
  return Boolean(process.env.SETLISTFM_API_KEY);
}

// Serialized request queue: each request waits for the previous one + interval
let queueTail: Promise<unknown> = Promise.resolve();

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(fn);
  queueTail = run
    .catch(() => undefined)
    .then(() => new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS)));
  return run;
}

async function setlistFmFetch(path: string): Promise<Response> {
  const apiKey = process.env.SETLISTFM_API_KEY;
  if (!apiKey) {
    throw new Error('SETLISTFM_API_KEY is not configured');
  }

  return throttled(() =>
    fetch(`${SETLISTFM_BASE}${path}`, {
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json',
      },
    }),
  );
}

function normalizeSongName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function findArtistMbid(artistName: string): Promise<string | null> {
  const params = new URLSearchParams({ artistName, p: '1', sort: 'relevance' });
  const res = await setlistFmFetch(`/search/artists?${params}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`setlist.fm artist search failed: ${res.status}`);
  }

  const data = await res.json();
  const artists: { mbid?: string; name?: string }[] = data.artist ?? [];
  const target = normalizeSongName(artistName);

  const exact = artists.find((a) => a.name && normalizeSongName(a.name) === target);
  return exact?.mbid ?? artists[0]?.mbid ?? null;
}

interface SetlistFmSet {
  song?: { name?: string }[];
}

interface SetlistFmSetlist {
  eventDate?: string;
  sets?: { set?: SetlistFmSet[] };
}

/**
 * Returns the songs an artist played across their most recent setlists,
 * sorted by play frequency. Returns [] when not configured, artist unknown,
 * or no recent setlists exist.
 */
export async function getRecentLiveSongs(artistName: string): Promise<LiveSong[]> {
  if (!isSetlistFmConfigured()) return [];

  try {
    const mbid = await findArtistMbid(artistName);
    if (!mbid) return [];

    const res = await setlistFmFetch(`/artist/${mbid}/setlists?p=1`);
    if (res.status === 404) return [];
    if (!res.ok) {
      throw new Error(`setlist.fm setlists fetch failed: ${res.status}`);
    }

    const data = await res.json();
    const setlists: SetlistFmSetlist[] = (data.setlist ?? []).slice(0, MAX_SETLISTS);

    const counts = new Map<string, LiveSong>();
    for (const setlist of setlists) {
      for (const set of setlist.sets?.set ?? []) {
        for (const song of set.song ?? []) {
          if (!song.name) continue;
          const key = normalizeSongName(song.name);
          if (!key) continue;

          const existing = counts.get(key);
          if (existing) {
            counts.set(key, { ...existing, playCount: existing.playCount + 1 });
          } else {
            counts.set(key, { name: song.name, playCount: 1 });
          }
        }
      }
    }

    return [...counts.values()].sort((a, b) => b.playCount - a.playCount);
  } catch (err) {
    // Live data is an enhancement, never a hard failure
    console.warn('[setlistfm] Failed to fetch live songs', {
      artist: artistName,
      error: String(err),
    });
    return [];
  }
}

export { normalizeSongName };

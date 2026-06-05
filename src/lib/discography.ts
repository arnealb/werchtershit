/**
 * Full-discography candidate source: every studio album + recent singles,
 * with popularity enriched via the batch /tracks endpoint (album-track
 * listings don't include popularity).
 */
import type { SpotifyTrack } from '@/types/spotify';
import { normalizeName, readSpotifyError, spotifyFetch, spotifyTrackFromApi } from './spotify';

const MAX_ALBUM_PAGES = 2; // 2 × 50 releases
const MAX_STUDIO_ALBUMS = 10;
const MAX_RECENT_SINGLES = 8;
const RECENT_SINGLE_YEARS = 3;
const MAX_TRACKS_TO_ENRICH = 250;
const MAX_CANDIDATES = 60;

interface AlbumSummary {
  id: string;
  name: string;
  releaseDate: string;
  group: string;
}

/** "Album (Deluxe Edition)" and "Album" should count as the same release. */
function albumDedupeKey(name: string): string {
  const normalized = normalizeName(name);
  const stripped = normalized
    .replace(/\b(deluxe|expanded|extended|remaster(ed)?|anniversary|special|bonus|tour) (edition|version)?\b.*$/, '')
    .replace(/\b(edition|version)\b.*$/, '')
    .trim();
  return stripped || normalized;
}

/** Live registrations rarely belong in a prep playlist of studio versions. */
function isLiveAlbum(name: string): boolean {
  return /\b(live (at|in|from|on)|unplugged|concert)\b/i.test(name);
}

async function fetchAllReleases(artistId: string, token: string): Promise<AlbumSummary[]> {
  const releases: AlbumSummary[] = [];

  for (let page = 0; page < MAX_ALBUM_PAGES; page++) {
    const path = `/artists/${artistId}/albums?include_groups=album,single&market=BE&limit=50&offset=${page * 50}`;
    const res = await spotifyFetch(path, token);
    if (!res.ok) {
      throw await readSpotifyError('Failed to fetch artist albums', 'GET', path, res);
    }

    const data = await res.json();
    const items: { id?: string; name?: string; release_date?: string; album_group?: string; album_type?: string }[] =
      data.items ?? [];

    for (const item of items) {
      if (!item.id || !item.name) continue;
      releases.push({
        id: item.id,
        name: item.name,
        releaseDate: item.release_date ?? '',
        group: item.album_group ?? item.album_type ?? 'album',
      });
    }

    if (!data.next) break;
  }

  return releases;
}

/** Dedupe editions, drop live albums, keep the original (earliest) release. */
function selectAlbums(releases: AlbumSummary[]): AlbumSummary[] {
  const byKey = new Map<string, AlbumSummary>();
  for (const release of releases) {
    if (isLiveAlbum(release.name)) continue;
    const key = `${release.group === 'single' ? 's' : 'a'}:${albumDedupeKey(release.name)}`;
    const existing = byKey.get(key);
    if (!existing || release.releaseDate < existing.releaseDate) {
      byKey.set(key, release);
    }
  }
  const deduped = [...byKey.values()];

  const studioAlbums = deduped
    .filter((release) => release.group !== 'single')
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));

  // Career spread: when an artist has many albums, keep newest + oldest halves
  const selectedAlbums =
    studioAlbums.length <= MAX_STUDIO_ALBUMS
      ? studioAlbums
      : [
          ...studioAlbums.slice(0, Math.ceil(MAX_STUDIO_ALBUMS / 2)),
          ...studioAlbums.slice(-Math.floor(MAX_STUDIO_ALBUMS / 2)),
        ];

  const recentCutoff = `${new Date().getFullYear() - RECENT_SINGLE_YEARS}`;
  const recentSingles = deduped
    .filter((release) => release.group === 'single' && release.releaseDate >= recentCutoff)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
    .slice(0, MAX_RECENT_SINGLES);

  return [...selectedAlbums, ...recentSingles];
}

async function fetchAlbumTrackIds(album: AlbumSummary, token: string): Promise<string[]> {
  const path = `/albums/${album.id}/tracks?market=BE&limit=50`;
  const res = await spotifyFetch(path, token);
  if (!res.ok) {
    throw await readSpotifyError('Failed to fetch album tracks', 'GET', path, res);
  }
  const data = await res.json();
  return (data.items ?? [])
    .map((track: { id?: string }) => track.id)
    .filter((id: string | undefined): id is string => Boolean(id));
}

/** Batch-fetch full track objects (incl. popularity) for up to 50 ids per call. */
async function enrichTracks(trackIds: string[], token: string): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];

  for (let i = 0; i < trackIds.length; i += 50) {
    const batch = trackIds.slice(i, i + 50);
    const path = `/tracks?ids=${batch.join(',')}&market=BE`;
    const res = await spotifyFetch(path, token);
    if (!res.ok) {
      throw await readSpotifyError('Failed to fetch track details', 'GET', path, res);
    }
    const data = await res.json();
    for (const track of data.tracks ?? []) {
      if (track) tracks.push(spotifyTrackFromApi(track));
    }
  }

  return tracks;
}

/**
 * Returns the most popular tracks across an artist's full discography
 * (studio albums + recent singles), deduped by song name so album/single
 * duplicates of the same song appear once.
 */
export async function getDiscographyTracks(artistId: string, token: string): Promise<SpotifyTrack[]> {
  const releases = await fetchAllReleases(artistId, token);
  const albums = selectAlbums(releases);

  const idResults = await Promise.allSettled(
    albums.map((album) => fetchAlbumTrackIds(album, token)),
  );
  const trackIds = [
    ...new Set(idResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))),
  ].slice(0, MAX_TRACKS_TO_ENRICH);

  const enriched = await enrichTracks(trackIds, token);

  // Same song on album + deluxe + single: keep the most popular version
  const bySongName = new Map<string, SpotifyTrack>();
  for (const track of enriched) {
    const key = normalizeName(track.name);
    if (!key) continue;
    const existing = bySongName.get(key);
    if (!existing || (track.popularity ?? 0) > (existing.popularity ?? 0)) {
      bySongName.set(key, track);
    }
  }

  return [...bySongName.values()]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, MAX_CANDIDATES);
}

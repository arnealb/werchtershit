/**
 * Builds the candidate track pool per festival artist for Smart Prep:
 *   - Spotify top tracks (live staples / hits)
 *   - Full discography by popularity (incl. classics)
 *   - Recent releases (new singles/albums)
 *   - setlist.fm: what the artist actually played live recently
 */
import type { Artist } from '@/types/lineup';
import type { SpotifyTrack, SpotifyTrackCandidate } from '@/types/spotify';
import { getArtistTopTracks, normalizeName, searchSpotifyArtist, searchTracksByArtist } from './spotify';
import { getDiscographyTracks } from './discography';
import { getRecentLiveSongs, normalizeSongName } from './setlistfm';

const MAX_CANDIDATES = 30;
const RECENT_RELEASE_MONTHS = 18;

function isRecentRelease(releaseDate?: string): boolean {
  if (!releaseDate) return false;
  const released = new Date(releaseDate);
  if (Number.isNaN(released.getTime())) return false;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RECENT_RELEASE_MONTHS);
  return released >= cutoff;
}

function candidateSortScore(candidate: SpotifyTrackCandidate): number {
  let score = candidate.popularity ?? 0;
  if (candidate.liveCount) score += 100 + candidate.liveCount * 5;
  if (candidate.sources.includes('spotify_top_tracks')) score += 50;
  if (candidate.sources.includes('recent_release')) score += 15;
  return score;
}

export async function getArtistPrepCandidates(
  festivalArtist: Artist,
  token: string,
  existingUris = new Set<string>(),
): Promise<SpotifyTrackCandidate[]> {
  const spotifyArtist = await searchSpotifyArtist(festivalArtist.name, token);
  if (!spotifyArtist) return [];

  const [topTracks, searchTracks, discographyTracks, liveSongs] = await Promise.allSettled([
    getArtistTopTracks(spotifyArtist.id, token),
    searchTracksByArtist(spotifyArtist.name, token, 10),
    getDiscographyTracks(spotifyArtist.id, token),
    getRecentLiveSongs(spotifyArtist.name),
  ]);

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
        const merged: SpotifyTrackCandidate = {
          ...existing,
          sources: existing.sources.includes(source)
            ? existing.sources
            : [...existing.sources, source],
          popularity: existing.popularity ?? track.popularity,
          albumName: existing.albumName ?? track.albumName,
          releaseDate: existing.releaseDate ?? track.releaseDate,
        };
        byUri.set(track.uri, merged);
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

  const spotifySources = [
    { result: topTracks, source: 'spotify_top_tracks' },
    { result: searchTracks, source: 'spotify_search' },
    { result: discographyTracks, source: 'discography' },
  ] as const;

  for (const { result, source } of spotifySources) {
    if (result.status === 'fulfilled') {
      addTracks(result.value, source);
    } else {
      console.warn('[prep-candidates] Source failed', {
        festivalArtist: festivalArtist.name,
        source,
        error: String(result.reason),
      });
    }
  }

  // Tag recent releases across all sources
  for (const [uri, candidate] of byUri) {
    if (isRecentRelease(candidate.releaseDate) && !candidate.sources.includes('recent_release')) {
      byUri.set(uri, { ...candidate, sources: [...candidate.sources, 'recent_release'] });
    }
  }

  // Match setlist.fm live songs against candidates by normalized song name
  if (liveSongs.status === 'fulfilled' && liveSongs.value.length > 0) {
    const playCountBySong = new Map(
      liveSongs.value.map((song) => [normalizeSongName(song.name), song.playCount]),
    );
    for (const [uri, candidate] of byUri) {
      const playCount = playCountBySong.get(normalizeSongName(candidate.name));
      if (playCount) {
        byUri.set(uri, {
          ...candidate,
          sources: [...candidate.sources, 'live_setlist'],
          liveCount: playCount,
        });
      }
    }
  }

  const candidates = [...byUri.values()]
    .sort((a, b) => candidateSortScore(b) - candidateSortScore(a))
    .slice(0, MAX_CANDIDATES);

  console.info('[prep-candidates] Built candidates', {
    festivalArtist: festivalArtist.name,
    spotifyArtist: spotifyArtist.name,
    candidateCount: candidates.length,
    liveMatches: candidates.filter((c) => c.sources.includes('live_setlist')).length,
    sourceCounts: candidates.reduce<Record<string, number>>((acc, track) => {
      for (const source of track.sources) acc[source] = (acc[source] ?? 0) + 1;
      return acc;
    }, {}),
  });

  return candidates;
}

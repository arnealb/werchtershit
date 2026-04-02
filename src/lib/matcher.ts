import type { MatchedArtist, SpotifyTrack } from '@/types/spotify';
import type { Artist } from '@/types/lineup';

/** Normalize a name for comparison */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    // Remove diacritics
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Common word replacements
    .replace(/\bfeat\b\.?/g, '')
    .replace(/\bft\b\.?/g, '')
    .replace(/\bvs\b\.?/g, '')
    .replace(/\band\b/g, '&')
    // Remove punctuation except & and space
    .replace(/[^\w\s&]/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/** Check if two artist names match */
export function artistNamesMatch(festivalName: string, spotifyName: string): boolean {
  const a = normalizeName(festivalName);
  const b = normalizeName(spotifyName);

  if (a === b) return true;

  // One contains the other (handles "fred again.." vs "fred again")
  if (a.length > 3 && b.includes(a)) return true;
  if (b.length > 3 && a.includes(b)) return true;

  // Split by & and check each part
  const aParts = a.split('&').map((p) => p.trim()).filter(Boolean);
  const bParts = b.split('&').map((p) => p.trim()).filter(Boolean);
  for (const ap of aParts) {
    for (const bp of bParts) {
      if (ap.length > 3 && bp.length > 3 && (ap === bp || ap.includes(bp) || bp.includes(ap))) {
        return true;
      }
    }
  }

  return false;
}

export interface MatchResult {
  matchedArtists: MatchedArtist[];
  unmatchedArtists: { id: string; name: string }[];
  totalTracks: number;
}

export function matchArtistsToTracks(
  selectedArtists: Artist[],
  playlistTracks: SpotifyTrack[],
  maxTracksPerArtist = 5,
): MatchResult {
  const matchedArtists: MatchedArtist[] = [];
  const unmatchedArtists: { id: string; name: string }[] = [];

  for (const festivalArtist of selectedArtists) {
    const matchingTracks: SpotifyTrack[] = [];
    let matchedSpotifyName: string | undefined;

    for (const track of playlistTracks) {
      // Check all artists on the track
      for (const spotifyArtist of track.artists) {
        if (artistNamesMatch(festivalArtist.name, spotifyArtist.name)) {
          matchingTracks.push(track);
          matchedSpotifyName = spotifyArtist.name;
          break;
        }
      }
    }

    // Deduplicate by track ID
    const seen = new Set<string>();
    const dedupedTracks = matchingTracks.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    const limitedTracks =
      maxTracksPerArtist > 0 ? dedupedTracks.slice(0, maxTracksPerArtist) : dedupedTracks;

    if (limitedTracks.length > 0) {
      matchedArtists.push({
        festivalArtistId: festivalArtist.id,
        festivalArtistName: festivalArtist.name,
        matched: true,
        matchedSpotifyName,
        tracks: limitedTracks,
      });
    } else {
      unmatchedArtists.push({ id: festivalArtist.id, name: festivalArtist.name });
      matchedArtists.push({
        festivalArtistId: festivalArtist.id,
        festivalArtistName: festivalArtist.name,
        matched: false,
        tracks: [],
      });
    }
  }

  const totalTracks = matchedArtists.reduce((sum, a) => sum + a.tracks.length, 0);
  return { matchedArtists, unmatchedArtists, totalTracks };
}

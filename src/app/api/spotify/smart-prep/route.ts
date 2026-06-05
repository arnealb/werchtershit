import { NextRequest, NextResponse } from 'next/server';
import { getLineupData } from '@/lib/lineup';
import { rankSmartPrepTracks } from '@/lib/openai';
import {
  getArtistPrepCandidates,
  getPlaylistTrackUris,
  getValidTokens,
  SpotifyApiError,
} from '@/lib/spotify';
import type { Artist } from '@/types/lineup';
import type { MatchedArtist, SpotifyTrackCandidate } from '@/types/spotify';

function scoreCandidate(track: SpotifyTrackCandidate): number {
  let score = track.popularity ?? 0;
  if (track.sources.includes('spotify_top_tracks')) score += 100;
  if (track.sources.includes('recent_release')) score += 25;
  if (track.sources.includes('spotify_search')) score += 10;
  if (track.alreadyInPlaylist) score -= 200;

  const releaseYear = Number(track.releaseDate?.slice(0, 4));
  if (Number.isFinite(releaseYear) && releaseYear >= 2024) score += 15;

  return score;
}

function fallbackPrepTracks(
  candidates: SpotifyTrackCandidate[],
  trackLimit: number,
): SpotifyTrackCandidate[] {
  return [...candidates]
    .sort((a, b) => scoreCandidate(b) - scoreCandidate(a))
    .slice(0, trackLimit)
    .map((track) => ({
      ...track,
      prepReason: track.sources.includes('spotify_top_tracks')
        ? 'Spotify top track and likely useful festival prep.'
        : track.sources.includes('recent_release')
          ? 'Recent release from this artist.'
          : 'Relevant Spotify match for this artist.',
    }));
}

export async function POST(request: NextRequest) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { artistIds, maxTracksPerArtist = 5, targetPlaylistId } = body as {
    artistIds: string[];
    maxTracksPerArtist?: number;
    targetPlaylistId?: string;
  };

  if (!artistIds || artistIds.length === 0) {
    return NextResponse.json({ error: 'No artists provided' }, { status: 400 });
  }

  try {
    const lineup = await getLineupData();
    const allArtists: Artist[] = lineup.flatMap((day) =>
      day.stages.flatMap((stage) => stage.artists),
    );
    const selectedArtists = allArtists.filter((artist) => artistIds.includes(artist.id));
    const trackLimit = maxTracksPerArtist <= 0
      ? Number.MAX_SAFE_INTEGER
      : Math.max(1, Math.min(maxTracksPerArtist, 50));

    if (selectedArtists.length === 0) {
      return NextResponse.json({ error: 'No matching artists found in lineup' }, { status: 400 });
    }

    console.info('[/api/spotify/smart-prep] Starting smart prep', {
      artistCount: selectedArtists.length,
      artistNames: selectedArtists.map((artist) => artist.name),
      maxTracksPerArtist: trackLimit === Number.MAX_SAFE_INTEGER ? 'all' : trackLimit,
      targetPlaylistId: targetPlaylistId ?? null,
    });

    const existingUris = targetPlaylistId
      ? (await getPlaylistTrackUris(targetPlaylistId, tokens.accessToken)).uris
      : new Set<string>();

    console.info('[/api/spotify/smart-prep] Loaded existing playlist tracks', {
      targetPlaylistId: targetPlaylistId ?? null,
      existingTrackCount: existingUris.size,
    });

    const candidateResults = await Promise.allSettled(
      selectedArtists.map(async (artist) => ({
        artist,
        candidates: await getArtistPrepCandidates(artist, tokens.accessToken, existingUris),
      })),
    );

    for (const [index, result] of candidateResults.entries()) {
      if (result.status === 'rejected') {
        const reason = result.reason;
        console.warn('[/api/spotify/smart-prep] Failed to build candidates for artist', {
          artist: selectedArtists[index]?.name,
          error: String(reason),
          spotify: reason instanceof SpotifyApiError ? reason.details : undefined,
        });
      }
    }

    const artistCandidates = candidateResults
      .filter((result): result is PromiseFulfilledResult<{ artist: Artist; candidates: SpotifyTrackCandidate[] }> =>
        result.status === 'fulfilled',
      )
      .map((result) => result.value)
      .filter(({ candidates }) => candidates.length > 0);

    console.info('[/api/spotify/smart-prep] Built candidate lists', {
      artistsWithCandidates: artistCandidates.length,
      artistsWithoutCandidates: selectedArtists.length - artistCandidates.length,
      candidates: artistCandidates.map(({ artist, candidates }) => ({
        artist: artist.name,
        total: candidates.length,
        alreadyInPlaylist: candidates.filter((track) => track.alreadyInPlaylist).length,
        sources: candidates.reduce<Record<string, number>>((acc, track) => {
          for (const source of track.sources) acc[source] = (acc[source] ?? 0) + 1;
          return acc;
        }, {}),
      })),
    });

    const byUri = new Map<string, SpotifyTrackCandidate>();
    for (const { candidates } of artistCandidates) {
      for (const candidate of candidates) byUri.set(candidate.uri, candidate);
    }

    let aiResult: Awaited<ReturnType<typeof rankSmartPrepTracks>>;
    try {
      const aiTrackLimit = trackLimit === Number.MAX_SAFE_INTEGER
        ? Math.max(...artistCandidates.map(({ candidates }) => candidates.length), 1)
        : trackLimit;

      aiResult = await rankSmartPrepTracks({
        maxTracksPerArtist: aiTrackLimit,
        artists: artistCandidates.map(({ artist, candidates }) => ({
          id: artist.id,
          name: artist.name,
          candidates,
        })),
      });
    } catch (error) {
      console.warn('[/api/spotify/smart-prep] OpenAI ranking failed, using fallback ranking', {
        error: String(error),
      });
      aiResult = { selections: [] };
    }

    console.info('[/api/spotify/smart-prep] OpenAI returned selections', {
      selectionCount: aiResult.selections.length,
      selections: aiResult.selections.map((selection) => ({
        festivalArtistId: selection.festivalArtistId,
        trackCount: selection.tracks.length,
      })),
    });

    const candidatesByArtistId = new Map(
      artistCandidates.map(({ artist, candidates }) => [artist.id, candidates]),
    );

    const matchedArtists: MatchedArtist[] = selectedArtists.map((artist) => {
      const selection = aiResult.selections.find((item) => item.festivalArtistId === artist.id);
      const tracks: SpotifyTrackCandidate[] = [];
      for (const track of selection?.tracks ?? []) {
        const candidate = byUri.get(track.uri);
        if (!candidate) continue;
        tracks.push({
          ...candidate,
          prepReason: track.reason,
        });
      }

      const finalTracks = tracks.length > 0
        ? tracks.slice(0, trackLimit)
        : fallbackPrepTracks(candidatesByArtistId.get(artist.id) ?? [], trackLimit);

      if (tracks.length === 0 && finalTracks.length > 0) {
        console.info('[/api/spotify/smart-prep] Used fallback ranking', {
          artist: artist.name,
          trackCount: finalTracks.length,
        });
      }

      return {
        festivalArtistId: artist.id,
        festivalArtistName: artist.name,
        matched: finalTracks.length > 0,
        matchedSpotifyName: finalTracks[0]?.spotifyArtistName,
        tracks: finalTracks,
      };
    });

    const unmatchedArtists = matchedArtists
      .filter((artist) => !artist.matched)
      .map((artist) => ({ id: artist.festivalArtistId, name: artist.festivalArtistName }));

    const totalTracks = new Set(matchedArtists.flatMap((artist) => artist.tracks.map((track) => track.uri))).size;
    const selectedDays = [...new Set(selectedArtists.map((artist) => artist.day))];

    console.info('[/api/spotify/smart-prep] Finished smart prep', {
      matchedArtists: matchedArtists.filter((artist) => artist.matched).length,
      unmatchedArtists: matchedArtists.filter((artist) => !artist.matched).length,
      totalTracks,
    });

    return NextResponse.json({
      matchedArtists,
      unmatchedArtists,
      totalTracks,
      selectedDays,
      mode: 'smart',
    });
  } catch (err) {
    if (err instanceof SpotifyApiError) {
      console.error('[/api/spotify/smart-prep] Spotify API error', err.details);
      return NextResponse.json({ error: err.message, spotify: err.details }, { status: err.details.status });
    }

    console.error('[/api/spotify/smart-prep] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

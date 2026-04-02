import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens, getRWPlaylistTracks } from '@/lib/spotify';
import { matchArtistsToTracks } from '@/lib/matcher';
import { getLineupData } from '@/lib/lineup';
import type { Artist } from '@/types/lineup';

export async function POST(request: NextRequest) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { artistIds, maxTracksPerArtist = 5 } = body as {
    artistIds: string[];
    maxTracksPerArtist?: number;
  };

  if (!artistIds || artistIds.length === 0) {
    return NextResponse.json({ error: 'No artists provided' }, { status: 400 });
  }

  try {
    // Get lineup data to resolve artist names
    const lineup = await getLineupData();
    const allArtists: Artist[] = lineup.flatMap((day) =>
      day.stages.flatMap((stage) => stage.artists),
    );
    const selectedArtists = allArtists.filter((a) => artistIds.includes(a.id));

    if (selectedArtists.length === 0) {
      return NextResponse.json({ error: 'No matching artists found in lineup' }, { status: 400 });
    }

    // Fetch official RW playlist
    const tracks = await getRWPlaylistTracks(tokens.accessToken);

    // Match
    const result = matchArtistsToTracks(selectedArtists, tracks, maxTracksPerArtist);

    // Determine selected days for description
    const selectedDays = [...new Set(selectedArtists.map((a) => a.day))];

    return NextResponse.json({
      matchedArtists: result.matchedArtists,
      unmatchedArtists: result.unmatchedArtists,
      totalTracks: result.totalTracks,
      selectedDays,
    });
  } catch (err) {
    console.error('[/api/spotify/playlist] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

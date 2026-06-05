import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens, searchTracksByArtist } from '@/lib/spotify';
import { getEventLineup } from '@/lib/events';
import type { MatchedArtist } from '@/types/spotify';
import { makeChronologicalComparator, type Artist } from '@/types/lineup';

export async function POST(request: NextRequest) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { artistIds, maxTracksPerArtist = 5, eventSlug } = body as {
    artistIds: string[];
    maxTracksPerArtist?: number;
    eventSlug?: string;
  };

  if (!artistIds || artistIds.length === 0) {
    return NextResponse.json({ error: 'No artists provided' }, { status: 400 });
  }

  try {
    const eventLineup = await getEventLineup(eventSlug);
    if (!eventLineup) {
      return NextResponse.json({ error: 'Event niet gevonden' }, { status: 404 });
    }
    const { lineup } = eventLineup;
    const allArtists: Artist[] = lineup.flatMap((day) =>
      day.stages.flatMap((stage) => stage.artists),
    );
    const selectedArtists = allArtists
      .filter((a) => artistIds.includes(a.id))
      .sort(makeChronologicalComparator(lineup));

    if (selectedArtists.length === 0) {
      return NextResponse.json({ error: 'No matching artists found in lineup' }, { status: 400 });
    }

    // Search tracks per artist in parallel
    const results = await Promise.allSettled(
      selectedArtists.map((artist) =>
        searchTracksByArtist(artist.name, tokens.accessToken, maxTracksPerArtist),
      ),
    );

    const matchedArtists: MatchedArtist[] = selectedArtists.map((artist, i) => {
      const result = results[i];
      const tracks = result.status === 'fulfilled' ? result.value : [];
      return {
        festivalArtistId: artist.id,
        festivalArtistName: artist.name,
        matched: tracks.length > 0,
        tracks,
      };
    });

    const unmatchedArtists = matchedArtists
      .filter((a) => !a.matched)
      .map((a) => ({ id: a.festivalArtistId, name: a.festivalArtistName }));

    const totalTracks = matchedArtists.reduce((sum, a) => sum + a.tracks.length, 0);
    const selectedDays = [...new Set(selectedArtists.map((a) => a.day))];

    return NextResponse.json({ matchedArtists, unmatchedArtists, totalTracks, selectedDays });
  } catch (err) {
    console.error('[/api/spotify/playlist] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

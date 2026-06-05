import { NextRequest, NextResponse } from 'next/server';
import {
  addMissingTracksToPlaylist,
  createPlaylist,
  getSpotifyUser,
  getValidTokens,
  searchTracksByArtist,
  SpotifyApiError,
  SPOTIFY_SCOPES,
} from '@/lib/spotify';
import { getEventLineup } from '@/lib/events';
import { recordPlaylistGeneration } from '@/lib/playlist-meta';
import { formatDayLabel, makeChronologicalComparator, type Artist } from '@/types/lineup';
import type { MatchedArtist } from '@/types/spotify';

export async function POST(request: NextRequest) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const {
    artistIds,
    maxTracksPerArtist = 5,
    targetPlaylistId,
    trackUris: explicitTrackUris,
    playlistName: requestedName,
    eventSlug,
    mode: requestedMode,
  } = body as {
    artistIds: string[];
    maxTracksPerArtist?: number;
    targetPlaylistId?: string;
    trackUris?: string[];
    playlistName?: string;
    eventSlug?: string;
    mode?: string;
  };

  if (!artistIds || artistIds.length === 0) {
    return NextResponse.json({ error: 'No artists provided' }, { status: 400 });
  }

  try {
    const eventLineup = await getEventLineup(eventSlug);
    if (!eventLineup) {
      return NextResponse.json({ error: 'Event niet gevonden' }, { status: 404 });
    }
    const { event, lineup } = eventLineup;
    const allArtists: Artist[] = lineup.flatMap((day) =>
      day.stages.flatMap((stage) => stage.artists),
    );
    const selectedArtists = allArtists
      .filter((a) => artistIds.includes(a.id))
      .sort(makeChronologicalComparator(lineup));

    let trackUris = [...new Set(explicitTrackUris ?? [])];
    if (trackUris.length === 0) {
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

      trackUris = [...new Set(matchedArtists.flatMap((a) => a.tracks.map((t) => t.uri)))];
    }

    if (trackUris.length === 0) {
      return NextResponse.json({ error: 'No tracks matched — nothing to add to playlist' }, { status: 400 });
    }

    const user = await getSpotifyUser(tokens.accessToken);

    const selectedDayKeys = [...new Set(selectedArtists.map((a) => a.day))];
    const selectedDays = lineup.filter((day) => selectedDayKeys.includes(day.day));
    const dayStr =
      selectedDays.length > 0 && selectedDays.length <= 2
        ? selectedDays.map((day) => formatDayLabel(day)).join(' & ')
        : 'Alle dagen';

    const customName = typeof requestedName === 'string' ? requestedName.trim().slice(0, 100) : '';
    const playlistName = customName || `${event.name} — Mijn selectie`;
    const description = `${event.name} | ${dayStr} | ${selectedArtists.length} artiesten, ${trackUris.length} nummers | Werchter Planner`;

    console.info('[/api/spotify/create] Saving selection to playlist', {
      spotifyUserId: user.id,
      selectedArtistCount: selectedArtists.length,
      trackCount: trackUris.length,
      selectedDays,
      playlistPublic: false,
      targetPlaylistId: targetPlaylistId ?? null,
      requestedScopes: SPOTIFY_SCOPES,
    });

    const generationBase = {
      spotifyUserId: user.id,
      eventSlug: event.slug,
      eventName: event.name,
      mode: (requestedMode === 'quick' ? 'quick' : 'smart') as 'smart' | 'quick',
      tracksPerArtist: maxTracksPerArtist,
      artistNames: selectedArtists.map((a) => a.name),
    };

    if (targetPlaylistId) {
      const addResult = await addMissingTracksToPlaylist(targetPlaylistId, trackUris, tokens.accessToken);
      await recordPlaylistGeneration({
        ...generationBase,
        playlistId: targetPlaylistId,
        addedTracks: addResult.addedCount,
      });
      return NextResponse.json({
        ok: true,
        playlistId: targetPlaylistId,
        playlistUrl: `https://open.spotify.com/playlist/${targetPlaylistId}`,
        totalTracks: addResult.addedCount,
        addedTracks: addResult.addedCount,
        skippedTracks: addResult.skippedCount,
        requestedTracks: addResult.requestedCount,
        mode: 'existing',
      });
    }

    const playlist = await createPlaylist(playlistName, description, trackUris, tokens.accessToken);
    await recordPlaylistGeneration({
      ...generationBase,
      playlistId: playlist.id,
      addedTracks: trackUris.length,
    });

    return NextResponse.json({
      ok: true,
      playlistId: playlist.id,
      playlistUrl: playlist.url,
      totalTracks: trackUris.length,
      addedTracks: trackUris.length,
      skippedTracks: 0,
      requestedTracks: trackUris.length,
      mode: 'new',
    });
  } catch (err) {
    if (err instanceof SpotifyApiError) {
      console.error('[/api/spotify/create] Spotify API error', err.details);
      return NextResponse.json(
        {
          error: err.message,
          spotify: err.details,
          requestedScopes: SPOTIFY_SCOPES,
        },
        { status: err.details.status },
      );
    }

    console.error('[/api/spotify/create] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

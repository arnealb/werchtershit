/**
 * Generation history: what the app put into which playlist (event, artists,
 * settings) so the playlists pages can show context per playlist.
 */
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase';

export interface PlaylistGeneration {
  playlistId: string;
  eventSlug: string;
  eventName: string;
  mode: 'smart' | 'quick';
  tracksPerArtist: number;
  artistNames: string[];
  addedTracks: number;
  createdAt: string;
}

export interface PlaylistGenerationSummary extends PlaylistGeneration {
  /** How many times the app generated into this playlist */
  generationCount: number;
  /** All artist names across generations (deduped) */
  allArtistNames: string[];
}

interface GenerationRow {
  playlist_id: string;
  event_slug: string;
  event_name: string;
  mode: string;
  tracks_per_artist: number;
  artist_names: unknown;
  added_tracks: number;
  created_at: string;
}

function rowToGeneration(row: GenerationRow): PlaylistGeneration {
  return {
    playlistId: row.playlist_id,
    eventSlug: row.event_slug,
    eventName: row.event_name,
    mode: row.mode === 'quick' ? 'quick' : 'smart',
    tracksPerArtist: row.tracks_per_artist,
    artistNames: Array.isArray(row.artist_names)
      ? row.artist_names.filter((name): name is string => typeof name === 'string')
      : [],
    addedTracks: row.added_tracks,
    createdAt: row.created_at,
  };
}

/** Record a generation (best effort — failures only log, never break saves). */
export async function recordPlaylistGeneration(input: {
  playlistId: string;
  spotifyUserId: string;
  eventSlug: string;
  eventName: string;
  mode: 'smart' | 'quick';
  tracksPerArtist: number;
  artistNames: string[];
  addedTracks: number;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('playlist_generations').insert({
      playlist_id: input.playlistId,
      spotify_user_id: input.spotifyUserId,
      event_slug: input.eventSlug,
      event_name: input.eventName,
      mode: input.mode,
      tracks_per_artist: Math.max(0, Math.min(input.tracksPerArtist, 100)),
      artist_names: input.artistNames.slice(0, 300),
      added_tracks: Math.max(0, input.addedTracks),
    });
    if (error) {
      console.error('[playlist-meta] Failed to record generation:', error.message);
    }
  } catch (err) {
    console.error('[playlist-meta] Failed to record generation:', err);
  }
}

/** Latest generation info per playlist for a user (newest generation wins). */
export async function getGenerationsByPlaylist(
  spotifyUserId: string,
): Promise<Map<string, PlaylistGenerationSummary>> {
  const result = new Map<string, PlaylistGenerationSummary>();
  if (!isSupabaseConfigured()) return result;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('playlist_generations')
      .select('playlist_id, event_slug, event_name, mode, tracks_per_artist, artist_names, added_tracks, created_at')
      .eq('spotify_user_id', spotifyUserId)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      console.error('[playlist-meta] Failed to load generations:', error.message);
      return result;
    }

    for (const row of (data ?? []) as GenerationRow[]) {
      const generation = rowToGeneration(row);
      const existing = result.get(generation.playlistId);
      if (!existing) {
        result.set(generation.playlistId, {
          ...generation,
          generationCount: 1,
          allArtistNames: [...generation.artistNames],
        });
      } else {
        result.set(generation.playlistId, {
          ...existing,
          generationCount: existing.generationCount + 1,
          allArtistNames: [
            ...new Set([...existing.allArtistNames, ...generation.artistNames]),
          ],
        });
      }
    }
  } catch (err) {
    console.error('[playlist-meta] Failed to load generations:', err);
  }

  return result;
}

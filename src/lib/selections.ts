import { getSupabaseAdmin, isSupabaseConfigured } from './supabase';

const MAX_SELECTION_SIZE = 500;

export interface UserSelection {
  artistIds: string[];
  updatedAt: string | null;
}

function isValidArtistIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_SELECTION_SIZE &&
    value.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 200)
  );
}

export const DEFAULT_EVENT_SLUG = 'rock-werchter-2026';

/** Load the saved artist selection for a Spotify user + event. Returns null when none saved. */
export async function getUserSelection(
  spotifyUserId: string,
  eventSlug: string = DEFAULT_EVENT_SLUG,
): Promise<UserSelection | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_selections')
    .select('artist_ids, updated_at')
    .eq('spotify_user_id', spotifyUserId)
    .eq('event_slug', eventSlug)
    .maybeSingle();

  if (error) {
    console.error('[selections] Failed to read selection:', error.message);
    return null;
  }
  if (!data || !isValidArtistIds(data.artist_ids)) return null;

  return { artistIds: data.artist_ids, updatedAt: data.updated_at ?? null };
}

/** Persist the artist selection for a Spotify user + event (upsert). */
export async function saveUserSelection(
  spotifyUserId: string,
  displayName: string,
  artistIds: unknown,
  eventSlug: string = DEFAULT_EVENT_SLUG,
): Promise<UserSelection> {
  if (!isValidArtistIds(artistIds)) {
    throw new Error(`artistIds must be an array of at most ${MAX_SELECTION_SIZE} strings`);
  }
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured — selections cannot be saved');
  }

  const updatedAt = new Date().toISOString();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('user_selections').upsert({
    spotify_user_id: spotifyUserId,
    event_slug: eventSlug,
    display_name: displayName,
    artist_ids: artistIds,
    updated_at: updatedAt,
  });

  if (error) {
    throw new Error(`Failed to save selection: ${error.message}`);
  }

  return { artistIds, updatedAt };
}

import type { LineupData } from '@/types/lineup';
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase';

export const BUILTIN_EVENT_SLUG = 'rock-werchter-2026';

export interface EventSummary {
  slug: string;
  name: string;
  location: string;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  artistCount: number;
  dayCount: number;
  createdBy: string;
}

export interface EventRecord extends EventSummary {
  lineup: LineupData;
}

interface EventRow {
  slug: string;
  name: string;
  location: string;
  start_date: string | null;
  end_date: string | null;
  image_url: string | null;
  created_by?: string;
  lineup: unknown;
}

function isValidLineup(value: unknown): value is LineupData {
  return Array.isArray(value);
}

function rowToRecord(row: EventRow): EventRecord {
  const lineup = isValidLineup(row.lineup) ? row.lineup : [];
  return {
    slug: row.slug,
    name: row.name,
    location: row.location ?? '',
    startDate: row.start_date,
    endDate: row.end_date,
    imageUrl: row.image_url,
    lineup,
    dayCount: lineup.length,
    artistCount: lineup.reduce(
      (sum, day) => sum + day.stages.reduce((s, stage) => s + stage.artists.length, 0),
      0,
    ),
    createdBy: row.created_by ?? '',
  };
}

/** Insert the built-in Rock Werchter event when the events table is still empty. */
async function ensureBuiltinEvent(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from('events')
    .select('slug', { count: 'exact', head: true });
  if (error) throw new Error(`Failed to count events: ${error.message}`);
  if ((count ?? 0) > 0) return;

  const { getLineupData } = await import('./lineup');
  const lineup = await getLineupData();
  const { error: insertError } = await supabase.from('events').upsert({
    slug: BUILTIN_EVENT_SLUG,
    name: 'Rock Werchter 2026',
    location: 'Werchter, België',
    start_date: lineup[0]?.date ?? '2026-07-02',
    end_date: lineup[lineup.length - 1]?.date ?? '2026-07-05',
    source_type: 'builtin',
    lineup,
  });
  if (insertError) throw new Error(`Failed to seed builtin event: ${insertError.message}`);
}

export async function listEvents(): Promise<EventSummary[]> {
  if (!isSupabaseConfigured()) {
    // Local dev without Supabase: only the built-in event exists
    const { getLineupData } = await import('./lineup');
    const lineup = await getLineupData();
    return [
      rowToRecord({
        slug: BUILTIN_EVENT_SLUG,
        name: 'Rock Werchter 2026',
        location: 'Werchter, België',
        start_date: lineup[0]?.date ?? null,
        end_date: lineup[lineup.length - 1]?.date ?? null,
        image_url: null,
        lineup,
      }),
    ];
  }

  await ensureBuiltinEvent();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('events')
    .select('slug, name, location, start_date, end_date, image_url, created_by, lineup')
    .order('start_date', { ascending: true });
  if (error) throw new Error(`Failed to list events: ${error.message}`);

  return (data ?? []).map((row) => rowToRecord(row as EventRow));
}

export async function getEvent(slug: string): Promise<EventRecord | null> {
  if (!isSupabaseConfigured()) {
    if (slug !== BUILTIN_EVENT_SLUG) return null;
    const events = await listEvents();
    return (events[0] as EventRecord) ?? null;
  }

  await ensureBuiltinEvent();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('events')
    .select('slug, name, location, start_date, end_date, image_url, created_by, lineup')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.error('[events] Failed to read event:', error.message);
    return null;
  }
  return data ? rowToRecord(data as EventRow) : null;
}

/** Lineup for an event; defaults to the built-in event for backwards compatibility. */
export async function getEventLineup(slug?: string): Promise<{ event: EventRecord; lineup: LineupData } | null> {
  const event = await getEvent(slug || BUILTIN_EVENT_SLUG);
  if (!event || event.lineup.length === 0) return null;
  return { event, lineup: event.lineup };
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function createEvent(input: {
  name: string;
  location: string;
  lineup: LineupData;
  sourceUrl?: string;
  sourceType: 'ai_url' | 'ai_screenshot' | 'ai_search';
  createdBy: string;
}): Promise<EventRecord> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured — events cannot be saved');
  }
  if (!input.name.trim()) throw new Error('Event name is required');
  if (!isValidLineup(input.lineup) || input.lineup.length === 0) {
    throw new Error('Event lineup is empty');
  }

  const supabase = getSupabaseAdmin();
  const baseSlug = slugify(input.name) || 'event';

  // Find a free slug (event, event-2, event-3, …)
  let slug = baseSlug;
  for (let attempt = 2; attempt < 20; attempt++) {
    const { data } = await supabase.from('events').select('slug').eq('slug', slug).maybeSingle();
    if (!data) break;
    slug = `${baseSlug}-${attempt}`;
  }

  const row = {
    slug,
    name: input.name.trim().slice(0, 120),
    location: input.location.trim().slice(0, 120),
    start_date: input.lineup[0]?.date || null,
    end_date: input.lineup[input.lineup.length - 1]?.date || null,
    source_url: input.sourceUrl?.slice(0, 500) ?? null,
    source_type: input.sourceType,
    created_by: input.createdBy,
    lineup: input.lineup,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('events').insert(row);
  if (error) throw new Error(`Failed to create event: ${error.message}`);

  return rowToRecord({ ...row, image_url: null });
}

/** Delete an event. Only the creator can delete; the built-in event is protected. */
export async function deleteEvent(slug: string, requesterId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }
  if (slug === BUILTIN_EVENT_SLUG) {
    throw new Error('Dit event kan niet verwijderd worden');
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('events')
    .select('created_by')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to read event: ${error.message}`);
  if (!data) throw new Error('Event niet gevonden');
  if (data.created_by !== requesterId) {
    throw new Error('Alleen wie het event toevoegde kan het verwijderen');
  }

  const { error: deleteError } = await supabase.from('events').delete().eq('slug', slug);
  if (deleteError) throw new Error(`Failed to delete event: ${deleteError.message}`);

  // Clean up selections for this event (best effort)
  await supabase.from('user_selections').delete().eq('event_slug', slug);
}

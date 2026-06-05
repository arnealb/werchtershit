import fs from 'fs/promises';
import path from 'path';
import type { LineupData } from '@/types/lineup';
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase';

const DATA_PATH = path.join(process.cwd(), 'data', 'lineup.json');
const LINEUP_CACHE_ID = 'rock-werchter-2026';

// Module-level cache so RSC renders + API calls don't hit Supabase on every request
let memoryCache: { data: LineupData; fetchedAt: number } | null = null;
const MEMORY_TTL_MS = 5 * 60 * 1000;

function isValidLineup(value: unknown): value is LineupData {
  return Array.isArray(value) && value.length > 0;
}

// ─── Supabase storage ─────────────────────────────────────────────────────────

async function readFromSupabase(): Promise<LineupData | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lineup_cache')
    .select('data')
    .eq('id', LINEUP_CACHE_ID)
    .maybeSingle();

  if (error) {
    console.error('[lineup] Failed to read lineup from Supabase:', error.message);
    return null;
  }
  if (!data || !isValidLineup(data.data)) return null;
  return data.data;
}

async function writeToSupabase(lineup: LineupData): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('lineup_cache').upsert({
    id: LINEUP_CACHE_ID,
    data: lineup,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to write lineup to Supabase: ${error.message}`);
  }
}

// ─── Local file storage (dev fallback) ────────────────────────────────────────

async function readFromFile(): Promise<LineupData | null> {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return isValidLineup(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeToFile(lineup: LineupData): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(lineup, null, 2), 'utf-8');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function readLineupCache(): Promise<LineupData | null> {
  if (memoryCache && Date.now() - memoryCache.fetchedAt < MEMORY_TTL_MS) {
    return memoryCache.data;
  }

  const data = isSupabaseConfigured()
    ? (await readFromSupabase()) ?? (await readFromFile())
    : await readFromFile();

  if (data) {
    memoryCache = { data, fetchedAt: Date.now() };
  }
  return data;
}

export async function writeLineupCache(data: LineupData): Promise<void> {
  if (!isValidLineup(data)) {
    throw new Error('Refusing to cache empty or invalid lineup data');
  }

  if (isSupabaseConfigured()) {
    await writeToSupabase(data);
  } else {
    await writeToFile(data);
  }
  memoryCache = { data, fetchedAt: Date.now() };
}

export async function getLineupData(): Promise<LineupData> {
  // Try cache first (memory → Supabase → local file)
  const cached = await readLineupCache();
  if (cached) return cached;

  // Scrape and cache
  const { scrapeFullLineup } = await import('./scraper');
  const data = await scrapeFullLineup();
  await writeLineupCache(data);
  return data;
}

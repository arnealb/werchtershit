import fs from 'fs/promises';
import path from 'path';
import type { LineupData } from '@/types/lineup';

const DATA_PATH = path.join(process.cwd(), 'data', 'lineup.json');

export async function readLineupCache(): Promise<LineupData | null> {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(raw) as LineupData;
  } catch {
    return null;
  }
}

export async function writeLineupCache(data: LineupData): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getLineupData(): Promise<LineupData> {
  // Try cache first
  const cached = await readLineupCache();
  if (cached && cached.length > 0) return cached;

  // Scrape and cache
  const { scrapeFullLineup } = await import('./scraper');
  const data = await scrapeFullLineup();
  await writeLineupCache(data);
  return data;
}

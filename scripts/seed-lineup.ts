/**
 * Upload the local data/lineup.json cache to Supabase so production
 * doesn't need to scrape on first load.
 *
 * Usage: npm run seed-lineup
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import fs from 'fs/promises';
import path from 'path';

async function loadEnvLocal(): Promise<void> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), '.env.local'), 'utf-8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
  } catch {
    // No .env.local — rely on the environment
  }
}

async function main(): Promise<void> {
  await loadEnvLocal();

  const { writeLineupCache } = await import('../src/lib/lineup');
  const { isSupabaseConfigured } = await import('../src/lib/supabase');

  if (!isSupabaseConfigured()) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first');
  }

  const raw = await fs.readFile(path.join(process.cwd(), 'data', 'lineup.json'), 'utf-8');
  const lineup = JSON.parse(raw);

  await writeLineupCache(lineup);
  console.log(`Seeded lineup to Supabase: ${lineup.length} days`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

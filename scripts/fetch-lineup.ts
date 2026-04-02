/**
 * Run this script to scrape and cache the Rock Werchter 2026 lineup:
 *   npx tsx scripts/fetch-lineup.ts
 *
 * The result is saved to data/lineup.json and used by the app on startup.
 */

import fs from 'fs/promises';
import path from 'path';

// We need to resolve paths relative to project root
const ROOT = path.join(import.meta.dirname ?? __dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'lineup.json');

async function main() {
  console.log('Fetching Rock Werchter 2026 lineup...\n');

  // Dynamically import from src (tsx handles TypeScript)
  const { scrapeFullLineup } = await import('../src/lib/scraper.js');
  const data = await scrapeFullLineup();

  const totalActs = data.reduce(
    (sum, day) => sum + day.stages.reduce((s, st) => s + st.artists.length, 0),
    0,
  );

  console.log(`\nScraped ${totalActs} acts across ${data.length} days`);
  data.forEach((day) => {
    const count = day.stages.reduce((s, st) => s + st.artists.length, 0);
    console.log(`  ${day.day}: ${count} acts`);
  });

  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`\nSaved to ${DATA_PATH}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

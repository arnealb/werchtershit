import { NextResponse } from 'next/server';
import { getLineupData } from '@/lib/lineup';

export async function GET() {
  try {
    const data = await getLineupData();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[/api/lineup] Error:', err);
    return NextResponse.json({ error: 'Failed to load lineup data' }, { status: 500 });
  }
}

// Trigger a fresh scrape, bypassing cache
export async function POST() {
  try {
    const { scrapeFullLineup } = await import('@/lib/scraper');
    const { writeLineupCache } = await import('@/lib/lineup');
    const data = await scrapeFullLineup();
    await writeLineupCache(data);
    return NextResponse.json({ ok: true, days: data.length });
  } catch (err) {
    console.error('[/api/lineup] Scrape error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

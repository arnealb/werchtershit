import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/spotify';
import {
  extractEventFromText,
  fetchEventPagesText,
  transformExtractedToLineup,
} from '@/lib/lineup-extract';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, hint } = body as { url?: unknown; hint?: unknown };
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(String(url));
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('bad protocol');
  } catch {
    return NextResponse.json({ error: 'Geef een geldige link (https://…)' }, { status: 400 });
  }

  try {
    const pageText = await fetchEventPagesText(parsedUrl.toString());
    if (pageText.length < 200) {
      return NextResponse.json(
        { error: 'Deze pagina bevat te weinig leesbare tekst. Probeer een screenshot.' },
        { status: 422 },
      );
    }

    const extracted = await extractEventFromText(
      pageText,
      typeof hint === 'string' ? hint.slice(0, 200) : undefined,
    );
    const lineup = transformExtractedToLineup(extracted);

    if (lineup.length === 0) {
      return NextResponse.json(
        { error: 'Geen timetable gevonden op deze pagina. Probeer een andere link of een screenshot.' },
        { status: 422 },
      );
    }

    return NextResponse.json({
      draft: { name: extracted.name, location: extracted.location, lineup },
      sourceUrl: parsedUrl.toString(),
    });
  } catch (err) {
    console.error('[/api/events/import-url] Error:', err);
    return NextResponse.json(
      { error: 'De pagina kon niet gelezen worden. Probeer een andere link of een screenshot.' },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/spotify';
import {
  extractEventFromImage,
  extractEventFromText,
  fetchEventPages,
  fetchPageScreenshot,
  transformExtractedToLineup,
  type ExtractedEvent,
} from '@/lib/lineup-extract';
import { lacksDayInfo, mergeVisionDays } from '@/lib/lineup-merge';

// Text extraction + optional vision fallback (pageshot render + Gemini vision)
// can take a while on big multi-day festivals
export const maxDuration = 120;

/**
 * When a big lineup lands on one day without times, the days are probably
 * only visible visually (dates baked into card images). Render a full-page
 * screenshot and let the vision model read the days, keeping the exact
 * artist names from the text extraction.
 */
async function refineWithVision(
  extracted: ExtractedEvent,
  pageUrl: string,
  hint: string | undefined,
): Promise<ExtractedEvent> {
  const screenshot = await fetchPageScreenshot(pageUrl);
  if (!screenshot) return extracted;
  try {
    const vision = await extractEventFromImage(screenshot, hint);
    return mergeVisionDays(extracted, vision);
  } catch (err) {
    console.error('[/api/events/import-url] Vision fallback failed:', err);
    return extracted;
  }
}

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

  const safeHint = typeof hint === 'string' ? hint.slice(0, 200) : undefined;

  try {
    const { text: pageText, mainUrl } = await fetchEventPages(parsedUrl.toString());
    if (pageText.length < 200) {
      return NextResponse.json(
        { error: 'Deze pagina bevat te weinig leesbare tekst. Probeer een screenshot.' },
        { status: 422 },
      );
    }

    let extracted = await extractEventFromText(pageText, safeHint);
    if (lacksDayInfo(extracted)) {
      extracted = await refineWithVision(extracted, mainUrl, safeHint);
    }
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

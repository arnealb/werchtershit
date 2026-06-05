import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/spotify';
import { extractEventFromImage, transformExtractedToLineup } from '@/lib/lineup-extract';

export const maxDuration = 60;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // ~8MB base64 payload

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

  const { imageDataUrl, hint } = body as { imageDataUrl?: unknown; hint?: unknown };
  if (
    typeof imageDataUrl !== 'string' ||
    !imageDataUrl.startsWith('data:image/') ||
    imageDataUrl.length > MAX_IMAGE_BYTES
  ) {
    return NextResponse.json(
      { error: 'Upload een afbeelding (PNG/JPG, max ±6MB)' },
      { status: 400 },
    );
  }

  try {
    const extracted = await extractEventFromImage(
      imageDataUrl,
      typeof hint === 'string' ? hint.slice(0, 200) : undefined,
    );
    const lineup = transformExtractedToLineup(extracted);

    if (lineup.length === 0) {
      return NextResponse.json(
        { error: 'Geen timetable herkend in deze afbeelding. Probeer een scherpere foto.' },
        { status: 422 },
      );
    }

    return NextResponse.json({
      draft: { name: extracted.name, location: extracted.location, lineup },
    });
  } catch (err) {
    console.error('[/api/events/import-image] Error:', err);
    return NextResponse.json(
      { error: 'De afbeelding kon niet gelezen worden. Probeer een scherpere foto.' },
      { status: 500 },
    );
  }
}

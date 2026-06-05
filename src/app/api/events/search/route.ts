import { NextRequest, NextResponse } from 'next/server';
import { getValidTokens } from '@/lib/spotify';
import { searchEventCandidates } from '@/lib/lineup-extract';

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

  const query = (body as { query?: unknown })?.query;
  if (typeof query !== 'string' || query.trim().length < 2 || query.length > 200) {
    return NextResponse.json({ error: 'query must be 2-200 characters' }, { status: 400 });
  }

  try {
    const candidates = await searchEventCandidates(query.trim());
    return NextResponse.json({ candidates });
  } catch (err) {
    console.error('[/api/events/search] Error:', err);
    return NextResponse.json({ error: 'Zoeken is mislukt. Probeer het opnieuw.' }, { status: 500 });
  }
}

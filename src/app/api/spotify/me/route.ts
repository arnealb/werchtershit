import { NextResponse } from 'next/server';
import { getValidTokens, getSpotifyUser } from '@/lib/spotify';

export async function GET() {
  const tokens = await getValidTokens();
  if (!tokens) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const user = await getSpotifyUser(tokens.accessToken);
    return NextResponse.json({ authenticated: true, user });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('sp_access_token');
  response.cookies.delete('sp_refresh_token');
  response.cookies.delete('sp_expires_at');
  return response;
}

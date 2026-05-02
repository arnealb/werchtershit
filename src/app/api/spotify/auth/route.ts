import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/spotify';
import crypto from 'crypto';

export async function GET() {
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = buildAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('sp_oauth_state', state, {
    httpOnly: true,
    maxAge: 60 * 10, // 10 minutes
    path: '/',
    sameSite: 'lax',
  });
  return response;
}

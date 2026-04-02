import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/spotify';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/planner?error=${encodeURIComponent(error)}`, request.url));
  }

  // Validate CSRF state
  const storedState = request.cookies.get('sp_oauth_state')?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(new URL('/planner?error=state_mismatch', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/planner?error=no_code', request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const response = NextResponse.redirect(new URL('/planner?spotify=connected', request.url));

    const cookieOpts = {
      httpOnly: true,
      path: '/',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    };

    response.cookies.set('sp_access_token', tokens.accessToken, cookieOpts);
    response.cookies.set('sp_refresh_token', tokens.refreshToken, cookieOpts);
    response.cookies.set('sp_expires_at', String(tokens.expiresAt), cookieOpts);
    response.cookies.delete('sp_oauth_state');

    return response;
  } catch (err) {
    console.error('[/api/spotify/callback] Error:', err);
    return NextResponse.redirect(new URL('/planner?error=token_exchange_failed', request.url));
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/spotify';

function appUrl(path: string): URL {
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error('SPOTIFY_REDIRECT_URI is not configured');
  }

  return new URL(path, new URL(redirectUri).origin);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(appUrl(`/planner?error=${encodeURIComponent(error)}`));
  }

  // Validate CSRF state
  const storedState = request.cookies.get('sp_oauth_state')?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(appUrl('/planner?error=state_mismatch'));
  }

  if (!code) {
    return NextResponse.redirect(appUrl('/planner?error=no_code'));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const response = NextResponse.redirect(appUrl('/planner?spotify=connected'));

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
    return NextResponse.redirect(appUrl('/planner?error=token_exchange_failed'));
  }
}

import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  if (host.startsWith('localhost')) {
    const url = request.url.replace('localhost', '127.0.0.1');
    return NextResponse.redirect(url, { status: 308 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

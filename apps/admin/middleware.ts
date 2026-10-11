import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();
  if (!request.cookies.has('weavia_admin_access') && !request.cookies.has('weavia_admin_refresh')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };

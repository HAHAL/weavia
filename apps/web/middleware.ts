import { NextResponse, type NextRequest } from 'next/server';

const DESKTOP_ORIGINS = new Set([
  'tauri://localhost',
  'http://localhost:1420',
  'http://127.0.0.1:1420',
  'http://localhost:3001',
]);

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigin = origin && DESKTOP_ORIGINS.has(origin) ? origin : undefined;
  const response =
    request.method === 'OPTIONS' ? new NextResponse(null, { status: 204 }) : NextResponse.next();
  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.headers.set('Vary', 'Origin');
  }
  return response;
}

export const config = {
  matcher: ['/api/auth/:path*', '/api/ai/:path*', '/api/admin/ai/:path*'],
};

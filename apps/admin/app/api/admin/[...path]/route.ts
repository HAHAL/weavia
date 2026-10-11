import { NextRequest, NextResponse } from 'next/server';

const backend = process.env.WEAVIA_BACKEND_URL ?? 'http://localhost:8080';
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' };

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin !== request.nextUrl.origin) return NextResponse.json({ message: 'Invalid origin' }, { status: 403 });
  }
  const path = (await context.params).path.map(encodeURIComponent).join('/');
  const url = `${backend}/api/admin/${path}${request.nextUrl.search}`;
  let access = request.cookies.get('weavia_admin_access')?.value;
  const refresh = request.cookies.get('weavia_admin_refresh')?.value;
  if (!access && !refresh) return NextResponse.json({ message: '请登录管理台' }, { status: 401 });
  const body = ['GET', 'HEAD'].includes(request.method) ? null : await request.text();
  const send = (token: string) => fetch(url, { method: request.method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body, cache: 'no-store' });
  let upstream = access ? await send(access) : undefined;
  let rotated: { accessToken: string; refreshToken: string } | undefined;
  if ((!upstream || upstream.status === 401) && refresh) {
    const response = await fetch(`${backend}/api/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }), cache: 'no-store' });
    if (response.ok) {
      rotated = (await response.json() as { data: { accessToken: string; refreshToken: string } }).data;
      access = rotated.accessToken;
      upstream = await send(access);
    }
  }
  if (!upstream) return NextResponse.json({ message: '登录已过期' }, { status: 401 });
  const result = new NextResponse(await upstream.text(), { status: upstream.status, headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' } });
  if (rotated) {
    result.cookies.set('weavia_admin_access', rotated.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
    result.cookies.set('weavia_admin_refresh', rotated.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 });
  }
  return result;
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

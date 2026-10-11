import { NextRequest, NextResponse } from 'next/server';

const backend = process.env.WEAVIA_BACKEND_URL ?? 'http://localhost:8080';
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' };

export async function POST(request: NextRequest) {
  const { email, password } = await request.json() as { email?: string; password?: string };
  if (!email || !password) return NextResponse.json({ message: '邮箱和密码不能为空' }, { status: 400 });
  const login = await fetch(`${backend}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, deviceInfo: { deviceName: 'WEAVIA Admin', platform: 'admin' } }),
    cache: 'no-store',
  });
  const body = await login.json() as { data?: { accessToken: string; refreshToken: string }; message?: string };
  if (!login.ok || !body.data) return NextResponse.json({ message: body.message ?? '登录失败' }, { status: login.status });
  const allowed = await fetch(`${backend}/api/admin/ai/catalog`, { headers: { authorization: `Bearer ${body.data.accessToken}` }, cache: 'no-store' });
  if (!allowed.ok) return NextResponse.json({ message: '该账户没有管理权限' }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set('weavia_admin_access', body.data.accessToken, { ...cookieOptions, maxAge: 15 * 60 });
  response.cookies.set('weavia_admin_refresh', body.data.refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 });
  return response;
}

export async function DELETE(request: NextRequest) {
  const refresh = request.cookies.get('weavia_admin_refresh')?.value;
  if (refresh) await fetch(`${backend}/api/auth/logout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: refresh }) }).catch(() => undefined);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('weavia_admin_access');
  response.cookies.delete('weavia_admin_refresh');
  return response;
}

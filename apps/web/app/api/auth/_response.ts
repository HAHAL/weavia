import { AuthError } from '@weavia/auth-core';

export function ok<T>(data: T) {
  return Response.json({ data });
}
export function failure(error: unknown) {
  if (error instanceof AuthError)
    return Response.json({ code: error.code, message: error.message }, { status: error.status });
  // Route handlers can be bundled separately, so class identity is not a safe
  // boundary for preserving a typed AuthError during development hot reloads.
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    const candidate = error as { code: string; message: string; status?: number };
    return Response.json(
      { code: candidate.code, message: candidate.message },
      { status: candidate.status ?? 400 },
    );
  }
  return Response.json({ code: 'UNKNOWN', message: '认证服务暂时不可用' }, { status: 500 });
}
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new AuthError('INVALID_TOKEN', '请求格式无效');
  }
}

import { AuthError } from '@weavia/auth-core';
import { authService } from '../_service';
import { failure, ok, readJson } from '../_response';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (typeof body.refreshToken !== 'string')
      throw new AuthError('REFRESH_FAILED', '缺少刷新令牌', 401);
    return ok(authService.refresh(body.refreshToken));
  } catch (error) {
    return failure(error);
  }
}

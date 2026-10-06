import { AuthError } from '@weavia/auth-core';
import { authService } from '../../_service';
import { failure, ok, readJson } from '../../_response';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (typeof body.loginSessionId !== 'string')
      throw new AuthError('INVALID_TOKEN', '缺少登录请求');
    return ok(await authService.authorizeDemo(body.loginSessionId));
  } catch (error) {
    return failure(error);
  }
}

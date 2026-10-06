import { AuthError } from '@weavia/auth-core';
import { authService } from '../_service';
import { failure, ok } from '../_response';

export async function GET(request: Request) {
  try {
    const header = request.headers.get('authorization');
    if (!header?.startsWith('Bearer ')) throw new AuthError('INVALID_TOKEN', '访问令牌缺失', 401);
    return ok(authService.me(header.slice(7)));
  } catch (error) {
    return failure(error);
  }
}

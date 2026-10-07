import { AuthError } from '@weavia/auth-core';
import { authService } from '../auth/_service';

export function authenticatedUser(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer '))
    throw new AuthError('INVALID_TOKEN', 'WEAVIA Access Token 缺失', 401);
  return authService.me(authorization.slice(7));
}

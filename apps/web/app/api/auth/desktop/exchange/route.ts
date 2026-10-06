import { AuthError } from '@weavia/auth-core';
import type { DeviceInfo } from '@weavia/shared';
import { authService } from '../../_service';
import { failure, ok, readJson } from '../../_response';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (typeof body.code !== 'string' || typeof body.state !== 'string' || !body.deviceInfo)
      throw new AuthError('INVALID_TOKEN', '授权交换参数不完整');
    return ok(await authService.exchange(body.code, body.state, body.deviceInfo as DeviceInfo));
  } catch (error) {
    return failure(error);
  }
}

import { authService } from '../_service';
import { ok, readJson } from '../_response';

export async function POST(request: Request) {
  const body = await readJson(request);
  authService.logout(typeof body.refreshToken === 'string' ? body.refreshToken : undefined);
  return ok({ loggedOut: true });
}

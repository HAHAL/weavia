import { authService } from '../../_service';
import { failure, ok, readJson } from '../../_response';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return ok(
      authService.createDesktopSession(
        typeof body.redirectUri === 'string' ? body.redirectUri : undefined,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}

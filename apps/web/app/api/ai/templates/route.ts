import { failure, ok } from '../../auth/_response';
import { authenticatedUser } from '../_auth';
import { promptTemplates } from '../../../../lib/ai/runtime';

export async function GET(request: Request) {
  try {
    authenticatedUser(request);
    return ok(promptTemplates);
  } catch (error) {
    return failure(error);
  }
}

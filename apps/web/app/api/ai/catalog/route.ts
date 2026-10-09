import { failure, ok } from '../../auth/_response';
import { authenticatedUser } from '../_auth';
import { modelCatalogFor } from '../../../../lib/ai/runtime';

export async function GET(request: Request) {
  try {
    return ok(modelCatalogFor(authenticatedUser(request)));
  } catch (error) {
    return failure(error);
  }
}

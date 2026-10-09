import type { AIEstimateRequest } from '@weavia/shared';
import { failure, ok } from '../../auth/_response';
import { authenticatedUser } from '../_auth';
import { estimateGeneration } from '../../../../lib/ai/runtime';

export async function POST(request: Request) {
  try {
    const user = authenticatedUser(request);
    return ok(estimateGeneration(user, (await request.json()) as AIEstimateRequest));
  } catch (error) {
    return failure(error);
  }
}

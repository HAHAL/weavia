import type { ImageGenerationRequest } from '@weavia/shared';
import { failure, ok } from '../../auth/_response';
import { authenticatedUser } from '../_auth';
import { aiGateway, aiRepository } from '../../../../lib/ai/runtime';

export async function POST(request: Request) {
  try {
    const user = authenticatedUser(request);
    const input = (await request.json()) as ImageGenerationRequest;
    return ok(await aiGateway.generateImage(user, input));
  } catch (error) {
    return failure(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = authenticatedUser(request);
    return ok(aiRepository.listTasks().filter((task) => task.userId === user.id));
  } catch (error) {
    return failure(error);
  }
}

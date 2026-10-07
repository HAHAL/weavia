import { failure, ok } from '../../../auth/_response';
import { authenticatedUser } from '../../_auth';
import { aiRepository } from '../../../../../lib/ai/runtime';
import { GatewayError } from '../../../../../lib/ai/gateway';

export async function GET(request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const user = authenticatedUser(request);
    const { taskId } = await context.params;
    const task = aiRepository.getTask(taskId);
    if (!task || task.userId !== user.id)
      throw new GatewayError('INVALID_REQUEST', '任务不存在', 404);
    return ok(task);
  } catch (error) {
    return failure(error);
  }
}

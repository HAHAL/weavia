import { aiRepository, sanitizedAdminSnapshot } from '../../../../../../lib/ai/runtime';
import { GatewayError } from '../../../../../../lib/ai/gateway';
import { failure, ok } from '../../../../auth/_response';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ providerId: string }> },
) {
  try {
    const { providerId } = await context.params;
    const provider = aiRepository.catalog.providers.find((item) => item.id === providerId);
    if (!provider) throw new GatewayError('INVALID_REQUEST', 'Provider 不存在', 404);
    const body = (await request.json()) as { enabled?: boolean };
    if (typeof body.enabled === 'boolean') provider.enabled = body.enabled;
    provider.updatedAt = new Date().toISOString();
    return ok(sanitizedAdminSnapshot());
  } catch (error) {
    return failure(error);
  }
}

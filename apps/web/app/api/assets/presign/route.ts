import type { AssetPresignRequest, AssetPresignResult } from '@weavia/shared';
import { AuthError } from '@weavia/auth-core';
import { failure } from '../../auth/_response';
import { authenticatedUser } from '../../ai/_auth';
import { localUploadToken, objectStorage } from '../../../../lib/storage/runtime';

const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxReferenceBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = authenticatedUser(request);
    const input = (await request.json()) as AssetPresignRequest;
    validate(input);
    const extension =
      input.contentType === 'image/png'
        ? 'png'
        : input.contentType === 'image/webp'
          ? 'webp'
          : 'jpg';
    const objectKey = `references/${user.id}/${input.assetId}.${extension}`;
    const ticket = await objectStorage.createUploadUrl({
      objectKey,
      contentType: input.contentType,
      size: input.size,
      expiresInSeconds: 600,
    });
    const uploadUrl = new URL(
      `/api/assets/upload/${localUploadToken(ticket.uploadUrl)}`,
      request.url,
    ).toString();
    const data: AssetPresignResult = { ...ticket, uploadUrl, requestId };
    return Response.json({ data, requestId });
  } catch (error) {
    const response = failure(error);
    response.headers.set('x-request-id', requestId);
    return response;
  }
}

function validate(input: AssetPresignRequest) {
  if (!input.assetId || !/^[0-9a-f-]{8,64}$/i.test(input.assetId))
    throw new AuthError('INVALID_TOKEN', 'assetId 无效', 400);
  if (!allowedMimeTypes.has(input.contentType))
    throw new AuthError('INVALID_TOKEN', '仅支持 PNG、JPG 和 WEBP 参考图', 415);
  if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > maxReferenceBytes)
    throw new AuthError('INVALID_TOKEN', '参考图必须小于或等于 5 MB', 413);
}

import { apiRequest } from './api';
import { loadAssetPreview } from './assets';
import type { Asset } from '../types';

export type UploadedReference = { assetId: string; objectKey: string; mimeType: string };

export async function uploadReferenceAsset(asset: Asset): Promise<UploadedReference> {
  const dataUrl = await loadAssetPreview(asset);
  const blob = await (await fetch(dataUrl)).blob();
  if (blob.size > 5 * 1024 * 1024) throw new Error('参考图不能超过 5 MB');
  const response = await apiRequest<{ uploadUrl: string; objectKey: string }>('/api/assets/presign', {
    method: 'POST',
    body: JSON.stringify({ assetId: asset.id, contentType: asset.mime, size: blob.size }),
  });
  const upload = await fetch(response.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': asset.mime } });
  if (!upload.ok) throw new Error('参考图上传失败');
  return { assetId: asset.id, objectKey: response.objectKey, mimeType: asset.mime };
}

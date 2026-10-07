import type { CloudAIOutput, LocalAsset } from '@weavia/shared';
import { describe, expect, it, vi } from 'vitest';
import { ReferenceAssetTransport } from './asset-transport';

const asset: LocalAsset = {
  id: 'asset-1',
  projectId: 'project-1',
  type: 'image',
  source: 'imported',
  fileName: 'product.png',
  relativePath: 'assets/originals/product.png',
  mimeType: 'image/png',
  fileSize: 3,
  hash: 'hash',
  role: 'REFERENCE_IMAGE',
  uploadStatus: 'LOCAL',
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
};

function setup() {
  const states: string[] = [];
  const upload = vi.fn(async () => undefined);
  const transport = new ReferenceAssetTransport({
    readDataUrl: async () => 'data:image/png;base64,AQID',
    presign: async () => ({
      uploadUrl: 'http://localhost/api/assets/upload/token',
      objectKey: 'references/user/asset-1.png',
      expiresAt: '2026-10-07T00:10:00.000Z',
      requestId: 'request-1',
    }),
    upload,
    markUpload: async (_id, status) => {
      states.push(status);
    },
  });
  return { transport, upload, states };
}

describe('ReferenceAssetTransport', () => {
  it('uploads a selected reference and returns only a storage reference', async () => {
    const { transport, upload, states } = setup();
    const prepared = await transport.prepareInput(asset);
    await expect(transport.resolveProviderInput(prepared)).resolves.toEqual({
      assetId: asset.id,
      objectKey: 'references/user/asset-1.png',
      mimeType: 'image/png',
    });
    expect(upload).toHaveBeenCalledOnce();
    expect(states).toEqual(['PENDING', 'UPLOADED']);
  });

  it('requires the reference role and enforces the size limit', async () => {
    const { transport } = setup();
    await expect(transport.prepareInput({ ...asset, role: 'INPUT' })).rejects.toThrow('设为参考图');
    await expect(
      transport.prepareInput({ ...asset, fileSize: 5 * 1024 * 1024 + 1 }),
    ).rejects.toThrow('5 MB');
  });

  it('resolves URL or base64 provider output', async () => {
    const { transport } = setup();
    const output: CloudAIOutput = {
      temporaryUrl: 'https://example.test/result.png',
      mimeType: 'image/png',
    };
    await expect(transport.resolveResult(output)).resolves.toBe(output.temporaryUrl);
  });
});

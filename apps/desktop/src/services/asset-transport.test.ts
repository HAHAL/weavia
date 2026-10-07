import type { CloudAIOutput, LocalAsset } from '@weavia/shared';
import { describe, expect, it } from 'vitest';
import { DevLocalAssetTransport } from './asset-transport';

const asset: LocalAsset = {
  id: 'asset-1',
  projectId: 'project-1',
  type: 'image',
  source: 'imported',
  fileName: 'product.png',
  relativePath: 'assets/originals/product.png',
  mimeType: 'image/png',
  fileSize: 1024,
  hash: 'hash',
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
};

describe('DevLocalAssetTransport', () => {
  it('prepares a bounded local image without exposing file contents', async () => {
    const transport = new DevLocalAssetTransport();
    await expect(transport.prepareInput(asset)).resolves.toEqual({
      assetId: asset.id,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      localRelativePath: asset.relativePath,
    });
  });

  it('rejects oversized development assets', async () => {
    const transport = new DevLocalAssetTransport();
    await expect(
      transport.prepareInput({ ...asset, fileSize: 5 * 1024 * 1024 + 1 }),
    ).rejects.toThrow('5 MB');
  });

  it('resolves URL or base64 provider output', async () => {
    const transport = new DevLocalAssetTransport();
    const output: CloudAIOutput = {
      temporaryUrl: 'https://example.test/result.png',
      mimeType: 'image/png',
    };
    await expect(transport.resolveResult(output)).resolves.toBe(output.temporaryUrl);
  });
});

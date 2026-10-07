import { describe, expect, it } from 'vitest';
import { LocalMockStorage } from './index';

describe('LocalMockStorage', () => {
  it('creates an upload URL, validates the upload and deletes the object', async () => {
    const storage = new LocalMockStorage(() => Date.parse('2026-10-07T00:00:00Z'));
    const ticket = await storage.createUploadUrl({
      objectKey: 'references/user/asset.png',
      contentType: 'image/png',
      size: 3,
    });
    await storage.upload(ticket.uploadUrl, new Uint8Array([1, 2, 3]), 'image/png');
    expect(storage.getMetadata(ticket.objectKey)).toMatchObject({ size: 3 });
    expect(await storage.createDownloadUrl(ticket.objectKey)).toContain('localmock://download/');
    await storage.delete(ticket.objectKey);
    expect(storage.getMetadata(ticket.objectKey)).toBeUndefined();
  });

  it('rejects an expired upload URL', async () => {
    let now = Date.parse('2026-10-07T00:00:00Z');
    const storage = new LocalMockStorage(() => now);
    const ticket = await storage.createUploadUrl({
      objectKey: 'references/user/expired.png',
      contentType: 'image/png',
      size: 1,
      expiresInSeconds: 1,
    });
    now += 2_000;
    await expect(
      storage.upload(ticket.uploadUrl, new Uint8Array([1]), 'image/png'),
    ).rejects.toThrow('expired');
  });
});

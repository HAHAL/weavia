import { LocalMockStorage } from '@weavia/storage-core';

const globalStorage = globalThis as typeof globalThis & {
  __weaviaLocalMockStorage?: LocalMockStorage;
};

export const objectStorage = (globalStorage.__weaviaLocalMockStorage ??= new LocalMockStorage());

export function localUploadToken(uploadUrl: string) {
  const url = new URL(uploadUrl);
  if (url.protocol !== 'localmock:' || url.hostname !== 'upload')
    throw new Error('Unsupported development upload URL');
  return url.pathname.slice(1);
}

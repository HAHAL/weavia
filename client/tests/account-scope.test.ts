import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
  get length() { return this.map.size; }
  key(index: number) { return [...this.map.keys()][index] ?? null; }
}

function installDom(): MemoryStorage {
  const storage = new MemoryStorage();
  const fakeWindow = { localStorage: storage, dispatchEvent: () => true, addEventListener: () => undefined };
  (globalThis as unknown as { window: unknown }).window = fakeWindow;
  (globalThis as unknown as { localStorage: unknown }).localStorage = storage;
  return storage;
}

function product(id: string) {
  return { id, name: `商品 ${id}`, category: '美妆', sku: `SKU-${id}`, description: '', createdAt: '2026-10-23T00:00:00.000Z' };
}

async function load() {
  const app = await import('../src/stores/app');
  const account = await import('../src/stores/account');
  return { useApp: app.useApp, ...account };
}

describe('账号隔离', () => {
  beforeEach(() => {
    vi.resetModules();
    installDom();
  });

  it('A 账号的商品不会出现在 B 账号的会话里', async () => {
    const { useApp, enterAccountScope, leaveAccountScope } = await load();

    enterAccountScope('user-a');
    useApp.getState().addProduct(product('a1'));
    expect(useApp.getState().products).toHaveLength(1);

    leaveAccountScope();
    expect(useApp.getState().products).toHaveLength(0);

    enterAccountScope('user-b');
    expect(useApp.getState().products).toHaveLength(0);

    enterAccountScope('user-a');
    expect(useApp.getState().products.map(item => item.id)).toEqual(['a1']);
  });

  it('登出后再登录同一账号能恢复自己的数据', async () => {
    const { useApp, enterAccountScope, leaveAccountScope } = await load();
    enterAccountScope('user-a');
    useApp.getState().addWork({ id: 'w1', title: '主图', mode: 'image', taskId: 't1', versions: [], source: 'live' });
    leaveAccountScope();
    expect(useApp.getState().works).toHaveLength(0);
    enterAccountScope('user-a');
    expect(useApp.getState().works).toHaveLength(1);
  });

  it('旧版全局数据只归给第一个登录的账号', async () => {
    const storage = installDom();
    storage.setItem('weavia.state.v1', JSON.stringify({
      state: { products: [product('legacy')], assets: [], tasks: [], works: [], avatars: {} },
      version: 1,
    }));
    const { useApp, enterAccountScope } = await load();

    enterAccountScope('user-a');
    expect(useApp.getState().products.map(item => item.id)).toEqual(['legacy']);

    enterAccountScope('user-b');
    expect(useApp.getState().products).toHaveLength(0);
  });
});

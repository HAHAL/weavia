import { apiRequest, isLiveMode } from './api';
import { useApp } from '../stores/app';
import { log } from '../lib/logger';
import type { Product } from '../types';

type ServerProduct = { localId: string; data: Product; deleted: boolean; updatedAt: string };

let unsubscribe: (() => void) | null = null;
let syncedFor = '';

function push(product: Product, deleted = false) {
  void apiRequest(`/api/me/products/${encodeURIComponent(product.id)}`, { method: 'PUT', body: JSON.stringify({ data: product, deleted, updatedAt: new Date().toISOString() }) })
    .catch(() => log('error', 'product.sync_push'));
}

// Pull the cloud copy, merge it into this device, then push every later local
// change. The source image stays on the device that added it; another device
// shows the product and asks for the image again before generating.
export async function startProductSync(userId: string) {
  if (!isLiveMode() || syncedFor === userId) return;
  syncedFor = userId;
  unsubscribe?.();
  unsubscribe = null;
  try {
    const data = await apiRequest<{ items: ServerProduct[] }>('/api/me/products');
    const remote = data.items || [];
    const local = useApp.getState().products;
    const localIds = new Set(local.map(item => item.id));
    const removed = new Set(remote.filter(item => item.deleted).map(item => item.localId));
    const added = remote.filter(item => !item.deleted && !localIds.has(item.localId)).map(item => ({ ...item.data, sourceAssetId: useApp.getState().assets.some(asset => asset.id === item.data.sourceAssetId) ? item.data.sourceAssetId : undefined }));
    if (added.length || removed.size) useApp.setState({ products: [...added, ...local.filter(item => !removed.has(item.id))] });
    const remoteIds = new Set(remote.map(item => item.localId));
    useApp.getState().products.filter(item => !remoteIds.has(item.id)).forEach(item => push(item));
  } catch {
    log('error', 'product.sync_pull');
  }
  unsubscribe = useApp.subscribe((state, previous) => {
    if (state.products === previous.products) return;
    const before = new Map(previous.products.map(item => [item.id, item]));
    const after = new Set(state.products.map(item => item.id));
    state.products.forEach(item => { if (before.get(item.id) !== item) push(item); });
    previous.products.forEach(item => { if (!after.has(item.id)) push(item, true); });
  });
}

export function stopProductSync() {
  unsubscribe?.();
  unsubscribe = null;
  syncedFor = '';
}

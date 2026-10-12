'use client';

import { useEffect, useState } from 'react';
import { apiGet, type Asset } from '../../lib/workbench';

export function useAssetPreviews(assets: Asset[], limit = 24) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    const images = assets.filter((asset) => asset.mimeType.startsWith('image/')).slice(0, limit);
    void Promise.allSettled(images.map(async (asset) => ({ id: asset.id, preview: (await apiGet<{ dataUrl: string }>(`/assets/${asset.id}/preview`)).dataUrl }))).then((results) => {
      if (!active) return;
      const next: Record<string, string> = {};
      for (const result of results) if (result.status === 'fulfilled') next[result.value.id] = result.value.preview;
      setPreviews(next);
    });
    return () => { active = false; };
  }, [assets, limit]);
  return previews;
}

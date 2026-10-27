import { useEffect, useState } from 'react';
import { useApp } from '../stores/app';
import { loadAssetPreview } from '../services/assets';
import type { Asset } from '../types';

type Resolved = { asset: Asset; url: string };

/**
 * Resolve a work version to a displayable URL without storing base64 in the
 * works snapshot. New versions reference an asset id; old versions may still
 * carry a dataUrl and are shown as-is.
 */
export function useAssetPreview(assetId?: string, dataUrl?: string) {
  const asset = useApp(state => (assetId ? state.assets.find(item => item.id === assetId) : undefined));
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const url = dataUrl ?? (resolved && resolved.asset === asset ? resolved.url : undefined);

  useEffect(() => {
    if (dataUrl || !asset) return;
    let active = true;
    let objectUrl: string | undefined;
    loadAssetPreview(asset)
      .then(next => {
        if (!active) {
          if (next.startsWith('blob:')) URL.revokeObjectURL(next);
          return;
        }
        if (next.startsWith('blob:')) objectUrl = next;
        setResolved({ asset, url: next });
      })
      .catch(() => { if (active) setResolved({ asset, url: '' }); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset, dataUrl]);

  return { url: url || undefined, missing: Boolean(assetId) && (!asset || (resolved?.asset===asset&&!resolved.url)) };
}

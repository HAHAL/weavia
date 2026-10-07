import { useEffect, useState } from 'react';
import type { LocalAsset } from '@weavia/shared';
import { localData } from '../services/local-data';

export function AssetThumbnail({
  asset,
  alt = asset.fileName,
}: {
  asset: LocalAsset;
  alt?: string;
}) {
  const [source, setSource] = useState<string>();
  useEffect(() => {
    let active = true;
    void localData.assetDataUrl(asset.id).then((value) => {
      if (active) setSource(value);
    });
    return () => {
      active = false;
    };
  }, [asset.id]);
  return source ? <img src={source} alt={alt} /> : <span className="asset-loading">W</span>;
}

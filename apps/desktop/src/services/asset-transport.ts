import type { CloudAIOutput, LocalAsset } from '@weavia/shared';

const MAX_DEV_INPUT_BYTES = 5 * 1024 * 1024;

export interface PreparedAssetInput {
  assetId: string;
  mimeType: string;
  fileSize: number;
  localRelativePath: string;
}

export interface AssetTransport {
  prepareInput(asset: LocalAsset): Promise<PreparedAssetInput>;
  resolveProviderInput(input: PreparedAssetInput): Promise<undefined>;
  resolveResult(output: CloudAIOutput): Promise<string>;
  cleanup(input: PreparedAssetInput): Promise<void>;
}

/**
 * Phase 2A development transport. It validates and associates the selected local
 * asset with the workflow, but deliberately does not upload it: Ant Digital's
 * image-input contract has not yet been verified. The provider request remains
 * text-to-image until that contract is confirmed.
 */
export class DevLocalAssetTransport implements AssetTransport {
  async prepareInput(asset: LocalAsset): Promise<PreparedAssetInput> {
    if (asset.type !== 'image' || !asset.mimeType.startsWith('image/')) {
      throw new Error('专业图片生成仅支持图片素材');
    }
    if (asset.fileSize <= 0 || asset.fileSize > MAX_DEV_INPUT_BYTES) {
      throw new Error('开发模式输入图片必须小于或等于 5 MB');
    }
    return {
      assetId: asset.id,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      localRelativePath: asset.relativePath,
    };
  }

  async resolveProviderInput(input: PreparedAssetInput): Promise<undefined> {
    void input;
    return undefined;
  }

  async resolveResult(output: CloudAIOutput): Promise<string> {
    const source = output.temporaryUrl ?? output.base64Data;
    if (!source) throw new Error('AI 服务未返回可下载结果');
    return source;
  }

  async cleanup(input: PreparedAssetInput): Promise<void> {
    void input;
  }
}

export const devLocalAssetTransport = new DevLocalAssetTransport();

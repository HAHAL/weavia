import type {
  AssetPresignResult,
  CloudAIOutput,
  LocalAsset,
  ReferenceAssetInput,
} from '@weavia/shared';

const MAX_REFERENCE_BYTES = 5 * 1024 * 1024;

export interface PreparedAssetInput {
  assetId: string;
  mimeType: string;
  fileSize: number;
  localRelativePath: string;
}

export interface ReferenceTransportDependencies {
  readDataUrl(assetId: string): Promise<string>;
  presign(input: {
    assetId: string;
    contentType: string;
    size: number;
  }): Promise<AssetPresignResult>;
  upload(uploadUrl: string, body: Blob, contentType: string): Promise<void>;
  markUpload(
    assetId: string,
    status: LocalAsset['uploadStatus'],
    remoteReferenceId?: string,
    expiresAt?: string,
  ): Promise<unknown>;
}

export interface AssetTransport {
  prepareInput(asset: LocalAsset): Promise<PreparedAssetInput>;
  resolveProviderInput(input: PreparedAssetInput): Promise<ReferenceAssetInput>;
  resolveResult(output: CloudAIOutput): Promise<string>;
  cleanup(input: PreparedAssetInput): Promise<void>;
}

export class ReferenceAssetTransport implements AssetTransport {
  constructor(private readonly dependencies: ReferenceTransportDependencies) {}

  async prepareInput(asset: LocalAsset): Promise<PreparedAssetInput> {
    if (asset.role !== 'REFERENCE_IMAGE') throw new Error('请先将商品素材设为参考图');
    if (asset.type !== 'image' || !asset.mimeType.startsWith('image/'))
      throw new Error('专业图片生成仅支持图片素材');
    if (asset.fileSize <= 0 || asset.fileSize > MAX_REFERENCE_BYTES)
      throw new Error('参考图必须小于或等于 5 MB');
    return {
      assetId: asset.id,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      localRelativePath: asset.relativePath,
    };
  }

  async resolveProviderInput(input: PreparedAssetInput): Promise<ReferenceAssetInput> {
    await this.dependencies.markUpload(input.assetId, 'PENDING');
    try {
      const [dataUrl, ticket] = await Promise.all([
        this.dependencies.readDataUrl(input.assetId),
        this.dependencies.presign({
          assetId: input.assetId,
          contentType: input.mimeType,
          size: input.fileSize,
        }),
      ]);
      const body = dataUrlToBlob(dataUrl);
      if (body.size !== input.fileSize || body.type !== input.mimeType)
        throw new Error('本地参考图内容与素材元数据不一致');
      await this.dependencies.upload(ticket.uploadUrl, body, input.mimeType);
      await this.dependencies.markUpload(
        input.assetId,
        'UPLOADED',
        ticket.objectKey,
        ticket.expiresAt,
      );
      return { assetId: input.assetId, objectKey: ticket.objectKey, mimeType: input.mimeType };
    } catch (error) {
      await this.dependencies.markUpload(input.assetId, 'FAILED');
      throw error;
    }
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

export function dataUrlToBlob(dataUrl: string) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match?.[1] || !match[2]) throw new Error('本地参考图数据格式无效');
  const binary = atob(match[2].replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}

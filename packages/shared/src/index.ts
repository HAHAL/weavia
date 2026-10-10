export type EntityId = string;
export type IsoDateTime = string;

export interface User {
  id: EntityId;
  email: string;
  name?: string;
  avatarUrl?: string;
  status: 'active' | 'disabled' | 'pending_verification';
}

export type PlanCode = 'free' | 'pro' | 'studio' | 'agency';
export type MembershipStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';

export interface Plan {
  id: EntityId;
  code: PlanCode;
  name: string;
  billingCycle: 'none' | 'monthly' | 'yearly';
  includedCredits: number;
  maxDevices: number;
  maxConcurrency: number;
  entitlements: Record<string, boolean | number | string>;
}

export interface Membership {
  id: EntityId;
  userId: EntityId;
  plan: Plan;
  status: MembershipStatus;
  startsAt: IsoDateTime;
  expiresAt?: IsoDateTime;
}

export interface CreditsWallet {
  userId: EntityId;
  available: number;
  frozen: number;
  lifetimeConsumed: number;
  currency: 'credits';
}

export type CreditsTransactionType =
  'topup' | 'reserve' | 'consume' | 'release' | 'refund' | 'admin_adjustment';

export interface CreditsTransaction {
  id: EntityId;
  walletId: EntityId;
  type: CreditsTransactionType;
  availableDelta: number;
  frozenDelta: number;
  referenceType: 'task' | 'order' | 'membership' | 'admin';
  referenceId: EntityId;
  idempotencyKey: string;
  createdAt: IsoDateTime;
}

export interface CostEstimate {
  credits: number;
  providerCostMinor?: number;
  currency?: string;
  pricingVersion: string;
}

export interface CreditsService {
  estimate(input: {
    capability: AICapability;
    quality: Quality;
    outputCount: number;
  }): Promise<CostEstimate>;
  reserve(taskId: EntityId, credits: number, idempotencyKey: string): Promise<CreditsTransaction>;
  settle(taskId: EntityId, deliveredOutputs: number): Promise<CreditsTransaction[]>;
  release(taskId: EntityId): Promise<CreditsTransaction>;
}

export type AuthStatus =
  | 'unauthenticated'
  | 'starting'
  | 'waiting_browser'
  | 'exchanging'
  | 'authenticated'
  | 'refreshing'
  | 'error';
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: IsoDateTime;
  tokenType: 'Bearer';
}
export type AuthErrorCode =
  | 'NETWORK_ERROR'
  | 'SESSION_EXPIRED'
  | 'AUTH_CODE_EXPIRED'
  | 'AUTH_CODE_USED'
  | 'INVALID_STATE'
  | 'INVALID_CALLBACK'
  | 'INVALID_TOKEN'
  | 'REFRESH_FAILED'
  | 'USER_CANCELLED'
  | 'DEVICE_ERROR'
  | 'UNKNOWN';
export interface AuthErrorShape {
  code: AuthErrorCode;
  message: string;
}
export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
  osVersion: string;
  appVersion: string;
}
export interface Device extends DeviceInfo {
  userId: EntityId;
  createdAt: IsoDateTime;
  lastSeenAt: IsoDateTime;
}
export interface DesktopAuthRequest {
  state: string;
  redirectUri: string;
  deviceId: string;
}
export interface DesktopAuthResult {
  code: string;
  state: string;
}
export interface DesktopLoginSession {
  loginSessionId: string;
  state: string;
  loginUrl: string;
  expiresAt: IsoDateTime;
}
export interface AuthSessionResult extends AuthTokens {
  user: User;
  device: Device;
}

export type LocalProjectStatus = 'active' | 'archived';
export interface LocalProject {
  id: EntityId;
  name: string;
  description: string;
  status: LocalProjectStatus;
  localRootPath: string;
  thumbnailAssetId?: EntityId;
  projectVersion: number;
  assetCount: number;
  taskCount: number;
  resultCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  lastOpenedAt: IsoDateTime;
}

export type LocalAssetType = 'image' | 'video';
export type LocalAssetSource = 'imported' | 'generated';
export type AssetRole = 'INPUT' | 'REFERENCE_IMAGE' | 'GENERATED_RESULT';
export type AssetUploadStatus = 'LOCAL' | 'PENDING' | 'UPLOADED' | 'FAILED' | 'EXPIRED';
export interface LocalAsset {
  id: EntityId;
  projectId: EntityId;
  type: LocalAssetType;
  source: LocalAssetSource;
  fileName: string;
  relativePath: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  hash: string;
  role: AssetRole;
  uploadStatus: AssetUploadStatus;
  remoteReferenceId?: string;
  expiresAt?: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface LocalTaskRecord {
  id: EntityId;
  projectId: EntityId;
  workflow: 'ai_model' | 'ai_commercial';
  status:
    | 'pending'
    | 'queued'
    | 'uploading'
    | 'running'
    | 'downloading'
    | 'reconciling'
    | 'success'
    | 'failed'
    | 'cancelled';
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: { code: string; message: string };
  progress: number;
  createdAt: IsoDateTime;
  startedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface GeneratedResult {
  id: EntityId;
  projectId: EntityId;
  taskId: EntityId;
  assetId: EntityId;
  type: LocalAssetType;
  relativePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: IsoDateTime;
}

export type LogicalModelKey = 'weavia-image-pro' | (string & {});
export type AIWorkflow = 'ai_model' | 'ai_commercial' | 'product_image_generation';
export type ImageGenerationMode = 'text_to_image' | 'image_to_image' | 'image_edit';
export type GenerationQualityLevel = 'fast' | 'standard' | 'professional' | 'flagship';
export interface AIModelCatalogItem {
  id: string;
  name: string;
  capabilities: Array<'image_generation' | 'reference_image' | 'image_edit' | 'high_quality_image'>;
  creditsCost: number;
  enabled: boolean;
  qualityLevel: GenerationQualityLevel;
  advanced: boolean;
}
export interface AIModelCatalogResult {
  models: AIModelCatalogItem[];
  professionalAccess: boolean;
}
export interface AIEstimateRequest {
  workflow: AIWorkflow;
  model: string;
  imageCount: number;
  advancedSelection?: boolean;
}
export interface AIEstimateResult {
  credits: number;
  estimatedTime: number;
  model: string;
}
export interface PromptTemplate {
  id: string;
  category: string;
  scene: string;
  style: string;
  prompt: string;
  negativePrompt: string;
  supportedModels: string[];
}
export interface ReferenceAssetInput {
  assetId: EntityId;
  objectKey: string;
  mimeType: string;
}
export interface AssetPresignRequest {
  assetId: EntityId;
  contentType: string;
  size: number;
}
export interface AssetPresignResult {
  uploadUrl: string;
  objectKey: string;
  expiresAt: IsoDateTime;
  requestId: string;
}
export type CloudAITaskStatus =
  'pending' | 'reserved' | 'running' | 'success' | 'cancelled' | 'download_pending' | 'local_saved' | 'failed';
export type AIGatewayErrorCode =
  | 'AUTH_FAILED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_RATE_LIMITED'
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_MODEL'
  | 'CONTENT_REJECTED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'GENERATION_FAILED'
  | 'RESULT_EXPIRED'
  | 'CONCURRENCY_LIMIT'
  | 'CANCELLED'
  | 'REAL_AI_DISABLED'
  | 'UNSUPPORTED_CAPABILITY'
  | 'UNKNOWN';
export interface ImageGenerationRequest {
  idempotencyKey: string;
  workspaceId?: EntityId;
  projectId: EntityId;
  productId?: EntityId;
  skuId?: EntityId;
  inputAssetId: EntityId;
  workflow: AIWorkflow;
  logicalModel: LogicalModelKey;
  model?: string;
  prompt: string;
  mode: ImageGenerationMode;
  referenceAssets?: ReferenceAssetInput[];
  size: '1024x1024';
  quality: Quality;
  numberOfImages: 1;
  outputFormat: 'png';
  metadata?: Record<string, string | number | boolean>;
}
export interface CloudAIOutput {
  temporaryUrl?: string;
  base64Data?: string;
  mimeType: string;
  width?: number;
  height?: number;
}
export interface CloudAITaskResult {
  id: EntityId;
  userId: EntityId;
  idempotencyKey: string;
  workflow: AIWorkflow;
  logicalModel: LogicalModelKey;
  workspaceId?: EntityId;
  productId?: EntityId;
  skuId?: EntityId;
  creditReservationId?: EntityId;
  provider?: string;
  model?: string;
  cost?: number;
  status: CloudAITaskStatus;
  outputs: CloudAIOutput[];
  providerRequestId?: string;
  error?: { code: AIGatewayErrorCode; message: string };
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type AICapability =
  | 'image_generation'
  | 'image_to_image'
  | 'image_edit'
  | 'image_to_video'
  | 'text_to_video'
  | 'upscale'
  | 'background_remove';
export type Quality = 'fast' | 'standard' | 'high';
export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface AIModelWorkflowInput {
  productImageUri: string;
  modelTemplateId: string;
  pose: string;
  background: string;
  aspectRatio: AspectRatio;
  quality: Quality;
  outputCount: number;
}

export interface AICommercialWorkflowInput {
  productImageUri: string;
  sceneTemplateId: string;
  style: string;
  composition: string;
  aspectRatio: AspectRatio;
  quality: Quality;
  outputCount: number;
}

export interface GenerationWorkflow<TInput> {
  kind: 'ai_model' | 'ai_commercial';
  validate(input: TInput): Promise<{ valid: boolean; issues: string[] }>;
  estimate(input: TInput): Promise<CostEstimate>;
  submit(input: TInput): Promise<{ taskId: EntityId }>;
}

export const mockWallet: CreditsWallet = {
  userId: 'demo-user',
  available: 12850,
  frozen: 0,
  lifetimeConsumed: 3200,
  currency: 'credits',
};

import type {
  AuthErrorCode,
  AuthSessionResult,
  DesktopLoginSession,
  DeviceInfo,
  User,
  CloudAITaskResult,
  ImageGenerationRequest,
  AssetPresignRequest,
  AssetPresignResult,
  AIEstimateRequest,
  AIEstimateResult,
  AIModelCatalogResult,
  PromptTemplate,
} from '@weavia/shared';

export interface ApiErrorBody {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}
export interface ApiResponse<T> {
  data: T;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getAccessToken?: () => Promise<string | undefined>,
  ) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = await this.getAccessToken?.();
    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    const body = (await response.json()) as ApiResponse<T> | ApiErrorBody;
    if (!response.ok)
      throw new ApiError(
        'code' in body ? body.code : 'UNKNOWN',
        'message' in body ? body.message : `Request failed: ${response.status}`,
        response.status,
      );
    return body as ApiResponse<T>;
  }
}

export interface SessionView { id:string; deviceId:string; deviceName:string; platform:string; current:boolean; createdAt:string; lastActiveAt?:string; revokedAt?:string; revokedReason?:string }
export interface DeletionRequest { id:string; userId:string; status:string; requestedAt:string; reviewedAt?:string; reviewReason?:string }
export interface AuthApi {
  requestRegistration?(email: string, password: string, name: string): Promise<{requestId:string;expiresInSeconds:number}>;
  verifyRegistration?(email:string,code:string,deviceInfo?:Partial<DeviceInfo>):Promise<AuthSessionResult>;
  requestPasswordReset?(email:string):Promise<void>;
  confirmPasswordReset?(email:string,code:string,newPassword:string):Promise<void>;
  listSessions?():Promise<SessionView[]>;
  revokeSession?(id:string):Promise<void>;
  revokeAllSessions?():Promise<void>;
  requestDeletion?(reason:string):Promise<DeletionRequest>;
  currentDeletion?():Promise<DeletionRequest|null>;
  login?(email: string, password: string, deviceInfo?: Partial<DeviceInfo>): Promise<AuthSessionResult>;
  createDesktopSession(redirectUri: string): Promise<DesktopLoginSession>;
  exchange(code: string, state: string, deviceInfo: DeviceInfo): Promise<AuthSessionResult>;
  refresh(refreshToken: string): Promise<AuthSessionResult>;
  logout(refreshToken?: string): Promise<void>;
  me(): Promise<User>;
}

export class AuthApiClient implements AuthApi {
  constructor(private readonly client: ApiClient) {}
  async requestRegistration(email:string,password:string,name:string){return (await this.client.request<{requestId:string;expiresInSeconds:number}>('auth/registration-requests',{method:'POST',body:JSON.stringify({email,password,name})})).data;}
  async verifyRegistration(email:string,code:string,deviceInfo:Partial<DeviceInfo>={}){return (await this.client.request<AuthSessionResult>('auth/email-verifications/verify',{method:'POST',body:JSON.stringify({email,code,deviceInfo})})).data;}
  async requestPasswordReset(email:string){await this.client.request('auth/password-reset/request',{method:'POST',body:JSON.stringify({email})});}
  async confirmPasswordReset(email:string,code:string,newPassword:string){await this.client.request('auth/password-reset/confirm',{method:'POST',body:JSON.stringify({email,code,newPassword})});}
  async listSessions(){return (await this.client.request<SessionView[]>('auth/sessions')).data;}
  async revokeSession(id:string){await this.client.request(`auth/sessions/${encodeURIComponent(id)}`,{method:'DELETE'});}
  async revokeAllSessions(){await this.client.request('auth/sessions/revoke-all',{method:'POST'});}
  async requestDeletion(reason:string){return (await this.client.request<DeletionRequest>('me/deletion-requests',{method:'POST',body:JSON.stringify({reason})})).data;}
  async currentDeletion(){return (await this.client.request<DeletionRequest|null>('me/deletion-requests/current')).data;}
  async login(email: string, password: string, deviceInfo: Partial<DeviceInfo> = {}) {
    return (await this.client.request<AuthSessionResult>('auth/login', { method: 'POST', body: JSON.stringify({ email, password, deviceInfo }) })).data;
  }
  async createDesktopSession(redirectUri: string) {
    return (
      await this.client.request<DesktopLoginSession>('auth/desktop/session', {
        method: 'POST',
        body: JSON.stringify({ redirectUri }),
      })
    ).data;
  }
  async exchange(code: string, state: string, deviceInfo: DeviceInfo) {
    return (
      await this.client.request<AuthSessionResult>('auth/desktop/exchange', {
        method: 'POST',
        body: JSON.stringify({ code, state, deviceInfo }),
      })
    ).data;
  }
  async refresh(refreshToken: string) {
    return (
      await this.client.request<AuthSessionResult>('auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      })
    ).data;
  }
  async logout(refreshToken?: string) {
    await this.client.request('auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }
  async me() {
    return (await this.client.request<User>('auth/me')).data;
  }
}

export class AIApiClient {
  constructor(private readonly client: ApiClient) {}
  async generateImage(request: ImageGenerationRequest) {
    return (
      await this.client.request<CloudAITaskResult>('ai/tasks', {
        method: 'POST',
        body: JSON.stringify(request),
      })
    ).data;
  }
  async getTask(taskId: string) {
    return (await this.client.request<CloudAITaskResult>(`ai/tasks/${taskId}`)).data;
  }
  async presignAsset(request: AssetPresignRequest) {
    return (
      await this.client.request<AssetPresignResult>('assets/presign', {
        method: 'POST',
        body: JSON.stringify(request),
      })
    ).data;
  }
  async getModelCatalog() {
    return (await this.client.request<AIModelCatalogResult>('ai/catalog')).data;
  }
  async estimate(request: AIEstimateRequest) {
    return (
      await this.client.request<AIEstimateResult>('ai/estimate', {
        method: 'POST',
        body: JSON.stringify(request),
      })
    ).data;
  }
  async getPromptTemplates() {
    return (await this.client.request<PromptTemplate[]>('ai/templates')).data;
  }
}

export function asAuthError(error: unknown): { code: AuthErrorCode; message: string } {
  if (error instanceof ApiError)
    return { code: isAuthErrorCode(error.code) ? error.code : 'UNKNOWN', message: error.message };
  if (error instanceof TypeError)
    return { code: 'NETWORK_ERROR', message: '无法连接认证服务，请检查网络后重试' };
  if (typeof error === 'string' && error.trim())
    return { code: 'UNKNOWN', message: error };
  return { code: 'UNKNOWN', message: error instanceof Error ? error.message : '未知认证错误' };
}

function isAuthErrorCode(code: string): code is AuthErrorCode {
  return [
    'NETWORK_ERROR',
    'SESSION_EXPIRED',
    'AUTH_CODE_EXPIRED',
    'AUTH_CODE_USED',
    'INVALID_STATE',
    'INVALID_CALLBACK',
    'INVALID_TOKEN',
    'REFRESH_FAILED',
    'REFRESH_REPLAY',
    'EMAIL_VERIFICATION_REQUIRED',
    'VERIFICATION_INVALID',
    'RATE_LIMITED',
    'USER_CANCELLED',
    'DEVICE_ERROR',
    'UNKNOWN',
  ].includes(code);
}

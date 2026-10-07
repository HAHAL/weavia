import type {
  AuthErrorCode,
  AuthSessionResult,
  DesktopLoginSession,
  DeviceInfo,
  User,
  CloudAITaskResult,
  ImageGenerationRequest,
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

export interface AuthApi {
  createDesktopSession(redirectUri: string): Promise<DesktopLoginSession>;
  exchange(code: string, state: string, deviceInfo: DeviceInfo): Promise<AuthSessionResult>;
  refresh(refreshToken: string): Promise<AuthSessionResult>;
  logout(refreshToken?: string): Promise<void>;
  me(): Promise<User>;
}

export class AuthApiClient implements AuthApi {
  constructor(private readonly client: ApiClient) {}
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
}

export function asAuthError(error: unknown): { code: AuthErrorCode; message: string } {
  if (error instanceof ApiError)
    return { code: isAuthErrorCode(error.code) ? error.code : 'UNKNOWN', message: error.message };
  if (error instanceof TypeError)
    return { code: 'NETWORK_ERROR', message: '无法连接认证服务，请检查网络后重试' };
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
    'USER_CANCELLED',
    'DEVICE_ERROR',
    'UNKNOWN',
  ].includes(code);
}

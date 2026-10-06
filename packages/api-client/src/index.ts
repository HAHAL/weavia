export interface ApiErrorBody { code: string; message: string; requestId?: string; details?: unknown; }
export interface ApiResponse<T> { data: T; requestId?: string; }

export class ApiClient {
  constructor(private readonly baseUrl: string, private readonly getAccessToken?: () => Promise<string | undefined>) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = await this.getAccessToken?.();
    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
    const body = (await response.json()) as ApiResponse<T> | ApiErrorBody;
    if (!response.ok) throw new Error('message' in body ? body.message : `Request failed: ${response.status}`);
    return body as ApiResponse<T>;
  }
}

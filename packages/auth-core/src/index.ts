import type { AuthErrorCode, AuthSessionResult, Device, DeviceInfo, User } from '@weavia/shared';

const DEMO_USER: User = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'WEAVIA Demo',
  email: 'demo@weavia.local',
  status: 'active',
};
const FIVE_MINUTES = 5 * 60 * 1000;
const ACCESS_TTL = 15 * 60 * 1000;
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000;

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthorizationCodeRecord {
  code: string;
  state: string;
  userId: string;
  expiresAt: number;
  consumedAt?: number;
}

export interface AuthorizationCodeStore {
  save(record: AuthorizationCodeRecord): Promise<void>;
  find(code: string): Promise<AuthorizationCodeRecord | undefined>;
  consume(code: string, consumedAt: number): Promise<boolean>;
}

export class MemoryAuthorizationCodeStore implements AuthorizationCodeStore {
  private readonly records = new Map<string, AuthorizationCodeRecord>();
  async save(record: AuthorizationCodeRecord) {
    this.records.set(record.code, record);
  }
  async find(code: string) {
    return this.records.get(code);
  }
  async consume(code: string, consumedAt: number) {
    const record = this.records.get(code);
    if (!record || record.consumedAt) return false;
    record.consumedAt = consumedAt;
    return true;
  }
}

export class AuthorizationCodeService {
  constructor(
    private readonly store: AuthorizationCodeStore,
    private readonly now = () => Date.now(),
    private readonly ttlMs = FIVE_MINUTES,
  ) {}
  async createAuthorizationCode(state: string, userId: string) {
    const record: AuthorizationCodeRecord = {
      code: randomToken(),
      state,
      userId,
      expiresAt: this.now() + this.ttlMs,
    };
    await this.store.save(record);
    return { code: record.code, expiresAt: new Date(record.expiresAt).toISOString() };
  }
  async validateAuthorizationCode(code: string, state: string) {
    const record = await this.store.find(code);
    if (!record) throw new AuthError('INVALID_TOKEN', '授权码无效');
    if (record.consumedAt) throw new AuthError('AUTH_CODE_USED', '授权码已使用');
    if (record.expiresAt <= this.now()) throw new AuthError('AUTH_CODE_EXPIRED', '授权码已过期');
    if (record.state !== state) throw new AuthError('INVALID_STATE', '登录状态校验失败');
    return record;
  }
  async consumeAuthorizationCode(code: string, state: string) {
    const record = await this.validateAuthorizationCode(code, state);
    if (!(await this.store.consume(code, this.now())))
      throw new AuthError('AUTH_CODE_USED', '授权码已使用');
    return record;
  }
}

interface LoginSession {
  id: string;
  state: string;
  redirectUri: string;
  expiresAt: number;
  authorized: boolean;
}
interface RefreshSession {
  token: string;
  userId: string;
  deviceId: string;
  expiresAt: number;
  revoked: boolean;
}

export class DevAuthService {
  private readonly loginSessions = new Map<string, LoginSession>();
  private readonly accessTokens = new Map<string, { userId: string; expiresAt: number }>();
  private readonly refreshTokens = new Map<string, RefreshSession>();
  private readonly devices = new Map<string, Device>();
  constructor(
    private readonly codes = new AuthorizationCodeService(new MemoryAuthorizationCodeStore()),
    private readonly now = () => Date.now(),
    private readonly webOrigin = 'http://localhost:3000',
  ) {}

  createDesktopSession(redirectUri = 'weavia://auth/callback') {
    if (!isAllowedRedirect(redirectUri)) throw new AuthError('INVALID_CALLBACK', '回调地址无效');
    const id = crypto.randomUUID();
    const session: LoginSession = {
      id,
      state: randomToken(),
      redirectUri,
      expiresAt: this.now() + FIVE_MINUTES,
      authorized: false,
    };
    this.loginSessions.set(id, session);
    return {
      loginSessionId: id,
      state: session.state,
      loginUrl: `${this.webOrigin}/login?session=${encodeURIComponent(id)}`,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  async authorizeDemo(loginSessionId: string) {
    const session = this.loginSessions.get(loginSessionId);
    if (!session || session.expiresAt <= this.now())
      throw new AuthError('SESSION_EXPIRED', '登录请求已过期');
    if (session.authorized) throw new AuthError('AUTH_CODE_USED', '登录请求已完成');
    session.authorized = true;
    const { code } = await this.codes.createAuthorizationCode(session.state, DEMO_USER.id);
    const callback = new URL(session.redirectUri);
    callback.searchParams.set('code', code);
    callback.searchParams.set('state', session.state);
    return { callbackUrl: callback.toString() };
  }

  async exchange(code: string, state: string, deviceInfo: DeviceInfo): Promise<AuthSessionResult> {
    await this.codes.consumeAuthorizationCode(code, state);
    const device = this.registerDevice(DEMO_USER.id, deviceInfo);
    return this.issueTokens(DEMO_USER, device);
  }

  refresh(refreshToken: string): AuthSessionResult {
    const session = this.refreshTokens.get(refreshToken);
    if (!session || session.revoked || session.expiresAt <= this.now())
      throw new AuthError('REFRESH_FAILED', '登录已失效，请重新登录', 401);
    session.revoked = true;
    const device = this.devices.get(`${session.userId}:${session.deviceId}`);
    if (!device) throw new AuthError('DEVICE_ERROR', '设备记录不存在');
    device.lastSeenAt = new Date(this.now()).toISOString();
    return this.issueTokens(DEMO_USER, device);
  }

  logout(refreshToken?: string) {
    if (refreshToken) {
      const session = this.refreshTokens.get(refreshToken);
      if (session) session.revoked = true;
    }
  }

  me(accessToken: string) {
    const token = this.accessTokens.get(accessToken);
    if (!token || token.expiresAt <= this.now())
      throw new AuthError('INVALID_TOKEN', '访问令牌无效', 401);
    return DEMO_USER;
  }

  private registerDevice(userId: string, info: DeviceInfo) {
    const key = `${userId}:${info.deviceId}`;
    const existing = this.devices.get(key);
    const at = new Date(this.now()).toISOString();
    const device: Device = existing
      ? { ...existing, ...info, lastSeenAt: at }
      : { ...info, userId, createdAt: at, lastSeenAt: at };
    this.devices.set(key, device);
    return device;
  }

  private issueTokens(user: User, device: Device): AuthSessionResult {
    const accessToken = randomToken();
    const refreshToken = randomToken();
    const accessExpiresAt = this.now() + ACCESS_TTL;
    this.accessTokens.set(accessToken, { userId: user.id, expiresAt: accessExpiresAt });
    this.refreshTokens.set(refreshToken, {
      token: refreshToken,
      userId: user.id,
      deviceId: device.deviceId,
      expiresAt: this.now() + REFRESH_TTL,
      revoked: false,
    });
    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(accessExpiresAt).toISOString(),
      tokenType: 'Bearer',
      user,
      device,
    };
  }
}

export function isAllowedRedirect(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'weavia:' && url.hostname === 'auth' && url.pathname === '/callback';
  } catch {
    return false;
  }
}

export function randomToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (value) => value.toString(16).padStart(2, '0')).join('');
}

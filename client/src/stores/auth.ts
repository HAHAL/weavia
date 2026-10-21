import { create } from 'zustand';
import { apiRequest, setApiSession } from '../services/api';

export type AuthUser = { id: string; email: string; name?: string };
type LoginResponse = { accessToken: string; refreshToken: string; expiresAt: string; user: AuthUser };
type AuthStatus = 'anonymous' | 'loading' | 'authenticated';
type AuthState = {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
};

const STORAGE_KEY = 'weavia.session';

function readSession(): { token: string; user: AuthUser } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as { token: string; user: AuthUser } : null;
  } catch {
    return null;
  }
}

function saveSession(token: string, user: AuthUser) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user })); } catch { /* session storage may be unavailable */ }
}

function clearSession() {
  setApiSession(null);
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  status: 'anonymous',
  error: null,

  async login(email, password) {
    set({ status: 'loading', error: null });
    try {
      const data = await apiRequest<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          deviceInfo: { deviceName: 'WEAVIA Desktop', platform: 'desktop', appVersion: '0.1.0' },
        }),
      }, { auth: false });
      setApiSession(data.accessToken);
      saveSession(data.accessToken, data.user);
      set({ user: data.user, token: data.accessToken, status: 'authenticated' });
    } catch (error) {
      set({ status: 'anonymous', error: error instanceof Error ? error.message : '登录失败' });
      throw error;
    }
  },

  async register(email, password, name) {
    set({ status: 'loading', error: null });
    try {
      const data = await apiRequest<LoginResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          name,
          deviceInfo: { deviceName: 'WEAVIA Desktop', platform: 'desktop', appVersion: '0.1.0' },
        }),
      }, { auth: false });
      setApiSession(data.accessToken);
      saveSession(data.accessToken, data.user);
      set({ user: data.user, token: data.accessToken, status: 'authenticated' });
    } catch (error) {
      set({ status: 'anonymous', error: error instanceof Error ? error.message : '注册失败' });
      throw error;
    }
  },

  async logout() {
    try { await apiRequest('/api/auth/logout', { method: 'POST' }); } catch { /* best effort */ }
    clearSession();
    set({ user: null, token: null, status: 'anonymous' });
  },

  async restore() {
    const saved = readSession();
    if (!saved) { set({ status: 'anonymous' }); return; }
    setApiSession(saved.token);
    try {
      const user = await apiRequest<AuthUser>('/api/auth/me');
      set({ user, token: saved.token, status: 'authenticated' });
      saveSession(saved.token, user);
    } catch {
      clearSession();
      set({ user: null, token: null, status: 'anonymous' });
    }
  },
}));

window.addEventListener('weavia:unauthorized', () => {
  clearSession();
  useAuth.setState({ user: null, token: null, status: 'anonymous' });
});

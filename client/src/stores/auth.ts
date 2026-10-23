import { create } from 'zustand';
import { apiRequest, setApiSession } from '../services/api';
import { enterAccountScope, leaveAccountScope } from './account';

export type AuthUser = { id: string; email: string; name?: string };
type LoginResponse = { accessToken: string; refreshToken: string; expiresAt: string; user: AuthUser };
type AuthStatus = 'anonymous' | 'loading' | 'authenticated';
type SavedSession = { token: string; refreshToken?: string; user: AuthUser; rememberedUntil?: string };
type AuthState = {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
  error: string | null;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
};

const STORAGE_KEY = 'weavia.session';
const REMEMBER_KEY = 'weavia.remembered';
const REMEMBER_DAYS = 10;

function readSession(): SavedSession | null {
  try {
    const rememberedRaw = localStorage.getItem(REMEMBER_KEY);
    if (rememberedRaw) {
      const saved = JSON.parse(rememberedRaw) as SavedSession;
      if (saved.rememberedUntil && new Date(saved.rememberedUntil).getTime() > Date.now()) return saved;
      localStorage.removeItem(REMEMBER_KEY);
    }
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as SavedSession : null;
  } catch {
    return null;
  }
}

function saveSession(token: string, refreshToken: string | undefined, user: AuthUser, remember = false) {
  const saved: SavedSession = remember
    ? { token, refreshToken, user, rememberedUntil: new Date(Date.now() + REMEMBER_DAYS * 86400_000).toISOString() }
    : { token, refreshToken, user };
  try {
    if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify(saved));
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch { /* storage may be unavailable */ }
}

function clearSession() {
  setApiSession(null);
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(REMEMBER_KEY); } catch { /* ignore */ }
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  status: 'loading',
  error: null,

  async login(email, password, remember = false) {
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
      saveSession(data.accessToken, data.refreshToken, data.user, remember);
      enterAccountScope(data.user.id);
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
      saveSession(data.accessToken, data.refreshToken, data.user, false);
      enterAccountScope(data.user.id);
      set({ user: data.user, token: data.accessToken, status: 'authenticated' });
    } catch (error) {
      set({ status: 'anonymous', error: error instanceof Error ? error.message : '注册失败' });
      throw error;
    }
  },

  async logout() {
    const saved = readSession();
    try { await apiRequest('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: saved?.refreshToken || '' }) }); } catch { /* best effort */ }
    clearSession();
    leaveAccountScope();
    set({ user: null, token: null, status: 'anonymous' });
  },

  async restore() {
    const saved = readSession();
    if (!saved) { set({ status: 'anonymous' }); return; }
    setApiSession(saved.token);
    try {
      const user = await apiRequest<AuthUser>('/api/auth/me');
      enterAccountScope(user.id);
      set({ user, token: saved.token, status: 'authenticated' });
      saveSession(saved.token, saved.refreshToken, user, Boolean(saved.rememberedUntil));
      return;
    } catch {
      // Access tokens live for 15 minutes. Fall back to the refresh token
      // before asking the user to sign in again.
    }
    if (!saved.refreshToken) { clearSession(); leaveAccountScope(); set({ user: null, token: null, status: 'anonymous' }); return; }
    try {
      const refreshed = await apiRequest<LoginResponse>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: saved.refreshToken }),
      }, { auth: false });
      setApiSession(refreshed.accessToken);
      saveSession(refreshed.accessToken, refreshed.refreshToken, refreshed.user, Boolean(saved.rememberedUntil));
      enterAccountScope(refreshed.user.id);
      set({ user: refreshed.user, token: refreshed.accessToken, status: 'authenticated' });
    } catch {
      clearSession();
      leaveAccountScope();
      set({ user: null, token: null, status: 'anonymous' });
    }
  },
}));

window.addEventListener('weavia:unauthorized', () => {
  clearSession();
  leaveAccountScope();
  useAuth.setState({ user: null, token: null, status: 'anonymous' });
});

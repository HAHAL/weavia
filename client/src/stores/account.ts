import { useApp } from './app';
import { ANONYMOUS_SCOPE, currentScope, partitionKey, setScope } from './scope';

type AccountState = {
  products?: unknown[];
  assets?: unknown[];
  tasks?: unknown[];
  works?: unknown[];
  avatars?: Record<string, unknown>;
};

const ACCOUNT_FIELDS = ['products', 'assets', 'tasks', 'works', 'avatars'] as const;
const LEGACY_KEY = 'weavia.state.v1';
const LEGACY_OWNER_KEY = 'weavia.state.v1.owner';

function readState(key: string): AccountState | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: AccountState };
    return parsed.state ?? null;
  } catch {
    return null;
  }
}

function hasAccountData(state: AccountState | null): boolean {
  if (!state) return false;
  return ACCOUNT_FIELDS.some(field => {
    const value = state[field];
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value && Object.keys(value).length > 0);
  });
}

function emptyAccount(): AccountState {
  return { products: [], assets: [], tasks: [], works: [], avatars: {} };
}

function devicePrefs() {
  const state = useApp.getState();
  return { collapsed: state.collapsed, theme: state.theme, enabledSkills: state.enabledSkills };
}

/** 先切换作用域再写入状态：之后的持久化只会落到新账号的分区。 */
function applyScope(scopeId: string, saved: AccountState | null): void {
  const prefs = devicePrefs();
  setScope(scopeId);
  useApp.setState({ ...emptyAccount(), ...(saved ?? {}), ...prefs } as never);
}

/** 旧版本只有一份全局数据，首次升级时归属给第一个登录的账号，原键保留作备份。 */
function adoptLegacyState(scopeId: string): AccountState | null {
  try {
    if (window.localStorage.getItem(LEGACY_OWNER_KEY)) return null;
    const legacy = readState(LEGACY_KEY);
    if (!hasAccountData(legacy)) return null;
    window.localStorage.setItem(LEGACY_OWNER_KEY, scopeId);
    return legacy;
  } catch {
    return null;
  }
}

export function enterAccountScope(userId: string): void {
  const scopeId = userId.trim() || ANONYMOUS_SCOPE;
  if (currentScope() === scopeId) return;
  const saved = readState(partitionKey(scopeId));
  applyScope(scopeId, hasAccountData(saved) ? saved : adoptLegacyState(scopeId) ?? saved);
}

export function leaveAccountScope(): void {
  applyScope(ANONYMOUS_SCOPE, null);
}

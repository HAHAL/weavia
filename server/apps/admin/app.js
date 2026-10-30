const BUILD_TAG = '2026-10-31-refresh';
const $ = (id) => document.getElementById(id);
const content = $('content');
const modal = $('modal');
const pages = [
  { id: 'dashboard', label: '仪表盘', kicker: '经营', group: '经营', icon: 'grid' },
  { id: 'commerce', label: '商业中心', kicker: '经营', group: '经营', icon: 'wallet' },
  { id: 'pricing', label: '定价与成本', kicker: '经营', group: '经营', icon: 'tag' },
  { id: 'analytics', label: '数据分析', kicker: '经营', group: '经营', icon: 'chart' },
  { id: 'users', label: '用户中心', kicker: '用户', group: '用户', icon: 'users' },
  { id: 'roles', label: '角色权限', kicker: '用户', group: '用户', icon: 'shield' },
  { id: 'invites', label: '邀请码', kicker: '用户', group: '用户', icon: 'ticket' },
  { id: 'ai', label: 'AI Studio', kicker: 'AI 运维', group: 'AI 运维', icon: 'spark' },
  { id: 'tasks', label: '创作任务', kicker: 'AI 运维', group: 'AI 运维', icon: 'list' },
  { id: 'ops', label: '运行与排障', kicker: 'AI 运维', group: 'AI 运维', icon: 'pulse' },
  { id: 'showcase', label: '内容管理', kicker: '内容与客户端', group: '内容与客户端', icon: 'image' },
  { id: 'client', label: '客户端发布', kicker: '内容与客户端', group: '内容与客户端', icon: 'rocket' },
  { id: 'storage', label: '存储', kicker: '系统', group: '系统', icon: 'db' },
  { id: 'settings', label: '设置', kicker: '系统', group: '系统', icon: 'gear' },
];
// 16px line icons, stroke uses currentColor so active/hover colors follow the text.
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M16 13h2M3 10h18M7 6V4h10v2"/>',
  tag: '<path d="M20 13l-7 7-9-9V4h7z"/><circle cx="8.5" cy="8.5" r="1.5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3zM14 4v16" stroke-dasharray="0"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
  pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  rocket: '<path d="M5 15c-1.5 1.5-2 4-2 6 2 0 4.5-.5 6-2M9 13l2 2M14.5 4.5C17 2 20 2 21.5 2.5 22 4 22 7 19.5 9.5L12 17l-5-5z"/><circle cx="16" cy="8" r="1.6"/>',
  db: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3.5a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.4V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 1 1 0 4z"/>',
};
Object.assign(ICONS, {
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
});
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
const defaultApiBase = location.port && location.port !== '80' && location.port !== '443' ? `${location.protocol}//${location.hostname}:8080` : location.origin;
let apiBase = localStorage.getItem('weavia.admin.api') || defaultApiBase;
let token = sessionStorage.getItem('weavia.admin.token') || '';
let email = sessionStorage.getItem('weavia.admin.email') || '';
const state = { page: 'dashboard', commerceTab: 'plans', aiTab: 'overview', taskTab: 'tasks', showcaseFilter: 'all', opsPeriod: '24h', health: 'checking', opsStatus: null, users: [], showcase: [], announcements: [], clientConfig: null, plans: [], orders: [], payments: [], providers: [], models: null, routing: null, usage: [], overview: null, tasks: [], runs: [], pricing: [], pricingSettings: null, invites: [] };


// Appearance: 跟随系统 / 浅色 / 深色, remembered per browser.
const THEME_KEY = 'weavia.admin.theme';
const THEME_MODES = [['system', '跟随系统', 'monitor'], ['light', '浅色', 'sun'], ['dark', '深色', 'moon']];
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
function themeMode() {
  try { const value = localStorage.getItem(THEME_KEY); return THEME_MODES.some(([id]) => id === value) ? value : 'system'; } catch { return 'system'; }
}
function applyTheme() {
  const mode = themeMode();
  document.documentElement.dataset.theme = mode === 'system' ? (systemDark.matches ? 'dark' : 'light') : mode;
  document.querySelectorAll('[data-theme-mode]').forEach((button) => {
    const active = button.dataset.themeMode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function setTheme(mode) {
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* private mode: keep for this page only */ }
  applyTheme();
}
function themeSwitch() {
  return `<div class="theme-switch" role="group" aria-label="外观">${THEME_MODES.map(([id, label, name]) => `<button type="button" data-theme-mode="${id}" title="${label}" aria-label="${label}">${icon(name)}</button>`).join('')}</div>`;
}
systemDark.addEventListener('change', () => { if (themeMode() === 'system') applyTheme(); });
document.addEventListener('click', (event) => { const button = event.target.closest('[data-theme-mode]'); if (button) setTheme(button.dataset.themeMode); });

// Styled replacement for window.confirm; uses its own <dialog> so it can sit
// on top of an open modal (e.g. deleting a key from the key list).
function confirmDialog(message, { okLabel = '确定', danger = true } = {}) {
  const dialog = $('confirmModal');
  dialog.innerHTML = `<form method="dialog" class="confirm-inner"><div class="confirm-icon ${danger ? 'danger' : ''}">!</div><div><h2>${danger ? '请确认' : '确认操作'}</h2><p>${esc(message).replace(/\n/g, '<br />')}</p></div><div class="confirm-actions"><button value="cancel" class="secondary">取消</button><button value="ok" class="${danger ? 'danger-button' : 'primary'}">${esc(okLabel)}</button></div></form>`;
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
    dialog.showModal();
    dialog.querySelector('button[value=ok]').focus();
  });
}

const tablePagers = new Map();
let nextTableId = 0;

function renderInto(target, html) {
  target.innerHTML = html;
  enhanceTables(target);
}

function enhanceTables(root = content) {
  for (const table of tablePagers.keys()) {
    if (!table.isConnected) tablePagers.delete(table);
  }
  root.querySelectorAll('table').forEach((table) => {
    if (table.dataset.enhanced) return;
    const tbody = table.tBodies[0];
    if (!tbody || !table.tHead || tbody.rows.length < 15) return;
    table.dataset.enhanced = '1';
    table.dataset.tableId ||= `table-${++nextTableId}`;
    const rows = [...tbody.rows];
    const state = { page: 0, size: 20 };

    const bar = document.createElement('div');
    bar.className = 'table-bar';
    bar.innerHTML = '<span class="table-info"></span><div class="row-actions"><button type="button" class="mini" data-role="prev">上一页</button><button type="button" class="mini" data-role="next">下一页</button><button type="button" class="mini" data-role="csv">导出 CSV</button></div>';
    const wrap = table.closest('.table-wrap') || table;
    wrap.parentElement.insertBefore(bar, wrap.nextSibling);

    const refresh = () => {
      const visible = rows.filter((row) => row.dataset.filtered !== '1');
      const pages = Math.max(1, Math.ceil(visible.length / state.size));
      state.page = Math.min(state.page, pages - 1);
      rows.forEach((row) => { row.hidden = true; });
      visible.slice(state.page * state.size, (state.page + 1) * state.size).forEach((row) => { row.hidden = false; });
      bar.querySelector('.table-info').textContent = `共 ${visible.length} 条 · 第 ${state.page + 1}/${pages} 页`;
      bar.querySelector('[data-role=prev]').disabled = state.page === 0;
      bar.querySelector('[data-role=next]').disabled = state.page >= pages - 1;
    };
    bar.querySelector('[data-role=prev]').onclick = () => { state.page -= 1; refresh(); };
    bar.querySelector('[data-role=next]').onclick = () => { state.page += 1; refresh(); };
    bar.querySelector('[data-role=csv]').onclick = () => {
      const visible = rows.filter((row) => row.dataset.filtered !== '1');
      const header = [...table.tHead.rows[0].cells].map((cell) => `"${cell.textContent.trim()}"`).join(',');
      const body = visible.map((row) => [...row.cells].map((cell) => `"${cell.textContent.replace(/"/g, '""').trim()}"`).join(',')).join('\n');
      const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'weavia-export.csv';
      link.click();
      URL.revokeObjectURL(link.href);
    };

    [...table.tHead.rows[0].cells].forEach((th, index) => {
      th.style.cursor = 'pointer';
      th.title = '点击排序';
      th.addEventListener('click', () => {
        const current = th.dataset.dir === 'asc' ? 'asc' : 'desc';
        const next = current === 'asc' ? 'desc' : 'asc';
        th.dataset.dir = next;
        rows.sort((a, b) => {
          const av = a.cells[index]?.textContent.trim() || '';
          const bv = b.cells[index]?.textContent.trim() || '';
          const an = parseFloat(av.replace(/[^\d.-]/g, ''));
          const bn = parseFloat(bv.replace(/[^\d.-]/g, ''));
          const result = Number.isFinite(an) && Number.isFinite(bn) ? an - bn : av.localeCompare(bv, 'zh-CN');
          return next === 'asc' ? result : -result;
        });
        rows.forEach((row) => tbody.appendChild(row));
        refresh();
      });
    });

    tablePagers.set(table, refresh);
    refresh();
  });
}

function refreshTables() {
  for (const [table, refresh] of tablePagers) {
    if (table.isConnected) refresh();
    else tablePagers.delete(table);
  }
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function fmtDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtMoney(minor) {
  return '¥' + (Number(minor || 0) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtNumber(value) { return Number(value || 0).toLocaleString('zh-CN'); }
function status(value) {
  const key = String(value || '').toLowerCase();
  const labels = { active: '正常', disabled: '已禁用', published: '已发布', draft: '草稿', paid: '已支付', pending: '待处理', succeeded: '成功', success: '成功', failed: '失败', running: '运行中', cancelled: '已取消', refunded: '已退款', trialing: '试用中', none: '免费' };
  const tones = { active: 'success', published: 'success', paid: 'success', succeeded: 'success', success: 'success', disabled: 'danger', failed: 'danger', refunded: 'danger', pending: 'warning', running: 'warning', draft: 'warning', trialing: 'gold' };
  return `<span class="badge ${tones[key] || ''}">${esc(labels[key] || value || '—')}</span>`;
}
function avatarLetter(value) { return (value || 'A').slice(0, 1).toUpperCase(); }
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 3200);
}
function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  if (busy) { button.dataset.label = button.textContent; button.textContent = '处理中…'; }
  else if (button.dataset.label) { button.textContent = button.dataset.label; }
}
function pageHead(title, description, actions = '') {
  return `<div class="page-head"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
}
function metric(label, value, note = '') {
  return `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
}
function empty(text) { return `<div class="empty">${esc(text)}</div>`; }
function loading() { return '<div class="skeleton"></div><div class="skeleton" style="margin-top:16px"></div>'; }

async function request(path, options = {}, auth = true) {
  const headers = new Headers(options.headers || {});
  if (auth && token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response;
  try {
    response = await fetch(apiBase.replace(/\/$/, '') + path, { ...options, headers });
  } catch {
    throw new Error('无法连接 API，请检查 API 地址和隧道');
  }
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (response.status === 401) { logout(); throw new Error('登录已失效，请重新登录'); }
  if (!response.ok) throw new Error((body && body.message) || `请求失败 (${response.status})`);
  return body && typeof body === 'object' && 'data' in body ? body.data : body;
}
const get = (path) => request(path);
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
const patch = (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) });
const remove = (path) => request(path, { method: 'DELETE' });

function renderNav() {
  let group = '';
  $('nav').innerHTML = pages.map((page) => {
    const heading = page.group !== group ? `<div class="nav-group">${esc(page.group)}</div>` : '';
    group = page.group;
    return `${heading}<button type="button" class="nav-item ${state.page === page.id ? 'active' : ''}" data-page="${page.id}" title="${esc(page.label)}">${icon(page.icon)}<span class="nav-label">${esc(page.label)}</span>${page.id === 'showcase' && state.showcase.length ? `<span class="nav-count">${state.showcase.length}</span>` : ''}</button>`;
  }).join('');
  document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
}
function showLogin() { $('loginView').hidden = false; $('adminView').hidden = true; applyTheme(); setTimeout(() => ($('email').value ? $('password') : $('email')).focus(), 0); }
function showAdmin() {
  $('loginView').hidden = true;
  $('adminView').hidden = false;
  $('adminEmail').textContent = email || '管理员';
  $('avatar').textContent = avatarLetter(email);
}
function logout() {
  token = ''; email = '';
  sessionStorage.removeItem('weavia.admin.token');
  sessionStorage.removeItem('weavia.admin.email');
  showLogin();
}
const REMEMBER_KEY = 'weavia.admin.rememberEmail';
async function checkLoginService() {
  const badge = $('loginStatus');
  if (!badge) return;
  const base = $('apiBase').value.trim().replace(/\/$/, '');
  try { $('apiHostLabel').textContent = new URL(base).host; } catch { $('apiHostLabel').textContent = '地址无效'; }
  badge.dataset.state = 'checking';
  badge.querySelector('span').textContent = '正在检查服务…';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(base + '/api/readiness', { signal: controller.signal });
    const ok = response.ok;
    badge.dataset.state = ok ? 'ok' : 'down';
    badge.querySelector('span').textContent = ok ? '服务正常' : `服务异常（${response.status}）`;
  } catch {
    badge.dataset.state = 'down';
    badge.querySelector('span').textContent = '无法连接服务，请检查连接设置';
  } finally { clearTimeout(timer); }
}
function initLogin() {
  $('loginTheme').innerHTML = themeSwitch();
  $('loginBuild').textContent = `版本 ${BUILD_TAG}`;
  try {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) { $('email').value = saved; $('rememberEmail').checked = true; }
  } catch { /* storage unavailable */ }
  $('togglePassword').addEventListener('click', () => {
    const input = $('password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('togglePassword').textContent = show ? '隐藏' : '显示';
    $('togglePassword').setAttribute('aria-pressed', String(show));
    $('togglePassword').setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
    input.focus();
  });
  const caps = (event) => { if (event.getModifierState) $('capsHint').hidden = !event.getModifierState('CapsLock'); };
  $('password').addEventListener('keydown', caps);
  $('password').addEventListener('keyup', caps);
  ['email', 'password'].forEach((id) => $(id).addEventListener('input', () => { $(id).classList.remove('invalid'); $('loginError').textContent = ''; }));
  $('apiBase').addEventListener('change', checkLoginService);
  checkLoginService();
}

async function login(event) {
  event.preventDefault();
  $('loginError').textContent = '';
  const emailValue = $('email').value.trim();
  const passwordValue = $('password').value;
  $('email').classList.toggle('invalid', !emailValue);
  $('password').classList.toggle('invalid', !passwordValue);
  if (!emailValue || !passwordValue) { $('loginError').textContent = '请输入邮箱和密码'; (emailValue ? $('password') : $('email')).focus(); return; }
  try { if ($('rememberEmail').checked) localStorage.setItem(REMEMBER_KEY, emailValue); else localStorage.removeItem(REMEMBER_KEY); } catch { /* ignore */ }
  apiBase = $('apiBase').value.trim().replace(/\/$/, '');
  localStorage.setItem('weavia.admin.api', apiBase);
  const button = event.target.querySelector('button[type=submit]');
  setBusy(button, true);
  try {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailValue, password: passwordValue, deviceInfo: { deviceName: 'weavia-admin', platform: 'web', appVersion: '0.1.0' } }),
    }, false);
    token = data.accessToken;
    email = data.user.email;
    sessionStorage.setItem('weavia.admin.token', token);
    sessionStorage.setItem('weavia.admin.email', email);
    showAdmin(); renderNav(); await navigate(pageFromHash()); await checkService();
  } catch (error) {
    $('loginError').textContent = error.message;
    $('password').value = '';
    $('password').focus();
    $('loginForm').classList.remove('shake');
    void $('loginForm').offsetWidth;
    $('loginForm').classList.add('shake');
  } finally {
    setBusy(button, false);
  }
}
function renderHealth() {
  const labels = { checking: '检查中…', ok: '创作服务正常', degraded: '部分服务受影响', down: '创作服务不可用', unreachable: '服务不可达', limited: 'API 可用 · 无状态权限', unknown: '状态未知' };
  const label = labels[state.health] || labels.checking;
  $('serviceStatus').textContent = label;
  $('serviceDot').dataset.health = state.health;
  if ($('settingsHealth')) $('settingsHealth').textContent = label;
}
async function checkService() {
  if (!token) return;
  state.health = 'checking';
  renderHealth();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(apiBase.replace(/\/$/, '') + '/api/admin/ops/status', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    if (response.status === 401) { logout(); return; }
    if (response.status === 403) { state.health = 'limited'; return; }
    if (!response.ok) { state.health = 'down'; return; }
    state.opsStatus = await response.json();
    state.health = state.opsStatus.status || 'unknown';
  } catch { state.health = 'unreachable'; }
  finally { clearTimeout(timeout); renderHealth(); }
}
function pageFromHash() {
  const id = location.hash.replace(/^#\/?/, '');
  return pages.some((page) => page.id === id) ? id : 'dashboard';
}
async function navigate(pageId) {
  state.page = pageId;
  if (location.hash !== `#/${pageId}`) history.replaceState(null, '', `#/${pageId}`);
  const page = pages.find((item) => item.id === pageId) || pages[0];
  $('pageKicker').textContent = page.kicker;
  $('pageCrumb').textContent = page.label;
  renderNav();
  content.innerHTML = loading();
  try { await loaders[pageId](); enhanceTables(); } catch (error) { content.innerHTML = pageHead(page.label, '') + empty(error.message); }
}
const loaders = { client: loadClient, dashboard: loadDashboard, users: loadUsers, roles: loadRoles, commerce: loadCommerce, ai: loadAI, pricing: loadPricing, invites: loadInvites, storage: loadStorage, tasks: loadTasks, ops: loadOps, showcase: loadShowcase, analytics: loadAnalytics, settings: loadSettings };

async function loadDashboard() {
  const [overview, orders, tasks, showcase, health] = await Promise.all([get('/api/admin/overview'), get('/api/admin/orders'), get('/api/admin/tasks'), get('/api/admin/showcase'), get('/api/admin/ai/health').catch(() => null)]);
  state.overview = overview; state.orders = orders || []; state.tasks = tasks || []; state.showcase = showcase.items || [];
  if (health) state.aiHealth = health;
  const recent = state.tasks.filter((t) => Date.now() - new Date(t.createdAt).getTime() < 86400000);
  const failed24 = recent.filter((t) => t.status === 'failed').length;
  // grossProfitCNY is yuan, revenue is fen: margin % = gross×100 / revenue × 100.
  const margin = overview.revenueMinorCNY && overview.grossProfitCNY != null ? (overview.grossProfitCNY * 100 * 100) / overview.revenueMinorCNY : null;
  // One list of things an operator should act on today, each linking to where it is fixed.
  const todo = [];
  (health?.channels || []).filter((c) => ['auth_failed', 'no_key'].includes(c.status)).forEach((c) => todo.push(['danger', `渠道「${c.name}」${CHANNEL_STATUS[c.status][1]}`, 'ai']));
  const broken = (health?.models || []).filter((m) => m.enabled && ['image', 'video'].includes(m.modality) && ['no_channel', 'no_usable_channel', 'video_provider_unsupported'].includes(m.reason));
  if (broken.length) todo.push(['danger', `${broken.length} 个客户端可见模型当前不可用：${broken.slice(0, 3).map((m) => m.displayName).join('、')}${broken.length > 3 ? ' 等' : ''}`, 'ai']);
  if (failed24) todo.push([failed24 / Math.max(recent.length, 1) > 0.1 ? 'danger' : 'warning', `过去 24 小时 ${failed24} 个任务失败（共 ${recent.length} 个）`, 'tasks']);
  if (margin != null && margin < 30) todo.push(['warning', `整体毛利率 ${margin.toFixed(0)}%，低于 30%`, 'pricing']);
  if (!todo.length) todo.push(['success', '没有需要处理的问题', '']);
  content.innerHTML = pageHead('仪表盘', '今天的经营、任务与渠道状态。', '<button class="secondary" data-action="go-tasks">创作任务</button><button class="primary" data-action="go-page" data-page="ai">AI Studio</button>') +
    `<div class="metrics hero-metrics">
      ${metric('累计收入', fmtMoney(overview.revenueMinorCNY), `毛利 ${overview.grossProfitCNY == null ? '—' : fmtMoney(Math.round(overview.grossProfitCNY * 100))}${margin != null ? ` · ${margin.toFixed(0)}%` : ''}`)}
      ${metric('用户', fmtNumber(overview.users), `今日新增 ${fmtNumber(overview.newUsersToday)} · 付费 ${fmtNumber(overview.paidMembers)}`)}
      ${metric('任务', fmtNumber(overview.tasks), `累计失败 ${fmtNumber(overview.failedTasks)} · ${overview.tasks ? ((overview.failedTasks / overview.tasks) * 100).toFixed(1) : 0}%`)}
      ${metric('AI 成本', '¥' + Number(overview.aiCostByCurrency?.CNY || 0).toFixed(2), `Credits 消耗 ${fmtNumber(overview.creditsConsumed)}`)}
    </div>
    <section class="panel"><div class="panel-head"><div><h2>今天需要处理</h2><p>渠道、模型、任务与毛利的异常汇总，点右侧直接去处理</p></div></div>
      ${todo.map(([level, text, page]) => `<div class="alert-row"><span class="badge ${level}">${level === 'danger' ? '严重' : level === 'warning' ? '注意' : '正常'}</span><span>${esc(text)}</span><span class="spacer"></span>${page ? `<button class="mini" data-action="go-page" data-page="${page}">去处理</button>` : ''}</div>`).join('')}
    </section>
    <div class="panel-grid">
      <section class="panel"><div class="panel-head"><div><h2>最近任务</h2><p>最新 6 个创作任务</p></div><button class="mini" data-action="go-tasks">全部任务</button></div>${tasksTable((tasks || []).slice(0, 6), true)}</section>
      <section class="panel"><div class="panel-head"><div><h2>最近订单</h2><p>最新 6 笔订单（线下入账见用户中心 → 调整 Credits）</p></div><button class="mini" data-action="go-commerce">全部订单</button></div>${ordersTable((orders || []).slice(0, 6))}</section>
    </div>`;
}
function ordersTable(rows) {
  if (!rows.length) return empty('还没有订单');
  return `<div class="table-wrap"><table><thead><tr><th>用户</th><th>类型</th><th>金额</th><th>状态</th><th>时间</th></tr></thead><tbody>${rows.map((row) => `<tr><td><span class="cell-main">${esc(row.email || row.userId)}</span></td><td>${esc(row.kind)}</td><td>${fmtMoney(row.amountMinor)} ${esc(row.currency)}</td><td>${status(row.status)}</td><td>${fmtDate(row.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
}
function tasksTable(rows, compact = false) {
  if (!rows.length) return empty('还没有任务');
  if (compact) return `<div class="table-wrap"><table><thead><tr><th>任务</th><th>模型</th><th>状态</th><th>实扣 / 返还</th><th>时间</th></tr></thead><tbody>${rows.map((row) => `<tr><td><span class="cell-main">${esc(row.type)}</span><span class="cell-sub">${esc(row.id.slice(0, 8))}</span></td><td>${esc(row.model || row.provider || '—')}</td><td>${status(row.status)}</td><td><span class="cell-main">${fmtNumber(row.consumedCredits)}</span><span class="cell-sub">返还 ${fmtNumber(row.releasedCredits)}</span></td><td>${fmtDate(row.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>任务 / 用户</th><th>模型 / 结算口径</th><th>状态</th><th>预留</th><th>实扣</th><th>返还</th><th>时间</th><th>操作</th></tr></thead><tbody>${rows.map((row) => `<tr><td><span class="cell-main">${esc(row.type)} · ${esc(row.id.slice(0, 8))}</span><span class="cell-sub">${esc(row.email || row.accountNo || row.userId)}</span></td><td><span class="cell-main">${esc(row.model || row.provider || '—')}</span><span class="cell-sub">${esc(billingBasisLabel(row.billingBasis))}</span></td><td>${status(row.status)}${row.errorCode ? `<span class="cell-sub">${esc(row.errorCode)}</span>` : ''}</td><td>${fmtNumber(row.reservedCredits)}</td><td class="${row.status === 'failed' && !row.consumedCredits ? 'negative' : ''}">${fmtNumber(row.consumedCredits)}</td><td>${fmtNumber(row.releasedCredits)}</td><td>${fmtDate(row.createdAt)}</td><td><button class="mini" data-action="task-detail" data-id="${esc(row.id)}">详情</button></td></tr>`).join('')}</tbody></table></div>`;
}
function billingBasisLabel(basis) {
  return basis === 'submitted' ? '按提交结算' : basis === 'delivered' ? '按交付结算' : '结算口径未留快照';
}
async function loadUsers() {
  const [users, inviteData] = await Promise.all([get('/api/admin/users'), get('/api/admin/invites')]);
  state.users = users || [];
  state.invites = inviteData?.items || [];
  const all = state.users;
  const filters = [['all', '全部', () => true], ['paid', '付费会员', (u) => u.membershipStatus === 'active' || (u.plan && u.plan !== 'free')], ['low', 'Credits < 100', (u) => Number(u.credits) < 100], ['sync', '已开 OSS 同步', (u) => u.ossSync], ['disabled', '已禁用', (u) => u.status !== 'active']];
  const today = all.filter((u) => Date.now() - new Date(u.createdAt).getTime() < 86400000).length;
  content.innerHTML = pageHead('用户中心', '查看用户、套餐、Credits 与账号状态；常用操作在每行右侧，其余在「更多」。') +
    `<div class="metrics">${metric('用户总数', fmtNumber(all.length))}${metric('今日注册', fmtNumber(today))}${metric('付费会员', fmtNumber(all.filter(filters[1][2]).length))}${metric('已禁用', fmtNumber(all.filter(filters[4][2]).length))}</div>
    <div class="panel"><div class="panel-head"><div class="tabs sub-tabs" style="margin:0">${filters.map(([id, label, fn]) => `<button type="button" class="${(state.userFilter || 'all') === id ? 'active' : ''}" data-user-filter="${id}">${label} <small>${all.filter(fn).length}</small></button>`).join('')}</div><input id="userSearch" class="search-input" placeholder="搜索邮箱、姓名、账号或套餐" /></div><div id="userTable"></div></div>`;
  const draw = () => {
    const query = ($('userSearch')?.value || '').trim().toLowerCase();
    const fn = (filters.find(([id]) => id === (state.userFilter || 'all')) || filters[0])[2];
    renderInto($('userTable'), usersTable(all.filter((u) => fn(u) && `${u.email} ${u.name} ${u.plan} ${u.accountNo}`.toLowerCase().includes(query))));
    enhanceTables($('userTable'));
  };
  content.querySelectorAll('[data-user-filter]').forEach((button) => button.addEventListener('click', () => { state.userFilter = button.dataset.userFilter; content.querySelectorAll('[data-user-filter]').forEach((b) => b.classList.toggle('active', b === button)); draw(); }));
  $('userSearch').addEventListener('input', draw);
  draw();
}


async function loadInvites() {
  const data = await get('/api/admin/invites');
  state.invites = data?.items || [];
  const rows = state.invites;
  const available = rows.filter((item) => item.enabled && !(item.expiresAt && new Date(item.expiresAt).getTime() < Date.now()) && (item.maxUses === 0 || item.usedCount < item.maxUses)).length;
  const used = rows.reduce((sum, item) => sum + Number(item.usedCount || 0), 0);
  content.innerHTML = pageHead('邀请码', '注册必须填写邀请码；默认 7 天有效，可限次数或随时停用。', '<button class="primary" data-action="invite-new">生成邀请码</button>') +
    `<div class="metrics">
      ${metric('可用邀请码', available, '未过期且未用完')}
      ${metric('累计注册', used, '所有邀请码已用次数')}
      ${metric('邀请码总数', rows.length, '含已停用')}
    </div>
    <section class="panel"><div class="panel-head"><div><h2>全部邀请码</h2><p>一个码用满或到期即失效；客户端注册页填写</p></div></div>${invitesTable(rows)}</section>`;
}

function invitesPanel() {
  const rows = state.invites || [];
  return `<section class="panel"><div class="panel-head"><div><h2>注册邀请码</h2><p>默认 7 天有效，注册时必须填写；用完或过期自动失效</p></div><button class="primary" data-action="invite-new">生成邀请码</button></div>${invitesTable(rows)}</section>`;
}
function invitesTable(rows) {
  if (!rows.length) return empty('还没有邀请码');
  return `<div class="table-wrap"><table><thead><tr><th>邀请码</th><th>备注</th><th>使用</th><th>有效期至</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map((item) => {
    const expired = item.expiresAt && new Date(item.expiresAt).getTime() < Date.now();
    const usedUp = item.maxUses > 0 && item.usedCount >= item.maxUses;
    const tone = !item.enabled ? '' : (expired || usedUp) ? 'warning' : 'success';
    const label = !item.enabled ? '已停用' : expired ? '已过期' : usedUp ? '已用完' : '可用';
    return `<tr><td><span class="cell-main"><code>${esc(item.code)}</code></span><span class="cell-sub">${fmtDate(item.createdAt)} 创建</span></td><td>${esc(item.note || '—')}</td><td>${item.usedCount} / ${item.maxUses === 0 ? '不限' : item.maxUses}</td><td>${item.expiresAt ? fmtDate(item.expiresAt) : '长期'}</td><td><span class="badge ${tone}">${label}</span></td><td><div class="row-actions"><button data-action="invite-copy" data-code="${esc(item.code)}">复制</button><button data-action="invite-toggle" data-id="${esc(item.id)}" data-enabled="${item.enabled ? 'false' : 'true'}">${item.enabled ? '停用' : '启用'}</button></div></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function inviteNewModal() {
  openModal('生成邀请码', `<label>备注<input name="note" maxlength="80" placeholder="例如：小红书内测第 1 批" /></label><div class="form-row"><label>数量<input name="count" type="number" min="1" max="50" value="1" /></label><label>可用次数<select name="maxUses"><option value="1">1 次</option><option value="5">5 次</option><option value="10">10 次</option><option value="0">不限次数</option></select></label><label>有效期（天）<input name="validDays" type="number" min="1" max="365" value="7" required /></label></div><p class="muted">默认 7 天；邀请码在客户端注册页填写，一个码用满或到期即失效。</p>`, '生成', async (form) => {
    const data = await post('/api/admin/invites', { note: form.get('note'), maxUses: Number(form.get('maxUses')), validDays: Number(form.get('validDays') || 7), count: Number(form.get('count') || 1) });
    const items = data.items || [];
    await navigate('users');
    const list = items.map((item) => `<label>邀请码<input value="${esc(item.code)}" readonly /></label>`).join('');
    openModal(`已生成 ${items.length} 个邀请码`, `${list}<p class="muted">有效期至 ${esc(items[0]?.expiresAt ? new Date(items[0].expiresAt).toLocaleString('zh-CN') : '长期')}，每个可用 ${items[0]?.maxUses === 0 ? '不限' : items[0]?.maxUses} 次。</p>`, '完成', async () => {});
    try { await navigator.clipboard.writeText(items.map((item) => item.code).join('\n')); } catch { /* 手动复制 */ }
  });
}

function usersTable(rows) {
  if (!rows.length) return empty('没有匹配的用户');
  return `<div class="table-wrap"><table><thead><tr><th>用户</th><th>套餐</th><th>Credits</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead><tbody>${rows.map((user) => `<tr><td><div class="user-cell"><img class="user-avatar" src="/avatars/${esc(user.avatarUrl || defaultAvatarId(user.id))}.png" alt="账户头像" loading="lazy" /><div><span class="cell-main">${esc(user.email)}</span><span class="cell-sub">${esc(user.accountNo || '—')} · ${esc(user.name || '未命名')} · ${esc(user.membershipStatus || 'none')}${user.inviteCode ? ` · 邀请码 ${esc(user.inviteCode)}` : ''}</span></div></div></td><td>${esc(user.plan || 'free')}</td><td><span class="cell-main">${fmtNumber(user.credits)}</span></td><td>${status(user.status)}<span class="badge ${user.ossSync ? 'success' : ''}">${user.ossSync ? 'OSS 同步已开' : 'OSS 同步未开'}</span></td><td>${fmtDate(user.createdAt)}</td><td><div class="row-actions"><button data-action="user-credits" data-id="${esc(user.id)}" data-email="${esc(user.email)}">调整 Credits</button><button data-action="user-activity" data-id="${esc(user.id)}">活动</button><details class="more-menu"><summary>更多</summary><div><button data-action="user-roles" data-id="${esc(user.id)}" data-email="${esc(user.email)}">角色</button><button data-action="account-lookup" data-no="${esc(user.accountNo || '')}">渠道分组</button><button data-action="oss-sync" data-id="${esc(user.id)}" data-enabled="${user.ossSync ? 'false' : 'true'}">${user.ossSync ? '关闭 OSS 同步' : '开通 OSS 同步'}</button><button data-action="user-password" data-id="${esc(user.id)}">重置密码</button><button class="danger" data-action="user-status" data-id="${esc(user.id)}" data-status="${user.status === 'active' ? 'disabled' : 'active'}">${user.status === 'active' ? '禁用账号' : '启用账号'}</button></div></details></div></td></tr>`).join('')}</tbody></table></div>`;
}

const avatarIds = ['mascot-fox','mascot-bear','mascot-rabbit','mascot-cat','mascot-owl','mascot-bird'];
function defaultAvatarId(_userId = '') { return avatarIds[0]; }



async function userRolesModal(userID, email) {
  let roles, current;
  try {
    [roles, current] = await Promise.all([get('/api/admin/roles'), get(`/api/admin/users/${userID}/roles`)]);
  } catch (error) {
    toast(error.message || '读取角色失败');
    return;
  }
  const selected = new Set(current.codes || []);
  const rows = (roles.items || []).map((role) => `<label class="switch-row"><span>${esc(role.name)} <small>${esc(role.code)} · ${role.permissions} 项权限</small></span><input type="checkbox" name="role" value="${esc(role.code)}" ${selected.has(role.code) ? 'checked' : ''} /></label>`).join('');
  openModal(`${email} 的角色`, `<div class="form-grid">${rows}</div><p class="muted">角色决定后台权限；不能移除自己的超级管理员。</p>`, '保存', async () => {
    const codes = [...modal.querySelectorAll('input[name=role]:checked')].map((input) => input.value);
    await request(`/api/admin/users/${userID}/roles`, { method: 'PUT', body: JSON.stringify({ codes }) });
    await navigate('users');
  });
}

async function accountGroupsModal(accountNo) {
  const [current, groups] = await Promise.all([get(`/api/admin/accounts/${encodeURIComponent(accountNo)}/groups`), Promise.resolve(state.routeGroups || [])]);
  const selected = new Set(current.codes || []);
  const rows = groups.map((group) => `<label class="switch-row"><span>${esc(group.name)} <small>${esc(group.code)}</small></span><input type="checkbox" name="group" value="${esc(group.code)}" ${selected.has(group.code) ? 'checked' : ''} /></label>`).join('');
  openModal(`账户 ${accountNo} 的渠道组`, `<div class="form-grid">${rows || empty('还没有分组')}</div><p class="muted">勾选的分组会优先命中；组内渠道全部不可用时自动回退默认组。</p>`, '保存', async () => {
    const codes = [...modal.querySelectorAll('input[name=group]:checked')].map((input) => input.value);
    await request(`/api/admin/accounts/${encodeURIComponent(accountNo)}/groups`, { method: 'PUT', body: JSON.stringify({ codes }) });
    await navigate('users');
  });
}

async function accountLookupModal(accountNo) {
  modal.innerHTML = `<div class="modal-inner"><div class="modal-head"><div><span class="eyebrow">ACCOUNT</span><h2>账户 ${esc(accountNo)}</h2></div><button type="button" class="modal-close" data-close-modal>×</button></div><div class="activity-loading">读取账户关联信息…</div><div class="modal-actions"><button type="button" class="primary" data-close-modal>关闭</button></div></div>`;
  modal.showModal();
  modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
  try {
    const data = await get(`/api/admin/accounts/${encodeURIComponent(accountNo)}`);
    const tasks = (data.recentTasks || []).map((task) => `<tr><td><span class="cell-sub">${esc(task.id.slice(0, 8))}</span></td><td>${esc(task.model || '—')}</td><td>${status(task.status)}</td><td>${fmtNumber(task.cost)}</td><td>${fmtDate(task.createdAt)}</td></tr>`).join('') || emptyRow(5);
    modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">ACCOUNT</span><h2>${esc(data.accountNo)} · ${esc(data.email)}</h2><p>${esc(data.name || '未命名')} · ${esc(data.plan)} · 注册于 ${fmtDate(data.createdAt)}</p></div><button type="button" class="modal-close" data-close-modal>×</button></div><div class="activity-summary"><div><small>账户 ID</small><strong>${esc(data.accountNo)}</strong><span>OSS 一级目录</span></div><div><small>可用 / 冻结</small><strong>${fmtNumber(data.credits)}</strong><span>冻结 ${fmtNumber(data.reserved)}</span></div><div><small>任务</small><strong>${fmtNumber(data.tasks)}</strong><span>成功 ${fmtNumber(data.successes)}</span></div><div><small>素材</small><strong>${fmtNumber(data.assets)}</strong><span>邀请码 ${esc(data.inviteCode || '—')}</span></div><div><small>OSS 同步</small><strong>${data.ossSync ? '已开通' : '未开通'}</strong><span>客户端不可自行开启</span></div></div><div class="activity-body"><section class="activity-section"><h3>最近任务</h3><div class="table-wrap"><table><thead><tr><th>ID</th><th>模型</th><th>状态</th><th>Credits</th><th>时间</th></tr></thead><tbody>${tasks}</tbody></table></div></section></div><div class="activity-actions"><span class="muted">账户 ID 用于对账、工单与对象存储目录</span><button type="button" class="secondary" data-action="account-groups" data-no="${esc(data.accountNo)}">配置渠道组</button><button type="button" class="primary" data-close-modal>关闭</button></div></div>`;
    modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
  } catch (error) {
    modal.querySelector('.activity-loading').textContent = error.message;
  }
}


async function loadRoles() {
  const [rolesData, usersData] = await Promise.all([get('/api/admin/roles'), get('/api/admin/users')]);
  const roles = rolesData.items || [];
  const users = usersData || [];
  const roleMap = new Map();
  await Promise.all(users.map(async (user) => {
    const data = await get(`/api/admin/users/${user.id}/roles`).catch(() => ({ codes: [] }));
    roleMap.set(user.id, new Set(data.codes || []));
  }));
  const rows = users.map((user) => `<tr data-user="${esc(user.id)}"><td><span class="cell-main">${esc(user.email)}</span><span class="cell-sub">${esc(user.accountNo || '—')}</span></td>${roles.map((role) => `<td><input type="checkbox" name="role-${esc(user.id)}" value="${esc(role.code)}" ${roleMap.get(user.id)?.has(role.code) ? 'checked' : ''} /></td>`).join('')}<td><button data-action="roles-save" data-id="${esc(user.id)}">保存</button></td></tr>`).join('');
  content.innerHTML = pageHead('角色权限', '给每个账户分配角色；角色决定后台可见与可操作范围。') + `<div class="panel"><div class="panel-head"><div><h2>账户角色</h2><p>super_admin 拥有全部权限；不能移除自己的超级管理员</p></div><span class="badge gold">${users.length} 个账户</span></div><div class="table-wrap"><table><thead><tr><th>账户</th>${roles.map((role) => `<th>${esc(role.name)}<span class="cell-sub">${role.permissions} 项权限</span></th>`).join('')}<th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

async function loadCommerce() {
  const [plans, orders, payments] = await Promise.all([get('/api/admin/plans'), get('/api/admin/orders'), get('/api/admin/payments')]);
  state.plans = plans || []; state.orders = orders || []; state.payments = payments || [];
  content.innerHTML = pageHead('商业中心', '套餐、订单、支付与收入。') + renderCommerceTabs() + '<div id="commerceBody"></div>';
  renderCommerceBody();
}
function renderCommerceTabs() {
  return `<div class="tabs">${[['plans', '套餐'], ['orders', '订单'], ['payments', '支付']].map(([id, label]) => `<button type="button" class="${state.commerceTab === id ? 'active' : ''}" data-action="commerce-tab" data-tab="${id}">${label}</button>`).join('')}</div>`;
}
function renderCommerceBody() {
  const body = $('commerceBody');
  if (state.commerceTab === 'plans') renderInto(body, `<div class="panel"><div class="panel-head"><div><h2>套餐</h2><p>价格与启用状态可调整</p></div></div>${plansTable(state.plans)}</div>`);
  else if (state.commerceTab === 'orders') renderInto(body, `<div class="panel"><div class="panel-head"><div><h2>订单</h2><p>最近 200 笔</p></div></div>${ordersTable(state.orders)}</div>`);
  else renderInto(body, `<div class="panel"><div class="panel-head"><div><h2>支付记录</h2><p>Provider 与到账状态</p></div></div>${paymentsTable(state.payments)}</div>`);
}
function plansTable(rows) {
  if (!rows.length) return empty('还没有套餐');
  return `<div class="table-wrap"><table><thead><tr><th>套餐</th><th>价格</th><th>Credits</th><th>设备</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map((plan) => `<tr><td><span class="cell-main">${esc(plan.name)}</span><span class="cell-sub">${esc(plan.code)} · ${esc(plan.billingCycle)}</span></td><td>${fmtMoney(plan.priceMinor)}</td><td>${fmtNumber(plan.includedCredits)}</td><td>${plan.maxDevices}</td><td>${status(plan.enabled ? 'active' : 'disabled')}</td><td><button class="mini" data-action="plan-edit" data-id="${esc(plan.id)}">编辑</button></td></tr>`).join('')}</tbody></table></div>`;
}
function paymentsTable(rows) {
  if (!rows.length) return empty('还没有支付记录');
  return `<div class="table-wrap"><table><thead><tr><th>Provider</th><th>订单</th><th>金额</th><th>状态</th><th>时间</th></tr></thead><tbody>${rows.map((row) => `<tr><td><span class="cell-main">${esc(row.provider)}</span><span class="cell-sub">${esc(row.id.slice(0, 8))}</span></td><td>${esc(row.orderId.slice(0, 8))}</td><td>${fmtMoney(row.amountMinor)} ${esc(row.currency)}</td><td>${status(row.status)}</td><td>${fmtDate(row.paidAt || row.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
}
// Modalities and the input → output contract of each purpose; mirrors
// routing.purposeIO on the server so the console derives the same answer.
const MODALITIES = [['text', '文本'], ['image', '图像'], ['video', '视频'], ['audio', '音频'], ['speech', '语音']];
const modalityLabel = (id) => (MODALITIES.find(([key]) => key === id) || [id, id])[1];
const PURPOSES = [
  ['text_to_image', '文生图', ['text'], 'image'], ['image_to_image', '参考图生图', ['text', 'image'], 'image'], ['image_edit', '图片编辑', ['text', 'image'], 'image'],
  ['text_to_video', '文生视频', ['text'], 'video'], ['image_to_video', '图生视频', ['text', 'image'], 'video'], ['reference_to_video', '参考生视频', ['text', 'image'], 'video'], ['video_edit', '视频编辑', ['text', 'video'], 'video'],
  ['audio_generation', '音乐 / 音效生成', ['text'], 'audio'],
  ['tts', '语音合成', ['text'], 'speech'],
  ['text_generation', '文本生成（文案 / 对话）', ['text'], 'text'], ['vision', '图像 / 视频理解', ['text', 'image', 'video'], 'text'], ['asr', '语音识别', ['speech'], 'text'],
];
function deriveIO(purposes) {
  const inputs = new Set(); const outputs = new Set();
  purposes.forEach((id) => { const p = PURPOSES.find(([key]) => key === id); if (p) { p[2].forEach((m) => inputs.add(m)); outputs.add(p[3]); } });
  const order = MODALITIES.map(([m]) => m);
  return [order.filter((m) => inputs.has(m)), order.filter((m) => outputs.has(m))];
}
const ioLabel = (inputs, outputs) => `${(inputs || []).map(modalityLabel).join(' + ') || '—'} → ${(outputs || []).map(modalityLabel).join(' + ') || '—'}`;
const purposeLabel = (id) => (PURPOSES.find(([key]) => key === id) || [id, id])[1];
const MODEL_REASONS = {
  ok: ['success', '正常'], single_channel: ['warning', '只有 1 个可用渠道'], hidden: ['', '客户端已隐藏'], no_channel: ['danger', '没有绑定渠道'],
  no_usable_channel: ['danger', '没有可用渠道'], video_provider_unsupported: ['danger', '该渠道暂不支持视频'],
};
const CHANNEL_STATUS = {
  ok: ['success', '正常'], degraded: ['warning', '部分 Key 失效'], auth_failed: ['danger', 'Key 全部失效'], no_key: ['danger', '没有可用 Key'], cooldown: ['warning', '冷却中'], disabled: ['', '已停用'],
};
// Plain-language explanations for provider error codes seen in route logs.
const ERROR_HELP = {
  AUTH_FAILED: 'Key 无效、过期或无权限：到「渠道与 Key」更新 Key 或点测试',
  PROVIDER_ERROR: '供应商返回未分类错误：看调用日志里的渠道和时间，联系供应商',
  TIMEOUT: '供应商响应超时：高峰期常见，可调高备用渠道优先级',
  RATE_LIMITED: '触发限流：增加 Key 或降低该渠道权重',
  INVALID_REQUEST: '请求参数不被接受：多为尺寸、参考图或模型能力不匹配，检查模型用途设置',
  InvalidParameter: '参数无效：多为尺寸或参考图格式不被该模型支持',
  NO_CHANNEL: '没有可用渠道：模型未绑定渠道，或渠道 / Key 全部不可用',
  UNKNOWN: '未知错误：结合任务详情时间线排查',
  OK: '成功',
};
const errorHelp = (code) => ERROR_HELP[code] || '';
const pct = (ok, failed) => { const total = ok + failed; return total ? `${Math.round((ok / total) * 100)}%` : '—'; };
const badge = ([tone, label]) => `<span class="badge ${tone}">${esc(label)}</span>`;

async function loadAI() {
  const [health, channelData, groupData, pricingData, storageData] = await Promise.all([get('/api/admin/ai/health'), get('/api/admin/ai/channels'), get('/api/admin/route-groups'), get('/api/admin/pricing').catch(() => null), get('/api/admin/storage').catch(() => null)]);
  state.aiHealth = health || { models: [], channels: [] };
  state.channels = channelData.items || [];
  state.routeGroups = groupData?.items || [];
  state.aiPricing = pricingData?.items || [];
  state.aiStorage = storageData || null;
  if (!['overview', 'models', 'channels', 'logs', 'groups'].includes(state.aiTab)) state.aiTab = 'overview';
  content.innerHTML = pageHead('AI Studio', '模型能不能用、为什么不能用、谁在失败，在这里一眼看清。') + renderAITabs() + '<div id="aiBody"></div>';
  renderAIBody();
}
function renderAITabs() {
  return `<div class="tabs">${[['overview', '健康看板'], ['models', '模型'], ['channels', '渠道与 Key'], ['logs', '调用日志'], ['groups', '分组与价格']].map(([id, label]) => `<button type="button" class="${state.aiTab === id ? 'active' : ''}" data-action="ai-tab" data-tab="${id}">${label}</button>`).join('')}</div>`;
}
function renderAIBody() {
  const body = $('aiBody');
  if (state.aiTab === 'overview') renderInto(body, renderAIOverview());
  else if (state.aiTab === 'models') renderInto(body, renderModelsTab());
  else if (state.aiTab === 'channels') renderInto(body, renderChannelsTab());
  else if (state.aiTab === 'logs') { renderInto(body, '<div id="logsBody">' + loading() + '</div>'); void loadLogs(); return; }
  else renderInto(body, `<div class="panel"><div class="panel-head"><div><h2>渠道分组</h2><p>把优质渠道放进独立分组并绑定给指定账户（如大客户）；组内全部不可用时自动回退默认组。倍率只影响售价。</p></div><div class="row-actions"><button class="secondary" data-action="go-pricing">定价与成本</button><button class="primary" data-action="group-new">新建分组</button></div></div>${routeGroupsTable(state.routeGroups || [])}</div>`);
  if (state.aiTab === 'models') bindModelFilters();
  enhanceTables(body);
}

function renderAIOverview() {
  const models = state.aiHealth.models || [];
  const channels = state.aiHealth.channels || [];
  const visible = models.filter((m) => m.enabled && ['image', 'video'].includes(m.modality));
  const ok = visible.filter((m) => m.reason === 'ok' || m.reason === 'single_channel');
  const success = channels.reduce((n, c) => n + c.success24h, 0);
  const failed = channels.reduce((n, c) => n + c.failed24h, 0);
  const alerts = [];
  channels.filter((c) => c.status === 'auth_failed' || c.status === 'no_key').forEach((c) => alerts.push({ level: 'danger', text: `渠道「${c.name}」${CHANNEL_STATUS[c.status][1]}，绑定在它上面的模型可能已不可用`, action: `<button class="mini" data-action="ai-tab" data-tab="channels">去处理</button>` }));
  channels.filter((c) => c.status === 'degraded').forEach((c) => alerts.push({ level: 'warning', text: `渠道「${c.name}」有 ${c.rejectedKeys} 把 Key 被供应商拒绝，已自动停用`, action: `<button class="mini" data-action="ai-tab" data-tab="channels">查看 Key</button>` }));
  visible.filter((m) => ['no_channel', 'no_usable_channel', 'video_provider_unsupported'].includes(m.reason)).forEach((m) => alerts.push({ level: 'danger', text: `模型「${m.displayName}」客户端可见但${MODEL_REASONS[m.reason][1]}，客户点了必定失败`, action: `<button class="mini" data-action="model-edit" data-key="${esc(m.key)}">隐藏或修复</button>` }));
  visible.filter((m) => m.reason === 'single_channel' && (m.success24h + m.failed24h) > 0).forEach((m) => alerts.push({ level: 'warning', text: `模型「${m.displayName}」只有 1 个可用渠道，渠道出问题就会停摆`, action: `<button class="mini" data-action="model-routes" data-key="${esc(m.key)}">看路由</button>` }));
  channels.filter((c) => c.status === 'cooldown').forEach((c) => alerts.push({ level: 'warning', text: `渠道「${c.name}」连续失败，冷却到 ${fmtDate(c.cooldownUntil)}`, action: '' }));
  const blocked = (state.aiPricing || []).filter((row) => row.status === 'block').length;
  if (blocked) alerts.push({ level: 'danger', text: `${blocked} 条定价低于毛利红线，已被拦截`, action: '<button class="mini" data-action="go-pricing">定价</button>' });
  if (success + failed >= 10 && failed / (success + failed) >= 0.1) alerts.push({ level: 'warning', text: `24 小时渠道调用失败率 ${pct(failed, success)} 失败，请看调用日志`, action: '<button class="mini" data-action="ai-tab" data-tab="logs">看日志</button>' });
  if (!alerts.length) alerts.push({ level: 'success', text: '没有需要处理的问题', action: '' });
  const order = { danger: 0, warning: 1, success: 2 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);
  return `<div class="metrics">
      ${metric('客户端可用模型', `${ok.length}/${visible.length}`, '可用 / 客户端可见')}
      ${metric('渠道', `${channels.filter((c) => c.status === 'ok').length}/${channels.filter((c) => c.enabled).length}`, '正常 / 启用')}
      ${metric('24h 渠道调用', fmtNumber(success + failed), `成功率 ${pct(success, failed)}`)}
      ${metric('对象存储', state.aiStorage?.provider === 'oss' ? 'OSS' : '本地磁盘', state.aiStorage?.bucket || '未配置')}
    </div>
    <section class="panel"><div class="panel-head"><div><h2>需要处理</h2><p>按严重程度排序；Key 被供应商拒绝（401/403）时系统会自动停用该 Key</p></div><button class="mini" data-action="ai-refresh">刷新</button></div>
      ${alerts.map((a) => `<div class="alert-row"><span class="badge ${a.level === 'danger' ? 'danger' : a.level === 'warning' ? 'warning' : 'success'}">${a.level === 'danger' ? '严重' : a.level === 'warning' ? '注意' : '正常'}</span><span>${esc(a.text)}</span><span class="spacer"></span>${a.action}</div>`).join('')}
    </section>
    <section class="panel"><div class="panel-head"><div><h2>客户端模型一览</h2><p>每个客户能看到的模型现在能不能用</p></div><button class="mini" data-action="ai-tab" data-tab="models">管理模型</button></div>
      <div class="model-health-grid">${visible.map((m) => `<button type="button" class="model-health ${MODEL_REASONS[m.reason]?.[0] || ''}" data-action="model-routes" data-key="${esc(m.key)}"><strong>${esc(m.displayName)}</strong><small>${esc(ioLabel(m.inputs, m.outputs))}</small><small>${m.usable}/${m.bindings} 渠道 · 24h ${pct(m.success24h, m.failed24h)}</small>${m.reason !== 'ok' ? `<em>${esc(MODEL_REASONS[m.reason]?.[1] || m.reason)}</em>` : ''}</button>`).join('') || empty('还没有模型')}</div>
    </section>`;
}

function renderModelsTab() {
  const models = state.aiHealth.models || [];
  const filter = state.modelPurpose || 'all';
  const matches = (m, id) => id === 'all' || (id === 'problem' ? m.enabled && !['ok', 'single_channel'].includes(m.reason) : id === 'hidden' ? !m.enabled : (m.outputs || []).includes(id));
  const chips = [['all', '全部'], ...MODALITIES.map(([id, label]) => [id, `输出${label}`]), ['problem', '有问题'], ['hidden', '已隐藏']].map(([id, label]) => {
    const count = models.filter((m) => matches(m, id)).length;
    return count || id === 'all' ? `<button type="button" class="${filter === id ? 'active' : ''}" data-action="model-purpose" data-purpose="${id}">${label} <small>${count}</small></button>` : '';
  }).join('');
  return `<div class="panel"><div class="panel-head"><div><h2>模型</h2><p>按「输入 → 输出」模态区分模型：用途决定输入输出和它出现在客户端哪个入口（客户端目前开放图像、视频；文本、语音、音频模型供文案、配音、视频拆解等功能调用）；售价在「定价与成本」修改</p></div></div>
    <div class="tabs sub-tabs">${chips}</div>
    <div class="toolbar" style="margin:12px 0"><input id="modelFilter" placeholder="搜索名称或 Key" /></div>
    <div class="table-wrap"><table><thead><tr><th>模型</th><th>输入 → 输出</th><th>用途</th><th>售价</th><th>渠道</th><th>24h 成功率</th><th>状态</th><th>操作</th></tr></thead><tbody>${models.filter((m) => matches(m, filter)).map((m) => `<tr><td><span class="cell-main">${esc(m.displayName)}</span><span class="cell-sub">${esc(m.key)}${(m.tags || []).length ? ' · ' + m.tags.map(esc).join(' / ') : ''}</span></td><td><span class="io">${esc(ioLabel(m.inputs, m.outputs))}</span></td><td>${(m.capabilities || []).map((c) => `<span class="badge">${esc(purposeLabel(c))}</span>`).join(' ')}</td><td>${fmtNumber(m.credits)}</td><td>${m.usable}/${m.bindings}<span class="cell-sub">${esc((m.providers || []).join(', ') || '—')}</span></td><td>${pct(m.success24h, m.failed24h)}${m.lastError ? `<span class="cell-sub" title="${esc(errorHelp(m.lastError))}">最近错误 ${esc(m.lastError)}</span>` : ''}</td><td>${badge(MODEL_REASONS[m.reason] || ['', m.reason])}</td><td><div class="row-actions"><button data-action="model-edit" data-key="${esc(m.key)}">编辑</button><button data-action="model-routes" data-key="${esc(m.key)}">路由</button><button data-action="model-visibility" data-key="${esc(m.key)}" data-enabled="${m.enabled ? 'false' : 'true'}">${m.enabled ? '隐藏' : '显示'}</button></div></td></tr>`).join('') || emptyRow(8)}</tbody></table></div></div>`;
}
function bindModelFilters() {
  const input = $('modelFilter');
  input?.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    document.querySelectorAll('#aiBody tbody tr').forEach((row) => { row.dataset.filtered = Boolean(query) && !row.textContent.toLowerCase().includes(query) ? '1' : '0'; });
    refreshTables();
  });
}
function purposeChecks(selected) {
  return `<div class="purpose-groups">${MODALITIES.map(([out, label]) => `<fieldset class="purpose-group"><legend>输出${label}</legend>${PURPOSES.filter((p) => p[3] === out).map(([id, name, inputs]) => `<label title="${esc(inputs.map(modalityLabel).join(' + '))} → ${label}"><input type="checkbox" name="purpose" value="${id}" ${selected.includes(id) ? 'checked' : ''} /> ${name}<small>${esc(inputs.map(modalityLabel).join('+'))}</small></label>`).join('')}</fieldset>`).join('')}</div><p class="muted io-preview" id="ioPreview"></p>`;
}
function bindIOPreview() {
  const update = () => { const picked = [...modal.querySelectorAll('input[name=purpose]:checked')].map((input) => input.value); const [inputs, outputs] = deriveIO(picked); const preview = $('ioPreview'); if (preview) preview.textContent = picked.length ? `这个模型：${ioLabel(inputs, outputs)}` : '至少勾选一个用途'; };
  modal.querySelectorAll('input[name=purpose]').forEach((input) => input.addEventListener('change', update));
  update();
}
function suggestPurposes(id) {
  const v = id.toLowerCase();
  const has = (...parts) => parts.some((p) => v.includes(p));
  if (has('vl-', '-vl', 'vision', 'omni', 'qvq')) return ['text', ['vision']];
  if (has('tts', 'cosyvoice', 'sambert', 'speech-synth')) return ['speech', ['tts']];
  if (has('asr', 'paraformer', 'sensevoice', 'whisper', 'transcri')) return ['text', ['asr']];
  if (has('music', 'suno', 'audio', 'sound')) return ['audio', ['audio_generation']];
  if (has('videoedit', 'video-edit')) return ['video', ['video_edit']];
  if (has('r2v')) return ['video', ['reference_to_video']];
  if (has('i2v')) return ['video', ['image_to_video']];
  if (has('t2v')) return ['video', ['text_to_video']];
  if (has('seedance', 'kling', 'hailuo', 'vidu')) return ['video', ['text_to_video', 'image_to_video']];
  if (has('veo', 'sora', 'video')) return ['video', ['text_to_video']];
  if (has('imageedit', 'image-edit', '-edit')) return ['image', ['image_to_image', 'image_edit']];
  if (has('t2i')) return ['image', ['text_to_image']];
  if (has('image', 'banana', 'seedream', 'flux')) return ['image', ['text_to_image', 'image_to_image']];
  if (has('gpt', 'qwen', 'deepseek', 'glm', 'claude', 'gemini', 'kimi', 'doubao', 'llama', 'chat', 'turbo', 'max', 'plus')) return ['text', ['text_generation']];
  return ['image', ['text_to_image']];
}
function modelEditModal(model) {
  const [, suggested] = suggestPurposes(model.key);
  openModal(`编辑模型 · ${model.displayName}`, `<label>显示名（客户端看到的名字）<input name="displayName" maxlength="60" required value="${esc(model.displayName)}" /></label><label>一句话说明<input name="description" maxlength="200" value="${esc(model.description || '')}" placeholder="例如：擅长中文文字海报，速度快" /></label><div><div class="field-head"><strong>用途（决定输入 → 输出）</strong><button type="button" class="mini" id="applySuggest">按模型名推荐：${suggested.map(purposeLabel).join('、')}</button></div>${purposeChecks(model.capabilities || [])}<p class="muted">只勾「文生图」的模型，客户选了商品参考图时会显示「不支持商品参考图」。请按供应商文档如实勾选；推荐只按名字猜，不会自动保存。</p></div><label>特点标签（逗号分隔，最多 6 个）<input name="tags" value="${esc((model.tags || []).join('，'))}" placeholder="擅长文字，速度快，商品一致性好" /></label><div class="form-row"><label>排序（越小越靠前）<input name="sortOrder" type="number" value="${model.sortOrder ?? 100}" /></label><label>客户端<select name="enabled"><option value="true" ${model.enabled ? 'selected' : ''}>显示</option><option value="false" ${!model.enabled ? 'selected' : ''}>隐藏</option></select></label></div>`, '保存', async (form) => {
    const capabilities = [...modal.querySelectorAll('input[name=purpose]:checked')].map((input) => input.value);
    if (!capabilities.length) throw new Error('至少选择一个用途');
    const tags = String(form.get('tags') || '').split(/[,，、]/).map((t) => t.trim()).filter(Boolean).slice(0, 6);
    await patch(`/api/admin/ai/logical-models/${encodeURIComponent(model.key)}`, { displayName: form.get('displayName'), description: form.get('description'), capabilities, tags, sortOrder: Number(form.get('sortOrder')) || 100, enabled: form.get('enabled') === 'true' });
    await navigate('ai');
  });
  $('applySuggest')?.addEventListener('click', () => { modal.querySelectorAll('input[name=purpose]').forEach((input) => { input.checked = suggested.includes(input.value); }); modal.querySelector('input[name=purpose]')?.dispatchEvent(new Event('change')); });
  bindIOPreview();
}
async function modelRoutesModal(key) {
  const model = (state.aiHealth.models || []).find((m) => m.key === key);
  modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">MODEL ROUTES</span><h2>${esc(model?.displayName || key)}</h2><p>客户选这个模型时，按优先级（大的先）和权重选择下面的渠道；渠道或 Key 不可用时自动跳过</p></div><button type="button" class="modal-close" data-close-modal>×</button></div><div class="activity-loading">读取路由…</div></div>`;
  modal.showModal();
  modal.querySelectorAll('[data-close-modal]').forEach((b) => b.addEventListener('click', () => modal.close()));
  const [routing, logs] = await Promise.all([get('/api/admin/ai/routing'), get(`/api/admin/ai/logs?model=${encodeURIComponent(key)}&hours=168&limit=10`).catch(() => ({ items: [] }))]);
  state.routing = routing;
  const channelStatus = new Map((state.aiHealth.channels || []).map((c) => [c.name, c.status]));
  const rows = (routing.bindings || []).filter((b) => b.logicalKey === key).map((b) => `<tr><td>${esc(b.channelName)}<span class="cell-sub">${esc(b.provider)} · ${esc(b.providerModelId)}</span></td><td>${badge(CHANNEL_STATUS[channelStatus.get(b.channelName)] || ['', '—'])}</td><td>${b.priority}</td><td>${b.weight}</td><td>${b.enabled ? status('active') : status('disabled')}${b.cooldownUntil ? `<span class="cell-sub">冷却至 ${fmtDate(b.cooldownUntil)}</span>` : ''}</td><td><button class="mini" data-action="routing-edit" data-id="${esc(b.id)}">调整</button></td></tr>`).join('') || emptyRow(6);
  const recent = (logs.items || []).map((row) => `<tr><td>${fmtDate(row.createdAt)}</td><td>${esc(row.channelName)}</td><td>${status(row.status === 'success' ? 'success' : 'failed')}</td><td title="${esc(errorHelp(row.errorCode))}">${esc(row.errorCode || '—')}</td><td>${fmtNumber(row.latencyMs)} ms</td></tr>`).join('') || emptyRow(5);
  modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">MODEL ROUTES</span><h2>${esc(model?.displayName || key)}</h2><p>${model ? `${model.usable}/${model.bindings} 个渠道可用 · ${esc(MODEL_REASONS[model.reason]?.[1] || '')}` : ''}</p></div><button type="button" class="modal-close" data-close-modal>×</button></div><div class="activity-body"><section class="activity-section"><h3>渠道</h3><div class="table-wrap"><table><thead><tr><th>渠道 / 模型 ID</th><th>渠道状态</th><th>优先级</th><th>权重</th><th>路由状态</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><p class="muted">要给这个模型加备用渠道：到「渠道与 Key」→ 目标渠道 → 发现模型，勾选同名模型并在「接入为」里填 <code>${esc(key)}</code>。</p></section><section class="activity-section"><h3>最近 10 次调用（7 天）</h3><div class="table-wrap"><table><thead><tr><th>时间</th><th>渠道</th><th>结果</th><th>错误码</th><th>延迟</th></tr></thead><tbody>${recent}</tbody></table></div></section></div><div class="activity-actions"><button type="button" class="secondary" data-action="model-edit" data-key="${esc(key)}">编辑模型</button><button type="button" class="primary" data-close-modal>关闭</button></div></div>`;
  modal.querySelectorAll('[data-close-modal]').forEach((b) => b.addEventListener('click', () => modal.close()));
}

function renderChannelsTab() {
  const health = new Map((state.aiHealth.channels || []).map((c) => [c.id, c]));
  const rows = (state.channels || []).map((channel) => {
    const h = health.get(channel.id) || { status: channel.enabled ? 'ok' : 'disabled', enabledKeys: 0, keys: 0, rejectedKeys: 0, success24h: 0, failed24h: 0, lastError: '' };
    return `<tr><td><span class="cell-main">${esc(channel.name)}</span><span class="cell-sub">${esc(providerLabel(channel.providerCode))} · 生成 ${esc(channel.baseUrl || '默认')}</span>${channel.modelsUrl ? `<span class="cell-sub">模型列表 ${esc(channel.modelsUrl)}</span>` : ''}</td><td>${badge(CHANNEL_STATUS[h.status] || ['', h.status])}${h.lastError ? `<span class="cell-sub">${esc(h.lastError.slice(0, 60))}</span>` : ''}</td><td>${h.enabledKeys}/${h.keys}${h.rejectedKeys ? `<span class="cell-sub">${h.rejectedKeys} 把被拒绝</span>` : ''}</td><td>${channel.modelCount}</td><td>${pct(h.success24h, h.failed24h)}<span class="cell-sub">${fmtNumber(h.success24h + h.failed24h)} 次</span></td><td>${channel.priority} / ${channel.weight}</td><td><div class="row-actions"><button data-action="channel-test" data-id="${esc(channel.id)}">测试</button><button data-action="channel-keys" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">Key</button><button data-action="channel-discover" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">发现模型</button><details class="more-menu"><summary>更多</summary><div><button data-action="channel-key" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">添加 Key</button><button data-action="channel-models" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">已接入模型</button><button data-action="channel-model-add" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">手动接入模型</button><button data-action="channel-edit" data-id="${esc(channel.id)}">优先级 / 权重</button><button data-action="channel-meta" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}" data-url="${esc(channel.baseUrl || '')}">名称 / 地址</button><button data-action="channel-toggle" data-id="${esc(channel.id)}" data-enabled="${channel.enabled ? 'false' : 'true'}">${channel.enabled ? '停用渠道' : '启用渠道'}</button><button class="danger" data-action="channel-delete" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">删除渠道</button></div></details></div></td></tr>`;
  }).join('');
  return `<div class="panel"><div class="panel-head"><div><h2>渠道与 Key</h2><p>一个渠道 = 一个供应商账号，可挂多把 Key。「测试」只读取模型列表，不产生费用；Key 被供应商拒绝时会自动停用并标注原因</p></div><button class="primary" data-action="channel-new">新增渠道</button></div>${rows ? `<div class="table-wrap"><table><thead><tr><th>渠道</th><th>状态</th><th>可用 Key</th><th>模型</th><th>24h 成功率</th><th>优先级/权重</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('还没有渠道')}</div>`;
}
async function channelTest(channelID, button) {
  setBusy(button, true);
  try {
    const keys = (await get(`/api/admin/ai/channels/${channelID}/keys`)).items || [];
    if (!keys.length) { toast('这个渠道还没有 Key'); return; }
    const results = [];
    for (const key of keys) {
      const r = await post(`/api/admin/ai/channel-keys/${key.id}/test`, {});
      results.push(`•••• ${key.last4}：${r.ok ? '✓ ' : '✗ '}${r.message}（${r.latencyMs} ms）${!key.enabled ? ' [当前停用]' : ''}`);
    }
    openModal('连接测试结果', `<div class="test-results">${results.map((line) => `<p>${esc(line)}</p>`).join('')}</div><p class="muted">测试通过但被停用的 Key，可在「Key」里重新启用。</p>`, '好的', async () => {});
  } catch (error) { toast(error.message); }
  finally { setBusy(button, false); }
}

async function loadLogs() {
  const f = state.logFilter || (state.logFilter = { hours: 24, model: '', channel: '', status: '', code: '' });
  const query = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, String(v)]));
  const data = await get(`/api/admin/ai/logs?${query}`).catch((error) => { toast(error.message); return { items: [], byCode: [], byChannel: [], byModel: [] }; });
  const models = state.aiHealth.models || [];
  const options = (list, value) => list.map(([v, label]) => `<option value="${esc(v)}" ${value === v ? 'selected' : ''}>${esc(label)}</option>`).join('');
  const summary = (list, key) => list.length ? list.map((s) => `<button type="button" class="log-chip ${s.failed ? 'bad' : ''}" data-action="log-filter" data-key="${key}" data-value="${esc(s.key === 'OK' ? '' : s.key)}" title="${esc(errorHelp(s.key))}"><strong>${esc(s.label)}</strong> ${fmtNumber(s.count)}${s.failed ? ` · 失败 ${fmtNumber(s.failed)}` : ''}</button>`).join('') : '<span class="muted">无</span>';
  const rows = (data.items || []).map((row) => `<tr><td>${fmtDate(row.createdAt)}</td><td><span class="cell-main">${esc(row.model)}</span><span class="cell-sub">${esc(row.providerModelId)}</span></td><td>${esc(row.channelName || '—')}${row.keyLast4 ? `<span class="cell-sub">•••• ${esc(row.keyLast4)}</span>` : ''}</td><td>${status(row.status === 'success' ? 'success' : 'failed')}${row.attempt > 1 ? `<span class="cell-sub">第 ${row.attempt} 次尝试</span>` : ''}</td><td>${row.errorCode ? `<span class="cell-main">${esc(row.errorCode)}</span><span class="cell-sub">${esc(errorHelp(row.errorCode))}</span>` : '—'}</td><td>${fmtNumber(row.latencyMs)} ms</td><td>${esc(row.userEmail || '—')}</td><td>${row.taskId ? `<button class="mini" data-action="task-detail" data-id="${esc(row.taskId)}">任务</button>` : ''}</td></tr>`).join('');
  renderInto($('logsBody'), `<div class="panel"><div class="panel-head"><div><h2>调用日志</h2><p>每一次渠道调用；点错误码汇总可快速筛选，点「任务」看完整时间线</p></div></div>
    <form id="logForm" class="toolbar log-filters"><select name="hours">${options([['1', '1 小时'], ['24', '24 小时'], ['168', '7 天'], ['720', '30 天']], String(f.hours))}</select><select name="model"><option value="">全部模型</option>${options(models.map((m) => [m.key, m.displayName]), f.model)}</select><select name="channel"><option value="">全部渠道</option>${options((state.channels || []).map((c) => [c.id, c.name]), f.channel)}</select><select name="status">${options([['', '全部结果'], ['success', '成功'], ['failed', '失败']], f.status)}</select><input name="code" placeholder="错误码" value="${esc(f.code)}" /><button class="secondary" type="submit">筛选</button><button class="ghost" type="button" data-action="log-reset">重置</button></form>
    <div class="log-summary"><div><h3>按错误码</h3>${summary(data.byCode || [], 'code')}</div><div><h3>按渠道</h3>${summary((data.byChannel || []).map((s) => ({ ...s })), 'channel')}</div><div><h3>按模型</h3>${summary(data.byModel || [], 'model')}</div></div>
    ${rows ? `<div class="table-wrap"><table><thead><tr><th>时间</th><th>模型</th><th>渠道 / Key</th><th>结果</th><th>错误</th><th>延迟</th><th>用户</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('这个条件下没有调用记录')}</div>`);
  $('logForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    state.logFilter = { hours: Number(form.get('hours')) || 24, model: String(form.get('model') || ''), channel: String(form.get('channel') || ''), status: String(form.get('status') || ''), code: String(form.get('code') || '').trim() };
    void loadLogs();
  });
  enhanceTables($('logsBody'));
}


function routingTable(rows) {
  if (!rows.length) return empty('还没有路由绑定');
  return `<div class="table-wrap"><table><thead><tr><th>逻辑模型</th><th>渠道</th><th>渠道模型</th><th>售价</th><th>优先级</th><th>权重</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map((row) => `<tr><td><span class="cell-main">${esc(row.logicalName || row.logicalKey)}</span><span class="cell-sub">${esc(row.logicalKey)} · ${esc(row.modality)}</span></td><td>${esc(row.channelName)}<span class="cell-sub">${esc(row.provider)}</span></td><td><span class="cell-sub">${esc(row.providerModelId)}</span></td><td>${fmtNumber(row.credits)}</td><td>${row.priority}</td><td>${row.weight}</td><td>${row.enabled ? status('active') : status('disabled')}${row.cooldownUntil ? `<span class="cell-sub">冷却至 ${fmtDate(row.cooldownUntil)}</span>` : ''}</td><td><button data-action="routing-edit" data-id="${esc(row.id)}">调整</button></td></tr>`).join('')}</tbody></table></div>`;
}
function routingEditModal(binding) {
  openModal('调整路由', `<label>逻辑模型<input value="${esc(binding.logicalName || binding.logicalKey)} → ${esc(binding.channelName)}" disabled /></label><div class="form-row"><label>优先级<input name="priority" type="number" min="0" max="10000" value="${binding.priority}" /></label><label>权重<input name="weight" type="number" min="0" max="1000" value="${binding.weight}" /></label></div><label>状态<select name="enabled"><option value="true" ${binding.enabled ? 'selected' : ''}>启用</option><option value="false" ${!binding.enabled ? 'selected' : ''}>停用</option></select></label><p class="muted">同一逻辑模型下，优先级高的渠道先被选中；同优先级按权重分流。</p>`, '保存', async (form) => {
    await patch(`/api/admin/ai/routing/${binding.id}`, { priority: Number(form.get('priority')), weight: Number(form.get('weight')), enabled: form.get('enabled') === 'true' });
    await navigate('ai');
  });
}

function routeGroupsTable(rows) {
  if (!rows.length) return empty('还没有分组');
  return `<div class="table-wrap"><table><thead><tr><th>分组</th><th>倍率</th><th>渠道</th><th>绑定账户</th><th>说明</th><th>操作</th></tr></thead><tbody>${rows.map((group) => `<tr><td><span class="cell-main">${esc(group.name)}</span><span class="cell-sub">${esc(group.code)}${group.isDefault ? ' · 默认' : ''}</span></td><td>${Number(group.priceMultiplier || 1).toFixed(2)}×</td><td>${group.channels.length}</td><td>${group.accounts}</td><td>${esc(group.description || '—')}</td><td><div class="row-actions"><button data-action="group-channels" data-id="${esc(group.id)}">配置渠道</button><button data-action="group-price" data-id="${esc(group.id)}" data-multiplier="${group.priceMultiplier || 1}" data-name="${esc(group.name)}">倍率</button></div></td></tr>`).join('')}</tbody></table></div>`;
}
function groupNewModal() {
  openModal('新建渠道分组', `<label>代码<input name="code" required placeholder="premium" /></label><label>名称<input name="name" required placeholder="优质渠道" /></label><label>说明<input name="description" placeholder="仅绑定客户可见" /></label>`, '创建', async (form) => {
    await post('/api/admin/route-groups', { code: form.get('code'), name: form.get('name'), description: form.get('description') });
    await navigate('ai');
  });
}

function groupPriceModal(group) {
  openModal(`「${group.name}」价格倍率`, `<label>倍率<input name="multiplier" type="number" step="0.01" min="0.01" max="10" value="${Number(group.priceMultiplier || 1).toFixed(2)}" required /></label><p class="muted">最终售价 = 逻辑模型 Credits × 倍率。1.00 为原价，0.50 五折，1.20 加价 20%。只影响售价，不影响毛利计算里的渠道成本。</p>`, '保存', async (form) => {
    await patch(`/api/admin/route-groups/${group.id}`, { priceMultiplier: Number(form.get('multiplier')) });
    await navigate('ai');
  });
}

function groupChannelsModal(group) {
  const channels = state.channels || [];
  const selected = new Set(group.channels || []);
  const rows = channels.map((channel) => `<label class="switch-row"><span>${esc(channel.name)} <small>${esc(channel.providerCode)}</small></span><input type="checkbox" name="channel" value="${esc(channel.id)}" ${selected.has(channel.id) ? 'checked' : ''} /></label>`).join('');
  openModal(`配置「${group.name}」的渠道`, `<div class="form-grid">${rows || empty('还没有渠道')}</div><p class="muted">组内渠道按权重和健康度选择；全部不可用时自动回退默认组。</p>`, '保存', async (form) => {
    const ids = [...modal.querySelectorAll('input[name=channel]:checked')].map((input) => input.value);
    await request(`/api/admin/route-groups/${group.id}/channels`, { method: 'PUT', body: JSON.stringify({ channelIds: ids }) });
    await navigate('ai');
  });
}


function providerLabel(code) {
  return ({ antdigital: 'Ant Digital MaaS', dashscope: '阿里云百炼', computrix: 'Computrix MaaS', volcengine: '火山方舟（字节）' })[code] || code;
}
function providerDocs(code) {
  return ({
    antdigital: 'https://maas-api.antdigital.com',
    dashscope: 'https://help.aliyun.com/zh/model-studio/model-pricing',
    computrix: 'https://computrix.ai',
    volcengine: 'https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh',
  })[code] || '';
}
function providerCards() {
  const rows = state.providerSummary || [];
  if (!rows.length) return empty('还没有配置任何渠道');
  return rows.map((row) => `<article class="provider-card">
    <div class="showcase-top">
      <span class="badge ${row.enabledChannels > 0 ? 'success' : ''}">${row.enabledChannels}/${row.channels} 渠道启用</span>
      <span class="badge ${row.keys > 0 ? 'gold' : 'danger'}">${row.keys} 个 Key</span>
      ${row.failures > 0 ? `<span class="badge danger">失败 ${row.failures}</span>` : ''}
    </div>
    <h3>${esc(providerLabel(row.code))}</h3>
    <p>${esc(row.code)}</p>
    <div class="provider-meta">
      <button class="mini" data-action="ai-tab" data-tab="channels">管理渠道与 Key</button>
      ${providerDocs(row.code) ? `<a class="mini" href="${esc(providerDocs(row.code))}" target="_blank" rel="noreferrer">文档</a>` : ''}
    </div>
  </article>`).join('');
}

function modelsTable(rows) {
  if (!rows.length) return empty('还没有模型');
  return `<div class="table-wrap"><table><thead><tr><th>模型</th><th>能力</th><th>Credits</th><th>质量</th><th>状态</th></tr></thead><tbody>${rows.map((model) => `<tr><td><span class="cell-main">${esc(model.displayName || model.modelId)}</span><span class="cell-sub">${esc(model.modelId || '')}</span></td><td>${esc((model.capabilities || []).join(', '))}</td><td>${fmtNumber(model.creditsCost)}</td><td>${esc(model.qualityLevel || '—')}</td><td>${status(model.enabled ? 'active' : 'disabled')}</td></tr>`).join('')}</tbody></table></div>`;
}
function channelsTable(rows) {
  if (!rows.length) return empty('还没有渠道');
  return `<div class="table-wrap"><table><thead><tr><th>渠道</th><th>Provider</th><th>优先级</th><th>权重</th><th>模型</th><th>Key</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map((channel) => `<tr><td><span class="cell-main">${esc(channel.name)}</span><span class="cell-sub">${esc(channel.baseUrl || '默认 Base URL')}</span></td><td>${esc(channel.providerCode)}</td><td>${channel.priority}</td><td>${channel.weight}</td><td>${channel.modelCount}</td><td>${channel.keyLast4 ? '•••• ' + esc(channel.keyLast4) : '<span class="badge danger">未配置</span>'}</td><td>${status(channel.enabled ? 'active' : 'disabled')}</td><td><div class="row-actions"><button data-action="channel-edit" data-id="${esc(channel.id)}">优先级</button><button data-action="channel-keys" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">Keys</button><button data-action="channel-meta" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}" data-url="${esc(channel.baseUrl || '')}">编辑</button><button data-action="channel-delete" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">删除</button><button data-action="channel-models" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">模型</button><button data-action="channel-discover" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">发现模型</button><button data-action="channel-model-add" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">手动接入</button><button data-action="channel-key" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">添加 Key</button><button data-action="channel-toggle" data-id="${esc(channel.id)}" data-enabled="${channel.enabled ? 'false' : 'true'}">${channel.enabled ? '停用' : '启用'}</button></div></td></tr>`).join('')}</tbody></table></div>`;
}

function skillsTable(rows) {
  if (!rows.length) return empty('还没有 Skill');
  return `<div class="table-wrap"><table><thead><tr><th>Skill</th><th>分类</th><th>作者</th><th>版本</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map((item) => `<tr><td><span class="cell-main">${esc(item.name)}</span><span class="cell-sub">${esc(item.description || '')}</span></td><td>${esc(item.category)}</td><td>${esc(item.author || '—')}</td><td>v${item.version}</td><td>${status(item.status)}</td><td><div class="row-actions"><button data-action="skill-publish" data-id="${esc(item.id)}">发布</button><button data-action="skill-reject" data-id="${esc(item.id)}">退回</button></div></td></tr>`).join('')}</tbody></table></div>`;
}

function appsTable(rows) {
  if (!rows.length) return empty('还没有 AI 应用');
  return `<div class="table-wrap"><table><thead><tr><th>应用</th><th>类型</th><th>模型</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map((item) => `<tr><td><span class="cell-main">${esc(item.name)}</span><span class="cell-sub">${esc(item.description || '')}</span></td><td>${esc(item.mediaType === 'video' ? '视频' : '图片')}</td><td>${esc(item.modelHint || '—')}</td><td>${status(item.status)}</td><td><div class="row-actions"><button data-action="app-publish" data-id="${esc(item.id)}">发布</button><button data-action="app-draft" data-id="${esc(item.id)}">下架</button></div></td></tr>`).join('')}</tbody></table></div>`;
}

function platformTable(rows) {
  if (!rows.length) return empty('没有从 Provider 列举到这类模型');
  return `<div class="table-wrap"><table><thead><tr><th>显示名</th><th>模型 ID</th><th>Provider</th><th>能力</th><th>Credits</th><th>接入</th></tr></thead><tbody>${rows.map((model) => `<tr><td><span class="cell-main">${esc(model.displayName)}</span></td><td><span class="cell-sub">${esc(model.id)}</span></td><td>${esc(model.provider)}</td><td>${esc((model.capabilities || []).join(', '))}</td><td>${model.creditsCost ? fmtNumber(model.creditsCost) : '—'}</td><td>${status(model.available ? 'active' : 'disabled')}</td></tr>`).join('')}</tbody></table></div>`;
}

function usageTable(rows) {
  if (!rows.length) return empty('还没有调用记录');
  return `<div class="table-wrap"><table><thead><tr><th>工作流</th><th>状态</th><th>成本</th><th>延迟</th><th>时间</th></tr></thead><tbody>${rows.map((row) => `<tr><td><span class="cell-main">${esc(row.workflow)}</span><span class="cell-sub">${esc(row.providerModelId?.slice(0, 8) || '')}</span></td><td>${status(row.status)}</td><td>¥${Number(row.estimatedCost || 0).toFixed(3)}</td><td>${fmtNumber(row.latencyMs)} ms</td><td>${fmtDate(row.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
}

function money(value) { return '¥' + Number(value || 0).toFixed(2); }
function marginBadge(row) {
  if (row.status === 'block') return '<span class="badge danger">低于红线</span>';
  if (row.status === 'unverified') return '<span class="badge warning">待合同核实</span>';
  if (row.status === 'needs_duration') return '<span class="badge warning">按秒待换算</span>';
  return '<span class="badge success">正常</span>';
}
function pricingTable(rows, multiplier = 1) {
  if (!rows.length) return empty('还没有可定价的模型绑定');
  const mult = Number(multiplier) || 1;
  const rank = { block: 0, ok: 1, needs_duration: 2, unverified: 3 };
  const sorted = [...rows].sort((a, b) => ((rank[a.status] ?? 9) - (rank[b.status] ?? 9)) || ((a.marginRate || 0) - (b.marginRate || 0)));
  return `<div class="table-wrap"><table><thead><tr><th>模型</th><th>渠道</th><th>售价</th><th>售价(¥)</th><th>厂商原价</th><th>毛利(¥)</th><th>毛利率</th><th>状态</th><th>操作</th></tr></thead><tbody>${sorted.map((row) => `<tr><td><span class="cell-main">${esc(row.displayName || row.key || '未绑定')}</span><span class="cell-sub">${esc(row.providerModelId)}</span></td><td>${esc(row.channelName)}</td><td>${fmtNumber(row.creditsCost)} Credits</td><td>${money(row.sellCny * mult)}</td><td>${money(row.costCny)} <span class="cell-sub">${esc(row.costCurrency)}/${esc(row.costUnit === 'per_second' ? '秒' : '张')}${row.taxIncluded ? ' 含税' : ' 未税'}${row.costVerified ? '' : ' · 未核实'}</span></td><td class="${row.sellCny * mult - row.costCny < 0 ? 'negative' : ''}">${row.status === 'ok' || row.status === 'block' ? money(row.sellCny * mult - row.costCny) : '—'}</td><td>${row.status === 'ok' || row.status === 'block' ? (((row.sellCny * mult - row.costCny) / (row.sellCny * mult)) * 100).toFixed(1) + '%' : '—'}</td><td>${marginBadge(row)}${row.reason ? `<span class="cell-sub">${esc(row.reason)}</span>` : ''}</td><td><div class="row-actions"><button data-action="pricing-price" data-id="${esc(row.channelModelId)}" data-model="${esc(row.logicalModelId)}">改售价</button><button data-action="pricing-cost" data-id="${esc(row.channelModelId)}">录成本</button></div></td></tr>`).join('')}</tbody></table></div>`;
}
async function loadPricing() {
  const data = await get('/api/admin/pricing');
  const rows = data.items || []; const settings = data.settings || {};
  state.pricing = rows; state.pricingSettings = settings; state.pricingGroups = data.groups || [];
  const blocked = rows.filter((row) => row.status === 'block').length;
  const unverified = rows.filter((row) => row.status === 'unverified' || row.status === 'needs_duration').length;
  content.innerHTML = pageHead('定价与成本', '厂商原价、售价与毛利率；低于最低毛利的模型会被拦在付费提交之外。') +
    `<div class="metrics">
      ${metric('Credit 汇率', money(settings.creditCnyRate), '1 Credit 折合人民币')}
      ${metric('美元汇率', Number(settings.fxUsdCny || 0).toFixed(2), 'USD → CNY')}
      ${metric('最低毛利率', (Number(settings.minMarginRate || 0) * 100).toFixed(0) + '%', '低于该值硬拦截')}
      ${metric('低于红线', blocked, '当前被拦截的绑定')}
      ${metric('待核实成本', unverified, '未录入合同价')}
    </div>
    <section class="panel"><div class="panel-head"><div><h2>全局参数</h2><p>修改后立即影响报价与拦截</p></div></div>
      <form id="pricingSettingsForm" class="form-grid">
        <label>Credit 汇率（元）<input name="rate" type="number" step="0.0001" min="0.0001" value="${esc(settings.creditCnyRate)}" required /></label>
        <label>美元汇率<input name="fx" type="number" step="0.0001" min="0.0001" value="${esc(settings.fxUsdCny)}" required /></label>
        <label>最低毛利率（0-1）<input name="margin" type="number" step="0.01" min="0" max="0.99" value="${esc(settings.minMarginRate)}" required /></label>
        <div><button class="primary" type="submit">保存参数</button></div>
      </form></section>
    <section class="panel"><div class="panel-head"><div><h2>模型定价</h2><p>按毛利率升序；切换分组查看该组的实付价与毛利</p></div><div class="row-actions"><select id="pricingGroup">${(data.groups || []).map((g) => `<option value="${g.priceMultiplier}">${esc(g.name)} ×${Number(g.priceMultiplier).toFixed(2)}</option>`).join('') || '<option value="1">默认 ×1.00</option>'}</select><span class="badge gold">${rows.length} 条绑定</span></div></div><div id="pricingBody">${pricingTable(rows)}</div></section>`;
  $('pricingSettingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type=submit]');
    const form = new FormData(event.target);
    setBusy(button, true);
    try {
      await request('/api/admin/pricing/settings', { method: 'PUT', body: JSON.stringify({ creditCnyRate: Number(form.get('rate')), fxUsdCny: Number(form.get('fx')), minMarginRate: Number(form.get('margin')) }) });
      toast('定价参数已保存');
      await navigate('pricing');
    } catch (error) { toast(error.message); setBusy(button, false); }
  });
  const groupSelect = $('pricingGroup');
  if (groupSelect) {
    groupSelect.addEventListener('change', () => renderInto($('pricingBody'), pricingTable(state.pricing, Number(groupSelect.value))));
  }
}
function pricingPriceModal(row) {
  if (!row.logicalModelId) { toast('该渠道模型还没有绑定逻辑模型'); return; }
  openModal('修改售价', `<label>模型<input value="${esc(row.displayName || row.key)} / ${esc(row.providerModelId)}" disabled /></label><label>售价（Credits）<input name="credits" type="number" min="0" step="1" value="${row.creditsCost}" required /></label><p class="muted">当前 1 Credit = ¥${Number(state.pricingSettings?.creditCnyRate || 0).toFixed(2)}，低于最低毛利的售价会被拦截。</p>`, '保存', async (form) => {
    await request(`/api/admin/pricing/model/${row.logicalModelId}`, { method: 'PUT', body: JSON.stringify({ creditsCost: Number(form.get('credits')) }) });
    await navigate('pricing');
  });
}
function pricingCostModal(row) {
  openModal('录入厂商成本', `<label>渠道模型<input value="${esc(row.channelName)} / ${esc(row.providerModelId)}" disabled /></label><div class="form-row"><label>原价<input name="amount" type="number" step="0.0001" min="0" value="${row.costAmount}" required /></label><label>币种<select name="currency"><option value="CNY" ${row.costCurrency === 'CNY' ? 'selected' : ''}>CNY</option><option value="USD" ${row.costCurrency === 'USD' ? 'selected' : ''}>USD</option></select></label><label>计费单位<select name="unit"><option value="per_image" ${row.costUnit === 'per_image' ? 'selected' : ''}>每张</option><option value="per_second" ${row.costUnit === 'per_second' ? 'selected' : ''}>每秒</option></select></label></div><div class="form-row"><label>含税<select name="tax"><option value="true" ${row.taxIncluded ? 'selected' : ''}>含税</option><option value="false" ${!row.taxIncluded ? 'selected' : ''}>未税</option></select></label><label>核实状态<select name="verified"><option value="true" ${row.costVerified ? 'selected' : ''}>已核实</option><option value="false" ${!row.costVerified ? 'selected' : ''}>待核实</option></select></label></div><label>价格来源<input name="source" value="${esc(row.costSource)}" placeholder="标价页或合同链接" /></label><label>备注<input name="note" value="${esc(row.costNote)}" placeholder="例如：按季度签约价，2026-12 调整" /></label>`, '保存', async (form) => {
    await request(`/api/admin/pricing/cost/${row.channelModelId}`, { method: 'PUT', body: JSON.stringify({ costAmount: Number(form.get('amount')), costCurrency: form.get('currency'), costUnit: form.get('unit'), taxIncluded: form.get('tax') === 'true', costVerified: form.get('verified') === 'true', costSource: form.get('source'), costNote: form.get('note') }) });
    await navigate('pricing');
  });
}


async function loadStorage() {
  const cfg = await get('/api/admin/storage');
  state.storage = cfg;
  const isOSS = cfg.provider === 'oss';
  content.innerHTML = pageHead('存储', '生成结果与参考图存在哪里；客户端始终通过 API 访问，不直连对象存储。') +
    `<div class="metrics">
      ${metric('当前后端', isOSS ? '阿里云 OSS' : '本地磁盘', isOSS ? esc(cfg.bucket || '未填 Bucket') : '容器内 /app/var/assets')}
      ${metric('密钥', cfg.hasSecret ? '已配置' : '未配置', cfg.accessKeyId ? esc(cfg.accessKeyId) : '—')}
      ${metric('最近测试', cfg.verifiedAt ? fmtDate(cfg.verifiedAt) : '未测试', cfg.lastError || '无错误')}
    </div>
    <section class="panel"><div class="panel-head"><div><h2>对象存储配置</h2><p>保存后立即生效，无需重启</p></div></div>
      <form id="storageForm" class="form-grid">
        <label>存储类型<select name="provider"><option value="local" ${!isOSS ? 'selected' : ''}>本地磁盘</option><option value="oss" ${isOSS ? 'selected' : ''}>阿里云 OSS</option></select></label>
        <label>Bucket 名称<input name="bucket" value="${esc(cfg.bucket)}" placeholder="例如 weavia-assets-test" /></label>
        <label>Region<input name="region" value="${esc(cfg.region)}" placeholder="例如 oss-cn-hangzhou" /></label>
        <label>内网 Endpoint（服务端使用）<input name="endpointInternal" value="${esc(cfg.endpointInternal)}" placeholder="oss-cn-hangzhou-internal.aliyuncs.com" /></label>
        <label>外网 Endpoint（可选，CDN/直连时用）<input name="endpointPublic" value="${esc(cfg.endpointPublic)}" placeholder="oss-cn-hangzhou.aliyuncs.com" /></label>
        <label>路径前缀<input name="prefix" value="${esc(cfg.prefix)}" placeholder="test 或 prod" /></label>
        <label>AccessKeyId<input name="accessKeyId" value="${esc(cfg.accessKeyId)}" autocomplete="off" /></label>
        <label>AccessKeySecret<input name="accessKeySecret" type="password" autocomplete="new-password" placeholder="${cfg.hasSecret ? '已保存，留空表示不修改' : '粘贴子账号 Secret'}" /></label>
        <label>客户端取用方式<select name="clientAssetMode"><option value="server" ${cfg.clientAssetMode !== 'cdn' ? 'selected' : ''}>走服务器代理（推荐）</option><option value="cdn" ${cfg.clientAssetMode === 'cdn' ? 'selected' : ''}>走外网 / CDN 域名</option></select></label>
        <label>外网 / CDN 域名<input name="cdnBaseUrl" value="${esc(cfg.cdnBaseUrl)}" placeholder="https://cdn.example.com" /></label>
        <label>同步展示数据<select name="syncShowcase"><option value="false" ${!cfg.syncShowcase ? 'selected' : ''}>关闭</option><option value="true" ${cfg.syncShowcase ? 'selected' : ''}>开启（宣传示例等）</option></select></label>
        <div class="row-actions"><button class="primary" type="submit">保存</button><button class="secondary" type="button" data-action="storage-test">测试连接</button><button class="secondary" type="button" data-action="storage-migrate" data-direction="to_oss">迁移本地→OSS</button><button class="secondary" type="button" data-action="storage-migrate" data-direction="to_local">迁回本地</button></div>
      </form>
      <div class="muted" style="margin-top:16px;line-height:1.8">
        <p>· <b>内网 Endpoint</b> 只有同地域的阿里云 ECS 能访问，不产生公网流量费，服务端固定走这条。</p>
        <p>· <b>外网 Endpoint</b> 仅在需要 CDN 或从本机调试时使用，会产生公网流量费；客户端当前<b>不直连 OSS</b>，下载仍走 API，所以不必给桶开公共读或 CORS。</p>
        <p>· 桶请设为<b>私有</b>，AK 用子账号并只授权该桶的 Get/Put/Delete/List。</p>
        <p>· 切换到 OSS 后，新写入走 OSS；历史本地文件仍可读，迁移工具后续提供。</p>
      </div></section>`;
  $('storageForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const button = event.target.querySelector('button[type=submit]');
    setBusy(button, true);
    try {
      await request('/api/admin/storage', { method: 'PUT', body: JSON.stringify({ provider: form.get('provider'), bucket: form.get('bucket'), region: form.get('region'), endpointInternal: form.get('endpointInternal'), endpointPublic: form.get('endpointPublic'), prefix: form.get('prefix'), accessKeyId: form.get('accessKeyId'), accessKeySecret: form.get('accessKeySecret'), clientAssetMode: form.get('clientAssetMode'), cdnBaseUrl: form.get('cdnBaseUrl'), syncShowcase: form.get('syncShowcase') === 'true' }) });
      toast('存储配置已保存');
      await navigate('storage');
    } catch (error) { toast(error.message); setBusy(button, false); }
  });
}


async function storageMigrate(direction) {
  const first = await post('/api/admin/storage/migrate', { direction, dryRun: true });
  const confirmed = await confirmDialog(`盘点结果：\n扫描 ${first.scanned} 个对象\n可迁移 ${first.moved} 个（${(first.bytes / 1048576).toFixed(1)} MB）\n跳过 ${first.skipped} 个\n缺失 ${first.missing} 个\n\n确认执行迁移？`);
  if (!confirmed) return;
  const report = await post('/api/admin/storage/migrate', { direction, dryRun: false });
  toast(`迁移完成：${report.moved} 个对象，更新素材 ${report.updatedAssets} 条、任务 ${report.updatedTasks} 条`);
  if (report.errors && report.errors.length) console.warn('migration errors', report.errors);
  await navigate('storage');
}

async function loadTasks() {
  const [tasks, runs] = await Promise.all([get('/api/admin/tasks'), get('/api/admin/task-runs')]);
  state.tasks = tasks || []; state.runs = runs || [];
  content.innerHTML = pageHead('创作任务', '任务状态、模型与执行记录。') + `<div class="tabs">${[['tasks', '任务'], ['runs', '执行记录']].map(([id, label]) => `<button type="button" class="${state.taskTab === id ? 'active' : ''}" data-action="task-tab" data-tab="${id}">${label}</button>`).join('')}</div><div id="taskBody"></div>`;
  renderTaskBody();
}
function renderTaskBody() {
  const filters = [['all', '全部', () => true], ['failed', '失败', (t) => t.status === 'failed'], ['running', '进行中', (t) => ['running', 'queued', 'reserved', 'reconciling'].includes(t.status)], ['success', '成功', (t) => t.status === 'success'], ['cancelled', '已取消', (t) => t.status === 'cancelled']];
  const current = filters.find(([id]) => id === (state.taskFilter || 'all')) || filters[0];
  const query = (state.taskQuery || '').toLowerCase();
  const rows = state.tasks.filter((t) => current[2](t) && (!query || `${t.id} ${t.email} ${t.model} ${t.errorCode}`.toLowerCase().includes(query)));
  const failed = state.tasks.filter((t) => t.status === 'failed');
  const codes = Object.entries(failed.reduce((acc, t) => { const code = t.errorCode || '未知'; acc[code] = (acc[code] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  renderInto($('taskBody'), state.taskTab === 'tasks'
    ? `<div class="metrics">${metric('任务', fmtNumber(state.tasks.length), '最近 500 个')}${metric('成功率', state.tasks.length ? `${Math.round(state.tasks.filter((t) => t.status === 'success').length / state.tasks.length * 100)}%` : '—')}${metric('失败', fmtNumber(failed.length), codes[0] ? `最多：${codes[0][0]}` : '无')}${metric('进行中', fmtNumber(state.tasks.filter(filters[2][2]).length))}</div>
      ${codes.length ? `<div class="panel"><div class="panel-head"><div><h2>失败原因</h2><p>点击查看该类失败的任务</p></div></div><div class="code-list">${codes.map(([code, n]) => `<button type="button" class="log-chip bad" data-task-code="${esc(code)}" title="${esc(errorHelp(code))}"><strong>${esc(code)}</strong> ${n}</button><span class="code-help">${esc(errorHelp(code))}</span>`).join('')}</div></div>` : ''}
      <div class="panel"><div class="panel-head"><div class="tabs sub-tabs" style="margin:0">${filters.map(([id, label, fn]) => `<button type="button" class="${current[0] === id ? 'active' : ''}" data-task-filter="${id}">${label} <small>${state.tasks.filter(fn).length}</small></button>`).join('')}</div><input id="taskSearch" class="search-input" placeholder="搜索任务 ID、用户、模型或错误码" value="${esc(state.taskQuery || '')}" /></div>${tasksTable(rows)}</div>`
    : `<div class="panel"><div class="panel-head"><div><h2>执行记录</h2><p>River 任务尝试与结果</p></div></div>${runsTable(state.runs)}</div>`);
  content.querySelectorAll('[data-task-filter]').forEach((button) => button.addEventListener('click', () => { state.taskFilter = button.dataset.taskFilter; renderTaskBody(); }));
  content.querySelectorAll('[data-task-code]').forEach((button) => button.addEventListener('click', () => { state.taskFilter = 'failed'; state.taskQuery = button.dataset.taskCode === '未知' ? '' : button.dataset.taskCode; renderTaskBody(); }));
  const search = $('taskSearch');
  search?.addEventListener('input', () => { state.taskQuery = search.value; clearTimeout(renderTaskBody.timer); renderTaskBody.timer = setTimeout(() => { renderTaskBody(); const next = $('taskSearch'); next.focus(); next.setSelectionRange(next.value.length, next.value.length); }, 250); });
  enhanceTables($('taskBody'));
}
function runsTable(rows) {
  if (!rows.length) return empty('还没有执行记录');
  return `<div class="table-wrap"><table><thead><tr><th>任务</th><th>尝试</th><th>状态</th><th>开始</th><th>结束</th></tr></thead><tbody>${rows.map((row) => `<tr><td><span class="cell-main">${esc(row.taskId.slice(0, 8))}</span></td><td>${row.attempt}</td><td>${status(row.status)}</td><td>${fmtDate(row.startedAt)}</td><td>${fmtDate(row.finishedAt)}</td></tr>`).join('')}</tbody></table></div>`;
}
function opsBadge(value) {
  const labels = { ok: '正常', success: '成功', started: '进行中', degraded: '部分受影响', down: '不可用', failed: '失败', running: '运行中', healthy: '健康', unknown: '未知', exited: '已停止' };
  const tone = ['ok', 'success', 'healthy', 'running'].includes(value) ? 'success' : ['degraded', 'unknown', 'started'].includes(value) ? 'warning' : 'danger';
  return `<span class="badge ${tone}">${esc(labels[value] || value || '未知')}</span>`;
}
function opsPercent(used, total) { return total > 0 ? `${Math.round(100 * used / total)}%` : '—'; }
function opsBytes(value) { return value == null ? '—' : `${(Number(value) / 1024 / 1024 / 1024).toFixed(1)} GiB`; }
function opsMegabytes(value) { return value == null ? '—' : `${Math.round(Number(value) / 1024 / 1024)} MiB`; }
function opsTrend(rows, key, totalKey) {
  const all = (rows || []).map((row) => totalKey ? 100 * row[key] / Math.max(1, row[totalKey]) : row[key]);
  const stride = Math.max(1, Math.ceil(all.length / 48));
  const values = all.filter((_, index) => index % stride === 0 || index === all.length - 1);
  if (values.length < 2) return '<span class="muted">暂无趋势数据</span>';
  const points = values.map((value, index) => `${(index * 100 / (values.length - 1)).toFixed(1)},${(30 - Math.max(0, Math.min(100, value)) * .28).toFixed(1)}`).join(' ');
  return `<svg class="ops-trend" viewBox="0 0 100 32" role="img" aria-label="所选时间范围内的变化趋势"><polyline points="${points}" /></svg>`;
}
async function loadOps() {
  let data;
  try { data = await get('/api/admin/ops/status'); }
  catch (error) { content.innerHTML = pageHead('运行与排障', '仅有运行状态权限的管理员可以查看。') + empty(error.message); return; }
  const historyData = await get(`/api/admin/ops/history?period=${state.opsPeriod}`).catch(() => ({ items: [] }));
  const history = { items: state.opsPeriod === '24h' ? (historyData.items || []).filter((row) => Date.now() - new Date(row.capturedAt).getTime() < 86400000) : historyData.items || [] };
  state.opsStatus = data;
  state.health = data.status || 'unknown';
  renderHealth();
  const q = data.queue || {};
  const host = data.hostStatus === 'ok' ? data.host : null;
  const containers = (host?.containers || []).map((row) => `<tr><td><span class="cell-main">${esc(row.name)}</span></td><td>${opsBadge(row.state)}</td><td>${opsBadge(row.health)}</td><td>${fmtNumber(row.restarts)}</td><td>${Number(row.cpuPercent || 0).toFixed(1)}%</td><td>${opsMegabytes(row.memoryBytes)}</td></tr>`).join('') || emptyRow(6);
  const checkNames = { api: 'API', database: '数据库', queue: '队列表', storage: '素材存储', worker: '任务 Worker', host: '宿主机', containers: 'Docker 容器' };
  const checks = Object.entries(checkNames).map(([key, label]) => `<tr><td>${label}</td><td>${opsBadge(data.checks?.[key] || 'unknown')}</td><td>${key === 'worker' ? `最后心跳 ${fmtDate(q.workerLastSeen)}` : key === 'queue' ? '检查队列表可查询；消费能力见 Worker 心跳' : '按需检测'}</td></tr>`).join('');
  const channels = (data.channels || []).map((row) => `<tr><td>${esc(row.name)}</td><td>${fmtNumber(row.calls)}</td><td>${fmtNumber(row.failures)}</td><td>${row.calls ? `${Math.round(100 * (row.calls - row.failures) / row.calls)}%` : '无近期调用'}</td></tr>`).join('') || emptyRow(4);
  const hostNote = host ? `采集于 ${fmtDate(host.capturedAt)}` : '主机采集尚未启用或数据已过期';
  content.innerHTML = pageHead('运行与排障', '先看业务影响，再定位 Worker、容器和渠道。', '<button class="secondary" data-action="ops-refresh">重新检查</button>') +
    `<div class="ops-head"><div><span class="eyebrow">SERVICE STATUS</span><h2>${opsBadge(data.status)} 创作链路</h2><p>最近检查 ${fmtDate(data.checkedAt)} · ${hostNote}</p></div><p>检查只读取运行信息，不发起付费生成。</p></div>
    <div class="metrics">${metric('待处理任务', fmtNumber(q.waiting), `最老等待 ${fmtNumber(q.oldestWaitSeconds)} 秒`)}${metric('执行中', fmtNumber(q.running), `Worker 心跳 ${fmtDate(q.workerLastSeen)}`)}${metric('24 小时失败', fmtNumber(q.failed24h), '按任务更新时间统计')}${metric('主机状态', data.hostStatus === 'ok' ? '已连接' : '未知', hostNote)}</div>
    <div class="panel-grid"><section class="panel"><div class="panel-head"><div><h2>核心依赖</h2><p>可查询状态与任务处理能力分开判断</p></div></div><div class="table-wrap"><table><thead><tr><th>检查项</th><th>状态</th><th>说明</th></tr></thead><tbody>${checks}</tbody></table></div></section>
    <section class="panel"><div class="panel-head"><div><h2>服务器资源</h2><p>${hostNote}</p></div><div class="row-actions">${[['24h', '24 小时'], ['7d', '7 天'], ['30d', '30 天']].map(([id, label]) => `<button data-action="ops-period" data-period="${id}" aria-pressed="${state.opsPeriod === id}">${label}</button>`).join('')}</div></div>${host ? `<div class="ops-resource"><div>CPU <strong>${Number(host.cpuPercent).toFixed(1)}%</strong>${opsTrend(history.items, 'cpuPercent')}</div><div>内存 <strong>${opsPercent(host.memoryUsed, host.memoryTotal)}</strong><small>${opsBytes(host.memoryUsed)} / ${opsBytes(host.memoryTotal)}</small>${opsTrend(history.items, 'memoryUsed', 'memoryTotal')}</div><div>磁盘 <strong>${opsPercent(host.diskUsed, host.diskTotal)}</strong><small>${opsBytes(host.diskUsed)} / ${opsBytes(host.diskTotal)}</small>${opsTrend(history.items, 'diskUsed', 'diskTotal')}</div></div>` : empty('等待宿主机采集器数据；业务检查仍可查看。')}</section></div>
    <section class="panel"><div class="panel-head"><div><h2>Docker 服务</h2><p>仅展示 WEAVIA 的四个容器</p></div></div><div class="table-wrap"><table><thead><tr><th>容器</th><th>运行</th><th>健康</th><th>重启</th><th>CPU</th><th>内存</th></tr></thead><tbody>${containers}</tbody></table></div></section>
    <section class="panel"><div class="panel-head"><div><h2>AI 渠道 · 近 24 小时</h2><p>${data.channelsAvailable ? '来自真实调用记录' : '渠道记录暂时不可用'}</p></div></div><div class="table-wrap"><table><thead><tr><th>渠道</th><th>调用</th><th>失败</th><th>成功率</th></tr></thead><tbody>${channels}</tbody></table></div></section>
    <section class="panel"><div class="panel-head"><div><h2>安全日志摘要</h2><p>只展示固定格式的安全事件；原始容器日志需通过 SSH 查看</p></div><div class="row-actions"><button data-action="ops-logs" data-service="backend">API</button><button data-action="ops-logs" data-service="worker">Worker</button><button data-action="ops-logs" data-service="admin">后台 Web</button><button data-action="ops-logs" data-service="postgres">PostgreSQL</button></div></div><div id="opsLogBody" role="status">选择一个服务查看最近 200 条安全摘要。</div></section>`;
}
async function loadOpsLogs(service) {
  const target = $('opsLogBody');
  if (!target) return;
  target.textContent = '正在读取安全日志摘要…';
  try {
    const data = await get(`/api/admin/ops/logs/${encodeURIComponent(service)}`);
    if (!target.isConnected) return;
    if (data.stale) { target.textContent = '主机采集结果已过期，暂无可靠日志摘要。'; return; }
    const rows = (data.items || []).map((row) => `<tr><td>${esc(row.time || '—')}</td><td>${esc(row.level || '—')}</td><td>${esc(row.message || '—')}</td></tr>`).join('') || emptyRow(3);
    renderInto(target, `<div class="table-wrap"><table><thead><tr><th>时间</th><th>级别</th><th>事件</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  } catch (error) { target.textContent = error.message; }
}
async function taskDetailModal(taskID) {
  const closeButtons = () => modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
  modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">TASK DETAIL</span><h2>任务详情</h2></div><button type="button" class="modal-close" data-close-modal aria-label="关闭">×</button></div><div class="activity-loading">正在读取任务、费用与渠道记录…</div></div>`;
  modal.showModal();
  closeButtons();
  try {
    const [detail, eventData] = await Promise.all([get(`/api/admin/tasks/${encodeURIComponent(taskID)}`), get(`/api/admin/ops/tasks/${encodeURIComponent(taskID)}/events`).catch(() => ({ items: [] }))]);
    if (!modal.open) return;
    const task = detail.task;
    const routes = (detail.routes || []).map((route) => `<tr><td>${fmtDate(route.createdAt)}</td><td>${esc(route.channelName || route.provider || '—')}</td><td>${esc(route.providerModelId || '—')}</td><td>${route.keyLast4 ? `•••• ${esc(route.keyLast4)}` : '—'}</td><td>${status(route.status)}${route.errorCode ? `<span class="cell-sub">${esc(route.errorCode)}</span>` : ''}</td><td>${fmtNumber(route.latencyMs)} ms</td></tr>`).join('') || emptyRow(6);
    const types = { reserve: '预留', consume: '实扣', release: '返还' };
    const transactions = (detail.transactions || []).map((entry) => `<tr><td>${fmtDate(entry.createdAt)}</td><td>${esc(types[entry.type] || entry.type)}</td><td>${fmtNumber(entry.availableDelta)}</td><td>${fmtNumber(entry.reservedDelta)}</td></tr>`).join('') || emptyRow(4);
    const stages = { running: '开始生成', provider: '渠道生成', failed: '失败', cancelled: '用户取消', reserved: '预留 Credits', queued: '进入队列', worker_started: 'Worker 开始', provider_request: '调用渠道', provider_submitted: '上游已提交', provider_response: '渠道响应', asset_saved: '素材已保存', settled: '已结算', failed: '任务失败', refund: '返还失败' };
    const events = (eventData.items || []).map((entry) => `<tr><td>${fmtDate(entry.createdAt)}</td><td>${esc(stages[entry.stage] || entry.stage)}</td><td>${opsBadge(entry.state)}</td><td>${esc(entry.code || '—')}</td><td>${entry.durationMs ? `${fmtNumber(entry.durationMs)} ms` : '—'}</td></tr>`).join('') || emptyRow(5);
    modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">TASK DETAIL</span><h2>${esc(task.type)} · ${esc(task.id.slice(0, 8))}</h2><p>${esc(task.email || task.userId)} · ${esc(task.accountNo || '未分配账户号')} · ${fmtDate(task.createdAt)}</p></div><button type="button" class="modal-close" data-close-modal aria-label="关闭">×</button></div>
      <div class="activity-summary"><div><small>任务状态</small><strong>${status(task.status)}</strong><span>${esc(task.errorCode || '无失败码')}</span></div><div><small>预留 Credits</small><strong>${fmtNumber(task.reservedCredits)}</strong><span>任务提交时预留</span></div><div><small>实扣 Credits</small><strong>${fmtNumber(task.consumedCredits)}</strong><span>${esc(billingBasisLabel(task.billingBasis))}</span></div><div><small>返还 Credits</small><strong>${fmtNumber(task.releasedCredits)}</strong><span>来自返还流水</span></div></div>
      <div class="activity-body"><section class="activity-section"><h3>任务与失败原因</h3><p>${esc(task.model || task.provider || '未指定模型')}${task.duration ? ` · ${esc(task.duration)} 秒` : ''}</p><p>${task.errorMessage ? `${esc(task.errorCode)}：${esc(task.errorMessage)}` : '无失败原因记录'}</p><p class="muted">${task.billingBasis ? '结算口径已按任务保存' : '历史任务未保存结算口径，请结合实际流水核对'}</p></section>
      <section class="activity-section"><h3>执行时间线</h3><p class="muted">仅新版本产生的任务有阶段记录；历史任务请结合渠道与 Credits 流水查看。</p><div class="table-wrap"><table><thead><tr><th>时间</th><th>阶段</th><th>结果</th><th>错误码</th><th>耗时</th></tr></thead><tbody>${events}</tbody></table></div></section>
      <section class="activity-section"><h3>渠道调用（最近 5 条）</h3><div class="table-wrap"><table><thead><tr><th>时间</th><th>渠道</th><th>渠道模型</th><th>Key 末四位</th><th>结果</th><th>延迟</th></tr></thead><tbody>${routes}</tbody></table></div></section>
      <section class="activity-section"><h3>Credits 流水</h3><div class="table-wrap"><table><thead><tr><th>时间</th><th>动作</th><th>可用变动</th><th>冻结变动</th></tr></thead><tbody>${transactions}</tbody></table></div></section></div>
      <div class="activity-actions"><span class="muted">金额以 Credits 流水为准</span>${task.status === 'success' ? `<button type="button" class="secondary" id="taskToTemplate">设为模板（草稿）</button>` : ''}<button type="button" class="primary" data-close-modal>关闭</button></div></div>`;
    closeButtons();
    $('taskToTemplate')?.addEventListener('click', async (event) => {
      const title = prompt('模板标题（客户端灵感广场显示）', '');
      if (title === null) return;
      setBusy(event.target, true);
      try { await post(`/api/admin/showcase/from-task/${encodeURIComponent(taskID)}`, { title, tag: '' }); toast('已存为草稿模板，到「内容管理」检查后发布'); modal.close(); }
      catch (error) { toast(error.message); setBusy(event.target, false); }
    });
  } catch (error) {
    if (modal.open) modal.querySelector('.activity-loading').textContent = error.message || '任务详情读取失败';
  }
}
function contentTabs() {
  return `<div class="tabs" style="margin-bottom:12px">${[['showcase', '示例与模板'], ['skills', 'Skill 审核'], ['apps', 'AI 应用']].map(([id, label]) => `<button type="button" class="${(state.contentTab || 'showcase') === id ? 'active' : ''}" data-action="content-tab" data-tab="${id}">${label}</button>`).join('')}</div>`;
}
async function loadShowcase() {
  if (state.contentTab === 'skills' || state.contentTab === 'apps') {
    const skills = state.contentTab === 'skills';
    const data = await get(skills ? '/api/admin/skills' : '/api/admin/apps');
    const items = data?.items || [];
    if (skills) state.skills = items; else state.apps = items;
    content.innerHTML = pageHead('内容管理', '客户端看到的示例、模板、Skill 与 AI 应用。') + contentTabs() + `<div class="panel"><div class="panel-head"><div><h2>${skills ? 'Skill 审核' : 'AI 应用'}</h2><p>${skills ? '客户上传后默认私有，审核通过才公开' : '发布后出现在客户端「AI 应用」'}</p></div><span class="badge gold">${items.length} 个</span></div>${skills ? skillsTable(items) : appsTable(items)}</div>`;
    return;
  }
  const data = await get('/api/admin/showcase');
  state.showcase = data.items || [];
  content.innerHTML = pageHead('内容管理', '客户端看到的示例、模板、Skill 与 AI 应用。', '<button class="primary" data-action="showcase-new">上传示例</button>') + contentTabs() +
    `<div class="toolbar"><div class="tabs">${[['all', '全部'], ['image', '示例图'], ['work', '示例作品']].map(([id, label]) => `<button type="button" class="${state.showcaseFilter === id ? 'active' : ''}" data-action="showcase-filter" data-tab="${id}">${label}</button>`).join('')}</div><span class="spacer"></span><span class="badge gold">${state.showcase.length} 条内容</span></div><div id="showcaseBody"></div>`;
  renderShowcaseBody();
}
function renderShowcaseBody() {
  const rows = state.showcaseFilter === 'all' ? state.showcase : state.showcase.filter((item) => item.kind === state.showcaseFilter);
  renderInto($('showcaseBody'), rows.length ? `<div class="showcase-grid">${rows.map((item) => `<article class="showcase-card"><img src="${apiBase.replace(/\/$/, '')}${esc(item.imageUrl)}" alt="${esc(item.title)}" loading="eager" /><div class="showcase-body"><div class="showcase-top"><span class="badge ${item.kind === 'work' ? 'gold' : ''}">${item.kind === 'work' ? '示例作品' : '示例图'}</span>${status(item.status)}</div><h3>${esc(item.title)}</h3><p>${esc(item.tag || '未设置标签')} · 排序 ${item.sortOrder} · 已被使用 ${fmtNumber(item.useCount)} 次</p><p class="muted">${item.model ? `一键同款：${esc(item.media === 'video' ? '视频' : '图片')} · ${esc(item.model)} · ${esc(item.ratio || '默认比例')} · ${esc(item.resolution || '1K')} · ${item.count || 1} 张` : '未设置一键同款参数（客户端只带入提示词）'}</p><div class="row-actions"><button data-action="showcase-toggle" data-id="${esc(item.id)}" data-status="${item.status === 'published' ? 'draft' : 'published'}">${item.status === 'published' ? '下架' : '发布'}</button><button data-action="showcase-edit" data-id="${esc(item.id)}">编辑</button><button class="danger" data-action="showcase-delete" data-id="${esc(item.id)}">删除</button></div></div></article>`).join('')}</div>` : empty('这个分类还没有内容'));
}
const levelLabels = { info: '普通', warning: '提醒', important: '重要' };
async function loadClient() {
  const [config, announcements] = await Promise.all([get('/api/admin/client-config'), get('/api/admin/announcements')]);
  state.clientConfig = config || {};
  state.announcements = announcements?.items || [];
  const c = state.clientConfig;
  content.innerHTML = pageHead('客户端发布', 'API 地址、强制升级与公告。保存后客户端下次启动（或 5 分钟内）生效。', '<button class="primary" data-action="announcement-new">新建公告</button>') +
    `<section class="panel"><div class="panel-head"><div><h2>连接与版本</h2><p>最后保存：${fmtDate(c.updatedAt)}</p></div></div>
      <form id="clientConfigForm" class="form-grid">
        <label>API 地址<input name="apiBaseUrl" value="${esc(c.apiBaseUrl || '')}" placeholder="https://api.example.com（留空表示沿用客户端内置地址）" /></label>
        <p class="muted">换域名步骤：先确认新地址能打开 <code>/api/health</code>，再保存这里。客户端会先探测新地址，探测失败会继续用旧地址，不会断连。</p>
        <div class="form-row"><label>最低可用版本（低于它必须升级）<input name="minVersion" value="${esc(c.minVersion || '')}" placeholder="0.2.0" /></label><label>最新版本<input name="latestVersion" value="${esc(c.latestVersion || '')}" placeholder="0.2.0" /></label></div>
        <div class="form-row"><label>macOS 下载地址<input name="downloadMac" value="${esc(c.downloadMac || '')}" placeholder="https://…/WEAVIA-mac.zip" /></label><label>Windows 下载地址<input name="downloadWindows" value="${esc(c.downloadWindows || '')}" placeholder="https://…/WEAVIA-setup.exe" /></label></div>
        <label>更新说明<textarea name="releaseNotes" rows="4" maxlength="4000">${esc(c.releaseNotes || '')}</textarea></label>
        <div class="form-row"><label>视频复刻 · 拆解渠道<select name="visionProvider">${['volcengine', 'dashscope', 'antdigital', 'computrix'].map((id) => `<option value="${id}" ${(c.visionProvider || 'volcengine') === id ? 'selected' : ''}>${id}</option>`).join('')}</select></label><label>视频复刻 · 视觉模型 ID<input name="visionModel" value="${esc(c.visionModel || '')}" placeholder="该渠道已开通的多模态模型，如豆包视觉模型 ID" /></label></div>
        <p class="muted">视频复刻会把参考视频的关键帧发给这个模型拆解分镜；留空则客户端提示「未配置」。</p>
        <div class="row-actions"><button class="primary" type="submit">保存连接与版本</button></div>
      </form></section>
    <section class="panel"><div class="panel-head"><div><h2>公告</h2><p>已发布且在有效期内的公告会显示在客户端首页顶部和铃铛里；置顶的排在最前</p></div><button class="secondary" data-action="announcement-new">新建公告</button></div>${announcementsTable(state.announcements)}</section>`;
  $('clientConfigForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const body = Object.fromEntries(['apiBaseUrl', 'minVersion', 'latestVersion', 'downloadMac', 'downloadWindows', 'releaseNotes', 'visionProvider', 'visionModel'].map((key) => [key, String(form.get(key) || '').trim()]));
    if (body.minVersion && !await confirmDialog(`保存后，版本低于 ${body.minVersion} 的客户端将无法继续使用，必须下载新版。确定？`)) return;
    const button = event.target.querySelector('button[type=submit]');
    setBusy(button, true);
    try { await request('/api/admin/client-config', { method: 'PUT', body: JSON.stringify(body) }); toast('已保存'); await navigate('client'); }
    catch (error) { toast(error.message); setBusy(button, false); }
  });
}
function announcementWindow(item) {
  if (!item.startsAt && !item.endsAt) return '长期';
  return `${item.startsAt ? fmtDate(item.startsAt) : '立即'} → ${item.endsAt ? fmtDate(item.endsAt) : '长期'}`;
}
function announcementsTable(rows) {
  if (!rows.length) return empty('还没有公告');
  return `<div class="table-wrap"><table><thead><tr><th>标题</th><th>级别</th><th>状态</th><th>有效期</th><th>更新</th><th>操作</th></tr></thead><tbody>${rows.map((item) => `<tr><td><span class="cell-main">${item.pinned ? '📌 ' : ''}${esc(item.title)}</span><span class="cell-sub">${esc((item.body || '').slice(0, 60))}</span></td><td><span class="badge ${item.level === 'important' ? 'danger' : item.level === 'warning' ? 'warning' : ''}">${levelLabels[item.level] || item.level}</span></td><td>${status(item.status)}</td><td>${announcementWindow(item)}</td><td>${fmtDate(item.updatedAt)}</td><td><div class="row-actions"><button data-action="announcement-toggle" data-id="${esc(item.id)}">${item.status === 'published' ? '下线' : '发布'}</button><button data-action="announcement-edit" data-id="${esc(item.id)}">编辑</button><button class="danger" data-action="announcement-delete" data-id="${esc(item.id)}">删除</button></div></td></tr>`).join('')}</tbody></table></div>`;
}
function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function announcementBody(item, overrides = {}) {
  return { title: item.title, body: item.body, level: item.level, pinned: item.pinned, status: item.status, startsAt: item.startsAt || null, endsAt: item.endsAt || null, ...overrides };
}
function announcementModal(item = null) {
  openModal(item ? '编辑公告' : '新建公告', `<label>标题<input name="title" maxlength="80" required value="${esc(item?.title || '')}" /></label><label>正文<textarea name="body" rows="6" maxlength="4000">${esc(item?.body || '')}</textarea></label><div class="form-row"><label>级别<select name="level">${Object.entries(levelLabels).map(([id, label]) => `<option value="${id}" ${(item?.level || 'info') === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>状态<select name="status"><option value="published" ${item?.status === 'published' ? 'selected' : ''}>发布</option><option value="draft" ${item?.status !== 'published' ? 'selected' : ''}>草稿</option></select></label><label>置顶<select name="pinned"><option value="false">否</option><option value="true" ${item?.pinned ? 'selected' : ''}>是</option></select></label></div><div class="form-row"><label>开始时间（可空）<input name="startsAt" type="datetime-local" value="${toLocalInput(item?.startsAt)}" /></label><label>结束时间（可空）<input name="endsAt" type="datetime-local" value="${toLocalInput(item?.endsAt)}" /></label></div>`, item ? '保存' : '创建', async (form) => {
    const when = (key) => { const value = form.get(key); return value ? new Date(String(value)).toISOString() : null; };
    const body = { title: form.get('title'), body: form.get('body'), level: form.get('level'), status: form.get('status'), pinned: form.get('pinned') === 'true', startsAt: when('startsAt'), endsAt: when('endsAt') };
    if (item) await request(`/api/admin/announcements/${item.id}`, { method: 'PUT', body: JSON.stringify(body) });
    else await post('/api/admin/announcements', body);
    await navigate('client');
  });
}

async function loadAnalytics() {
  const [overview, usage, logs] = await Promise.all([get('/api/admin/overview'), get('/api/admin/ai/usage'), get('/api/admin/ai/logs?hours=168&limit=1').catch(() => ({ byModel: [], byChannel: [], byCode: [] }))]);
  state.overview = overview; state.usage = usage?.usage || [];
  const rateBar = (row) => { const ok = row.count - row.failed; const rate = row.count ? ok / row.count : 0; return `<div class="rate"><span style="width:${(rate * 100).toFixed(0)}%" class="${rate < 0.8 ? 'bad' : rate < 0.95 ? 'warn' : ''}"></span></div><span class="rate-label">${row.count ? `${(rate * 100).toFixed(1)}%` : '—'}</span>`; };
  const table = (rows, label) => rows.length ? `<div class="table-wrap"><table><thead><tr><th>${label}</th><th>调用</th><th>失败</th><th>成功率</th></tr></thead><tbody>${rows.map((row) => `<tr><td><span class="cell-main">${esc(row.label)}</span></td><td>${fmtNumber(row.count)}</td><td class="${row.failed ? 'negative' : ''}">${fmtNumber(row.failed)}</td><td class="rate-cell">${rateBar(row)}</td></tr>`).join('')}</tbody></table></div>` : empty('最近 7 天没有调用');
  const revenue = Number(overview.revenueMinorCNY || 0) / 100;
  const cost = Number(overview.aiCostByCurrency?.CNY || 0);
  content.innerHTML = pageHead('数据分析', '收入与成本、模型和渠道最近 7 天的表现。') +
    `<div class="metrics">${metric('收入', fmtMoney(overview.revenueMinorCNY), '已支付订单')}${metric('AI 成本', '¥' + cost.toFixed(2), '按 Provider 记账')}${metric('毛利率', revenue ? `${(((revenue - cost) / revenue) * 100).toFixed(1)}%` : '—', '(收入 - AI 成本) / 收入')}${metric('任务失败率', overview.tasks ? `${((overview.failedTasks / overview.tasks) * 100).toFixed(1)}%` : '—', `${fmtNumber(overview.failedTasks)} / ${fmtNumber(overview.tasks)}`)}</div>
    <div class="panel-grid">
      <section class="panel"><div class="panel-head"><div><h2>模型表现（7 天）</h2><p>按渠道调用次数排序，成功率低于 95% 标黄、低于 80% 标红</p></div><button class="mini" data-action="go-page" data-page="ai">AI Studio</button></div>${table(logs.byModel || [], '模型')}</section>
      <section class="panel"><div class="panel-head"><div><h2>渠道表现（7 天）</h2><p>同一模型的多个渠道可在 AI Studio → 模型 → 路由里调整</p></div></div>${table(logs.byChannel || [], '渠道')}</section>
    </div>
    <section class="panel"><div class="panel-head"><div><h2>Provider 调用明细</h2><p>最近 500 条</p></div></div>${usageTable(state.usage)}</section>`;
}
async function loadSettings() {
  const logs = await get('/api/admin/audit-logs').catch(() => ({ items: [] }));
  const rows = (logs.items || []).map((item) => `<tr><td>${fmtDate(item.createdAt)}</td><td>${esc(item.actor)}</td><td><span class="cell-main">${esc(item.action)}</span><span class="cell-sub">${esc(item.resourceType)} ${esc(String(item.resourceId || '').slice(0, 8))}</span></td><td><span class="cell-sub">${esc(JSON.stringify(item.before || {}))}</span></td><td><span class="cell-sub">${esc(JSON.stringify(item.after || {}))}</span></td><td>${esc(item.ip || '—')}</td></tr>`).join('') || emptyRow(6);
  content.innerHTML = pageHead('设置', '外观、后台连接与操作留痕。') +
    `<div class="panel"><div class="panel-head"><div><h2>外观</h2><p>跟随系统时，电脑切换深浅色后台会自动跟随；只对当前浏览器生效</p></div></div><div class="appearance-options">${THEME_MODES.map(([id, label, name]) => `<button type="button" class="appearance-option" data-theme-mode="${id}">${icon(name)}<strong>${label}</strong><small>${id === 'system' ? '自动切换' : id === 'light' ? '始终浅色' : '始终深色'}</small></button>`).join('')}</div></div>` +
    `<div class="panel"><div class="panel-head"><div><h2>连接</h2><p>管理后台通过此地址访问 Go API</p></div></div><div class="form-grid"><label>API 地址<input id="settingsApi" value="${esc(apiBase)}" /></label><label>当前管理员<input value="${esc(email)}" disabled /></label><label>后台版本<input value="${BUILD_TAG}" disabled /></label><div><button class="primary" data-action="save-api">保存 API 地址</button></div></div></div>
    <div class="panel"><div class="panel-head"><div><h2>服务状态</h2><p>健康检查结果</p></div><button class="secondary" data-action="check-service">重新检查</button></div><p id="settingsHealth" role="status"></p></div>
    <div class="panel"><div class="panel-head"><div><h2>最近管理操作</h2><p>路由、模型接入等写操作留痕，最多 100 条</p></div></div><div class="table-wrap"><table><thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>变更前</th><th>变更后</th><th>来源 IP</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="panel"><div class="panel-head"><div><h2>关于</h2><p>WEAVIA Admin Console</p></div></div><p>用户、商业、AI、任务、内容管理与数据分析，统一在新 Go API 之上。</p></div>`;
  renderHealth();
  applyTheme();
}
function openModal(title, body, submitLabel, onSubmit) {
  modal.innerHTML = `<form method="dialog" class="modal-inner"><div class="modal-head"><div><span class="eyebrow">WEAVIA ADMIN</span><h2>${esc(title)}</h2></div><button type="button" class="modal-close" aria-label="关闭" data-close-modal>×</button></div><div class="form-grid">${body}</div><p class="form-error" id="modalError" role="alert"></p><div class="modal-actions"><button type="button" class="secondary" data-close-modal>取消</button><button type="submit" class="primary">${esc(submitLabel)}</button></div></form>`;
  modal.showModal();
  modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
  modal.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = modal.querySelector('button[type=submit]');
    setBusy(button, true);
    try { await onSubmit(new FormData(event.target)); modal.close(); toast('已保存'); }
    catch (error) { $('modalError').textContent = error.message; }
    finally { setBusy(button, false); }
  });
}
function emptyRow(cols) { return `<tr><td colspan="${cols}" class="muted">最近 15 天没有记录</td></tr>`; }

async function userActivityModal(user) {
  modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">USER ACTIVITY</span><h2>${esc(user.email)}</h2><p>最近 15 天登录、模型请求与 Credits 消耗</p></div><button type="button" class="modal-close" data-close-modal aria-label="关闭">×</button></div><div class="activity-loading">读取用户活动…</div><div class="activity-actions"><button type="button" class="secondary" data-close-modal>关闭</button></div></div>`;
  modal.showModal();
  modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
  try {
    const data = await get(`/api/admin/users/${user.id}/activity?days=15`);
    const summary = data.summary || {};
    const logins = data.logins || [];
    const requests = data.requests || [];
    const consumptions = data.consumptions || [];
    const models = data.models || [];
    const loginRows = logins.length ? logins.map((item) => `<tr><td>${fmtDate(item.at)}</td><td><span class="ip">${esc(item.ip || '—')}</span></td><td><span class="cell-main">${esc(item.deviceName || '未知设备')}</span><span class="cell-sub">${esc(item.platform || '—')}${item.appVersion ? ' · v' + esc(item.appVersion) : ''}</span></td><td class="ua" title="${esc(item.userAgent)}">${esc(item.userAgent || '—')}</td><td>${item.success ? status('success') : status('failed')}${item.failureReason ? `<span class="cell-sub">${esc(item.failureReason)}</span>` : ''}</td></tr>`).join('') : emptyRow(5);
    const requestRows = requests.length ? requests.map((item) => `<tr><td>${fmtDate(item.at)}</td><td><span class="cell-main">${esc(item.modelKey || item.providerModel || '—')}</span><span class="cell-sub">${esc(item.provider || '—')}</span></td><td>${esc(item.resolution || '—')}${item.count ? ' · ' + item.count + ' 张' : ''}</td><td>${status(item.status)}</td><td>${fmtNumber(item.credits)}</td></tr>`).join('') : emptyRow(5);
    const consumptionRows = consumptions.length ? consumptions.map((item) => { const delta = Number(item.availableDelta || 0) + Number(item.reservedDelta || 0); return `<tr><td>${fmtDate(item.at)}</td><td>${esc(item.type)}</td><td class="${delta < 0 ? 'negative' : 'positive'}">${delta > 0 ? '+' : ''}${fmtNumber(delta)}</td><td>${fmtNumber(item.balanceAfter)}</td><td><span class="cell-sub">${esc(item.referenceType || '—')} ${esc(item.referenceId || '')}</span></td></tr>`; }).join('') : emptyRow(5);
    const modelRows = models.length ? models.map((item) => `<tr><td>${esc(item.model || '—')}</td><td>${fmtNumber(item.requests)}</td><td>${fmtNumber(item.succeeded)}</td><td>${fmtNumber(item.credits)}</td></tr>`).join('') : emptyRow(4);
    modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">USER ACTIVITY</span><h2>${esc(user.email)}</h2><p>最近 ${data.windowDays || 15} 天登录、模型请求与 Credits 消耗</p></div><button type="button" class="modal-close" data-close-modal aria-label="关闭">×</button></div><div class="activity-summary"><div><small>登录</small><strong>${fmtNumber(summary.logins)}</strong><span>成功 ${fmtNumber(summary.successfulLogins)} 次</span></div><div><small>独立 IP</small><strong>${fmtNumber(summary.uniqueIPs)}</strong><span>最近 ${fmtDate(summary.lastLoginAt)}</span></div><div><small>模型请求</small><strong>${fmtNumber(summary.requests)}</strong><span>最近 ${fmtDate(summary.lastRequestAt)}</span></div><div><small>消耗 Credits</small><strong>${fmtNumber(summary.consumedCredits)}</strong><span>当前余额 ${fmtNumber(summary.credits)}</span></div></div><div class="activity-body"><section class="activity-section"><h3>登录记录</h3><div class="table-wrap"><table><thead><tr><th>时间</th><th>IP</th><th>客户端</th><th>User-Agent</th><th>结果</th></tr></thead><tbody>${loginRows}</tbody></table></div></section><section class="activity-section"><h3>模型请求</h3><div class="table-wrap"><table><thead><tr><th>时间</th><th>模型 / Provider</th><th>参数</th><th>状态</th><th>Credits</th></tr></thead><tbody>${requestRows}</tbody></table></div></section><section class="activity-section"><h3>模型用量汇总</h3><div class="table-wrap"><table><thead><tr><th>模型</th><th>请求</th><th>成功</th><th>Credits</th></tr></thead><tbody>${modelRows}</tbody></table></div></section><section class="activity-section"><h3>消费流水</h3><div class="table-wrap"><table><thead><tr><th>时间</th><th>类型</th><th>变动</th><th>余额</th><th>关联</th></tr></thead><tbody>${consumptionRows}</tbody></table></div></section></div><div class="activity-actions"><span class="muted">用于对账的原始记录，按时间倒序</span><button type="button" class="primary" data-close-modal>关闭</button></div></div>`;
    modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
  } catch (error) {
    modal.querySelector('.activity-loading').textContent = error.message;
  }
}

function creditsModal(user) {
  openModal('调整 Credits', `<label>用户<input value="${esc(user.email)}" disabled /></label><label>类型<select name="kind"><option value="topup">线下充值入账（需凭证号）</option><option value="adjust">人工调整（补偿 / 扣减）</option></select></label><label>调整数量（正数增加，负数扣减）<input name="amount" type="number" step="1" required /></label><label>收款凭证号（线下充值必填，同一凭证只能入账一次）<input name="voucher" maxlength="80" placeholder="例如：转账流水号 / 收据编号" /></label><label>原因<input name="reason" required maxlength="200" placeholder="例如：线下充值 ¥500 / 活动补偿" /></label>`, '确认调整', async (form) => {
    const amount = Number(form.get('amount'));
    if (!Number.isInteger(amount) || amount === 0) throw new Error('请输入非零整数');
    const voucher = String(form.get('voucher') || '').trim();
    const topup = form.get('kind') === 'topup';
    if (topup && amount < 0) throw new Error('充值入账必须是正数');
    if (topup && !voucher) throw new Error('线下充值必须填写收款凭证号');
    const reason = topup ? `线下充值 · 凭证 ${voucher} · ${form.get('reason')}` : form.get('reason');
    await post('/api/admin/credits/adjust', { userId: user.id, amount, reason, idempotencyKey: topup ? `voucher:${voucher}` : crypto.randomUUID() });
    await navigate('users');
  });
}
function passwordModal(user) {
  openModal('重置登录密码', `<label>用户<input value="${esc(user.email)}" disabled /></label><label>新的临时密码（至少 8 位）<input name="password" type="text" minlength="8" maxlength="64" required autocomplete="off" /></label><p class="muted">保存后该用户所有设备会被退出，请把临时密码线下告知用户，并提醒其登录后自行修改。</p>`, '确认重置', async (form) => {
    await post(`/api/admin/users/${user.id}/password`, { password: form.get('password') });
  });
}
function providerKeyModal(provider) {
  openModal(`设置 ${provider.name} Key`, `<label>Provider<input value="${esc(provider.name)} (${esc(provider.code)})" disabled /></label><label>API Key<input name="apiKey" type="password" autocomplete="new-password" required placeholder="粘贴 Provider Key，保存后只显示末四位" /></label><p class="muted">Key 会加密存储，不会回传到浏览器。设置后模型列表会走实时 /models 接口。</p>`, '保存 Key', async (form) => {
    const apiKey = String(form.get('apiKey') || '').trim();
    if (apiKey.length < 16) throw new Error('Key 长度不正确');
    await request(`/api/admin/ai/providers/${provider.code}/credential`, { method: 'PUT', body: JSON.stringify({ apiKey }) });
    await navigate('ai');
  });
}


async function channelKeysModal(channel) {
  modal.innerHTML = `<div class="modal-inner"><div class="modal-head"><div><span class="eyebrow">CHANNEL KEYS</span><h2>${esc(channel.name)}</h2></div><button type="button" class="modal-close" data-close-modal>×</button></div><div class="activity-loading">读取 Key…</div><div class="modal-actions"><button type="button" class="secondary" data-close-modal>关闭</button></div></div>`;
  modal.showModal();
  modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
  try {
    const [data, healthData] = await Promise.all([get(`/api/admin/ai/channels/${channel.id}/keys`), get(`/api/admin/ai/channels/${channel.id}/keys-health`).catch(() => ({ items: [] }))]);
    const health = new Map((healthData.items || []).map((item) => [item.keyId, item]));
    const rows = (data.items || []).map((key) => {
      const h = health.get(key.id) || { calls: 0, successes: 0, failures: 0, avgMs: 0, lastModel: '' };
      const rate = h.calls ? ((h.successes / h.calls) * 100).toFixed(0) + '%' : '—';
      return `<tr><td><span class="cell-main">•••• ${esc(key.last4)}</span><span class="cell-sub">${fmtDate(key.createdAt)} 添加</span></td><td>${key.weight}</td><td>${h.calls ? fmtNumber(h.calls) : '0'}</td><td>${h.calls ? `${fmtNumber(h.successes)} / ${rate}` : '—'}</td><td>${h.avgMs ? fmtNumber(h.avgMs) + ' ms' : '—'}</td><td>${esc(h.lastModel || '—')}</td><td>${key.failures ? `<span class="badge danger">失败 ${key.failures}</span>` : '<span class="badge success">正常</span>'}</td><td>${key.cooldownUntil ? fmtDate(key.cooldownUntil) : '—'}</td><td>${key.enabled ? status('active') : status('disabled')}${key.disabledReason ? `<span class="cell-sub">系统停用：${esc(key.disabledReason)} · ${fmtDate(key.disabledAt)}</span>` : ''}</td><td><div class="row-actions"><button data-action="key-test" data-id="${esc(key.id)}">测试</button><button data-action="channel-key-toggle" data-id="${esc(key.id)}" data-channel="${esc(channel.id)}" data-enabled="${key.enabled ? 'false' : 'true'}">${key.enabled ? '停用' : '启用'}</button><button data-action="channel-key-delete" data-id="${esc(key.id)}" data-channel="${esc(channel.id)}">删除</button></div></td></tr>`;
    }).join('') || emptyRow(10);
    modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">CHANNEL KEYS</span><h2>${esc(channel.name)}</h2><p>同一渠道可挂多把 Key，按权重随机分配，失败自动进入冷却</p></div><button type="button" class="modal-close" data-close-modal>×</button></div><div class="activity-body"><section class="activity-section"><div class="table-wrap"><table><thead><tr><th>Key</th><th>权重</th><th>7 天调用</th><th>成功 / 成功率</th><th>平均延迟</th><th>最近模型</th><th>健康</th><th>冷却至</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></section></div><div class="activity-actions"><span class="muted">Key 加密存储，只显示末四位</span><button type="button" class="primary" data-action="channel-key" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">添加 Key</button></div></div>`;
    modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
  } catch (error) {
    modal.querySelector('.activity-loading').textContent = error.message;
  }
}



async function channelModelsModal(channel) {
  modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">CHANNEL MODELS</span><h2>${esc(channel.name)}</h2><p>该渠道已接入的模型，可逐条启停</p></div><button type="button" class="modal-close" data-close-modal>×</button></div><div class="activity-loading">读取模型清单…</div><div class="activity-actions"><button type="button" class="secondary" data-close-modal>关闭</button></div></div>`;
  modal.showModal();
  modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
  try {
    const data = await get(`/api/admin/ai/channels/${channel.id}/models`);
    const rows = (data.items || []).map((item) => `<tr><td><span class="cell-main">${esc(item.displayName)}</span><span class="cell-sub">${esc(item.providerModelId)}</span></td><td>${esc(item.modality)}</td><td>${item.credits ? fmtNumber(item.credits) : '—'}<span class="cell-sub">${esc(item.logicalKey || '未绑定')}</span></td><td>${item.enabled ? status('active') : status('disabled')}</td><td><button data-action="channel-model-toggle" data-id="${esc(item.id)}" data-channel="${esc(channel.id)}" data-enabled="${item.enabled ? 'false' : 'true'}">${item.enabled ? '停用' : '启用'}</button></td></tr>`).join('') || emptyRow(5);
    modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">CHANNEL MODELS</span><h2>${esc(channel.name)}</h2><p>${(data.items || []).length} 个模型 · 停用后不参与路由</p></div><button type="button" class="modal-close" data-close-modal>×</button></div><div class="activity-body"><section class="activity-section"><div class="table-wrap"><table><thead><tr><th>模型</th><th>模态</th><th>售价 / 逻辑模型</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></section></div><div class="activity-actions"><span class="muted">售价来自绑定的逻辑模型</span><button type="button" class="primary" data-close-modal>关闭</button></div></div>`;
    modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
  } catch (error) {
    modal.querySelector('.activity-loading').textContent = error.message;
  }
}

async function channelDiscoverModal(channel) {
  modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">DISCOVER</span><h2>${esc(channel.name)} · 发现模型</h2><p>用该渠道的 Key 读取供应商模型列表</p></div><button type="button" class="modal-close" data-close-modal>×</button></div><div class="activity-loading">正在读取供应商模型列表…</div></div>`;
  modal.showModal();
  modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
  try {
    const data = await post(`/api/admin/ai/channels/${channel.id}/discover`, {});
    const items = data.items || [];
    const existing = (state.aiHealth?.models || []).map((m) => m.key);
    const row = (item, index) => {
            return `<tr data-index="${index}" data-id="${esc(item.id)}"><td><input type="checkbox" name="pick" ${item.enabled ? 'disabled' : ''} /></td><td><span class="cell-main">${esc(item.id)}</span>${item.enabled ? `<span class="cell-sub">已接入 → ${esc(item.logicalKey || item.id)}</span>` : ''}</td><td><span class="io" data-io>${esc(ioLabel(item.inputs, item.outputs))}</span></td><td><details class="purpose-pick"><summary>${esc(item.capabilities.map(purposeLabel).join('、'))}</summary><div class="purpose-checks compact">${PURPOSES.map(([id, label]) => `<label><input type="checkbox" name="cap" value="${id}" ${item.capabilities.includes(id) ? 'checked' : ''} /> ${label}</label>`).join('')}</div></details></td><td><input name="display" value="${esc(item.id)}" /><input name="logical" list="logicalKeys" placeholder="接入为（默认同 ID）" /></td><td><input name="credits" type="number" min="1" value="50" style="width:72px" /></td></tr>`;
    };
    modal.innerHTML = `<div class="modal-inner activity-modal discover-modal"><div class="activity-head"><div><span class="eyebrow">DISCOVER</span><h2>${esc(channel.name)} · ${items.length} 个模型</h2><p>勾选要接入的模型。用途（决定输入 → 输出）已按模型名推荐，点开可改；图像、视频模型会出现在客户端，文本、语音、音频模型供后台功能调用；「接入为」填已有模型 Key = 给它加备用渠道</p></div><button type="button" class="modal-close" data-close-modal>×</button></div><div class="activity-body"><section class="activity-section"><div class="toolbar"><input id="discoverSearch" placeholder="搜索模型 ID" /><label class="switch-row" style="gap:6px"><input type="checkbox" id="discoverHideEnabled" checked /> 隐藏已接入</label></div><datalist id="logicalKeys">${existing.map((key) => `<option value="${esc(key)}"></option>`).join('')}</datalist><div class="table-wrap" style="max-height:52vh;overflow:auto"><table><thead><tr><th></th><th>模型 ID</th><th>输入 → 输出</th><th>用途</th><th>显示名 / 接入为</th><th>售价</th></tr></thead><tbody id="discoverList">${items.map(row).join('') || emptyRow(6)}</tbody></table></div></section></div><div class="activity-actions"><span class="muted" id="discoverCount">已选 0 个</span><button type="button" class="secondary" data-close-modal>取消</button><button type="button" class="primary" id="discoverApply">接入选中的模型</button></div></div>`;
    modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
    const applyFilter = () => {
      const q = $('discoverSearch').value.toLowerCase();
      const hide = $('discoverHideEnabled').checked;
      $('discoverList').querySelectorAll('tr[data-id]').forEach((tr) => { const item = items[Number(tr.dataset.index)]; tr.hidden = (q && !item.id.toLowerCase().includes(q)) || (hide && item.enabled); });
    };
    $('discoverSearch').addEventListener('input', applyFilter);
    $('discoverHideEnabled').addEventListener('change', applyFilter);
    applyFilter();
    $('discoverList').addEventListener('change', (event) => {
      const tr = event.target.closest('tr');
      if (tr && event.target.name === 'cap') {
        const picked = [...tr.querySelectorAll('input[name=cap]:checked')].map((input) => input.value);
        const [inputs, outputs] = deriveIO(picked);
        tr.querySelector('[data-io]').textContent = ioLabel(inputs, outputs);
        tr.querySelector('.purpose-pick summary').textContent = picked.map(purposeLabel).join('、') || '未选择';
      }
      $('discoverCount').textContent = `已选 ${modal.querySelectorAll('input[name=pick]:checked').length} 个`;
    });
    $('discoverApply').addEventListener('click', async (event) => {
      const picked = [...modal.querySelectorAll('input[name=pick]:checked')].map((input) => input.closest('tr'));
      if (!picked.length) { toast('先勾选模型'); return; }
      for (const tr of picked) {
        if (!tr.querySelectorAll('input[name=cap]:checked').length) { toast(`${tr.dataset.id} 至少选一个用途`); return; }
      }
      setBusy(event.target, true);
      let done = 0;
      try {
        for (const tr of picked) {
          const capabilities = [...tr.querySelectorAll('input[name=cap]:checked')].map((input) => input.value);
          await post(`/api/admin/ai/channels/${channel.id}/models`, { providerModelId: tr.dataset.id, displayName: tr.querySelector('input[name=display]').value.trim() || tr.dataset.id, modality: deriveIO(capabilities)[1][0] || 'image', capabilities, credits: Number(tr.querySelector('input[name=credits]').value) || 50, logicalKey: tr.querySelector('input[name=logical]').value.trim() });
          done += 1;
        }
      } catch (error) { toast(`已接入 ${done} 个，第 ${done + 1} 个失败：${error.message}`); setBusy(event.target, false); return; }
      modal.close();
      toast(`已接入 ${done} 个模型；到「模型」页核对用途和售价`);
      state.aiTab = 'models';
      await navigate('ai');
    });
  } catch (error) {
    modal.querySelector('.activity-loading').textContent = error.message;
  }
}
function manualModelModal(channel) {
  openModal('手动接入模型', `<label>模型 ID<input name="providerModelId" required placeholder="供应商实际 model id" /></label><label>显示名称<input name="displayName" required /></label><div class="form-row"><label>模态<select name="modality"><option value="image">图片</option><option value="video">视频</option></select></label><label>售价（Credits）<input name="credits" type="number" min="1" value="50" /></label></div><p class="muted">用于供应商不支持枚举、或你想用自定义逻辑模型键的场景。</p>`, '接入', async (form) => {
    await post(`/api/admin/ai/channels/${channel.id}/models`, { providerModelId: form.get('providerModelId'), displayName: form.get('displayName'), modality: form.get('modality'), credits: Number(form.get('credits') || 50) });
    await navigate('ai');
  });
}

// Where each provider serves generation and its model list. Computrix is the
// odd one: generation on maas-api.computrix.ai, model list on computrix.ai.
const PROVIDER_PRESETS = {
  antdigital: { label: 'Ant Digital MaaS', base: 'https://maas-api.antdigital.com/v1', models: '', note: '模型列表与生成同域：{Base}/models' },
  computrix: { label: 'Computrix MaaS', base: 'https://maas-api.computrix.ai/v1', models: 'https://computrix.ai/v1/models', note: '生成走 maas-api.computrix.ai，模型列表在 computrix.ai（不同域名，需单独填写）' },
  volcengine: { label: '火山方舟（字节）', base: 'https://ark.cn-beijing.volces.com/api/v3', models: '', note: '模型列表与生成同域：{Base}/models' },
  dashscope: { label: '阿里云百炼', base: 'https://dashscope.aliyuncs.com/api/v1', models: 'https://dashscope.aliyuncs.com/compatible-mode/v1/models', note: '生成走原生接口，模型列表走兼容模式 /compatible-mode/v1/models' },
};
function endpointFields(provider, baseUrl = '', modelsUrl = '') {
  const preset = PROVIDER_PRESETS[provider] || { base: '', models: '', note: '' };
  return `<div class="endpoint-fields" data-provider="${esc(provider)}">
    <label>生成接口地址（Base URL）<input name="baseUrl" value="${esc(baseUrl)}" placeholder="${esc(preset.base || '留空使用默认')}" /></label>
    <label>模型列表地址<input name="modelsUrl" value="${esc(modelsUrl)}" placeholder="${esc(preset.models || '留空 = Base URL + /models')}" /></label>
    <p class="muted endpoint-note">${esc(preset.note || '')}${preset.models ? ` <button type="button" class="mini" data-fill-models="${esc(preset.models)}">填入推荐地址</button>` : ''}</p>
  </div>`;
}
function bindEndpointFields() {
  modal.querySelector('[data-fill-models]')?.addEventListener('click', (event) => { modal.querySelector('input[name=modelsUrl]').value = event.target.dataset.fillModels; });
  const select = modal.querySelector('select[name=providerCode]');
  select?.addEventListener('change', () => {
    const box = modal.querySelector('.endpoint-fields');
    box.outerHTML = endpointFields(select.value, '', PROVIDER_PRESETS[select.value]?.models || '');
    bindEndpointFields();
  });
}
function channelModal() {
  openModal('新增渠道', `<label>供应商<select name="providerCode">${Object.entries(PROVIDER_PRESETS).map(([code, p]) => `<option value="${code}">${esc(p.label)}</option>`).join('')}</select></label><label>渠道名称<input name="name" required placeholder="例如：AntDigital 备用账号" /></label>${endpointFields('antdigital')}<label>API Key<input name="apiKey" type="password" required autocomplete="off" /></label><div class="form-row"><label>优先级<input name="priority" type="number" value="50" /></label><label>权重<input name="weight" type="number" value="1" min="0" /></label></div><p class="muted">创建后会复制同供应商已接入的模型并绑到对应逻辑模型；之后可在「发现模型」里增减。</p>`, '创建渠道', async (form) => {
    const channel = await post('/api/admin/ai/channels', { providerCode: form.get('providerCode'), name: form.get('name'), baseUrl: form.get('baseUrl'), apiKey: form.get('apiKey'), priority: Number(form.get('priority') || 0), weight: Number(form.get('weight') || 1) });
    const modelsUrl = String(form.get('modelsUrl') || '').trim();
    if (modelsUrl && channel?.id) await request(`/api/admin/ai/channels/${channel.id}/meta`, { method: 'PATCH', body: JSON.stringify({ name: form.get('name'), baseUrl: form.get('baseUrl'), modelsUrl }) });
    await navigate('ai');
  });
  bindEndpointFields();
}

function channelMetaModal(channel) {
  openModal('名称与地址', `<label>名称<input name="name" value="${esc(channel.name)}" required /></label><label>供应商<input value="${esc(PROVIDER_PRESETS[channel.providerCode]?.label || channel.providerCode)}" disabled /></label>${endpointFields(channel.providerCode, channel.baseUrl || '', channel.modelsUrl || '')}<p class="muted">保存后可在渠道列表点「测试」验证模型列表地址是否可达。</p>`, '保存', async (form) => {
    await request(`/api/admin/ai/channels/${channel.id}/meta`, { method: 'PATCH', body: JSON.stringify({ name: form.get('name'), baseUrl: form.get('baseUrl'), modelsUrl: form.get('modelsUrl') }) });
    await navigate('ai');
  });
  bindEndpointFields();
}

function channelEditModal(channel) {
  openModal('渠道优先级', `<label>渠道<input value="${esc(channel.name)}" disabled /></label><div class="form-row"><label>优先级<input name="priority" type="number" value="${channel.priority}" /></label><label>权重<input name="weight" type="number" min="0" value="${channel.weight}" /></label></div><p class="muted">同优先级按权重随机；失败会自动切换。</p>`, '保存', async (form) => {
    await patch(`/api/admin/ai/channels/${channel.id}`, { priority: Number(form.get('priority')), weight: Number(form.get('weight')) });
    await navigate('ai');
  });
}

function channelKeyModal(channel) {
  openModal('设置渠道 Key', `<label>渠道<input value="${esc(channel.name)}" disabled /></label><label>API Key<input name="apiKey" type="password" required placeholder="只显示末四位" /></label>`, '保存 Key', async (form) => {
    await request(`/api/admin/ai/channels/${channel.id}/key`, { method: 'PUT', body: JSON.stringify({ apiKey: form.get('apiKey') }) });
    await navigate('ai');
  });
}

function planModal(plan) {
  openModal('编辑套餐', `<label>套餐<input value="${esc(plan.name)} (${esc(plan.code)})" disabled /></label><label>价格（元）<input name="price" type="number" min="0" step="0.01" value="${(plan.priceMinor / 100).toFixed(2)}" required /></label><label>状态<select name="enabled"><option value="true" ${plan.enabled ? 'selected' : ''}>启用</option><option value="false" ${!plan.enabled ? 'selected' : ''}>停用</option></select></label>`, '保存', async (form) => {
    await patch(`/api/admin/plans/${plan.id}`, { priceMinor: Math.round(Number(form.get('price')) * 100), enabled: form.get('enabled') === 'true' });
    await navigate('commerce');
  });
}
function showcaseModal(item = null) {
  const image = item?.imageUrl ? `${apiBase.replace(/\/$/, '')}${item.imageUrl}` : '';
  openModal(item ? '编辑示例' : '上传示例', `<div class="modal-upload"><div class="upload-preview" id="uploadPreview">${image ? `<img id="showcasePreview" src="${esc(image)}" alt="" />` : '<img id="showcasePreview" alt="" hidden />'}<span id="previewEmpty" ${image ? 'hidden' : ''}>选择一张图片</span><input name="image" id="showcaseImage" type="file" accept="image/jpeg,image/png,image/webp" ${item ? '' : 'required'} /></div><div class="form-grid"><label>类型<select name="kind"><option value="image" ${item?.kind === 'image' || !item ? 'selected' : ''}>示例图</option><option value="work" ${item?.kind === 'work' ? 'selected' : ''}>示例作品</option></select></label><label>标题<input name="title" maxlength="120" value="${esc(item?.title || '')}" required /></label><label>标签<input name="tag" maxlength="40" value="${esc(item?.tag || '')}" placeholder="美妆 / 暖调" /></label><label>提示词<textarea name="prompt" rows="4" maxlength="2000">${esc(item?.prompt || '')}</textarea></label><div class="form-row"><label>排序<input name="sortOrder" type="number" value="${item?.sortOrder ?? 100}" /></label><label>状态<select name="status"><option value="published" ${item?.status === 'published' || !item ? 'selected' : ''}>发布</option><option value="draft" ${item?.status === 'draft' ? 'selected' : ''}>草稿</option></select></label></div><p class="muted">一键同款参数：客户点「做同款」时自动填入。模型填逻辑模型 Key（如 qwen-image-2.0），留空则只带入提示词。</p><div class="form-row"><label>媒体<select name="media"><option value="image" ${item?.media !== 'video' ? 'selected' : ''}>图片</option><option value="video" ${item?.media === 'video' ? 'selected' : ''}>视频</option></select></label><label>模型 Key<input name="model" maxlength="120" value="${esc(item?.model || '')}" placeholder="qwen-image-2.0" /></label></div><div class="form-row"><label>比例<select name="ratio">${['', '1:1', '3:4', '4:5', '16:9', '9:16'].map((r) => `<option value="${r}" ${(item?.ratio || '') === r ? 'selected' : ''}>${r || '不指定'}</option>`).join('')}</select></label><label>清晰度<select name="resolution">${['', '1K', '2K', '4K'].map((r) => `<option value="${r}" ${(item?.resolution || '') === r ? 'selected' : ''}>${r || '不指定'}</option>`).join('')}</select></label><label>张数<input name="count" type="number" min="1" max="4" value="${item?.count || 1}" /></label></div></div></div>`, item ? '保存修改' : '上传并发布', async (form) => {
    if (item) {
      await patch(`/api/admin/showcase/${item.id}`, { kind: form.get('kind'), title: form.get('title'), tag: form.get('tag'), prompt: form.get('prompt'), status: form.get('status'), sortOrder: Number(form.get('sortOrder')), media: form.get('media'), model: form.get('model'), ratio: form.get('ratio'), resolution: form.get('resolution'), count: Number(form.get('count')) || 1 });
    } else {
      const file = form.get('image');
      if (!(file instanceof File) || !file.size) throw new Error('请选择图片文件');
      const upload = new FormData();
      ['kind', 'title', 'tag', 'prompt', 'status', 'sortOrder', 'media', 'model', 'ratio', 'resolution', 'count', 'image'].forEach((key) => upload.append(key, form.get(key)));
      await request('/api/admin/showcase', { method: 'POST', body: upload });
    }
    await navigate('showcase');
  });
  const input = $('showcaseImage');
  input?.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    $('showcasePreview').src = URL.createObjectURL(file);
    $('showcasePreview').hidden = false;
    $('previewEmpty').hidden = true;
  });
}

async function onAction(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  try {
    if (action === 'go-pricing') return navigate('pricing');
    if (action === 'go-showcase') return navigate('showcase');
    if (action === 'go-commerce') return navigate('commerce');
    if (action === 'go-tasks') return navigate('tasks');
    if (action === 'commerce-tab') { state.commerceTab = target.dataset.tab; content.querySelector('.tabs').outerHTML = renderCommerceTabs(); return renderCommerceBody(); }
    if (action === 'go-page') { await navigate(target.dataset.page); return; }
    if (action === 'ai-refresh') { await navigate('ai'); return; }
    if (action === 'model-purpose') { state.modelPurpose = target.dataset.purpose; return renderAIBody(); }
    if (action === 'model-edit') { const m = (state.aiHealth?.models || []).find((item) => item.key === target.dataset.key); if (m) modelEditModal(m); return; }
    if (action === 'model-routes') { await modelRoutesModal(target.dataset.key); return; }
    if (action === 'model-visibility') { setBusy(target, true); await patch(`/api/admin/ai/logical-models/${encodeURIComponent(target.dataset.key)}`, { enabled: target.dataset.enabled === 'true' }); await navigate('ai'); return; }
    if (action === 'channel-test') { await channelTest(target.dataset.id, target); return; }
    if (action === 'key-test') { setBusy(target, true); try { const r = await post(`/api/admin/ai/channel-keys/${target.dataset.id}/test`, {}); toast(`${r.ok ? '✓' : '✗'} ${r.message}`); } finally { setBusy(target, false); } return; }
    if (action === 'log-filter') { state.logFilter = { ...(state.logFilter || { hours: 24 }), [target.dataset.key]: target.dataset.value }; await loadLogs(); return; }
    if (action === 'log-reset') { state.logFilter = { hours: 24, model: '', channel: '', status: '', code: '' }; await loadLogs(); return; }
    if (action === 'content-tab') { state.contentTab = target.dataset.tab; await navigate('showcase'); return; }
    if (action === 'ai-tab') { state.aiTab = target.dataset.tab; content.querySelector('.tabs').outerHTML = renderAITabs(); return renderAIBody(); }
    if (action === 'task-tab') { state.taskTab = target.dataset.tab; content.querySelector('.tabs').outerHTML = `<div class="tabs">${[['tasks', '任务'], ['runs', '执行记录']].map(([id, label]) => `<button type="button" class="${state.taskTab === id ? 'active' : ''}" data-action="task-tab" data-tab="${id}">${label}</button>`).join('')}</div>`; return renderTaskBody(); }
    if (action === 'task-detail') return taskDetailModal(target.dataset.id);
    if (action === 'showcase-filter') { state.showcaseFilter = target.dataset.tab; await loadShowcase(); return; }
    if (action === 'storage-migrate') { setBusy(target, true); try { await storageMigrate(target.dataset.direction); } catch (error) { toast(error.message); } finally { setBusy(target, false); } return; }
    if (action === 'storage-test') { setBusy(target, true); try { await post('/api/admin/storage/test', {}); toast('连接正常，已写入并删除探针对象'); await navigate('storage'); } catch (error) { toast(error.message); setBusy(target, false); } return; }
    if (action === 'invite-new') return inviteNewModal();
    if (action === 'invite-copy') { try { await navigator.clipboard.writeText(target.dataset.code); toast('邀请码已复制'); } catch { toast('复制失败，请手动选择'); } return; }
    if (action === 'invite-toggle') { setBusy(target, true); await patch(`/api/admin/invites/${target.dataset.id}`, { enabled: target.dataset.enabled === 'true' }); await navigate('users'); return; }
    if (action === 'oss-sync') { setBusy(target, true); await patch(`/api/admin/users/${target.dataset.id}/oss-sync`, { enabled: target.dataset.enabled === 'true' }); await navigate('users'); return; }
    if (action === 'roles-save') { const userID = target.dataset.id; setBusy(target, true); try { const codes = [...content.querySelectorAll(`input[name=role-${userID}]:checked`)].map((input) => input.value); await request(`/api/admin/users/${userID}/roles`, { method: 'PUT', body: JSON.stringify({ codes }) }); toast('角色已保存'); } catch (error) { toast(error.message); } finally { setBusy(target, false); } return; }
    if (action === 'user-roles') { userRolesModal(target.dataset.id, target.dataset.email); return; }
    if (action === 'account-groups') { accountGroupsModal(target.dataset.no); return; }
    if (action === 'account-lookup') { const row = state.users.find((item) => item.accountNo === target.dataset.no); if (row) accountLookupModal(row.accountNo); return; }
    if (action === 'user-activity') { const user = state.users.find((item) => item.id === target.dataset.id); if (user) userActivityModal(user); return; }
    if (action === 'user-status') { setBusy(target, true); await patch(`/api/admin/users/${target.dataset.id}/status`, { status: target.dataset.status }); await navigate('users'); return; }
    if (action === 'user-password') { const user = state.users.find((item) => item.id === target.dataset.id); if (user) passwordModal(user); return; }
    if (action === 'user-credits') { const user = state.users.find((item) => item.id === target.dataset.id); if (user) creditsModal(user); return; }
    if (action === 'plan-edit') { const plan = state.plans.find((item) => item.id === target.dataset.id); if (plan) planModal(plan); return; }
    if (action === 'skill-publish') { setBusy(target, true); await patch(`/api/admin/skills/${target.dataset.id}`, { status: 'published' }); await navigate(state.page); return; }
    if (action === 'skill-reject') { setBusy(target, true); await patch(`/api/admin/skills/${target.dataset.id}`, { status: 'rejected' }); await navigate(state.page); return; }
    if (action === 'app-publish') { setBusy(target, true); await patch(`/api/admin/apps/${target.dataset.id}`, { status: 'published' }); await navigate(state.page); return; }
    if (action === 'app-draft') { setBusy(target, true); await patch(`/api/admin/apps/${target.dataset.id}`, { status: 'draft' }); await navigate(state.page); return; }
    if (action === 'sync-models') { setBusy(target, true); const result = await post('/api/admin/ai/models/sync', {}); toast(`已同步 ${result.synced || 0} 个模型`); await navigate('ai'); return; }
    if (action === 'pricing-price') { const row = state.pricing.find((item) => item.channelModelId === target.dataset.id); if (row) pricingPriceModal(row); return; }
    if (action === 'pricing-cost') { const row = state.pricing.find((item) => item.channelModelId === target.dataset.id); if (row) pricingCostModal(row); return; }
    if (action === 'routing-edit') { const binding = (state.routing?.bindings || []).find((item) => item.id === target.dataset.id); if (binding) routingEditModal(binding); return; }
    if (action === 'group-new') return groupNewModal();
    if (action === 'group-price') { const group = (state.routeGroups || []).find((item) => item.id === target.dataset.id); if (group) groupPriceModal(group); return; }
    if (action === 'group-channels') { const group = (state.routeGroups || []).find((item) => item.id === target.dataset.id); if (group) groupChannelsModal(group); return; }
    if (action === 'channel-meta') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) channelMetaModal(channel); return; }
    if (action === 'channel-delete') { if (!await confirmDialog(`删除渠道「${target.dataset.name}」？其 Key、模型与绑定会一起删除，不可恢复。`)) return; setBusy(target, true); await remove(`/api/admin/ai/channels/${target.dataset.id}`); await navigate('ai'); return; }
    if (action === 'channel-models') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) channelModelsModal(channel); return; }
    if (action === 'channel-model-toggle') { setBusy(target, true); await patch(`/api/admin/ai/channel-models/${target.dataset.id}`, { enabled: target.dataset.enabled === 'true' }); const channel = (state.channels || []).find((item) => item.id === target.dataset.channel); if (channel) channelModelsModal(channel); return; }
    if (action === 'channel-discover') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) channelDiscoverModal(channel); return; }
    if (action === 'channel-model-add') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) manualModelModal(channel); return; }
    if (action === 'channel-keys') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) channelKeysModal(channel); return; }
    if (action === 'channel-key-toggle') { setBusy(target, true); await patch(`/api/admin/ai/channel-keys/${target.dataset.id}`, { enabled: target.dataset.enabled === 'true' }); const channel = (state.channels || []).find((item) => item.id === target.dataset.channel); if (channel) channelKeysModal(channel); return; }
    if (action === 'channel-key-delete') { if (!await confirmDialog('删除这把 Key？该操作不可恢复。')) return; setBusy(target, true); await remove(`/api/admin/ai/channel-keys/${target.dataset.id}`); const channel = (state.channels || []).find((item) => item.id === target.dataset.channel); if (channel) channelKeysModal(channel); return; }
    if (action === 'channel-new') return channelModal();
    if (action === 'channel-edit') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) channelEditModal(channel); return; }
    if (action === 'channel-key') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) channelKeyModal(channel); return; }
    if (action === 'channel-toggle') { setBusy(target, true); await patch(`/api/admin/ai/channels/${target.dataset.id}`, { enabled: target.dataset.enabled === 'true' }); await navigate('ai'); return; }
    if (action === 'provider-key') { const provider = state.providers.find((item) => item.code === target.dataset.code); if (provider) providerKeyModal(provider); return; }
    if (action === 'provider-toggle') { setBusy(target, true); await patch(`/api/admin/ai/providers/${target.dataset.id}`, { enabled: target.dataset.enabled === 'true' }); await navigate('ai'); return; }
    if (action === 'showcase-new') return showcaseModal();
    if (action === 'announcement-new') return announcementModal();
    if (action === 'announcement-edit') { const item = state.announcements.find((entry) => entry.id === target.dataset.id); if (item) announcementModal(item); return; }
    if (action === 'announcement-toggle') { const item = state.announcements.find((entry) => entry.id === target.dataset.id); if (!item) return; setBusy(target, true); await request(`/api/admin/announcements/${item.id}`, { method: 'PUT', body: JSON.stringify(announcementBody(item, { status: item.status === 'published' ? 'draft' : 'published' })) }); await navigate('client'); return; }
    if (action === 'announcement-delete') { if (!await confirmDialog('确定删除这条公告？')) return; setBusy(target, true); await remove(`/api/admin/announcements/${target.dataset.id}`); await navigate('client'); return; }
    if (action === 'showcase-edit') { const item = state.showcase.find((entry) => entry.id === target.dataset.id); if (item) showcaseModal(item); return; }
    if (action === 'showcase-toggle') { setBusy(target, true); await patch(`/api/admin/showcase/${target.dataset.id}`, { status: target.dataset.status }); await navigate('showcase'); return; }
    if (action === 'showcase-delete') { if (!await confirmDialog('确定删除这条内容？客户端将不再显示。')) return; setBusy(target, true); await remove(`/api/admin/showcase/${target.dataset.id}`); await navigate('showcase'); return; }
    if (action === 'save-api') { apiBase = $('settingsApi').value.trim().replace(/\/$/, ''); localStorage.setItem('weavia.admin.api', apiBase); toast('API 地址已保存'); await checkService(); return; }
    if (action === 'check-service') { await checkService(); toast('服务状态已更新'); return; }
    if (action === 'ops-refresh') { await navigate('ops'); return; }
    if (action === 'ops-period') { state.opsPeriod = target.dataset.period; await navigate('ops'); return; }
    if (action === 'ops-logs') { await loadOpsLogs(target.dataset.service); return; }
  } catch (error) { toast(error.message); setBusy(target, false); }
}
// Buttons inside dialogs live outside #content, so both share one handler.
content.addEventListener('click', onAction);
modal.addEventListener('click', onAction);
$('loginForm').addEventListener('submit', login);
$('logout').addEventListener('click', logout);
$('refresh').addEventListener('click', () => navigate(state.page));
$('serviceStatus').addEventListener('click', () => navigate('ops'));
setInterval(() => {
  if (token && !document.hidden) checkService();
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (token && !document.hidden) checkService();
});
$('apiBase').value = apiBase;
initLogin();
$('themeSlot').innerHTML = themeSwitch();
applyTheme();
window.addEventListener('hashchange', () => { if (token && pageFromHash() !== state.page) navigate(pageFromHash()); });
if (token) { showAdmin(); renderNav(); checkService(); navigate(pageFromHash()); } else { showLogin(); }

const BUILD_TAG = '2026-10-25-ops-a';
const $ = (id) => document.getElementById(id);
const content = $('content');
const modal = $('modal');
const pages = [
  { id: 'dashboard', label: '仪表盘', kicker: 'OVERVIEW' },
  { id: 'users', label: '用户中心', kicker: 'CUSTOMERS' },
  { id: 'roles', label: '角色权限', kicker: 'ACCESS' },
  { id: 'commerce', label: '商业中心', kicker: 'COMMERCE' },
  { id: 'ai', label: 'AI Studio', kicker: 'AI OPERATIONS' },
  { id: 'pricing', label: '定价与成本', kicker: 'PRICING' },
  { id: 'invites', label: '邀请码', kicker: 'GROWTH' },
  { id: 'storage', label: '存储', kicker: 'STORAGE' },
  { id: 'tasks', label: '创作任务', kicker: 'TASKS' },
  { id: 'ops', label: '运行与排障', kicker: 'OPERATIONS' },
  { id: 'showcase', label: '内容管理', kicker: 'SHOWCASE' },
  { id: 'analytics', label: '数据分析', kicker: 'ANALYTICS' },
  { id: 'settings', label: '设置', kicker: 'SETTINGS' },
];
const defaultApiBase = location.port && location.port !== '80' && location.port !== '443' ? `${location.protocol}//${location.hostname}:8080` : location.origin;
let apiBase = localStorage.getItem('weavia.admin.api') || defaultApiBase;
let token = sessionStorage.getItem('weavia.admin.token') || '';
let email = sessionStorage.getItem('weavia.admin.email') || '';
const state = { page: 'dashboard', commerceTab: 'plans', aiTab: 'overview', taskTab: 'tasks', showcaseFilter: 'all', opsPeriod: '24h', health: 'checking', opsStatus: null, users: [], showcase: [], plans: [], orders: [], payments: [], providers: [], models: null, routing: null, usage: [], overview: null, tasks: [], runs: [], pricing: [], pricingSettings: null, invites: [] };


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
  $('nav').innerHTML = pages.map((page, index) => `<button type="button" class="nav-item ${state.page === page.id ? 'active' : ''}" data-page="${page.id}"><span class="nav-index">0${index + 1}</span><span class="nav-label">${esc(page.label)}</span>${page.id === 'showcase' && state.showcase.length ? `<span class="nav-count">${state.showcase.length}</span>` : ''}</button>`).join('');
  document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
}
function showLogin() { $('loginView').hidden = false; $('adminView').hidden = true; }
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
async function login(event) {
  event.preventDefault();
  $('loginError').textContent = '';
  apiBase = $('apiBase').value.trim().replace(/\/$/, '');
  localStorage.setItem('weavia.admin.api', apiBase);
  const button = event.target.querySelector('button[type=submit]');
  setBusy(button, true);
  try {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('email').value.trim(), password: $('password').value, deviceInfo: { deviceName: 'weavia-admin', platform: 'web', appVersion: '0.1.0' } }),
    }, false);
    token = data.accessToken;
    email = data.user.email;
    sessionStorage.setItem('weavia.admin.token', token);
    sessionStorage.setItem('weavia.admin.email', email);
    showAdmin(); renderNav(); await navigate('dashboard'); await checkService();
  } catch (error) {
    $('loginError').textContent = error.message;
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
async function navigate(pageId) {
  state.page = pageId;
  const page = pages.find((item) => item.id === pageId) || pages[0];
  $('pageKicker').textContent = page.kicker;
  renderNav();
  content.innerHTML = loading();
  try { await loaders[pageId](); enhanceTables(); } catch (error) { content.innerHTML = pageHead(page.label, '') + empty(error.message); }
}
const loaders = { dashboard: loadDashboard, users: loadUsers, roles: loadRoles, commerce: loadCommerce, ai: loadAI, pricing: loadPricing, invites: loadInvites, storage: loadStorage, tasks: loadTasks, ops: loadOps, showcase: loadShowcase, analytics: loadAnalytics, settings: loadSettings };

async function loadDashboard() {
  const [overview, orders, tasks, showcase] = await Promise.all([get('/api/admin/overview'), get('/api/admin/orders'), get('/api/admin/tasks'), get('/api/admin/showcase')]);
  state.overview = overview; state.orders = orders || []; state.tasks = tasks || []; state.showcase = showcase.items || [];
  content.innerHTML = pageHead('仪表盘', '今天的运营、收入、任务与内容状态。', '<button class="secondary" data-action="go-showcase">管理客户端内容</button>') +
    `<div class="metrics">
      ${metric('用户总数', fmtNumber(overview.users), `今日新增 ${fmtNumber(overview.newUsersToday)}`)}
      ${metric('付费会员', fmtNumber(overview.paidMembers), '订阅中的付费用户')}
      ${metric('累计收入', fmtMoney(overview.revenueMinorCNY), '已支付订单')}
      ${metric('Credits 消耗', fmtNumber(overview.creditsConsumed), '已结算任务')}
      ${metric('任务总数', fmtNumber(overview.tasks), `失败 ${fmtNumber(overview.failedTasks)}`)}
      ${metric('AI 成本', '¥' + Number(overview.aiCostByCurrency?.CNY || 0).toFixed(2), '按 Provider 记账')}
      ${metric('毛利', overview.grossProfitCNY == null ? '—' : fmtMoney(Math.round(overview.grossProfitCNY * 100)), '收入 - AI 成本')}
      ${metric('内容条目', fmtNumber(state.showcase.length), '在内容管理中查看')}
    </div>
    <div class="panel-grid">
      <section class="panel"><div class="panel-head"><div><h2>最近订单</h2><p>最新 6 笔商业订单</p></div><button class="text-button" data-action="go-commerce">全部订单</button></div>${ordersTable((orders || []).slice(0, 6))}</section>
      <section class="panel"><div class="panel-head"><div><h2>最近任务</h2><p>最新 6 个创作任务</p></div><button class="text-button" data-action="go-tasks">全部任务</button></div>${tasksTable((tasks || []).slice(0, 6), true)}</section>
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
  content.innerHTML = pageHead('用户中心', '查看用户、套餐、Credits 与账号状态。') + `<div class="panel"><div class="toolbar"><input id="userSearch" placeholder="搜索邮箱、姓名或套餐" /><span class="spacer"></span><span class="badge gold">${state.users.length} 位用户</span></div><div id="userTable"></div></div>`
  const draw = (rows) => { renderInto($('userTable'), usersTable(rows)); };
  draw(state.users);
  $('userSearch').addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    draw(users.filter((user) => `${user.email} ${user.name} ${user.plan}`.toLowerCase().includes(query)));
  });
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
  return `<div class="table-wrap"><table><thead><tr><th>用户</th><th>套餐</th><th>Credits</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead><tbody>${rows.map((user) => `<tr><td><span class="cell-main">${esc(user.email)}</span><span class="cell-sub">${esc(user.accountNo || '—')} · ${esc(user.name || '未命名')} · ${esc(user.membershipStatus || 'none')}${user.inviteCode ? ` · 邀请码 ${esc(user.inviteCode)}` : ''}</span></td><td>${esc(user.plan || 'free')}</td><td><span class="cell-main">${fmtNumber(user.credits)}</span></td><td>${status(user.status)}<span class="badge ${user.ossSync ? 'success' : ''}">${user.ossSync ? 'OSS 同步已开' : 'OSS 同步未开'}</span></td><td>${fmtDate(user.createdAt)}</td><td><div class="row-actions"><button data-action="user-roles" data-id="${esc(user.id)}" data-email="${esc(user.email)}">角色</button><button data-action="account-lookup" data-no="${esc(user.accountNo || '')}">关联</button><button data-action="oss-sync" data-id="${esc(user.id)}" data-enabled="${user.ossSync ? 'false' : 'true'}">${user.ossSync ? '关闭同步' : '开通同步'}</button><button data-action="user-activity" data-id="${esc(user.id)}">活动</button><button data-action="user-status" data-id="${esc(user.id)}" data-status="${user.status === 'active' ? 'disabled' : 'active'}">${user.status === 'active' ? '禁用' : '启用'}</button><button data-action="user-credits" data-id="${esc(user.id)}" data-email="${esc(user.email)}">调整 Credits</button></div></td></tr>`).join('')}</tbody></table></div>`;
}



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
async function loadAI() {
  const [providers, models, routing, usage, channelData, skillData, appData, groupData, pricingData, storageData, providerSummary] = await Promise.all([get('/api/admin/ai/providers'), get('/api/admin/ai/models'), get('/api/admin/ai/routing'), get('/api/admin/ai/usage'), get('/api/admin/ai/channels'), get('/api/admin/skills'), get('/api/admin/apps'), get('/api/admin/route-groups'), get('/api/admin/pricing').catch(() => null), get('/api/admin/storage').catch(() => null), get('/api/admin/ai/provider-summary').catch(() => null)]);
  const channels = channelData.items || [];
  state.providers = providers || []; state.models = models; state.platformModels = models?.platformModels || []; state.routing = routing; state.usage = usage?.usage || []; state.channels = channels || []; state.skills = skillData?.items || []; state.apps = appData?.items || []; state.routeGroups = groupData?.items || []; state.aiPricing = pricingData?.items || []; state.aiStorage = storageData || null; state.providerSummary = providerSummary?.items || [];
  content.innerHTML = pageHead('AI Studio', 'Provider、模型目录、路由与调用成本。') + renderAITabs() + '<div id="aiBody"></div>';
  renderAIBody();
}
function renderAITabs() {
  return `<div class="tabs">${[['overview', '概览'], ['providers', '供应商'], ['channels', '渠道与 Key'], ['models', '模型与能力'], ['routing', '路由'], ['groups', '分组'], ['usage', '用量'], ['skills', 'Skill'], ['apps', '应用']].map(([id, label]) => `<button type="button" class="${state.aiTab === id ? 'active' : ''}" data-action="ai-tab" data-tab="${id}">${label}</button>`).join('')}</div>`;
}
function renderAIBody() {
  const body = $('aiBody');
  if (state.aiTab === 'overview') {
    renderInto(body, renderAIOverview());
    return;
  }
  if (state.aiTab === 'providers') {
    body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>供应商</h2><p>平台档案与健康概览；Key 统一在「渠道与 Key」里管理</p></div></div><div class="provider-grid">${providerCards()}</div></div>`;
  } else if (state.aiTab === 'channels') {
    body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>渠道</h2><p>一个渠道对应一个 Provider 账号/Key，可配置优先级和权重</p></div><button class="primary" data-action="channel-new">新增渠道</button></div>${channelsTable(state.channels)}</div>`;
  } else if (state.aiTab === 'skills') {
    body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>Skill 管理</h2><p>客户上传后默认私有，审核通过才公开</p></div><span class="badge gold">${(state.skills || []).length} 个</span></div>${skillsTable(state.skills || [])}</div>`;
  } else if (state.aiTab === 'apps') {
    body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>AI 应用管理</h2><p>图片应用开放；视频应用在阶段 3 接入</p></div><span class="badge gold">${(state.apps || []).length} 个</span></div>${appsTable(state.apps || [])}</div>`;
  } else if (state.aiTab === 'models') {
    const platform = state.platformModels || [];
    const images = platform.filter((item) => item.modality === 'image');
    const videos = platform.filter((item) => item.modality === 'video');
    body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>平台模型</h2><p>来自 Provider /models；显示名、模态与接入状态</p></div><div class="row-actions"><span class="badge gold">${platform.length} 个模型</span><button class="mini" data-action="sync-models">同步到客户端</button></div></div><div class="toolbar" style="margin:12px 0"><input id="modelFilter" placeholder="搜索模型名称或 ID" /></div><h3 class="model-section-title">图片模型</h3>${platformTable(images)}<h3 class="model-section-title">视频模型</h3>${platformTable(videos)}</div>`;
  } else if (state.aiTab === 'routing') {
    const bindings = state.routing?.bindings || [];
    body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>逻辑模型路由</h2><p>客户端看到的模型 → 实际渠道模型；优先级越大越先选中，可按权重分流</p></div></div><div class="toolbar" style="margin:12px 0"><input id="routingFilter" placeholder="搜索逻辑模型、渠道或模型 ID" /></div>${routingTable(bindings)}</div>`;
  } else if (state.aiTab === 'groups') {
    body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>渠道分组</h2><p>把优质渠道放进独立分组，绑定给指定账户；组内不可用时自动回退默认组</p></div><button class="primary" data-action="group-new">新建分组</button></div>${routeGroupsTable(state.routeGroups || [])}</div>`;
  } else {
    body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>调用用量</h2><p>最近 500 条 Provider 调用</p></div></div><div class="toolbar" style="margin:12px 0"><input id="usageFilter" placeholder="搜索工作流、模型或状态" /></div>${usageTable(state.usage)}</div>`;
  }
  ['modelFilter', 'routingFilter', 'usageFilter'].forEach((id) => {
    const input = $(id);
    if (!input) return;
    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      document.querySelectorAll('#aiBody tbody tr').forEach((row) => {
        row.dataset.filtered = Boolean(query) && !row.textContent.toLowerCase().includes(query) ? '1' : '0';
      });
      refreshTables();
    });
  });
  enhanceTables(body);
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


function renderAIOverview() {
  const channels = state.channels || [];
  const usage = state.usage || [];
  const pricing = state.aiPricing || [];
  const platform = state.platformModels || [];
  const enabledChannels = channels.filter((c) => c.enabled).length;
  const failing = channels.filter((c) => Number(c.consecutiveFailures || 0) > 0);
  const failedCalls = usage.filter((row) => String(row.status || '').toLowerCase() === 'failed').length;
  const failureRate = usage.length ? (failedCalls / usage.length) * 100 : 0;
  const cost = usage.reduce((sum, row) => sum + Number(row.estimatedCost || 0), 0);
  const blocked = pricing.filter((row) => row.status === 'block').length;
  const unverified = pricing.filter((row) => row.status === 'unverified' || row.status === 'needs_duration').length;
  const unavailableModels = platform.filter((m) => !m.available).length;
  const alerts = [];
  failing.slice(0, 3).forEach((c) => alerts.push({ level: 'danger', text: `渠道「${c.name}」连续失败 ${c.consecutiveFailures} 次` }));
  if (blocked) alerts.push({ level: 'danger', text: `${blocked} 条定价低于毛利红线，已被拦截` });
  if (unverified) alerts.push({ level: 'warning', text: `${unverified} 条渠道成本待合同核实` });
  if (!state.aiStorage?.provider || state.aiStorage.provider === 'local') alerts.push({ level: 'warning', text: '对象存储仍为本地磁盘，未启用 OSS' });
  if (failureRate >= 10) alerts.push({ level: 'warning', text: `最近调用失败率 ${failureRate.toFixed(1)}%，请检查渠道` });
  if (unavailableModels) alerts.push({ level: 'info', text: `${unavailableModels} 个模型当前不可用` });
  if (!alerts.length) alerts.push({ level: 'success', text: '没有需要处理的告警' });
  return `<div class="metrics">
      ${metric('渠道', enabledChannels + '/' + channels.length, '启用 / 总数')}
      ${metric('最近调用', fmtNumber(usage.length), `失败 ${failedCalls} · ${failureRate.toFixed(1)}%`)}
      ${metric('估算成本', '¥' + cost.toFixed(2), '最近 500 条调用')}
      ${metric('定价拦截', blocked, `${unverified} 条待核实`)}
      ${metric('模型', (platform.length - unavailableModels) + '/' + platform.length, '可用 / 总数')}
      ${metric('对象存储', state.aiStorage?.provider === 'oss' ? 'OSS' : '本地磁盘', state.aiStorage?.bucket || '未配置')}
    </div>
    <div class="panel-grid">
      <section class="panel"><div class="panel-head"><div><h2>告警</h2><p>按严重程度排序，点击跳到对应页面处理</p></div></div>
        ${alerts.map((alert) => `<div class="alert-row"><span class="badge ${alert.level === 'danger' ? 'danger' : alert.level === 'warning' ? 'warning' : alert.level === 'success' ? 'success' : 'gold'}">${alert.level === 'danger' ? '严重' : alert.level === 'warning' ? '注意' : alert.level === 'success' ? '正常' : '提示'}</span><span>${esc(alert.text)}</span></div>`).join('')}
      </section>
      <section class="panel"><div class="panel-head"><div><h2>快捷入口</h2><p>常用运维操作</p></div></div>
        <div class="row-actions"><button data-action="ai-tab" data-tab="channels">管理渠道与 Key</button><button data-action="ai-tab" data-tab="groups">配置分组</button><button data-action="ai-tab" data-tab="usage">查看调用</button><button data-action="go-pricing">定价与成本</button></div>
        <p class="muted" style="margin-top:12px">渠道多 Key、账户绑定优质组、按秒计价的视频模型都在这里统一管理。</p>
      </section>
    </div>`;
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
  const confirmed = confirm(`盘点结果：\n扫描 ${first.scanned} 个对象\n可迁移 ${first.moved} 个（${(first.bytes / 1048576).toFixed(1)} MB）\n跳过 ${first.skipped} 个\n缺失 ${first.missing} 个\n\n确认执行迁移？`);
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
  renderInto($('taskBody'), state.taskTab === 'tasks'
    ? `<div class="panel"><div class="panel-head"><div><h2>任务</h2><p>最近 500 个</p></div></div>${tasksTable(state.tasks)}</div>`
    : `<div class="panel"><div class="panel-head"><div><h2>执行记录</h2><p>River 任务尝试与结果</p></div></div>${runsTable(state.runs)}</div>`);
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
    const stages = { reserved: '预留 Credits', queued: '进入队列', worker_started: 'Worker 开始', provider_request: '调用渠道', provider_submitted: '上游已提交', provider_response: '渠道响应', asset_saved: '素材已保存', settled: '已结算', failed: '任务失败', refund: '返还失败' };
    const events = (eventData.items || []).map((entry) => `<tr><td>${fmtDate(entry.createdAt)}</td><td>${esc(stages[entry.stage] || entry.stage)}</td><td>${opsBadge(entry.state)}</td><td>${esc(entry.code || '—')}</td><td>${entry.durationMs ? `${fmtNumber(entry.durationMs)} ms` : '—'}</td></tr>`).join('') || emptyRow(5);
    modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">TASK DETAIL</span><h2>${esc(task.type)} · ${esc(task.id.slice(0, 8))}</h2><p>${esc(task.email || task.userId)} · ${esc(task.accountNo || '未分配账户号')} · ${fmtDate(task.createdAt)}</p></div><button type="button" class="modal-close" data-close-modal aria-label="关闭">×</button></div>
      <div class="activity-summary"><div><small>任务状态</small><strong>${status(task.status)}</strong><span>${esc(task.errorCode || '无失败码')}</span></div><div><small>预留 Credits</small><strong>${fmtNumber(task.reservedCredits)}</strong><span>任务提交时预留</span></div><div><small>实扣 Credits</small><strong>${fmtNumber(task.consumedCredits)}</strong><span>${esc(billingBasisLabel(task.billingBasis))}</span></div><div><small>返还 Credits</small><strong>${fmtNumber(task.releasedCredits)}</strong><span>来自返还流水</span></div></div>
      <div class="activity-body"><section class="activity-section"><h3>任务与失败原因</h3><p>${esc(task.model || task.provider || '未指定模型')}${task.duration ? ` · ${esc(task.duration)} 秒` : ''}</p><p>${task.errorMessage ? `${esc(task.errorCode)}：${esc(task.errorMessage)}` : '无失败原因记录'}</p><p class="muted">${task.billingBasis ? '结算口径已按任务保存' : '历史任务未保存结算口径，请结合实际流水核对'}</p></section>
      <section class="activity-section"><h3>执行时间线</h3><p class="muted">仅新版本产生的任务有阶段记录；历史任务请结合渠道与 Credits 流水查看。</p><div class="table-wrap"><table><thead><tr><th>时间</th><th>阶段</th><th>结果</th><th>错误码</th><th>耗时</th></tr></thead><tbody>${events}</tbody></table></div></section>
      <section class="activity-section"><h3>渠道调用（最近 5 条）</h3><div class="table-wrap"><table><thead><tr><th>时间</th><th>渠道</th><th>渠道模型</th><th>Key 末四位</th><th>结果</th><th>延迟</th></tr></thead><tbody>${routes}</tbody></table></div></section>
      <section class="activity-section"><h3>Credits 流水</h3><div class="table-wrap"><table><thead><tr><th>时间</th><th>动作</th><th>可用变动</th><th>冻结变动</th></tr></thead><tbody>${transactions}</tbody></table></div></section></div>
      <div class="activity-actions"><span class="muted">本页只读；金额以 Credits 流水为准</span><button type="button" class="primary" data-close-modal>关闭</button></div></div>`;
    closeButtons();
  } catch (error) {
    if (modal.open) modal.querySelector('.activity-loading').textContent = error.message || '任务详情读取失败';
  }
}
async function loadShowcase() {
  const data = await get('/api/admin/showcase');
  state.showcase = data.items || [];
  content.innerHTML = pageHead('内容管理', '客户端首页的示例图与示例作品。上传后客户端刷新即可读取。', '<button class="primary" data-action="showcase-new">上传示例</button>') +
    `<div class="toolbar"><div class="tabs">${[['all', '全部'], ['image', '示例图'], ['work', '示例作品']].map(([id, label]) => `<button type="button" class="${state.showcaseFilter === id ? 'active' : ''}" data-action="showcase-filter" data-tab="${id}">${label}</button>`).join('')}</div><span class="spacer"></span><span class="badge gold">${state.showcase.length} 条内容</span></div><div id="showcaseBody"></div>`;
  renderShowcaseBody();
}
function renderShowcaseBody() {
  const rows = state.showcaseFilter === 'all' ? state.showcase : state.showcase.filter((item) => item.kind === state.showcaseFilter);
  renderInto($('showcaseBody'), rows.length ? `<div class="showcase-grid">${rows.map((item) => `<article class="showcase-card"><img src="${apiBase.replace(/\/$/, '')}${esc(item.imageUrl)}" alt="${esc(item.title)}" loading="eager" /><div class="showcase-body"><div class="showcase-top"><span class="badge ${item.kind === 'work' ? 'gold' : ''}">${item.kind === 'work' ? '示例作品' : '示例图'}</span>${status(item.status)}</div><h3>${esc(item.title)}</h3><p>${esc(item.tag || '未设置标签')} · 排序 ${item.sortOrder}</p><div class="row-actions"><button data-action="showcase-toggle" data-id="${esc(item.id)}" data-status="${item.status === 'published' ? 'draft' : 'published'}">${item.status === 'published' ? '下架' : '发布'}</button><button data-action="showcase-edit" data-id="${esc(item.id)}">编辑</button><button class="danger" data-action="showcase-delete" data-id="${esc(item.id)}">删除</button></div></div></article>`).join('')}</div>` : empty('这个分类还没有内容'));
}
async function loadAnalytics() {
  const [overview, usage, tasks] = await Promise.all([get('/api/admin/overview'), get('/api/admin/ai/usage'), get('/api/admin/tasks')]);
  state.overview = overview; state.usage = usage?.usage || []; state.tasks = tasks || [];
  content.innerHTML = pageHead('数据分析', '收入、成本、任务与 Provider 调用。') +
    `<div class="metrics">${metric('收入', fmtMoney(overview.revenueMinorCNY))}${metric('AI 成本', '¥' + Number(usage?.estimatedCost || 0).toFixed(2))}${metric('任务', fmtNumber(overview.tasks), `失败 ${overview.failedTasks}`)}${metric('Credits 消耗', fmtNumber(overview.creditsConsumed))}</div>
    <section class="panel"><div class="panel-head"><div><h2>Provider 用量</h2><p>最近 500 条</p></div></div>${usageTable(state.usage)}</section>`;
}
async function loadSettings() {
  const logs = await get('/api/admin/audit-logs').catch(() => ({ items: [] }));
  const rows = (logs.items || []).map((item) => `<tr><td>${fmtDate(item.createdAt)}</td><td>${esc(item.actor)}</td><td><span class="cell-main">${esc(item.action)}</span><span class="cell-sub">${esc(item.resourceType)} ${esc(String(item.resourceId || '').slice(0, 8))}</span></td><td><span class="cell-sub">${esc(JSON.stringify(item.before || {}))}</span></td><td><span class="cell-sub">${esc(JSON.stringify(item.after || {}))}</span></td><td>${esc(item.ip || '—')}</td></tr>`).join('') || emptyRow(6);
  content.innerHTML = pageHead('设置', '后台连接与当前工作区信息。') +
    `<div class="panel"><div class="panel-head"><div><h2>连接</h2><p>管理后台通过此地址访问 Go API</p></div></div><div class="form-grid"><label>API 地址<input id="settingsApi" value="${esc(apiBase)}" /></label><label>当前管理员<input value="${esc(email)}" disabled /></label><label>后台版本<input value="${BUILD_TAG}" disabled /></label><div><button class="primary" data-action="save-api">保存 API 地址</button></div></div></div>
    <div class="panel"><div class="panel-head"><div><h2>服务状态</h2><p>健康检查结果</p></div><button class="secondary" data-action="check-service">重新检查</button></div><p id="settingsHealth" role="status"></p></div>
    <div class="panel"><div class="panel-head"><div><h2>最近管理操作</h2><p>路由、模型接入等写操作留痕，最多 100 条</p></div></div><div class="table-wrap"><table><thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>变更前</th><th>变更后</th><th>来源 IP</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="panel"><div class="panel-head"><div><h2>关于</h2><p>WEAVIA Admin Console</p></div></div><p>用户、商业、AI、任务、内容管理与数据分析，统一在新 Go API 之上。</p></div>`;
  renderHealth();
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
  openModal('调整 Credits', `<label>用户<input value="${esc(user.email)}" disabled /></label><label>调整数量（正数增加，负数扣减）<input name="amount" type="number" step="1" required /></label><label>原因<input name="reason" required maxlength="200" placeholder="例如：活动补偿 / 人工充值" /></label>`, '确认调整', async (form) => {
    const amount = Number(form.get('amount'));
    if (!Number.isInteger(amount) || amount === 0) throw new Error('请输入非零整数');
    await post('/api/admin/credits/adjust', { userId: user.id, amount, reason: form.get('reason'), idempotencyKey: crypto.randomUUID() });
    await navigate('users');
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
      return `<tr><td><span class="cell-main">•••• ${esc(key.last4)}</span><span class="cell-sub">${fmtDate(key.createdAt)} 添加</span></td><td>${key.weight}</td><td>${h.calls ? fmtNumber(h.calls) : '0'}</td><td>${h.calls ? `${fmtNumber(h.successes)} / ${rate}` : '—'}</td><td>${h.avgMs ? fmtNumber(h.avgMs) + ' ms' : '—'}</td><td>${esc(h.lastModel || '—')}</td><td>${key.failures ? `<span class="badge danger">失败 ${key.failures}</span>` : '<span class="badge success">正常</span>'}</td><td>${key.cooldownUntil ? fmtDate(key.cooldownUntil) : '—'}</td><td>${key.enabled ? status('active') : status('disabled')}</td><td><div class="row-actions"><button data-action="channel-key-toggle" data-id="${esc(key.id)}" data-channel="${esc(channel.id)}" data-enabled="${key.enabled ? 'false' : 'true'}">${key.enabled ? '停用' : '启用'}</button><button data-action="channel-key-delete" data-id="${esc(key.id)}" data-channel="${esc(channel.id)}">删除</button></div></td></tr>`;
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
  modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">DISCOVER</span><h2>${esc(channel.name)} · 发现模型</h2><p>用该渠道的 Key 读取供应商模型列表，勾选后接入</p></div><button type="button" class="modal-close" data-close-modal>×</button></div><div class="activity-loading">正在读取供应商模型列表…</div><div class="activity-actions"><button type="button" class="secondary" data-close-modal>关闭</button></div></div>`;
  modal.showModal();
  modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
  try {
    const data = await post(`/api/admin/ai/channels/${channel.id}/discover`, {});
    const ids = data.items || [];
    const list = ids.map((id) => `<label class="switch-row"><span>${esc(id)}</span><input type="checkbox" name="pick" value="${esc(id)}" /></label>`).join('');
    modal.innerHTML = `<div class="modal-inner activity-modal"><div class="activity-head"><div><span class="eyebrow">DISCOVER</span><h2>${esc(channel.name)} · ${ids.length} 个模型</h2><p>勾选要开放的模型，再统一设置模态、能力和售价</p></div><button type="button" class="modal-close" data-close-modal>×</button></div><div class="activity-body"><section class="activity-section"><input id="discoverSearch" placeholder="搜索模型 ID" /><div id="discoverList" style="max-height:320px;overflow:auto;margin-top:12px">${list || empty('供应商没有返回模型')}</div></section><section class="activity-section"><div class="form-row"><label>模态<select id="discoverModality"><option value="image">图片</option><option value="video">视频</option></select></label><label>售价（Credits）<input id="discoverCredits" type="number" min="1" value="50" /></label></div></section></div><div class="activity-actions"><button type="button" class="secondary" data-close-modal>取消</button><button type="button" class="primary" id="discoverApply">接入所选</button></div></div>`;
    modal.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => modal.close()));
    $('discoverSearch').addEventListener('input', (event) => {
      const q = event.target.value.toLowerCase();
      $('discoverList').querySelectorAll('label').forEach((label) => { label.hidden = q && !label.textContent.toLowerCase().includes(q); });
    });
    $('discoverApply').addEventListener('click', async () => {
      const picked = [...modal.querySelectorAll('input[name=pick]:checked')].map((input) => input.value);
      if (!picked.length) { toast('先勾选模型'); return; }
      const modality = $('discoverModality').value;
      const credits = Number($('discoverCredits').value || 50);
      let done = 0;
      for (const id of picked) {
        await post(`/api/admin/ai/channels/${channel.id}/models`, { providerModelId: id, displayName: id, modality, credits });
        done += 1;
      }
      modal.close();
      toast(`已接入 ${done} 个模型`);
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

function channelModal() {
  openModal('新增渠道', `<label>Provider<select name="providerCode"><option value="antdigital">AntDigital</option><option value="dashscope">DashScope</option><option value="computrix">Computrix</option><option value="volcengine">火山方舟（字节）</option></select></label><label>渠道名称<input name="name" required placeholder="例如：AntDigital 备用账号" /></label><label>Base URL<input name="baseUrl" placeholder="留空使用默认" /></label><label>API Key<input name="apiKey" type="password" required /></label><div class="form-row"><label>优先级<input name="priority" type="number" value="50" /></label><label>权重<input name="weight" type="number" value="1" min="0" /></label></div><p class="muted">会自动复制同 Provider 的模型，并绑到对应逻辑模型。</p>`, '创建渠道', async (form) => {
    await post('/api/admin/ai/channels', { providerCode: form.get('providerCode'), name: form.get('name'), baseUrl: form.get('baseUrl'), apiKey: form.get('apiKey'), priority: Number(form.get('priority') || 0), weight: Number(form.get('weight') || 1) });
    await navigate('ai');
  });
}


function channelMetaModal(channel) {
  openModal('编辑渠道', `<label>名称<input name="name" value="${esc(channel.name)}" required /></label><label>Base URL<input name="baseUrl" value="${esc(channel.baseUrl || '')}" placeholder="留空使用 Provider 默认" /></label>`, '保存', async (form) => {
    await request(`/api/admin/ai/channels/${channel.id}/meta`, { method: 'PATCH', body: JSON.stringify({ name: form.get('name'), baseUrl: form.get('baseUrl') }) });
    await navigate('ai');
  });
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
  openModal(item ? '编辑示例' : '上传示例', `<div class="modal-upload"><div class="upload-preview" id="uploadPreview">${image ? `<img id="showcasePreview" src="${esc(image)}" alt="" />` : '<img id="showcasePreview" alt="" hidden />'}<span id="previewEmpty" ${image ? 'hidden' : ''}>选择一张图片</span><input name="image" id="showcaseImage" type="file" accept="image/jpeg,image/png,image/webp" ${item ? '' : 'required'} /></div><div class="form-grid"><label>类型<select name="kind"><option value="image" ${item?.kind === 'image' || !item ? 'selected' : ''}>示例图</option><option value="work" ${item?.kind === 'work' ? 'selected' : ''}>示例作品</option></select></label><label>标题<input name="title" maxlength="120" value="${esc(item?.title || '')}" required /></label><label>标签<input name="tag" maxlength="40" value="${esc(item?.tag || '')}" placeholder="美妆 / 暖调" /></label><label>提示词<textarea name="prompt" rows="4" maxlength="2000">${esc(item?.prompt || '')}</textarea></label><div class="form-row"><label>排序<input name="sortOrder" type="number" value="${item?.sortOrder ?? 100}" /></label><label>状态<select name="status"><option value="published" ${item?.status === 'published' || !item ? 'selected' : ''}>发布</option><option value="draft" ${item?.status === 'draft' ? 'selected' : ''}>草稿</option></select></label></div></div></div>`, item ? '保存修改' : '上传并发布', async (form) => {
    if (item) {
      await patch(`/api/admin/showcase/${item.id}`, { kind: form.get('kind'), title: form.get('title'), tag: form.get('tag'), prompt: form.get('prompt'), status: form.get('status'), sortOrder: Number(form.get('sortOrder')) });
    } else {
      const file = form.get('image');
      if (!(file instanceof File) || !file.size) throw new Error('请选择图片文件');
      const upload = new FormData();
      ['kind', 'title', 'tag', 'prompt', 'status', 'sortOrder', 'image'].forEach((key) => upload.append(key, form.get(key)));
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

content.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  try {
    if (action === 'go-pricing') return navigate('pricing');
    if (action === 'go-showcase') return navigate('showcase');
    if (action === 'go-commerce') return navigate('commerce');
    if (action === 'go-tasks') return navigate('tasks');
    if (action === 'commerce-tab') { state.commerceTab = target.dataset.tab; content.querySelector('.tabs').outerHTML = renderCommerceTabs(); return renderCommerceBody(); }
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
    if (action === 'user-credits') { const user = state.users.find((item) => item.id === target.dataset.id); if (user) creditsModal(user); return; }
    if (action === 'plan-edit') { const plan = state.plans.find((item) => item.id === target.dataset.id); if (plan) planModal(plan); return; }
    if (action === 'skill-publish') { setBusy(target, true); await patch(`/api/admin/skills/${target.dataset.id}`, { status: 'published' }); await navigate('ai'); return; }
    if (action === 'skill-reject') { setBusy(target, true); await patch(`/api/admin/skills/${target.dataset.id}`, { status: 'rejected' }); await navigate('ai'); return; }
    if (action === 'app-publish') { setBusy(target, true); await patch(`/api/admin/apps/${target.dataset.id}`, { status: 'published' }); await navigate('ai'); return; }
    if (action === 'app-draft') { setBusy(target, true); await patch(`/api/admin/apps/${target.dataset.id}`, { status: 'draft' }); await navigate('ai'); return; }
    if (action === 'sync-models') { setBusy(target, true); const result = await post('/api/admin/ai/models/sync', {}); toast(`已同步 ${result.synced || 0} 个模型`); await navigate('ai'); return; }
    if (action === 'pricing-price') { const row = state.pricing.find((item) => item.channelModelId === target.dataset.id); if (row) pricingPriceModal(row); return; }
    if (action === 'pricing-cost') { const row = state.pricing.find((item) => item.channelModelId === target.dataset.id); if (row) pricingCostModal(row); return; }
    if (action === 'routing-edit') { const binding = (state.routing?.bindings || []).find((item) => item.id === target.dataset.id); if (binding) routingEditModal(binding); return; }
    if (action === 'group-new') return groupNewModal();
    if (action === 'group-price') { const group = (state.routeGroups || []).find((item) => item.id === target.dataset.id); if (group) groupPriceModal(group); return; }
    if (action === 'group-channels') { const group = (state.routeGroups || []).find((item) => item.id === target.dataset.id); if (group) groupChannelsModal(group); return; }
    if (action === 'channel-meta') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) channelMetaModal(channel); return; }
    if (action === 'channel-delete') { if (!confirm(`删除渠道「${target.dataset.name}」？其 Key、模型与绑定会一起删除，不可恢复。`)) return; setBusy(target, true); await remove(`/api/admin/ai/channels/${target.dataset.id}`); await navigate('ai'); return; }
    if (action === 'channel-models') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) channelModelsModal(channel); return; }
    if (action === 'channel-model-toggle') { setBusy(target, true); await patch(`/api/admin/ai/channel-models/${target.dataset.id}`, { enabled: target.dataset.enabled === 'true' }); const channel = (state.channels || []).find((item) => item.id === target.dataset.channel); if (channel) channelModelsModal(channel); return; }
    if (action === 'channel-discover') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) channelDiscoverModal(channel); return; }
    if (action === 'channel-model-add') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) manualModelModal(channel); return; }
    if (action === 'channel-keys') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) channelKeysModal(channel); return; }
    if (action === 'channel-key-toggle') { setBusy(target, true); await patch(`/api/admin/ai/channel-keys/${target.dataset.id}`, { enabled: target.dataset.enabled === 'true' }); const channel = (state.channels || []).find((item) => item.id === target.dataset.channel); if (channel) channelKeysModal(channel); return; }
    if (action === 'channel-key-delete') { if (!confirm('删除这把 Key？该操作不可恢复。')) return; setBusy(target, true); await remove(`/api/admin/ai/channel-keys/${target.dataset.id}`); const channel = (state.channels || []).find((item) => item.id === target.dataset.channel); if (channel) channelKeysModal(channel); return; }
    if (action === 'channel-new') return channelModal();
    if (action === 'channel-edit') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) channelEditModal(channel); return; }
    if (action === 'channel-key') { const channel = (state.channels || []).find((item) => item.id === target.dataset.id); if (channel) channelKeyModal(channel); return; }
    if (action === 'channel-toggle') { setBusy(target, true); await patch(`/api/admin/ai/channels/${target.dataset.id}`, { enabled: target.dataset.enabled === 'true' }); await navigate('ai'); return; }
    if (action === 'provider-key') { const provider = state.providers.find((item) => item.code === target.dataset.code); if (provider) providerKeyModal(provider); return; }
    if (action === 'provider-toggle') { setBusy(target, true); await patch(`/api/admin/ai/providers/${target.dataset.id}`, { enabled: target.dataset.enabled === 'true' }); await navigate('ai'); return; }
    if (action === 'showcase-new') return showcaseModal();
    if (action === 'showcase-edit') { const item = state.showcase.find((entry) => entry.id === target.dataset.id); if (item) showcaseModal(item); return; }
    if (action === 'showcase-toggle') { setBusy(target, true); await patch(`/api/admin/showcase/${target.dataset.id}`, { status: target.dataset.status }); await navigate('showcase'); return; }
    if (action === 'showcase-delete') { if (!confirm('确定删除这条内容？客户端将不再显示。')) return; setBusy(target, true); await remove(`/api/admin/showcase/${target.dataset.id}`); await navigate('showcase'); return; }
    if (action === 'save-api') { apiBase = $('settingsApi').value.trim().replace(/\/$/, ''); localStorage.setItem('weavia.admin.api', apiBase); toast('API 地址已保存'); await checkService(); return; }
    if (action === 'check-service') { await checkService(); toast('服务状态已更新'); return; }
    if (action === 'ops-refresh') { await navigate('ops'); return; }
    if (action === 'ops-period') { state.opsPeriod = target.dataset.period; await navigate('ops'); return; }
    if (action === 'ops-logs') { await loadOpsLogs(target.dataset.service); return; }
  } catch (error) { toast(error.message); setBusy(target, false); }
});
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
if (token) { showAdmin(); renderNav(); checkService(); navigate('dashboard'); } else { showLogin(); }

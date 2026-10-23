const $ = (id) => document.getElementById(id);
const content = $('content');
const modal = $('modal');
const pages = [
  { id: 'dashboard', label: '仪表盘', kicker: 'OVERVIEW' },
  { id: 'users', label: '用户中心', kicker: 'CUSTOMERS' },
  { id: 'commerce', label: '商业中心', kicker: 'COMMERCE' },
  { id: 'ai', label: 'AI Studio', kicker: 'AI OPERATIONS' },
  { id: 'pricing', label: '定价与成本', kicker: 'PRICING' },
  { id: 'tasks', label: '创作任务', kicker: 'TASKS' },
  { id: 'showcase', label: '内容管理', kicker: 'SHOWCASE' },
  { id: 'analytics', label: '数据分析', kicker: 'ANALYTICS' },
  { id: 'settings', label: '设置', kicker: 'SETTINGS' },
];
const defaultApiBase = location.port && location.port !== '80' && location.port !== '443' ? `${location.protocol}//${location.hostname}:8080` : location.origin;
let apiBase = localStorage.getItem('weavia.admin.api') || defaultApiBase;
let token = sessionStorage.getItem('weavia.admin.token') || '';
let email = sessionStorage.getItem('weavia.admin.email') || '';
const state = { page: 'dashboard', commerceTab: 'plans', aiTab: 'providers', taskTab: 'tasks', showcaseFilter: 'all', users: [], showcase: [], plans: [], orders: [], payments: [], providers: [], models: null, routing: null, usage: [], overview: null, tasks: [], runs: [], pricing: [], pricingSettings: null };

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
    showAdmin(); renderNav(); await navigate('dashboard');
  } catch (error) {
    $('loginError').textContent = error.message;
  } finally {
    setBusy(button, false);
  }
}
async function checkService() {
  $('serviceStatus').textContent = '检查中…';
  try {
    const response = await fetch(apiBase.replace(/\/$/, '') + '/api/health');
    $('serviceStatus').textContent = response.ok ? '服务正常' : '服务异常';
  } catch { $('serviceStatus').textContent = '服务不可达'; }
}
async function navigate(pageId) {
  state.page = pageId;
  const page = pages.find((item) => item.id === pageId) || pages[0];
  $('pageKicker').textContent = page.kicker;
  renderNav();
  content.innerHTML = loading();
  try { await loaders[pageId](); } catch (error) { content.innerHTML = pageHead(page.label, '') + empty(error.message); }
}
const loaders = { dashboard: loadDashboard, users: loadUsers, commerce: loadCommerce, ai: loadAI, pricing: loadPricing, tasks: loadTasks, showcase: loadShowcase, analytics: loadAnalytics, settings: loadSettings };

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
      <section class="panel"><div class="panel-head"><div><h2>最近任务</h2><p>最新 6 个创作任务</p></div><button class="text-button" data-action="go-tasks">全部任务</button></div>${tasksTable((tasks || []).slice(0, 6))}</section>
    </div>`;
}
function ordersTable(rows) {
  if (!rows.length) return empty('还没有订单');
  return `<div class="table-wrap"><table><thead><tr><th>用户</th><th>类型</th><th>金额</th><th>状态</th><th>时间</th></tr></thead><tbody>${rows.map((row) => `<tr><td><span class="cell-main">${esc(row.email || row.userId)}</span></td><td>${esc(row.kind)}</td><td>${fmtMoney(row.amountMinor)} ${esc(row.currency)}</td><td>${status(row.status)}</td><td>${fmtDate(row.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
}
function tasksTable(rows) {
  if (!rows.length) return empty('还没有任务');
  return `<div class="table-wrap"><table><thead><tr><th>任务</th><th>模型</th><th>状态</th><th>Credits</th><th>时间</th></tr></thead><tbody>${rows.map((row) => `<tr><td><span class="cell-main">${esc(row.type)}</span><span class="cell-sub">${esc(row.id.slice(0, 8))}</span></td><td>${esc(row.model || row.provider || '—')}</td><td>${status(row.status)}</td><td>${fmtNumber(row.cost)}</td><td>${fmtDate(row.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
}
async function loadUsers() {
  const users = (await get('/api/admin/users')) || [];
  state.users = users;
  content.innerHTML = pageHead('用户中心', '查看用户、套餐、Credits 与账号状态。') + `<div class="panel"><div class="toolbar"><input id="userSearch" placeholder="搜索邮箱、姓名或套餐" /><span class="spacer"></span><span class="badge gold">${users.length} 位用户</span></div><div id="userTable"></div></div>`;
  const draw = (rows) => { $('userTable').innerHTML = usersTable(rows); };
  draw(users);
  $('userSearch').addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    draw(users.filter((user) => `${user.email} ${user.name} ${user.plan}`.toLowerCase().includes(query)));
  });
}
function usersTable(rows) {
  if (!rows.length) return empty('没有匹配的用户');
  return `<div class="table-wrap"><table><thead><tr><th>用户</th><th>套餐</th><th>Credits</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead><tbody>${rows.map((user) => `<tr><td><span class="cell-main">${esc(user.email)}</span><span class="cell-sub">${esc(user.name || '未命名')} · ${esc(user.membershipStatus || 'none')}</span></td><td>${esc(user.plan || 'free')}</td><td><span class="cell-main">${fmtNumber(user.credits)}</span></td><td>${status(user.status)}</td><td>${fmtDate(user.createdAt)}</td><td><div class="row-actions"><button data-action="user-activity" data-id="${esc(user.id)}">活动</button><button data-action="user-status" data-id="${esc(user.id)}" data-status="${user.status === 'active' ? 'disabled' : 'active'}">${user.status === 'active' ? '禁用' : '启用'}</button><button data-action="user-credits" data-id="${esc(user.id)}" data-email="${esc(user.email)}">调整 Credits</button></div></td></tr>`).join('')}</tbody></table></div>`;
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
  if (state.commerceTab === 'plans') body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>套餐</h2><p>价格与启用状态可调整</p></div></div>${plansTable(state.plans)}</div>`;
  else if (state.commerceTab === 'orders') body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>订单</h2><p>最近 200 笔</p></div></div>${ordersTable(state.orders)}</div>`;
  else body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>支付记录</h2><p>Provider 与到账状态</p></div></div>${paymentsTable(state.payments)}</div>`;
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
  const [providers, models, routing, usage, channelData, skillData, appData] = await Promise.all([get('/api/admin/ai/providers'), get('/api/admin/ai/models'), get('/api/admin/ai/routing'), get('/api/admin/ai/usage'), get('/api/admin/ai/channels'), get('/api/admin/skills'), get('/api/admin/apps')]);
  const channels = channelData.items || [];
  state.providers = providers || []; state.models = models; state.platformModels = models?.platformModels || []; state.routing = routing; state.usage = usage?.usage || []; state.channels = channels || []; state.skills = skillData?.items || []; state.apps = appData?.items || [];
  content.innerHTML = pageHead('AI Studio', 'Provider、模型目录、路由与调用成本。') + renderAITabs() + '<div id="aiBody"></div>';
  renderAIBody();
}
function renderAITabs() {
  return `<div class="tabs">${[['providers', 'Provider'], ['channels', '渠道'], ['models', '模型'], ['skills', 'Skill'], ['apps', '应用'], ['routing', '路由'], ['usage', '用量']].map(([id, label]) => `<button type="button" class="${state.aiTab === id ? 'active' : ''}" data-action="ai-tab" data-tab="${id}">${label}</button>`).join('')}</div>`;
}
function renderAIBody() {
  const body = $('aiBody');
  if (state.aiTab === 'providers') {
    body.innerHTML = `<div class="provider-grid">${state.providers.map((provider) => `<article class="provider-card"><div class="showcase-top"><span class="badge ${provider.enabled ? 'success' : ''}">${provider.enabled ? '已启用' : '已停用'}</span><span class="badge ${provider.configured ? 'gold' : 'danger'}">${provider.configured ? 'Key 已配置' : '缺少 Key'}</span></div><h3>${esc(provider.name)}</h3><p>${esc(provider.code)} · ${esc(provider.type)}</p><p>${esc(provider.baseUrl)}</p><div class="provider-meta"><span class="badge">${provider.modelCount || 0} 个模型</span>${provider.keyLast4 ? `<span class="badge">•••• ${esc(provider.keyLast4)}</span>` : ''}<button class="mini" data-action="provider-key" data-code="${esc(provider.code)}" data-name="${esc(provider.name)}">设置 Key</button><button class="mini" data-action="provider-toggle" data-id="${esc(provider.id)}" data-enabled="${provider.enabled ? 'false' : 'true'}">${provider.enabled ? '停用' : '启用'}</button></div></article>`).join('')}</div>`;
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
    body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>平台模型</h2><p>来自 Provider /models；显示名、模态与接入状态</p></div><div class="row-actions"><span class="badge gold">${platform.length} 个模型</span><button class="mini" data-action="sync-models">同步到客户端</button></div></div><h3 class="model-section-title">图片模型</h3>${platformTable(images)}<h3 class="model-section-title">视频模型</h3>${platformTable(videos)}</div>`;
  } else if (state.aiTab === 'routing') {
    const logical = state.routing?.logicalModels || [];
    const bindings = state.routing?.bindings || [];
    const models = state.models?.providerModels || [];
    body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>逻辑模型路由</h2><p>客户端能力到 Provider 模型的映射</p></div></div><div class="table-wrap"><table><thead><tr><th>逻辑模型</th><th>绑定模型</th><th>优先级</th><th>状态</th></tr></thead><tbody>${bindings.map((binding) => { const logicalModel = logical.find((item) => item.id === binding.logicalModelId); const model = models.find((item) => item.id === binding.providerModelId); return `<tr><td><span class="cell-main">${esc(logicalModel?.displayName || binding.logicalModelId)}</span><span class="cell-sub">${esc(logicalModel?.key || '')}</span></td><td>${esc(model?.displayName || binding.providerModelId)}</td><td>${binding.priority}</td><td>${status(binding.enabled ? 'active' : 'disabled')}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  } else {
    body.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>调用用量</h2><p>最近 500 条 Provider 调用</p></div></div>${usageTable(state.usage)}</div>`;
  }
}
function modelsTable(rows) {
  if (!rows.length) return empty('还没有模型');
  return `<div class="table-wrap"><table><thead><tr><th>模型</th><th>能力</th><th>Credits</th><th>质量</th><th>状态</th></tr></thead><tbody>${rows.map((model) => `<tr><td><span class="cell-main">${esc(model.displayName || model.modelId)}</span><span class="cell-sub">${esc(model.modelId || '')}</span></td><td>${esc((model.capabilities || []).join(', '))}</td><td>${fmtNumber(model.creditsCost)}</td><td>${esc(model.qualityLevel || '—')}</td><td>${status(model.enabled ? 'active' : 'disabled')}</td></tr>`).join('')}</tbody></table></div>`;
}
function channelsTable(rows) {
  if (!rows.length) return empty('还没有渠道');
  return `<div class="table-wrap"><table><thead><tr><th>渠道</th><th>Provider</th><th>优先级</th><th>权重</th><th>模型</th><th>Key</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map((channel) => `<tr><td><span class="cell-main">${esc(channel.name)}</span><span class="cell-sub">${esc(channel.baseUrl || '默认 Base URL')}</span></td><td>${esc(channel.providerCode)}</td><td>${channel.priority}</td><td>${channel.weight}</td><td>${channel.modelCount}</td><td>${channel.keyLast4 ? '•••• ' + esc(channel.keyLast4) : '<span class="badge danger">未配置</span>'}</td><td>${status(channel.enabled ? 'active' : 'disabled')}</td><td><div class="row-actions"><button data-action="channel-edit" data-id="${esc(channel.id)}">优先级</button><button data-action="channel-key" data-id="${esc(channel.id)}" data-name="${esc(channel.name)}">设置 Key</button><button data-action="channel-toggle" data-id="${esc(channel.id)}" data-enabled="${channel.enabled ? 'false' : 'true'}">${channel.enabled ? '停用' : '启用'}</button></div></td></tr>`).join('')}</tbody></table></div>`;
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
function pricingTable(rows) {
  if (!rows.length) return empty('还没有可定价的模型绑定');
  const rank = { block: 0, ok: 1, needs_duration: 2, unverified: 3 };
  const sorted = [...rows].sort((a, b) => ((rank[a.status] ?? 9) - (rank[b.status] ?? 9)) || ((a.marginRate || 0) - (b.marginRate || 0)));
  return `<div class="table-wrap"><table><thead><tr><th>模型</th><th>渠道</th><th>售价</th><th>售价(¥)</th><th>厂商原价</th><th>毛利(¥)</th><th>毛利率</th><th>状态</th><th>操作</th></tr></thead><tbody>${sorted.map((row) => `<tr><td><span class="cell-main">${esc(row.displayName || row.key || '未绑定')}</span><span class="cell-sub">${esc(row.providerModelId)}</span></td><td>${esc(row.channelName)}</td><td>${fmtNumber(row.creditsCost)} Credits</td><td>${money(row.sellCny)}</td><td>${money(row.costCny)} <span class="cell-sub">${esc(row.costCurrency)}/${esc(row.costUnit === 'per_second' ? '秒' : '张')}${row.taxIncluded ? ' 含税' : ' 未税'}${row.costVerified ? '' : ' · 未核实'}</span></td><td class="${row.marginCny < 0 ? 'negative' : ''}">${row.status === 'ok' || row.status === 'block' ? money(row.marginCny) : '—'}</td><td>${row.status === 'ok' || row.status === 'block' ? (row.marginRate * 100).toFixed(1) + '%' : '—'}</td><td>${marginBadge(row)}${row.reason ? `<span class="cell-sub">${esc(row.reason)}</span>` : ''}</td><td><div class="row-actions"><button data-action="pricing-price" data-id="${esc(row.channelModelId)}" data-model="${esc(row.logicalModelId)}">改售价</button><button data-action="pricing-cost" data-id="${esc(row.channelModelId)}">录成本</button></div></td></tr>`).join('')}</tbody></table></div>`;
}
async function loadPricing() {
  const data = await get('/api/admin/pricing');
  const rows = data.items || []; const settings = data.settings || {};
  state.pricing = rows; state.pricingSettings = settings;
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
    <section class="panel"><div class="panel-head"><div><h2>模型定价</h2><p>按毛利率升序；未核实成本不参与拦截</p></div><span class="badge gold">${rows.length} 条绑定</span></div>${pricingTable(rows)}</section>`;
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

async function loadTasks() {
  const [tasks, runs] = await Promise.all([get('/api/admin/tasks'), get('/api/admin/task-runs')]);
  state.tasks = tasks || []; state.runs = runs || [];
  content.innerHTML = pageHead('创作任务', '任务状态、模型与执行记录。') + `<div class="tabs">${[['tasks', '任务'], ['runs', '执行记录']].map(([id, label]) => `<button type="button" class="${state.taskTab === id ? 'active' : ''}" data-action="task-tab" data-tab="${id}">${label}</button>`).join('')}</div><div id="taskBody"></div>`;
  renderTaskBody();
}
function renderTaskBody() {
  $('taskBody').innerHTML = state.taskTab === 'tasks'
    ? `<div class="panel"><div class="panel-head"><div><h2>任务</h2><p>最近 500 个</p></div></div>${tasksTable(state.tasks)}</div>`
    : `<div class="panel"><div class="panel-head"><div><h2>执行记录</h2><p>River 任务尝试与结果</p></div></div>${runsTable(state.runs)}</div>`;
}
function runsTable(rows) {
  if (!rows.length) return empty('还没有执行记录');
  return `<div class="table-wrap"><table><thead><tr><th>任务</th><th>尝试</th><th>状态</th><th>开始</th><th>结束</th></tr></thead><tbody>${rows.map((row) => `<tr><td><span class="cell-main">${esc(row.taskId.slice(0, 8))}</span></td><td>${row.attempt}</td><td>${status(row.status)}</td><td>${fmtDate(row.startedAt)}</td><td>${fmtDate(row.finishedAt)}</td></tr>`).join('')}</tbody></table></div>`;
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
  $('showcaseBody').innerHTML = rows.length ? `<div class="showcase-grid">${rows.map((item) => `<article class="showcase-card"><img src="${apiBase.replace(/\/$/, '')}${esc(item.imageUrl)}" alt="${esc(item.title)}" loading="eager" /><div class="showcase-body"><div class="showcase-top"><span class="badge ${item.kind === 'work' ? 'gold' : ''}">${item.kind === 'work' ? '示例作品' : '示例图'}</span>${status(item.status)}</div><h3>${esc(item.title)}</h3><p>${esc(item.tag || '未设置标签')} · 排序 ${item.sortOrder}</p><div class="row-actions"><button data-action="showcase-toggle" data-id="${esc(item.id)}" data-status="${item.status === 'published' ? 'draft' : 'published'}">${item.status === 'published' ? '下架' : '发布'}</button><button data-action="showcase-edit" data-id="${esc(item.id)}">编辑</button><button class="danger" data-action="showcase-delete" data-id="${esc(item.id)}">删除</button></div></div></article>`).join('')}</div>` : empty('这个分类还没有内容');
}
async function loadAnalytics() {
  const [overview, usage, tasks] = await Promise.all([get('/api/admin/overview'), get('/api/admin/ai/usage'), get('/api/admin/tasks')]);
  state.overview = overview; state.usage = usage?.usage || []; state.tasks = tasks || [];
  content.innerHTML = pageHead('数据分析', '收入、成本、任务与 Provider 调用。') +
    `<div class="metrics">${metric('收入', fmtMoney(overview.revenueMinorCNY))}${metric('AI 成本', '¥' + Number(usage?.estimatedCost || 0).toFixed(2))}${metric('任务', fmtNumber(overview.tasks), `失败 ${overview.failedTasks}`)}${metric('Credits 消耗', fmtNumber(overview.creditsConsumed))}</div>
    <section class="panel"><div class="panel-head"><div><h2>Provider 用量</h2><p>最近 500 条</p></div></div>${usageTable(state.usage)}</section>`;
}
function loadSettings() {
  content.innerHTML = pageHead('设置', '后台连接与当前工作区信息。') +
    `<div class="panel"><div class="panel-head"><div><h2>连接</h2><p>管理后台通过此地址访问 Go API</p></div></div><div class="form-grid"><label>API 地址<input id="settingsApi" value="${esc(apiBase)}" /></label><label>当前管理员<input value="${esc(email)}" disabled /></label><div><button class="primary" data-action="save-api">保存 API 地址</button></div></div></div>
    <div class="panel"><div class="panel-head"><div><h2>服务状态</h2><p>健康检查结果</p></div><button class="secondary" data-action="check-service">重新检查</button></div><p>${esc($('serviceStatus').textContent)}</p></div>
    <div class="panel"><div class="panel-head"><div><h2>关于</h2><p>WEAVIA Admin Console</p></div></div><p>用户、商业、AI、任务、内容管理与数据分析，统一在新 Go API 之上。</p></div>`;
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

function channelModal() {
  openModal('新增渠道', `<label>Provider<select name="providerCode"><option value="antdigital">AntDigital</option><option value="dashscope">DashScope</option><option value="computrix">Computrix</option></select></label><label>渠道名称<input name="name" required placeholder="例如：AntDigital 备用账号" /></label><label>Base URL<input name="baseUrl" placeholder="留空使用默认" /></label><label>API Key<input name="apiKey" type="password" required /></label><div class="form-row"><label>优先级<input name="priority" type="number" value="50" /></label><label>权重<input name="weight" type="number" value="1" min="0" /></label></div><p class="muted">会自动复制同 Provider 的模型，并绑到对应逻辑模型。</p>`, '创建渠道', async (form) => {
    await post('/api/admin/ai/channels', { providerCode: form.get('providerCode'), name: form.get('name'), baseUrl: form.get('baseUrl'), apiKey: form.get('apiKey'), priority: Number(form.get('priority') || 0), weight: Number(form.get('weight') || 1) });
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
    if (action === 'go-showcase') return navigate('showcase');
    if (action === 'go-commerce') return navigate('commerce');
    if (action === 'go-tasks') return navigate('tasks');
    if (action === 'commerce-tab') { state.commerceTab = target.dataset.tab; content.querySelector('.tabs').outerHTML = renderCommerceTabs(); return renderCommerceBody(); }
    if (action === 'ai-tab') { state.aiTab = target.dataset.tab; content.querySelector('.tabs').outerHTML = renderAITabs(); return renderAIBody(); }
    if (action === 'task-tab') { state.taskTab = target.dataset.tab; content.querySelector('.tabs').outerHTML = `<div class="tabs">${[['tasks', '任务'], ['runs', '执行记录']].map(([id, label]) => `<button type="button" class="${state.taskTab === id ? 'active' : ''}" data-action="task-tab" data-tab="${id}">${label}</button>`).join('')}</div>`; return renderTaskBody(); }
    if (action === 'showcase-filter') { state.showcaseFilter = target.dataset.tab; await loadShowcase(); return; }
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
  } catch (error) { toast(error.message); setBusy(target, false); }
});
$('loginForm').addEventListener('submit', login);
$('logout').addEventListener('click', logout);
$('refresh').addEventListener('click', () => navigate(state.page));
$('apiBase').value = apiBase;
if (token) { showAdmin(); renderNav(); checkService(); navigate('dashboard'); } else { showLogin(); }

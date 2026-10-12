'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  Filter,
  Layers3,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  WandSparkles,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

type Section = 'dashboard' | 'users' | 'business' | 'ai' | 'tasks' | 'analytics' | 'settings';
type User = {
  id: string;
  email: string;
  name: string;
  status: string;
  plan: string;
  membershipStatus: string;
  membershipExpiresAt: string | null;
  credits: number;
  createdAt: string;
};
type Transaction = {
  id: string;
  userId: string;
  type: string;
  availableDelta: number;
  balanceAfter: number;
  referenceType: string;
  createdAt: string;
};
type Task = {
  id: string;
  userId: string;
  type: string;
  status: string;
  provider: string;
  model: string;
  cost: number;
  createdAt: string;
};
type Metrics = {
  users: number;
  newUsersToday: number;
  paidMembers: number;
  revenueMinorCNY: number;
  creditsConsumed: number;
  aiCostByCurrency: Record<string, number>;
  grossProfitCNY: number | null;
  tasks: number;
  failedTasks: number;
};
type Order = {
  id: string;
  userId: string;
  email: string;
  status: string;
  kind: string;
  amountMinor: number;
  currency: string;
  createdAt: string;
};
type Payment = {
  id: string;
  orderId: string;
  provider: string;
  status: string;
  amountMinor: number;
  currency: string;
  paidAt: string | null;
  createdAt: string;
};
type Device = {
  id: string;
  userId: string;
  name: string;
  platform: string;
  lastActiveAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
type TaskRun = {
  id: string;
  taskId: string;
  attempt: number;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};
type Provider = {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
  configured: boolean;
  modelCount: number;
  calls: number;
  successes: number;
  failures: number;
  successRate: number;
  averageLatencyMs: number;
  baseUrl: string;
};
type Model = {
  id: string;
  providerId: string;
  displayName: string;
  modelId: string;
  modality: string;
  enabled: boolean;
  creditsCost: number;
  outputCost?: number;
  currency?: string;
  pricingUnit?: string;
  qualityLevel: string;
};
type Binding = {
  id: string;
  logicalModelId: string;
  providerModelId: string;
  priority: number;
  enabled: boolean;
};
type Usage = {
  id: string;
  providerId: string;
  providerModelId: string;
  status: string;
  workflow: string;
  estimatedCost?: number;
  latencyMs: number;
  createdAt: string;
};
type Catalog = {
  providers: Provider[];
  models: Model[];
  logicalModels: { id: string; displayName: string }[];
  bindings: Binding[];
  usage: Usage[];
  estimatedCost: number;
};
type Plan = {
  id: string;
  code: string;
  name: string;
  billingCycle: string;
  priceMinor: number;
  includedCredits: number;
  maxDevices: number;
  maxConcurrency: number;
  enabled: boolean;
};
type Data = {
  users?: User[];
  transactions?: Transaction[];
  tasks?: Task[];
  catalog?: Catalog;
  plans?: Plan[];
  metrics?: Metrics;
  orders?: Order[];
  payments?: Payment[];
  devices?: Device[];
  usage?: Usage[];
  taskRuns?: TaskRun[];
};
type Source = keyof Data;
const endpoints: Record<Source, string> = {
  users: '/api/admin/users',
  transactions: '/api/admin/credits/transactions',
  tasks: '/api/admin/tasks',
  catalog: '/api/admin/ai/catalog',
  plans: '/api/admin/plans',
  metrics: '/api/admin/overview',
  orders: '/api/admin/orders',
  payments: '/api/admin/payments',
  devices: '/api/admin/devices',
  usage: '/api/admin/ai/usage',
  taskRuns: '/api/admin/task-runs',
};
const sourceLabels: Record<Source, string> = {
  catalog: 'AI 数据',
  usage: '调用记录',
  transactions: 'Credits 流水',
  plans: '套餐',
  tasks: '任务',
  taskRuns: '任务日志',
  users: '用户',
  metrics: '概览',
  orders: '订单',
  payments: '支付',
  devices: '设备',
};
const sectionMeta: Record<
  Section,
  { title: string; description: string; tabs: { id: string; label: string }[] }
> = {
  dashboard: { title: 'Dashboard', description: '掌握平台运营状况与核心业务指标', tabs: [] },
  users: {
    title: '用户中心',
    description: '查看用户、会员权益与 Credits 使用情况',
    tabs: [
      { id: 'list', label: '用户列表' },
      { id: 'memberships', label: '会员状态' },
      { id: 'credits', label: 'Credits 余额与流水' },
      { id: 'devices', label: '设备管理' },
    ],
  },
  business: {
    title: '商业中心',
    description: '管理订阅套餐、交易与计费规则',
    tabs: [
      { id: 'plans', label: '套餐管理' },
      { id: 'orders', label: '订单管理' },
      { id: 'payments', label: '支付记录' },
      { id: 'rules', label: 'Credits 规则' },
    ],
  },
  ai: {
    title: 'AI Studio',
    description: '统一管理模型供给、路由策略与调用成本',
    tabs: [
      { id: 'providers', label: 'Provider 管理' },
      { id: 'models', label: '模型管理' },
      { id: 'routing', label: '智能 Routing' },
      { id: 'costs', label: '成本配置' },
    ],
  },
  tasks: {
    title: '创作任务',
    description: '追踪生成任务、失败情况与执行记录',
    tabs: [
      { id: 'all', label: '全部任务' },
      { id: 'images', label: '图片任务' },
      { id: 'videos', label: '视频任务' },
      { id: 'failed', label: '失败任务' },
      { id: 'logs', label: '任务日志' },
    ],
  },
  analytics: {
    title: '数据分析',
    description: '分析平台调用量、消耗与模型表现',
    tabs: [
      { id: 'usage', label: 'AI 用量' },
      { id: 'users', label: '用户增长' },
      { id: 'commercial', label: '商业数据' },
    ],
  },
  settings: {
    title: '系统设置',
    description: '平台权限、运行状态与基础配置',
    tabs: [
      { id: 'general', label: '基础设置' },
      { id: 'security', label: '安全与权限' },
    ],
  },
};

async function getSource<T>(source: Source): Promise<T> {
  const response = await fetch(endpoints[source], { cache: 'no-store' });
  if (!response.ok)
    throw new Error(
      response.status === 401 ? '登录已过期，请重新登录' : `读取失败 (${response.status})`,
    );
  const body = (await response.json()) as { data: T | { usage: T } };
  return (source === 'usage' ? (body.data as { usage: T }).usage : body.data) as T;
}
function number(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}
function costSummary(metrics?: Metrics) {
  if (!metrics) return '—';
  const values = Object.entries(metrics.aiCostByCurrency).filter(([, amount]) => amount !== 0);
  if (!values.length) return '0';
  if (values.length > 1) return '多币种';
  const [currency, amount] = values[0]!;
  return `${currency} ${number(amount)}`;
}
function date(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function shortId(value: string) {
  return value.slice(0, 8);
}
function statusLabel(value: string) {
  return (
    (
      {
        active: '正常',
        disabled: '已禁用',
        success: '成功',
        succeeded: '已完成',
        completed: '已完成',
        paid: '已支付',
        refunded: '已退款',
        failed: '失败',
        pending: '等待中',
        queued: '排队中',
        running: '运行中',
        processing: '处理中',
        cancelled: '已取消',
        trialing: '试用中',
        past_due: '付款逾期',
        expired: '已过期',
        none: '无订阅',
      } as Record<string, string>
    )[value] ?? value
  );
}
function Status({ value }: { value: string }) {
  const tone = ['active', 'success', 'succeeded', 'completed', 'paid'].includes(value)
    ? 'success'
    : ['failed', 'disabled', 'refunded'].includes(value)
      ? 'error'
      : 'neutral';
  return (
    <span className={`status status-${tone}`}>
      <span />
      {statusLabel(value)}
    </span>
  );
}
function PageHeader({
  title,
  description,
  onRefresh,
  loading,
}: {
  title: string;
  description: string;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="page-eyebrow">WEAVIA / ADMIN</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="outline-button"
        type="button"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        刷新数据
      </Button>
    </div>
  );
}
function Empty({
  title,
  description,
  icon: Icon = Layers3,
}: {
  title: string;
  description: string;
  icon?: typeof Layers3;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={22} />
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="load-error" role="alert">
      <CircleAlert size={18} />
      <span>{message}</span>
      <button type="button" onClick={retry}>
        重试
      </button>
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'blue',
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone?: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon tone-${tone}`}>
          <Icon size={17} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            {headers.map((item) => (
              <th key={item}>{item}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function DataFrame({
  title,
  subtitle,
  children,
  count,
  search,
  onSearch,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  count?: number | undefined;
  search?: string;
  onSearch?: (value: string) => void;
}) {
  return (
    <section className="data-frame">
      <div className="data-frame-heading">
        <div>
          <h2>
            {title}
            {count !== undefined && <span className="count-pill">{number(count)}</span>}
          </h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {onSearch && (
          <label className="table-search">
            <Search size={15} />
            <input
              aria-label={`搜索${title}`}
              placeholder="搜索..."
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          </label>
        )}
      </div>
      {children}
    </section>
  );
}

export function ConsolePage({ section, initialTab }: { section: Section; initialTab?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const meta = sectionMeta[section];
  const tab = initialTab ?? params.get('tab') ?? meta.tabs[0]?.id;
  const [data, setData] = useState<Data>({});
  const [errors, setErrors] = useState<Partial<Record<Source, string>>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const needed: Source[] =
    section === 'dashboard'
      ? ['metrics', 'users', 'tasks', 'catalog']
      : section === 'users'
        ? ['users', 'transactions', 'devices']
        : section === 'business'
          ? ['plans', 'orders', 'payments']
          : section === 'ai'
            ? ['catalog']
            : section === 'tasks'
              ? ['tasks', 'taskRuns']
              : section === 'analytics'
                ? ['metrics', 'users', 'catalog', 'usage']
                : [];
  const neededKey = needed.join(',');
  const refresh = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled(
      neededKey
        .split(',')
        .filter(Boolean)
        .map(async (key) => [key, await getSource(key as Source)] as const),
    );
    const next: Data = {};
    const nextErrors: Partial<Record<Source, string>> = {};
    results.forEach((result, index) => {
      const key = neededKey.split(',')[index] as Source;
      if (result.status === 'fulfilled') Object.assign(next, { [key]: result.value[1] });
      else nextErrors[key] = result.reason instanceof Error ? result.reason.message : '读取失败';
    });
    setData(next);
    setErrors(nextErrors);
    setLoading(false);
  }, [neededKey]);
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  const tabs = meta.tabs;
  function switchTab(next: string) {
    setQuery('');
    router.push(
      `/${section === 'ai' ? 'ai-studio' : section === 'dashboard' ? '' : section}?tab=${next}`,
    );
  }
  const userMap = useMemo(
    () => new Map((data.users ?? []).map((user) => [user.id, user])),
    [data.users],
  );
  const visibleUsers = (data.users ?? []).filter((user) =>
    `${user.email} ${user.name} ${user.plan} ${user.id}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const visibleTransactions = (data.transactions ?? []).filter((item) =>
    `${item.userId} ${item.type} ${item.referenceType}`.toLowerCase().includes(query.toLowerCase()),
  );
  const visibleTasks = (data.tasks ?? []).filter((item) =>
    `${item.id} ${item.userId} ${item.model} ${item.provider}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const errorsToShow = needed.filter((source) => errors[source]);
  return (
    <>
      <PageHeader
        title={meta.title}
        description={meta.description}
        onRefresh={() => void refresh()}
        loading={loading}
      />
      {tabs.length > 0 && (
        <div className="section-tabs" role="tablist" aria-label={`${meta.title}栏目`}>
          {tabs.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? 'selected' : ''}
              key={item.id}
              onClick={() => switchTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {errorsToShow.length > 0 && (
        <LoadError
          message={`${errorsToShow.map((source) => sourceLabels[source]).join('、')}：${errors[errorsToShow[0]!]}`}
          retry={() => void refresh()}
        />
      )}
      {section === 'dashboard' && <Dashboard data={data} loading={loading} userMap={userMap} />}
      {section === 'users' && (tab === 'list' || tab === 'memberships') && (
        <DataFrame
          title={tab === 'list' ? '用户列表' : '会员状态'}
          subtitle="用户数据来自管理 API，最多显示最近 200 位用户"
          count={data.users?.length}
          search={query}
          onSearch={setQuery}
        >
          {visibleUsers.length ? (
            <Table
              headers={
                tab === 'memberships'
                  ? ['用户', '会员套餐', '订阅状态', '有效期至', 'Credits 余额']
                  : ['用户', '会员套餐', 'Credits 余额', '注册时间', '账户状态', '']
              }
            >
              {visibleUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="identity">
                      <span className="identity-avatar">
                        {(user.name || user.email).slice(0, 1).toUpperCase()}
                      </span>
                      <span>
                        <strong>{user.name || user.email.split('@')[0]}</strong>
                        <small>{user.email}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`plan-label ${user.plan !== 'free' ? 'paid' : ''}`}>
                      {user.plan.toUpperCase()}
                    </span>
                  </td>
                  {tab === 'memberships' ? (
                    <>
                      <td>
                        <Status value={user.membershipStatus} />
                      </td>
                      <td>{user.membershipExpiresAt ? date(user.membershipExpiresAt) : '—'}</td>
                      <td className="tabular">{number(user.credits)}</td>
                    </>
                  ) : (
                    <>
                      <td className="tabular">{number(user.credits)}</td>
                      <td>{date(user.createdAt)}</td>
                      <td>
                        <Status value={user.status} />
                      </td>
                      <td>
                        <span className="row-id">{shortId(user.id)}</span>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title={loading ? '正在加载用户' : query ? '没有匹配的用户' : '暂无用户'}
              description={
                loading ? '正在连接管理 API' : query ? '尝试更换搜索词' : '用户注册后会显示在这里'
              }
              icon={Users}
            />
          )}
        </DataFrame>
      )}
      {section === 'users' && tab === 'credits' && (
        <DataFrame
          title="Credits 消费记录"
          subtitle="展示最近 500 条不可变交易流水"
          count={data.transactions?.length}
          search={query}
          onSearch={setQuery}
        >
          {visibleTransactions.length ? (
            <Table headers={['交易记录', '用户', '类型', 'Credits 变动', '交易后余额', '时间']}>
              {visibleTransactions.map((item) => (
                <tr key={item.id}>
                  <td className="mono">{shortId(item.id)}…</td>
                  <td>
                    {userMap.get(item.userId)?.email ?? (
                      <span className="mono">{shortId(item.userId)}…</span>
                    )}
                  </td>
                  <td>{item.type}</td>
                  <td className={`tabular ${item.availableDelta < 0 ? 'negative' : 'positive'}`}>
                    {item.availableDelta > 0 ? '+' : ''}
                    {number(item.availableDelta)}
                  </td>
                  <td className="tabular">{number(item.balanceAfter)}</td>
                  <td>{date(item.createdAt)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title={loading ? '正在加载流水' : '暂无消费记录'}
              description="Credits 发生变动后会显示在这里"
              icon={Wallet}
            />
          )}
        </DataFrame>
      )}
      {section === 'users' && tab === 'devices' && (
        <DataFrame
          title="设备管理"
          subtitle="最近 200 台设备及最近活跃情况"
          count={data.devices?.length}
        >
          {data.devices?.length ? (
            <Table headers={['设备', '用户', '平台', '最近活跃', '状态']}>
              {data.devices.map((device) => (
                <tr key={device.id}>
                  <td>
                    <strong>{device.name}</strong>
                    <small className="cell-subtitle mono">{shortId(device.id)}…</small>
                  </td>
                  <td>{userMap.get(device.userId)?.email ?? `${shortId(device.userId)}…`}</td>
                  <td>{device.platform}</td>
                  <td>{device.lastActiveAt ? date(device.lastActiveAt) : '—'}</td>
                  <td>
                    <Status value={device.revokedAt ? 'disabled' : 'active'} />
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title={loading ? '正在加载设备' : '暂无设备'}
              description="用户登录设备后会显示在这里"
              icon={Server}
            />
          )}
        </DataFrame>
      )}
      {section === 'business' && (
        <Business
          tab={tab}
          plans={data.plans}
          orders={data.orders}
          payments={data.payments}
          loading={loading}
          refresh={refresh}
        />
      )}
      {section === 'ai' && (
        <AIStudio tab={tab} catalog={data.catalog} loading={loading} refresh={refresh} />
      )}
      {section === 'tasks' && (
        <Tasks
          tab={tab}
          tasks={visibleTasks}
          allTasks={data.tasks}
          taskRuns={data.taskRuns}
          loading={loading}
          query={query}
          setQuery={setQuery}
          userMap={userMap}
        />
      )}
      {section === 'analytics' && <Analytics tab={tab} data={data} loading={loading} />}
      {section === 'settings' && <Settings tab={tab} />}
    </>
  );
}

function Dashboard({
  data,
  loading,
  userMap,
}: {
  data: Data;
  loading: boolean;
  userMap: Map<string, User>;
}) {
  const tasks = data.tasks ?? [];
  const catalog = data.catalog;
  const metrics = data.metrics;
  const recentTasks = tasks.slice(0, 6);
  return (
    <>
      <div className="overview-strip">
        <div>
          <span className="live-dot" />
          实时概览 <span className="strip-divider">·</span> 数据源：WEAVIA Cloud API
        </div>
        <span>
          {new Date().toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>
      </div>
      <div className="metric-grid">
        <Metric
          label="用户数量"
          value={metrics ? number(metrics.users) : '—'}
          detail="平台累计用户"
          icon={Users}
        />
        <Metric
          label="今日新增"
          value={metrics ? number(metrics.newUsersToday) : '—'}
          detail="今天注册"
          icon={ArrowUpRight}
          tone="green"
        />
        <Metric
          label="付费会员"
          value={metrics ? number(metrics.paidMembers) : '—'}
          detail="有效付费订阅"
          icon={ShieldCheck}
          tone="violet"
        />
        <Metric
          label="收入"
          value={metrics ? `¥${number(metrics.revenueMinorCNY / 100)}` : '—'}
          detail="CNY 已支付订单累计"
          icon={CreditCard}
          tone="amber"
        />
        <Metric
          label="Credits 消耗"
          value={metrics ? number(metrics.creditsConsumed) : '—'}
          detail="累计确认消耗"
          icon={Wallet}
          tone="amber"
        />
        <Metric
          label="AI 成本"
          value={costSummary(metrics)}
          detail="按 Provider 币种统计"
          icon={Sparkles}
          tone="violet"
        />
        <Metric
          label="利润"
          value={
            metrics?.grossProfitCNY === null || !metrics
              ? '—'
              : `¥${number(metrics.grossProfitCNY)}`
          }
          detail="CNY 收入－AI 成本，未含其他费用"
          icon={ArrowDownRight}
          tone="green"
        />
        <Metric
          label="任务统计"
          value={metrics ? number(metrics.tasks) : '—'}
          detail={metrics ? `${metrics.failedTasks} 个失败` : '任务数据待接入'}
          icon={WandSparkles}
        />
      </div>
      <div className="dashboard-columns">
        <DataFrame title="最近创作任务" subtitle="最新任务运行状态">
          <Link className="text-link" href="/tasks">
            查看全部 <ArrowRight size={14} />
          </Link>
          {recentTasks.length ? (
            <Table headers={['任务 ID', '用户', '模型', 'Credits', '状态', '创建时间']}>
              {recentTasks.map((task) => (
                <tr key={task.id}>
                  <td className="mono">{shortId(task.id)}…</td>
                  <td>{userMap.get(task.userId)?.email ?? `${shortId(task.userId)}…`}</td>
                  <td>{task.model || '—'}</td>
                  <td className="tabular">{number(task.cost)}</td>
                  <td>
                    <Status value={task.status} />
                  </td>
                  <td>{date(task.createdAt)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title={loading ? '正在加载任务' : '暂无创作任务'}
              description="创作任务启动后会显示在这里"
              icon={WandSparkles}
            />
          )}
        </DataFrame>
        <div className="overview-side">
          <section className="side-panel">
            <div className="side-panel-heading">
              <h2>平台状态</h2>
              <Activity size={17} />
            </div>
            <div className="side-row">
              <span>
                <span className="status-dot green" />
                用户服务
              </span>
              <strong>{data.users ? '已连接' : '待连接'}</strong>
            </div>
            <div className="side-row">
              <span>
                <span className="status-dot green" />
                任务服务
              </span>
              <strong>{data.tasks ? '已连接' : '待连接'}</strong>
            </div>
            <div className="side-row">
              <span>
                <span className="status-dot green" />
                AI Providers
              </span>
              <strong>
                {catalog ? `${catalog.providers.filter((p) => p.enabled).length} 个启用` : '待连接'}
              </strong>
            </div>
          </section>
          <section className="side-panel quick-links">
            <h2>快捷入口</h2>
            <Link href="/users">
              <Users size={16} />
              查看用户
              <ChevronRight size={15} />
            </Link>
            <Link href="/ai-studio">
              <Sparkles size={16} />
              管理 AI 模型
              <ChevronRight size={15} />
            </Link>
            <Link href="/business">
              <CreditCard size={16} />
              商业中心
              <ChevronRight size={15} />
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}

function Business({
  tab,
  plans,
  orders,
  payments,
  loading,
  refresh,
}: {
  tab: string | undefined;
  plans: Plan[] | undefined;
  orders: Order[] | undefined;
  payments: Payment[] | undefined;
  loading: boolean;
  refresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Plan | null>(null);
  const [price, setPrice] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  function openEdit(plan: Plan) {
    setEditing(plan);
    setPrice((plan.priceMinor / 100).toFixed(2));
    setEnabled(plan.enabled);
    setSaveError('');
  }
  async function savePlan(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setSaveError('');
    try {
      const response = await fetch(`/api/admin/plans/${encodeURIComponent(editing.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ priceMinor: Math.round(Number(price) * 100), enabled }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? '套餐更新失败');
      }
      await refresh();
      setEditing(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '套餐更新失败');
    } finally {
      setSaving(false);
    }
  }
  if (tab === 'orders')
    return (
      <DataFrame title="订单管理" subtitle="最近 200 笔订单" count={orders?.length}>
        {orders?.length ? (
          <Table headers={['订单 ID', '用户', '类型', '金额', '状态', '创建时间']}>
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="mono">{shortId(order.id)}…</td>
                <td>{order.email || `${shortId(order.userId)}…`}</td>
                <td>{order.kind}</td>
                <td className="tabular">
                  {order.currency} {number(order.amountMinor / 100)}
                </td>
                <td>
                  <Status value={order.status} />
                </td>
                <td>{date(order.createdAt)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty
            title={loading ? '正在加载订单' : '暂无订单'}
            description="客户下单后会显示在这里"
            icon={CreditCard}
          />
        )}
      </DataFrame>
    );
  if (tab === 'payments')
    return (
      <DataFrame title="支付记录" subtitle="最近 200 笔支付记录" count={payments?.length}>
        {payments?.length ? (
          <Table headers={['支付 ID', '订单 ID', '支付渠道', '金额', '状态', '支付时间']}>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td className="mono">{shortId(payment.id)}…</td>
                <td className="mono">{shortId(payment.orderId)}…</td>
                <td>{payment.provider}</td>
                <td className="tabular">
                  {payment.currency} {number(payment.amountMinor / 100)}
                </td>
                <td>
                  <Status value={payment.status} />
                </td>
                <td>{payment.paidAt ? date(payment.paidAt) : '—'}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty
            title={loading ? '正在加载支付' : '暂无支付记录'}
            description="支付完成后会显示在这里"
            icon={CreditCard}
          />
        )}
      </DataFrame>
    );
  if (tab === 'rules')
    return (
      <DataFrame title="Credits 规则" subtitle="来自当前套餐配置">
        {plans?.length ? (
          <Table headers={['套餐', '每期赠送 Credits', '设备上限', '并发任务', '计费周期']}>
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td>
                  <strong>{plan.name}</strong>
                </td>
                <td className="tabular">{number(plan.includedCredits)}</td>
                <td>{plan.maxDevices}</td>
                <td>{plan.maxConcurrency}</td>
                <td>{plan.billingCycle}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty
            title={loading ? '正在加载规则' : '暂无套餐规则'}
            description="套餐配置接入后在这里展示"
            icon={Wallet}
          />
        )}
      </DataFrame>
    );
  return (
    <>
      <DataFrame title="套餐管理" subtitle="套餐价格及启用状态" count={plans?.length}>
        {plans?.length ? (
          <div className="plan-grid">
            {plans.map((plan) => (
              <div className="plan-card" key={plan.id}>
                <div className="plan-card-top">
                  <span className="plan-icon">
                    <Layers3 size={18} />
                  </span>
                  <span className={`plan-label ${plan.enabled ? 'paid' : ''}`}>
                    {plan.enabled ? plan.code.toUpperCase() : '已停用'}
                  </span>
                </div>
                <h3>{plan.name}</h3>
                <div className="plan-price">
                  ¥{(plan.priceMinor / 100).toFixed(0)}
                  <span> / {plan.billingCycle === 'yearly' ? '年' : '月'}</span>
                </div>
                <div className="plan-divider" />
                <div className="plan-feature">
                  <Check size={15} />
                  {number(plan.includedCredits)} Credits / 期
                </div>
                <div className="plan-feature">
                  <Check size={15} />
                  {plan.maxDevices} 台设备
                </div>
                <div className="plan-feature">
                  <Check size={15} />
                  {plan.maxConcurrency} 个并发任务
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="plan-edit"
                  type="button"
                  onClick={() => openEdit(plan)}
                >
                  编辑套餐
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title={loading ? '正在加载套餐' : '暂无套餐'}
            description="套餐配置会从 WEAVIA Cloud API 同步"
            icon={CreditCard}
          />
        )}
      </DataFrame>
      {editing && (
        <div className="edit-overlay" role="presentation" onMouseDown={() => setEditing(null)}>
          <div
            className="edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`编辑 ${editing.name} 套餐`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2>编辑 {editing.name}</h2>
            <p>更新套餐价格与上架状态</p>
            <form onSubmit={(event) => void savePlan(event)}>
              <label htmlFor="plan-price">
                价格（元 / {editing.billingCycle === 'yearly' ? '年' : '月'}）
              </label>
              <Input
                id="plan-price"
                type="number"
                min="0"
                step="0.01"
                required
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
              <label className="edit-checkbox">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                />{' '}
                启用套餐
              </label>
              {saveError && (
                <p className="edit-error" role="alert">
                  {saveError}
                </p>
              )}
              <div className="edit-actions">
                <Button variant="outline" type="button" onClick={() => setEditing(null)}>
                  取消
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? '保存中...' : '保存更改'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function AIStudio({
  tab,
  catalog,
  loading,
  refresh,
}: {
  tab: string | undefined;
  catalog: Catalog | undefined;
  loading: boolean;
  refresh: () => Promise<void>;
}) {
  const [updating, setUpdating] = useState<string>();
  const [actionError, setActionError] = useState('');
  async function toggle(provider: Provider) {
    setUpdating(provider.id);
    setActionError('');
    try {
      const response = await fetch(`/api/admin/ai/providers/${encodeURIComponent(provider.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: !provider.enabled }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message ?? '更新失败');
      }
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '更新失败');
    } finally {
      setUpdating(undefined);
    }
  }
  if (tab === 'models')
    return (
      <DataFrame
        title="模型目录"
        subtitle="模型能力、质量档位与 Credits 定价"
        count={catalog?.models.length}
      >
        {catalog?.models.length ? (
          <Table headers={['模型', 'Provider', '类型', '质量档位', 'Credits', '状态']}>
            {catalog.models.map((model) => (
              <tr key={model.id}>
                <td>
                  <strong>{model.displayName}</strong>
                  <small className="cell-subtitle mono">{model.modelId}</small>
                </td>
                <td>
                  {catalog.providers.find((provider) => provider.id === model.providerId)?.name ??
                    '—'}
                </td>
                <td>{model.modality}</td>
                <td>{model.qualityLevel}</td>
                <td className="tabular">{number(model.creditsCost)}</td>
                <td>
                  <Status value={model.enabled ? 'active' : 'disabled'} />
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty
            title={loading ? '正在加载模型' : '暂无模型'}
            description="模型接入后会显示在这里"
            icon={Sparkles}
          />
        )}
      </DataFrame>
    );
  if (tab === 'routing')
    return (
      <DataFrame
        title="智能 Routing"
        subtitle="逻辑模型到 Provider 模型的优先级绑定"
        count={catalog?.bindings.length}
      >
        {catalog?.bindings.length ? (
          <Table headers={['逻辑模型', '目标 Provider 模型', '优先级', '状态']}>
            {catalog.bindings.map((binding) => (
              <tr key={binding.id}>
                <td>
                  <strong>
                    {catalog.logicalModels.find((item) => item.id === binding.logicalModelId)
                      ?.displayName ?? '—'}
                  </strong>
                </td>
                <td>
                  {catalog.models.find((model) => model.id === binding.providerModelId)
                    ?.displayName ?? '—'}
                </td>
                <td className="tabular">{binding.priority}</td>
                <td>
                  <Status value={binding.enabled ? 'active' : 'disabled'} />
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty
            title={loading ? '正在加载路由' : '暂无路由绑定'}
            description="配置模型路由后会显示在这里"
            icon={Filter}
          />
        )}
      </DataFrame>
    );
  if (tab === 'costs')
    return (
      <DataFrame
        title="成本配置"
        subtitle="Provider 报价与平台 Credits 定价概览"
        count={catalog?.models.length}
      >
        {catalog?.models.length ? (
          <Table headers={['模型', 'Provider', 'Provider 输出成本', '计价单位', 'Credits 定价']}>
            {catalog.models.map((model) => (
              <tr key={model.id}>
                <td>
                  <strong>{model.displayName}</strong>
                </td>
                <td>
                  {catalog.providers.find((provider) => provider.id === model.providerId)?.name ??
                    '—'}
                </td>
                <td className="tabular">
                  {model.outputCost === undefined
                    ? '未配置'
                    : `${model.currency ?? ''} ${model.outputCost}`}
                </td>
                <td>{model.pricingUnit ?? '—'}</td>
                <td className="tabular">{number(model.creditsCost)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty
            title={loading ? '正在加载成本配置' : '暂无模型成本'}
            description="模型配置接入后会显示在这里"
            icon={Wallet}
          />
        )}
      </DataFrame>
    );
  return (
    <DataFrame
      title="Provider 管理"
      subtitle="供应商配置及调用健康度"
      count={catalog?.providers.length}
    >
      {actionError && <LoadError message={actionError} retry={() => void refresh()} />}
      {catalog?.providers.length ? (
        <Table
          headers={['Provider', '配置状态', '模型数量', '调用量', '成功率', '平均延迟', '状态']}
        >
          {catalog.providers.map((provider) => (
            <tr key={provider.id}>
              <td>
                <div className="provider-name">
                  <span className="provider-avatar">{provider.name.slice(0, 1)}</span>
                  <span>
                    <strong>{provider.name}</strong>
                    <small>{provider.code}</small>
                  </span>
                </div>
              </td>
              <td>
                {provider.configured ? (
                  <span className="configured">
                    <Check size={13} />
                    已配置
                  </span>
                ) : (
                  <span className="muted">未配置</span>
                )}
              </td>
              <td className="tabular">{provider.modelCount}</td>
              <td className="tabular">{number(provider.calls)}</td>
              <td className="tabular">{(provider.successRate * 100).toFixed(1)}%</td>
              <td className="tabular">{number(provider.averageLatencyMs)} ms</td>
              <td>
                <button
                  className={`toggle ${provider.enabled ? 'on' : ''}`}
                  type="button"
                  role="switch"
                  aria-checked={provider.enabled}
                  aria-label={`${provider.enabled ? '禁用' : '启用'} ${provider.name}`}
                  disabled={updating === provider.id}
                  onClick={() => void toggle(provider)}
                >
                  <span />
                </button>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty
          title={loading ? '正在加载 Provider' : '暂无 Provider'}
          description="连接 AI 供应商后会显示在这里"
          icon={Server}
        />
      )}
    </DataFrame>
  );
}

function Tasks({
  tab,
  tasks,
  allTasks,
  taskRuns,
  loading,
  query,
  setQuery,
  userMap,
}: {
  tab: string | undefined;
  tasks: Task[];
  allTasks: Task[] | undefined;
  taskRuns: TaskRun[] | undefined;
  loading: boolean;
  query: string;
  setQuery: (value: string) => void;
  userMap: Map<string, User>;
}) {
  if (tab === 'logs')
    return (
      <DataFrame
        title="任务日志"
        subtitle="最近 500 条执行尝试"
        count={taskRuns?.length}
        search={query}
        onSearch={setQuery}
      >
        {taskRuns?.length ? (
          <Table headers={['运行 ID', '任务 ID', '尝试次数', '状态', '开始时间', '结束时间']}>
            {taskRuns
              .filter((run) =>
                `${run.id} ${run.taskId}`.toLowerCase().includes(query.toLowerCase()),
              )
              .map((run) => (
                <tr key={run.id}>
                  <td className="mono">{shortId(run.id)}…</td>
                  <td className="mono">{shortId(run.taskId)}…</td>
                  <td className="tabular">{run.attempt}</td>
                  <td>
                    <Status value={run.status} />
                  </td>
                  <td>{run.startedAt ? date(run.startedAt) : '—'}</td>
                  <td>{run.finishedAt ? date(run.finishedAt) : '—'}</td>
                </tr>
              ))}
          </Table>
        ) : (
          <Empty
            title={loading ? '正在加载运行记录' : '暂无任务日志'}
            description="任务执行后会产生运行记录"
            icon={Clock3}
          />
        )}
      </DataFrame>
    );
  const filtered =
    tab === 'failed'
      ? tasks.filter((task) => task.status === 'failed')
      : tab === 'images'
        ? tasks.filter((task) => ['image_generation', 'image_edit'].includes(task.type))
        : tab === 'videos'
          ? tasks.filter((task) => task.type === 'image_to_video')
          : tasks;
  return (
    <DataFrame
      title={
        tab === 'failed'
          ? '失败任务'
          : tab === 'logs'
            ? '任务日志'
            : tab === 'images'
              ? '图片任务'
              : tab === 'videos'
                ? '视频任务'
                : '全部任务'
      }
      subtitle="显示最近 500 条创作任务"
      count={filtered.length}
      search={query}
      onSearch={setQuery}
    >
      {filtered.length ? (
        <Table
          headers={['任务 ID', '用户', '类型', 'Provider / 模型', 'Credits', '状态', '创建时间']}
        >
          {filtered.map((task) => (
            <tr key={task.id}>
              <td className="mono">{shortId(task.id)}…</td>
              <td>
                {userMap.get(task.userId)?.email ?? (
                  <span className="mono">{shortId(task.userId)}…</span>
                )}
              </td>
              <td>
                {(
                  {
                    image_generation: '图片生成',
                    image_edit: '图片编辑',
                    image_to_video: '图生视频',
                  } as Record<string, string>
                )[task.type] ?? task.type}
              </td>
              <td>
                <strong>{task.provider || '—'}</strong>
                <small className="cell-subtitle">{task.model || '未指定模型'}</small>
              </td>
              <td className="tabular">{number(task.cost)}</td>
              <td>
                <Status value={task.status} />
              </td>
              <td>{date(task.createdAt)}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty
          title={
            loading
              ? '正在加载任务'
              : query
                ? '没有匹配的任务'
                : tab === 'failed' && allTasks?.length
                  ? '没有失败任务'
                  : '暂无创作任务'
          }
          description="任务运行记录会显示在这里"
          icon={WandSparkles}
        />
      )}
    </DataFrame>
  );
}

function Analytics({
  tab,
  data,
  loading,
}: {
  tab: string | undefined;
  data: Data;
  loading: boolean;
}) {
  if (tab === 'commercial')
    return (
      <>
        <div className="metric-grid mini">
          <Metric
            label="累计收入"
            value={data.metrics ? `¥${number(data.metrics.revenueMinorCNY / 100)}` : '—'}
            detail="CNY 已支付订单"
            icon={CreditCard}
            tone="amber"
          />
          <Metric
            label="付费会员"
            value={data.metrics ? number(data.metrics.paidMembers) : '—'}
            detail="有效付费订阅"
            icon={Users}
            tone="violet"
          />
          <Metric
            label="利润"
            value={
              data.metrics?.grossProfitCNY === null || !data.metrics
                ? '—'
                : `¥${number(data.metrics.grossProfitCNY)}`
            }
            detail="未含其他费用"
            icon={ArrowUpRight}
            tone="green"
          />
        </div>
        <DataFrame title="商业数据口径">
          <div className="analytics-note">
            <p>
              收入统计 CNY 已支付订单；利润为 CNY 收入减去 AI Provider
              成本，尚未计入其他运营费用。存在未换算的外币成本时不计算利润。
            </p>
            <Link href="/business?tab=orders">
              查看订单 <ArrowRight size={14} />
            </Link>
          </div>
        </DataFrame>
      </>
    );
  if (tab === 'users') {
    const users = data.users ?? [];
    return (
      <>
        <div className="metric-grid mini">
          <Metric
            label="累计用户"
            value={data.metrics ? number(data.metrics.users) : '—'}
            detail="平台总量"
            icon={Users}
          />
          <Metric
            label="今日新增"
            value={data.metrics ? number(data.metrics.newUsersToday) : '—'}
            detail="今天注册"
            icon={ArrowUpRight}
            tone="green"
          />
          <Metric
            label="付费会员"
            value={data.metrics ? number(data.metrics.paidMembers) : '—'}
            detail="有效付费订阅"
            icon={ShieldCheck}
            tone="violet"
          />
        </div>
        <DataFrame title="最近注册用户">
          {users.length ? (
            <Table headers={['用户', '套餐', '注册时间']}>
              {users.slice(0, 20).map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.plan}</td>
                  <td>{date(user.createdAt)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title={loading ? '正在加载用户' : '暂无用户'}
              description="注册数据会显示在这里"
              icon={Users}
            />
          )}
        </DataFrame>
      </>
    );
  }
  const usage = data.usage ?? [];
  return (
    <>
      <div className="metric-grid mini">
        <Metric
          label="Provider 调用"
          value={data.usage ? number(usage.length) : '—'}
          detail="最近 500 条记录"
          icon={Activity}
        />
        <Metric
          label="成功调用"
          value={
            data.usage ? number(usage.filter((item) => item.status === 'success').length) : '—'
          }
          detail="最近 500 条记录"
          icon={Check}
          tone="green"
        />
        <Metric
          label="AI 成本"
          value={costSummary(data.metrics)}
          detail="按 Provider 币种统计"
          icon={Wallet}
          tone="amber"
        />
      </div>
      <DataFrame title="模型调用记录" subtitle="最近 500 条 Provider 使用明细" count={usage.length}>
        {usage.length ? (
          <Table headers={['Provider', '模型', '工作流', '延迟', '估算成本', '状态', '时间']}>
            {usage.map((item) => (
              <tr key={item.id}>
                <td>
                  {data.catalog?.providers.find((provider) => provider.id === item.providerId)
                    ?.name ?? '—'}
                </td>
                <td>
                  {data.catalog?.models.find((model) => model.id === item.providerModelId)
                    ?.displayName ?? '—'}
                </td>
                <td>{item.workflow}</td>
                <td className="tabular">{item.latencyMs} ms</td>
                <td className="tabular">{item.estimatedCost ?? '—'}</td>
                <td>
                  <Status value={item.status} />
                </td>
                <td>{date(item.createdAt)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty
            title={loading ? '正在加载调用记录' : '暂无调用记录'}
            description="AI 模型被调用后会显示在这里"
            icon={Activity}
          />
        )}
      </DataFrame>
    </>
  );
}

function Settings({ tab }: { tab: string | undefined }) {
  return tab === 'security' ? (
    <div className="settings-layout">
      <section className="settings-panel">
        <div className="settings-icon">
          <ShieldCheck size={20} />
        </div>
        <h2>管理员访问</h2>
        <p>后台仅允许拥有 admin.read 权限的账户登录。访问令牌存储在 HttpOnly Cookie 中。</p>
        <div className="setting-line">
          <span>登录方式</span>
          <strong>邮箱与密码</strong>
        </div>
        <div className="setting-line">
          <span>访问控制</span>
          <strong>基于角色权限</strong>
        </div>
      </section>
      <section className="settings-panel">
        <div className="settings-icon">
          <Clock3 size={20} />
        </div>
        <h2>会话安全</h2>
        <p>访问令牌到期后使用刷新令牌续期。退出登录会撤销当前会话。</p>
        <div className="setting-line">
          <span>访问令牌</span>
          <strong>15 分钟</strong>
        </div>
        <div className="setting-line">
          <span>刷新令牌</span>
          <strong>30 天</strong>
        </div>
      </section>
    </div>
  ) : (
    <div className="settings-layout">
      <section className="settings-panel">
        <div className="settings-icon">
          <Settings2 size={20} />
        </div>
        <h2>平台信息</h2>
        <p>WEAVIA 运营管理后台</p>
        <div className="setting-line">
          <span>工作区</span>
          <strong>WEAVIA Workspace</strong>
        </div>
        <div className="setting-line">
          <span>界面语言</span>
          <strong>简体中文</strong>
        </div>
      </section>
      <section className="settings-panel">
        <div className="settings-icon">
          <Server size={20} />
        </div>
        <h2>服务连接</h2>
        <p>管理数据通过 WEAVIA Cloud API 读取。需要更改服务地址时，请更新部署环境中的服务配置。</p>
        <div className="setting-line">
          <span>API 访问</span>
          <strong>服务端代理</strong>
        </div>
      </section>
    </div>
  );
}

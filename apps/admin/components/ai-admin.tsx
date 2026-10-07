'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, PageHeader } from '@weavia/ui';

type View = 'providers' | 'provider' | 'models' | 'routing' | 'usage';
interface Snapshot {
  providers: Array<{
    id: string;
    code: string;
    name: string;
    baseUrl: string;
    enabled: boolean;
    configured: boolean;
    modelCount: number;
    calls: number;
    successes: number;
    failures: number;
    successRate: number;
    failureRate: number;
    averageLatencyMs: number;
  }>;
  models: Array<{
    id: string;
    providerId: string;
    modelId: string;
    displayName: string;
    modality: string;
    capabilities: string[];
    enabled: boolean;
    currency?: string;
    pricingUnit?: string;
    outputCost?: number;
  }>;
  logicalModels: Array<{
    id: string;
    key: string;
    displayName: string;
    type: string;
    enabled: boolean;
  }>;
  bindings: Array<{
    id: string;
    logicalModelId: string;
    providerModelId: string;
    priority: number;
    enabled: boolean;
  }>;
  usage: Array<{
    id: string;
    providerId: string;
    providerModelId: string;
    logicalModel: string;
    workflow: string;
    status: string;
    attempt: number;
    latencyMs: number;
    estimatedCost?: number;
    createdAt: string;
  }>;
  estimatedCost: number;
}
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';

export function AIAdminView({ view, providerId }: { view: View; providerId?: string }) {
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState<string>();
  const [testing, setTesting] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/admin/ai/catalog`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Cloud API ${response.status}`);
      setData(((await response.json()) as { data: Snapshot }).data);
      setError(undefined);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  if (error)
    return (
      <>
        <PageHeader eyebrow="AI PLATFORM" title="AI 管理" description="Cloud API 当前不可用" />
        <p className="admin-error">{error}</p>
        <Button onClick={() => void load()}>重试</Button>
      </>
    );
  if (!data) return <p>正在读取 WEAVIA Cloud API…</p>;
  if (view === 'providers') return <Providers data={data} />;
  if (view === 'provider') {
    const provider = data.providers.find((item) => item.id === providerId);
    if (!provider) return <p>Provider 不存在</p>;
    async function toggle() {
      await fetch(`${apiBase}/admin/ai/providers/${provider!.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: !provider!.enabled }),
      });
      await load();
    }
    return (
      <>
        <PageHeader
          eyebrow="PROVIDER DETAIL"
          title={provider.name}
          description={provider.baseUrl}
        />
        <div className="provider-detail">
          <Card>
            <h2>配置就绪</h2>
            <dl>
              <div>
                <dt>Code</dt>
                <dd>{provider.code}</dd>
              </div>
              <div>
                <dt>Enabled</dt>
                <dd>{String(provider.enabled)}</dd>
              </div>
              <div>
                <dt>API Key</dt>
                <dd>{provider.configured ? '已配置' : '未配置'}</dd>
              </div>
            </dl>
            <Button onClick={() => void toggle()}>{provider.enabled ? '禁用' : '启用'}</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setTesting(true);
                void load().finally(() => setTesting(false));
              }}
            >
              {testing ? '检查中…' : 'Test Connection（仅配置）'}
            </Button>
          </Card>
          <Card>
            <h2>Usage Summary</h2>
            <p>
              {provider.calls} 调用 · {provider.successes} 成功 · {provider.failures} 失败
            </p>
            <p>平均 {provider.averageLatencyMs} ms</p>
          </Card>
        </div>
        <h2>Supported Models</h2>
        <ul>
          {data.models
            .filter((item) => item.providerId === provider.id)
            .map((model) => (
              <li key={model.id}>
                {model.displayName} · {model.capabilities.join(', ')}
              </li>
            ))}
        </ul>
      </>
    );
  }
  if (view === 'models') return <Models data={data} />;
  if (view === 'routing') return <Routing data={data} />;
  return <Usage data={data} />;
}

function Providers({ data }: { data: Snapshot }) {
  return (
    <>
      <PageHeader
        eyebrow="AI PLATFORM"
        title="AI Providers"
        description="真实 Cloud API 配置与调用健康度；Secret 永不返回 Admin。"
      />
      <div className="stats">
        <Card className="stat">
          <span>Providers</span>
          <strong>{data.providers.length}</strong>
        </Card>
        <Card className="stat">
          <span>调用</span>
          <strong>{data.providers.reduce((n, p) => n + p.calls, 0)}</strong>
        </Card>
        <Card className="stat">
          <span>成功</span>
          <strong>{data.providers.reduce((n, p) => n + p.successes, 0)}</strong>
        </Card>
        <Card className="stat">
          <span>平均延迟</span>
          <strong>{data.providers[0]?.averageLatencyMs ?? 0}ms</strong>
        </Card>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Provider</th>
            <th>状态</th>
            <th>Base URL</th>
            <th>Secret</th>
            <th>模型</th>
            <th>成功率</th>
          </tr>
        </thead>
        <tbody>
          {data.providers.map((provider) => (
            <tr key={provider.id}>
              <td>
                <Link href={`/providers/${provider.id}`}>{provider.name}</Link>
              </td>
              <td>
                <Badge tone={provider.enabled ? 'success' : 'neutral'}>
                  {provider.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </td>
              <td>{provider.baseUrl}</td>
              <td>{provider.configured ? 'Configured' : 'Not Configured'}</td>
              <td>{provider.modelCount}</td>
              <td>{(provider.successRate * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
function Models({ data }: { data: Snapshot }) {
  return (
    <>
      <PageHeader
        eyebrow="PHYSICAL MODELS"
        title="Models"
        description="Provider 物理模型与成本元数据。"
      />
      <table className="data-table">
        <thead>
          <tr>
            <th>模型</th>
            <th>Modality</th>
            <th>Capabilities</th>
            <th>状态</th>
            <th>Pricing</th>
          </tr>
        </thead>
        <tbody>
          {data.models.map((model) => (
            <tr key={model.id}>
              <td>
                {model.displayName}
                <small>{model.modelId}</small>
              </td>
              <td>{model.modality}</td>
              <td>{model.capabilities.join(', ')}</td>
              <td>{model.enabled ? 'Enabled' : 'Disabled'}</td>
              <td>
                {model.outputCost === undefined
                  ? '未配置'
                  : `${model.outputCost} ${model.currency}/${model.pricingUnit}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
function Routing({ data }: { data: Snapshot }) {
  return (
    <>
      <PageHeader
        eyebrow="MODEL ROUTER"
        title="Routing"
        description="用户逻辑档位到 Provider 物理模型的优先级绑定。"
      />
      <table className="data-table">
        <thead>
          <tr>
            <th>Logical Model</th>
            <th>Provider Model</th>
            <th>Priority</th>
            <th>Enabled</th>
          </tr>
        </thead>
        <tbody>
          {data.bindings.map((binding) => (
            <tr key={binding.id}>
              <td>
                {data.logicalModels.find((item) => item.id === binding.logicalModelId)?.displayName}
              </td>
              <td>
                {data.models.find((item) => item.id === binding.providerModelId)?.displayName}
              </td>
              <td>{binding.priority}</td>
              <td>{String(binding.enabled)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
function Usage({ data }: { data: Snapshot }) {
  return (
    <>
      <PageHeader
        eyebrow="PROVIDER USAGE"
        title="Usage"
        description="真实 Provider 调用、延迟与估算成本。"
      />
      <div className="stats">
        <Card className="stat">
          <span>今日调用</span>
          <strong>{data.usage.length}</strong>
        </Card>
        <Card className="stat">
          <span>成功</span>
          <strong>{data.usage.filter((item) => item.status === 'success').length}</strong>
        </Card>
        <Card className="stat">
          <span>失败</span>
          <strong>{data.usage.filter((item) => item.status === 'failed').length}</strong>
        </Card>
        <Card className="stat">
          <span>估算成本</span>
          <strong>{data.estimatedCost || '—'}</strong>
        </Card>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Logical Model</th>
            <th>Workflow</th>
            <th>Status</th>
            <th>Attempt</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          {data.usage.length ? (
            data.usage.map((item) => (
              <tr key={item.id}>
                <td>{item.logicalModel}</td>
                <td>{item.workflow}</td>
                <td>{item.status}</td>
                <td>{item.attempt}</td>
                <td>{item.latencyMs}ms</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>暂无真实调用</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

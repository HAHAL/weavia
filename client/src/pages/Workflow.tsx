import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Handle, Position, type Connection, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CheckCircle2, CircleDashed, LoaderCircle, Play, Plus, Save, Trash2, XCircle } from 'lucide-react';
import { Badge, Button, Card, Field, StatePanel } from '../components/ui';
import { useApp } from '../stores/app';
import { createTask } from '../services/tasks';
import { useAssetPreview } from '../hooks/useAssetPreview';
import { deleteWorkflow, listWorkflows, listWorkflowRuns, saveWorkflow, startWorkflowRun, finishWorkflowRun, type WorkflowRecord, type WorkflowRun } from '../services/workflows';

type Kind = 'input' | 'prompt' | 'condition' | 'review' | 'image' | 'output';
type RunState = 'idle' | 'queued' | 'running' | 'waiting' | 'success' | 'error' | 'skipped';
type WFData = { label: string; kind: Kind; value?: string; prompt?: string; condition?: string; modelId?: string; run?: RunState; result?: string; error?: string; assetId?: string } & Record<string, unknown>;
type WFNode = Node<WFData>;
const kinds: { kind: Kind; label: string; hint: string }[] = [
  { kind: 'input', label: '输入', hint: '商品名或创作要求' },
  { kind: 'prompt', label: '提示词', hint: '把上游内容组织成提示词' },
  { kind: 'condition', label: '条件', hint: '包含关键词才继续' },
  { kind: 'review', label: '人工审核', hint: '暂停等待确认' },
  { kind: 'image', label: '图片生成', hint: '真实调用图片模型' },
  { kind: 'output', label: '输出', hint: '收集最终结果' },
];
const initialNodes: WFNode[] = [
  { id: 'input-1', type: 'weavia', position: { x: 40, y: 170 }, data: { label: '商品输入', kind: 'input', value: '一瓶金色香水，放在奶油色石材上' } },
  { id: 'prompt-1', type: 'weavia', position: { x: 280, y: 170 }, data: { label: '主图提示词', kind: 'prompt', prompt: '为这件商品制作自然光商业主图，突出包装和材质。\n{{input}}' } },
  { id: 'image-1', type: 'weavia', position: { x: 530, y: 170 }, data: { label: '商品主图', kind: 'image', modelId: 'image-balanced' } },
  { id: 'output-1', type: 'weavia', position: { x: 780, y: 170 }, data: { label: '输出作品', kind: 'output' } },
];
const initialEdges: Edge[] = [
  { id: 'e-input-prompt', source: 'input-1', target: 'prompt-1' },
  { id: 'e-prompt-image', source: 'prompt-1', target: 'image-1' },
  { id: 'e-image-output', source: 'image-1', target: 'output-1' },
];

function statusIcon(state: RunState) {
  if (state === 'skipped') return <CircleDashed size={13} />;
  if (state === 'waiting') return <CircleDashed size={13} />;
  if (state === 'running' || state === 'queued') return <LoaderCircle size={13} className="wf-spin" />;
  if (state === 'success') return <CheckCircle2 size={13} />;
  if (state === 'error') return <XCircle size={13} />;
  return <CircleDashed size={13} />;
}

function WeaviaNode({ data, selected }: NodeProps<WFNode>) {
  const state = data.run || 'idle';
  const { url } = useAssetPreview(data.kind === 'image' ? data.assetId : undefined);
  return <div className={`wf-node wf-node-${data.kind} ${selected ? 'selected' : ''} wf-state-${state}`}>
    {data.kind !== 'input' && <Handle type="target" position={Position.Left} />}
    <div className="wf-node-head"><span className="wf-node-kind">{kinds.find(item => item.kind === data.kind)?.label}</span><span className="wf-node-state">{statusIcon(state)}</span></div>
    <strong>{data.label}</strong>
    {data.kind === 'image' && url && <img className="wf-node-image-preview" src={url} alt="" />}
    <small>{data.kind === 'image' ? (data.modelId || '图片模型') : data.kind === 'prompt' ? (data.prompt || '未配置提示词') : data.kind === 'input' ? (data.value || '未配置输入') : (data.result || '等待上游结果')}</small>
    {data.kind !== 'output' && <Handle type="source" position={Position.Right} />}
  </div>;
}
const nodeTypes = { weavia: WeaviaNode };

function topological(nodes: WFNode[], edges: Edge[]): WFNode[][] {
  const incoming = new Map(nodes.map(node => [node.id, 0]));
  const outgoing = new Map(nodes.map(node => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (!incoming.has(edge.source) || !incoming.has(edge.target)) continue;
    incoming.set(edge.target, (incoming.get(edge.target) || 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }
  let ready = nodes.filter(node => incoming.get(node.id) === 0);
  const layers: WFNode[][] = [];
  const seen = new Set<string>();
  while (ready.length) {
    layers.push(ready);
    const next: WFNode[] = [];
    for (const node of ready) {
      seen.add(node.id);
      for (const id of outgoing.get(node.id) || []) {
        const count = (incoming.get(id) || 0) - 1;
        incoming.set(id, count);
        if (count === 0) { const target = nodes.find(item => item.id === id); if (target) next.push(target); }
      }
    }
    ready = next;
  }
  if (seen.size !== nodes.length) throw new Error('工作流存在环，无法执行');
  return layers;
}

function sleep(ms: number) { return new Promise(resolve => window.setTimeout(resolve, ms)); }

export function WorkflowPage() {
  const { notify } = useApp();
  const [nodes, setNodes, onNodesChange] = useNodesState<WFNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<RunState>('idle');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState('商品主图工作流');
  const [saved, setSaved] = useState(false);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [pendingReview, setPendingReview] = useState<string | null>(null);
  const reviewResolve = useRef<null | (() => void)>(null);
  const [log, setLog] = useState<string[]>([]);
  const node = nodes.find(item => item.id === selected);
  const nodeTypesMemo = useMemo(() => nodeTypes, []);
  const onConnect = useCallback((connection: Connection) => setEdges(current => addEdge(connection, current)), [setEdges]);

  function patchNode(id: string, patch: Partial<WFData>) {
    setNodes(current => current.map(item => item.id === id ? { ...item, data: { ...item.data, ...patch } } : item));
  }
  function add(kind: Kind) {
    const id = `${kind}-${crypto.randomUUID().slice(0, 6)}`;
    const label = kinds.find(item => item.kind === kind)?.label || '节点';
    setNodes(current => [...current, { id, type: 'weavia', position: { x: 120 + current.length * 24, y: 90 + current.length * 22 }, data: { label, kind, ...(kind === 'input' ? { value: '商品描述' } : kind === 'prompt' ? { prompt: '{{input}}' } : kind === 'condition' ? { condition: '商品' } : kind === 'image' ? { modelId: 'image-balanced' } : {}) } }]);
    notify(`${label}节点已添加`);
  }
  function snapshot() {
    return { nodes: nodes.map(item => ({ ...item, data: { ...item.data, run: 'idle' as RunState, result: undefined, error: undefined } })), edges };
  }
  async function saveRemote() {
    try {
      const record = await saveWorkflow(workflowId, workflowName, snapshot());
      setWorkflowId(record.id); setSaved(true); setWorkflows(current => [record, ...current.filter(item => item.id !== record.id)]); notify('工作流已保存到云端');
    } catch (error) { notify(error instanceof Error ? error.message : '保存失败'); }
  }
  async function loadRemote() {
    try {
      const items = await listWorkflows();
      setWorkflows(items);
      if (!items.length) { notify('还没有云端工作流'); return; }
      const record = items[0];
      applyRecord(record); notify(`已载入 ${record.name}`);
    } catch (error) { notify(error instanceof Error ? error.message : '载入失败'); }
  }
  async function removeWorkflow() {
    if (!workflowId) return;
    try { await deleteWorkflow(workflowId); setWorkflows(current => current.filter(item => item.id !== workflowId)); const next = workflows.find(item => item.id !== workflowId); if (next) applyRecord(next); else { setWorkflowId(null); setWorkflowName('未命名工作流'); setSaved(false); setRuns([]); } notify('工作流已删除'); }
    catch (error) { notify(error instanceof Error ? error.message : '删除失败'); }
  }
  function applyRecord(record: WorkflowRecord) {
    setWorkflowId(record.id); setWorkflowName(record.name);
    void listWorkflowRuns(record.id).then(setRuns).catch(() => setRuns([]));
    setNodes((record.graph.nodes || []) as WFNode[]); setEdges((record.graph.edges || []) as Edge[]); setStatus('idle'); setLog([]); setSaved(true);
  }
  useEffect(() => { void listWorkflows().then(items => { setWorkflows(items); if (items[0]) applyRecord(items[0]); }).catch(() => {}); }, []);
  function resetRuns() {
    setNodes(current => current.map(item => ({ ...item, data: { ...item.data, run: 'queued', result: undefined, error: undefined } })));
    setLog([]); setStatus('running');
  }

  function approveReview() { const resolve = reviewResolve.current; if (!resolve) return; reviewResolve.current = null; setPendingReview(null); setStatus('running'); resolve(); }

  async function waitFor(taskId: string): Promise<string> {
    for (let i = 0; i < 600; i++) {
      const task = useApp.getState().tasks.find(item => item.id === taskId);
      if (task?.status === 'Succeeded') return task.workId ? `作品 ${task.workId.slice(0, 8)}` : `任务 ${taskId.slice(0, 8)}`;
      if (task?.status === 'Failed' || task?.status === 'Cancelled') throw new Error(task.error || '图片节点生成失败');
      await sleep(500);
    }
    throw new Error('图片节点等待超时');
  }

  async function executeNode(current: WFNode, inputs: string[]): Promise<string> {
    const data = current.data;
    if (data.kind === 'input') return data.value || '';
    if (data.kind === 'output') return inputs[0] || '';
    if (data.kind === 'review') return new Promise<string>(resolve => { setPendingReview(current.id); setStatus('waiting'); reviewResolve.current = () => resolve(inputs.join('\n')); });
    if (data.kind === 'prompt') return (data.prompt || '{{input}}').replace(/\{\{input\}\}/g, inputs.join('\n')) || inputs.join('\n');
    if (data.kind === 'condition') { const text = inputs.join('\n'); const keyword = (data.condition || '').trim(); if (keyword && !text.includes(keyword)) throw new Error(`__SKIP__条件不满足：${keyword}`); return text; }
    const prompt = inputs.filter(Boolean).join('\n') || data.prompt || '';
    if (!prompt.trim()) throw new Error('图片节点没有提示词');
    const taskId = await createTask({ prompt, mode: 'image', modelId: data.modelId || 'image-balanced', params: { ratio: '1:1', resolution: '1K', count: 1, promptExtend: true, size: '1024x1024', outputFormat: 'png' } });
    const result = await waitFor(taskId);
    return result;
  }

  async function execute() {
    if (!nodes.length) { notify('请先添加节点'); return; }
    let layers: WFNode[][];
    try { layers = topological(nodes, edges); } catch (error) { setStatus('error'); notify(error instanceof Error ? error.message : 'DAG 校验失败'); return; }
    resetRuns();
    let runId = '';
    let activeWorkflowId = workflowId;
    try {
      if (!activeWorkflowId) { const record = await saveWorkflow(null, workflowName, snapshot()); activeWorkflowId = record.id; setWorkflowId(record.id); setSaved(true); }
      const run = await startWorkflowRun(activeWorkflowId, snapshot()); runId = run.id;
    } catch (error) { setStatus('error'); notify(error instanceof Error ? error.message : '无法创建运行记录'); return; }
    const outputs = new Map<string, string>();
    const started = Date.now();
    try {
      for (const layer of layers) {
        await Promise.all(layer.map(async current => {
          const upstream = edges.filter(edge => edge.target === current.id);
          if (upstream.some(edge => !outputs.has(edge.source))) { patchNode(current.id, { run: 'skipped', result: '上游条件未通过' }); setLog(lines => [...lines, `○ ${current.data.label} · 已跳过`]); return; }
          patchNode(current.id, { run: 'running' });
          try {
            const inputs = upstream.map(edge => outputs.get(edge.source) || '').filter(Boolean);
            const result = await executeNode(current, inputs);
            outputs.set(current.id, result);
            const task = useApp.getState().tasks.find(item => result.endsWith(item.id.slice(0, 8)) || result.endsWith(item.workId?.slice(0, 8) || ''));
            const work = task?.workId ? useApp.getState().works.find(item => item.id === task.workId) : undefined;
            patchNode(current.id, { run: 'success', result, assetId: work?.versions.at(-1)?.assetId });
            setLog(lines => [...lines, `✓ ${current.data.label} · ${result}`]);
          } catch (error) {
            const message = error instanceof Error ? error.message : '执行失败';
            if (message.startsWith('__SKIP__')) { patchNode(current.id, { run: 'skipped', result: message.replace('__SKIP__', '') }); setLog(lines => [...lines, `○ ${current.data.label} · ${message.replace('__SKIP__', '')}`]); return; }
            patchNode(current.id, { run: 'error', error: message });
            setLog(lines => [...lines, `✗ ${current.data.label} · ${message}`]);
            throw error;
          }
        }));
      }
      setStatus('success');
      setLog(lines => [...lines, `完成 · ${layers.flat().length} 个节点 · ${((Date.now() - started) / 1000).toFixed(1)}s`]);
      notify('工作流执行完成');
      if (activeWorkflowId && runId) { await finishWorkflowRun(activeWorkflowId, runId, 'success', Object.fromEntries(outputs)); void listWorkflowRuns(activeWorkflowId).then(setRuns).catch(() => {}); }
    } catch (error) {
      setStatus('error');
      const message = error instanceof Error ? error.message : '工作流执行失败';
      if (activeWorkflowId && runId) { await finishWorkflowRun(activeWorkflowId, runId, 'failed', null, message).catch(() => {}); void listWorkflowRuns(activeWorkflowId).then(setRuns).catch(() => {}); }
      notify(message);
    }
  }

  return <div className="page workflow-page">
    <div className="page-header"><div><span className="home-eyebrow">Workflow Studio</span><h1>DAG 工作流</h1><p>连接节点，按依赖顺序执行；保存工作流图与每次运行记录。</p></div><div className="header-actions"><select className="workflow-select" aria-label="选择工作流" value={workflowId || ''} onChange={event => { const record = workflows.find(item => item.id === event.target.value); if (record) applyRecord(record); }}><option value="">新工作流</option>{workflows.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button variant="secondary" onClick={() => void loadRemote()}>刷新</Button><Button variant="ghost" onClick={() => void removeWorkflow()} disabled={!workflowId}>删除</Button><Button variant="secondary" onClick={() => void saveRemote()}><Save size={15} /> 保存</Button>{pendingReview && <Button onClick={approveReview}>通过审核并继续</Button>}<Button onClick={() => void execute()} disabled={status === 'running' || status === 'waiting'}><Play size={15} /> {status === 'running' ? '运行中…' : status === 'waiting' ? '等待审核' : '运行 DAG'}</Button></div></div>
    <div className="workflow-layout">
      <Card className="node-library"><h2>节点库</h2><p className="node-library-hint">添加节点后拖动连接</p>{kinds.map(item => <button type="button" key={item.kind} onClick={() => add(item.kind)}><Plus size={15} /><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>)}<div className="workflow-legend"><span><i className="legend-dot queued" />待执行</span><span><i className="legend-dot running" />执行中</span><span><i className="legend-dot success" />成功</span><span><i className="legend-dot error" />失败</span><span><i className="legend-dot skipped" />跳过</span></div></Card>
      <div className="flow-canvas" aria-label="工作流画布"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypesMemo} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={(_, next) => setSelected(next.id)} fitView><Background gap={22} size={1} /><MiniMap /><Controls /></ReactFlow></div>
      <Card className="node-inspector"><div className="workflow-name-row"><input aria-label="工作流名称" value={workflowName} onChange={event => { setWorkflowName(event.target.value); setSaved(false); }} /><Badge tone={saved ? 'success' : 'neutral'}>{saved ? '已保存' : '未保存'}</Badge></div><h2>节点参数</h2>{node ? <><div className="wf-inspector-kind"><Badge>{kinds.find(item => item.kind === node.data.kind)?.label}</Badge><small>{node.id}</small></div><Field label="节点名称"><input value={node.data.label} onChange={event => patchNode(node.id, { label: event.target.value })} /></Field>{node.data.kind === 'input' && <Field label="输入内容"><textarea rows={4} value={node.data.value || ''} onChange={event => patchNode(node.id, { value: event.target.value })} placeholder="商品名或创作要求" /></Field>}{node.data.kind === 'prompt' && <Field label="提示词模板"><textarea rows={5} value={node.data.prompt || ''} onChange={event => patchNode(node.id, { prompt: event.target.value })} placeholder="使用 {{input}} 引用上游内容" /></Field>}{node.data.kind === 'review' && <p className="muted">执行到此节点会暂停，等待你点击「通过审核并继续」。</p>}
      {node.data.kind === 'condition' && <Field label="继续条件"><input value={node.data.condition || ''} onChange={event => patchNode(node.id, { condition: event.target.value })} placeholder="上游内容包含此关键词才继续" /><small className="muted">不满足时只跳过下游节点，不判整个工作流失败。</small></Field>}
      {node.data.kind === 'image' && <Field label="图片模型"><select value={node.data.modelId || 'image-balanced'} onChange={event => patchNode(node.id, { modelId: event.target.value })}><option value="image-balanced">WEAVIA Pro</option><option value="image-detail">WEAVIA Detail</option></select></Field>}{node.data.result && <div className="wf-node-result"><small>最近结果</small><strong>{node.data.result}</strong></div>}{node.data.error && <p className="form-error" role="alert">{node.data.error}</p>}<Button variant="danger" onClick={() => { setNodes(current => current.filter(item => item.id !== node.id)); setEdges(current => current.filter(edge => edge.source !== node.id && edge.target !== node.id)); setSelected(null); }}><Trash2 size={15} /> 删除节点</Button></> : <StatePanel type="empty" title="选择节点" detail="单击画布中的节点查看参数。" />}
        <div className="execution-result"><h3>运行日志 <Badge tone={status === 'success' ? 'success' : status === 'error' ? 'danger' : status === 'running' ? 'info' : 'neutral'}>{status === 'success' ? '完成' : status === 'error' ? '失败' : status === 'running' ? '运行中' : '待运行'}</Badge></h3>{log.length ? <div className="wf-log">{log.map((line, index) => <p key={`${line}-${index}`} className={line.startsWith('✗') ? 'error' : line.startsWith('✓') ? 'success' : ''}>{line}</p>)}</div> : <p className="muted">运行后会显示每个节点的状态与结果。</p>}</div>
        <div className="workflow-run-history"><h3>最近运行 <Badge>{runs.length}</Badge></h3>{runs.length ? runs.slice(0, 5).map(run => <div key={run.id} className="workflow-run-row"><div><Badge tone={run.status === 'success' ? 'success' : run.status === 'failed' ? 'danger' : 'info'}>{run.status === 'success' ? '成功' : run.status === 'failed' ? '失败' : '运行中'}</Badge>{run.error && <small>{run.error}</small>}</div><span>{new Date(run.startedAt).toLocaleString('zh-CN')}</span></div>) : <p className="muted">还没有运行记录。</p>}</div>
      </Card>
    </div>
  </div>;
}

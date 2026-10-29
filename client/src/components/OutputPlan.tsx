import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Button, Dialog } from './ui';
import { createQuote } from '../services/quote';
import { defaultPlan, PLAN_PURPOSE_LABELS, planSizeFor, type PlanItem, type PlanPurpose } from '../services/plan';

type PlanKind = 'set3' | 'set5' | 'set7';
type QuoteStatus = 'pending' | 'success' | 'error';
type OutputPlanProps = {
  modelId: string;
  referenceAssetIds: string[];
  onClose: () => void;
  onConfirm: (items: PlanItem[]) => Promise<void>;
};

const RATIOS = ['1:1', '4:5', '3:4', '16:9', '9:16'];
const PURPOSES = Object.keys(PLAN_PURPOSE_LABELS) as PlanPurpose[];

function pendingStatuses(items: PlanItem[]): Record<string, QuoteStatus> {
  return Object.fromEntries(items.map(item => [item.id, 'pending' as const]));
}

export function OutputPlan({ modelId, referenceAssetIds, onClose, onConfirm }: OutputPlanProps) {
  const [kind, setKind] = useState<PlanKind>('set3');
  const [items, setItems] = useState<PlanItem[]>(() => defaultPlan('set3'));
  const [quoteStatuses, setQuoteStatuses] = useState<Record<string, QuoteStatus>>(() => pendingStatuses(defaultPlan('set3')));
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const quoteQueue = useRef<Promise<void>>(Promise.resolve());
  const quoteKey = JSON.stringify(items.map(({ id, purpose, prompt, size }) => ({ id, purpose, prompt, size })));
  const referenceKey = JSON.stringify(referenceAssetIds);
  const statusRef = useRef(quoteStatuses);
  useEffect(() => { statusRef.current = quoteStatuses; }, [quoteStatuses]);
  const pending = items.some(item => quoteStatuses[item.id] === 'pending');
  const missingPrompt = items.some(item => !item.prompt.trim());
  const totalCredits = items.reduce((total, item) => total + (quoteStatuses[item.id] === 'success' ? item.credits : 0), 0);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const rows = (JSON.parse(quoteKey) as Array<Pick<PlanItem, 'id' | 'prompt' | 'size'>>).filter(row => statusRef.current[row.id] === 'pending');
      if (!rows.length) return;
      const references = JSON.parse(referenceKey) as string[];
      const quoteRows = async () => {
        for (const [index, row] of rows.entries()) {
          if (cancelled) return;
          try {
            if (!modelId || !row.prompt.trim()) throw new Error('缺少模型或提示词');
            const quote = await createQuote({
              model: modelId,
              mode: references.length ? 'image_to_image' : 'text_to_image',
              prompt: row.prompt.trim(),
              size: row.size,
              numberOfImages: 1,
              referenceAssetIds: references,
            });
            if (cancelled) return;
            setItems(current => current.map(item => item.id === row.id ? { ...item, credits: quote.totalCredits } : item));
            setQuoteStatuses(current => ({ ...current, [row.id]: 'success' }));
          } catch {
            if (cancelled) return;
            setQuoteStatuses(current => ({ ...current, [row.id]: 'error' }));
          }
          if (index < rows.length - 1) await new Promise<void>(resolve => window.setTimeout(resolve, 200));
        }
      };
      quoteQueue.current = quoteQueue.current.then(quoteRows, quoteRows);
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [quoteKey, modelId, referenceKey]);

  function patchItem(id: string, patch: Partial<PlanItem>) {
    setItems(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
    setQuoteStatuses(current => ({ ...current, [id]: 'pending' }));
    setDirty(true);
  }

  function reorder(next: PlanItem[]) {
    setItems(next);
    setDirty(true);
  }

  function removeItem(id: string) {
    setItems(current => current.filter(item => item.id !== id));
    setQuoteStatuses(current => { const next = { ...current }; delete next[id]; return next; });
    setDirty(true);
  }

  function switchKind(next: PlanKind) {
    if (next === kind) return;
    if (dirty && !window.confirm('当前计划已编辑，切换张数会放弃这些修改。确定继续吗？')) return;
    const nextItems = defaultPlan(next);
    setKind(next);
    setItems(nextItems);
    setQuoteStatuses(pendingStatuses(nextItems));
    setDirty(false);
  }

  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    reorder(next);
  }

  async function confirm() {
    if (submitting || pending || missingPrompt || !modelId || !items.length) return;
    setSubmitting(true);
    try {
      await onConfirm(items);
    } finally {
      setSubmitting(false);
    }
  }

  return <Dialog title="商品套图产出计划" onClose={() => { if (!submitting) onClose(); }} wide>
    <div className="plan-dialog">
      <div className="plan-kind" role="group" aria-label="套图张数">
        {(['set3', 'set5', 'set7'] as const).map(value => <button type="button" key={value} className={kind === value ? 'plan-kind-active' : ''} aria-pressed={kind === value} disabled={submitting} onClick={() => switchKind(value)}>{value.slice(3)} 张</button>)}
      </div>
      <div className="plan-table-scroll">
        <table className="plan-table">
          <thead><tr><th scope="col">序号</th><th scope="col">用途</th><th scope="col">提示词</th><th scope="col">比例</th><th scope="col">单张 Credits</th><th scope="col">行操作</th></tr></thead>
          <tbody>{items.map((item, index) => <tr key={item.id}>
            <td className="plan-index">{index + 1}</td>
            <td><select aria-label={`第 ${index + 1} 张用途`} value={item.purpose} disabled={submitting} onChange={event => { const purpose = event.target.value as PlanPurpose; patchItem(item.id, { purpose, title: PLAN_PURPOSE_LABELS[purpose] }); }}>{PURPOSES.map(purpose => <option key={purpose} value={purpose}>{PLAN_PURPOSE_LABELS[purpose]}</option>)}</select></td>
            <td><textarea aria-label={`第 ${index + 1} 张提示词`} rows={2} value={item.prompt} disabled={submitting} onChange={event => patchItem(item.id, { prompt: event.target.value })} /></td>
            <td><select aria-label={`第 ${index + 1} 张比例`} value={item.ratio} disabled={submitting} onChange={event => patchItem(item.id, { ratio: event.target.value, size: planSizeFor(event.target.value) })}>{RATIOS.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}</select></td>
            <td className="plan-credits">{quoteStatuses[item.id] === 'pending' ? '计算中…' : quoteStatuses[item.id] === 'success' ? item.credits : '—'}</td>
            <td><div className="plan-row-actions"><button type="button" aria-label={`第 ${index + 1} 张上移`} title="上移" disabled={submitting || index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} aria-hidden="true" /></button><button type="button" aria-label={`第 ${index + 1} 张下移`} title="下移" disabled={submitting || index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} aria-hidden="true" /></button><button type="button" aria-label={`删除第 ${index + 1} 张`} title="删除" disabled={submitting || items.length === 1} onClick={() => removeItem(item.id)}><Trash2 size={15} aria-hidden="true" /></button></div></td>
          </tr>)}</tbody>
        </table>
      </div>
      <footer className="plan-footer">
        <div className="plan-summary"><strong>合计 {totalCredits} Credits</strong><span>预计时间约 {items.length * 30} 秒</span>{!modelId && <small role="alert">当前没有可用图片模型</small>}{pending && <small role="status">正在计算报价</small>}{missingPrompt && <small role="alert">请填写每张图片的提示词</small>}</div>
        <div className="plan-footer-actions"><Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>取消</Button><Button type="button" disabled={submitting || pending || missingPrompt || !modelId || !items.length} onClick={() => void confirm()}>{submitting ? '提交中…' : '确认并生成'}</Button></div>
      </footer>
    </div>
  </Dialog>;
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutTemplate, Search, Trash2 } from 'lucide-react';
import { Badge, Button, StatePanel } from '../components/ui';
import { FALLBACK_SHOWCASE, type ShowcaseItem } from '../data/showcase';
import { loadShowcase } from '../services/showcase';
import { deleteMyTemplate, hasPlaceholders, loadMyTemplates, type MyTemplate } from '../services/templates';
import { useAssetPreview } from '../hooks/useAssetPreview';
import { useApp } from '../stores/app';

type Tab = 'official' | 'mine';

function Cover({ item }: { item: ShowcaseItem | MyTemplate }) {
  const mine = 'source' in item ? item : undefined;
  const { url } = useAssetPreview(mine?.assetId, mine?.dataUrl);
  const src = item.imageUrl || url;
  return src ? <img src={src} alt={item.title} loading="lazy" /> : <span className="template-cover-empty"><LayoutTemplate size={28} aria-hidden="true" /></span>;
}

export function TemplatesPage() {
  const navigate = useNavigate();
  const { notify } = useApp();
  const [tab, setTab] = useState<Tab>('official');
  const [official, setOfficial] = useState<ShowcaseItem[]>(FALLBACK_SHOWCASE);
  const [mine, setMine] = useState<MyTemplate[]>(() => loadMyTemplates());
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('全部');

  useEffect(() => { void loadShowcase().then(setOfficial); }, []);

  const source: Array<ShowcaseItem | MyTemplate> = tab === 'official' ? [...official].sort((a, b) => (b.useCount || 0) - (a.useCount || 0)) : mine;
  const tags = useMemo(() => ['全部', ...Array.from(new Set(source.map(item => (item.tag || '').split(/[\s/·]+/)[0]).filter(Boolean)))].slice(0, 12), [source]);
  const term = query.trim().toLowerCase();
  const items = source.filter(item => (tag === '全部' || (item.tag || '').startsWith(tag)) && (!term || `${item.title} ${item.tag} ${item.prompt}`.toLowerCase().includes(term)));

  function use(item: ShowcaseItem | MyTemplate) {
    navigate('/', { state: { template: item } });
  }
  function remove(id: string) {
    deleteMyTemplate(id);
    setMine(loadMyTemplates());
    notify('已删除我的模板');
  }

  return <div className="page templates-page">
    <div className="page-header"><div><h1>模板库</h1><p>看中哪个点「做同款」，提示词和参数自动带入；模板里的 {'{商品名}'} {'{卖点}'} 会换成你选的商品。</p></div></div>
    <div className="templates-toolbar">
      <div className="segmented" role="tablist" aria-label="模板来源">
        <button type="button" role="tab" aria-selected={tab === 'official'} className={tab === 'official' ? 'selected' : ''} onClick={() => { setTab('official'); setTag('全部'); }}>官方模板 <small>{official.length}</small></button>
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'selected' : ''} onClick={() => { setTab('mine'); setTag('全部'); setMine(loadMyTemplates()); }}>我的模板 <small>{mine.length}</small></button>
      </div>
      <label className="search-box"><Search size={16} aria-hidden="true" /><input aria-label="搜索模板" placeholder="搜索标题、标签或提示词" value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>
    <div className="chip-row templates-tags">{tags.map(item => <button type="button" key={item} className={`skill-chip ${tag === item ? 'selected' : ''}`} onClick={() => setTag(item)}>{item}</button>)}</div>
    {items.length ? <div className="templates-grid">{items.map(item => <article key={item.id} className="template-card">
      <button type="button" className="template-cover" onClick={() => use(item)} aria-label={`做同款：${item.title}`}><Cover item={item} /><span className="showcase-use">做同款</span></button>
      <div className="template-body">
        <div className="template-title"><strong>{item.title}</strong>{item.useCount ? <small>{item.useCount} 人用过</small> : null}</div>
        <p>{item.prompt}</p>
        <div className="template-meta">{item.model && <Badge>{item.model}</Badge>}{item.ratio && <Badge>{item.ratio}</Badge>}{item.count && item.count > 1 ? <Badge>{item.count} 张</Badge> : null}{hasPlaceholders(item.prompt) && <Badge tone="info">含商品变量</Badge>}</div>
        <div className="template-actions"><Button onClick={() => use(item)}>做同款</Button>{'source' in item && <Button variant="ghost" aria-label="删除这个模板" onClick={() => remove(item.id)}><Trash2 size={15} /></Button>}</div>
      </div>
    </article>)}</div> : <StatePanel type="empty" title={tab === 'mine' ? '还没有我的模板' : '没有匹配的模板'} detail={tab === 'mine' ? '在作品中心打开一件满意的作品，点「存为我的模板」。' : '换个关键词或标签试试。'} action={tab === 'mine' ? <Button variant="secondary" onClick={() => navigate('/works')}>去作品中心</Button> : undefined} />}
  </div>;
}

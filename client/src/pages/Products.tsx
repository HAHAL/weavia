import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, Package, Pencil, Plus, Search, Sparkles } from 'lucide-react';
import { Badge, Button, Card, Dialog, Field, StatePanel } from '../components/ui';
import { useAssetPreview } from '../hooks/useAssetPreview';
import { importAsset } from '../services/assets';
import { useApp } from '../stores/app';
import type { Product } from '../types';

const categories = ['全部', '美妆', '服饰', '鞋履', '电子', '其他'];

function ProductPicture({ product }: { product: Product }) {
  const { url, missing } = useAssetPreview(product.sourceAssetId);
  return <div className="product-image">
    {url || product.image
      ? <img src={url || product.image} alt={`${product.name} 商品依据图`} />
      : <span className="product-image-empty"><Package size={32} aria-hidden="true" />{product.sourceAssetId ? (missing ? '依据图已删除' : '依据图暂不可预览') : '未添加依据图'}</span>}
  </div>;
}

export function Products() {
  const { products, assets, addProduct, addAsset, notify } = useApp();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('全部');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('美妆');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [verifiedFacts, setVerifiedFacts] = useState('');
  const [forbiddenClaims, setForbiddenClaims] = useState('');
  const [sourceAssetId, setSourceAssetId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const visible = products.filter(product =>
    (filter === '全部' || product.category === filter)
    && `${product.name} ${product.sku}`.toLowerCase().includes(search.toLowerCase())
  );
  const selectedAsset = assets.find(asset => asset.id === sourceAssetId);
  const sourcePreview = useAssetPreview(sourceAssetId);

  function open(product?: Product) {
    setEditing(product || null);
    setName(product?.name || '');
    setCategory(product?.category || '美妆');
    setSku(product?.sku || '');
    setDescription(product?.description || '');
    setVerifiedFacts(product?.verifiedFacts || '');
    setForbiddenClaims(product?.forbiddenClaims || '');
    setSourceAssetId(product?.sourceAssetId || '');
    setError('');
    setModal(true);
  }

  async function uploadSource(file?: File) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const asset = await importAsset(file);
      addAsset(asset);
      setSourceAssetId(asset.id);
      notify('商品依据图已加入素材中心');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '商品依据图导入失败');
    } finally {
      setUploading(false);
    }
  }

  function save() {
    if (!name.trim()) {
      setError('请填写商品名称');
      return;
    }
    if (uploading) return;
    const product: Product = {
      id: editing?.id || crypto.randomUUID(),
      name: name.trim(),
      category,
      sku: sku.trim(),
      description: description.trim(),
      verifiedFacts: verifiedFacts.trim(),
      forbiddenClaims: forbiddenClaims.trim(),
      sourceAssetId: sourceAssetId || undefined,
      createdAt: editing?.createdAt || new Date().toISOString(),
    };
    if (editing) {
      useApp.setState(state => ({ products: state.products.map(item => item.id === editing.id ? product : item) }));
      notify('商品已更新');
    } else {
      addProduct(product);
      notify('商品已创建');
    }
    setModal(false);
  }

  return <div className="page">
    <div className="page-header"><div><h1>商品库</h1><p>记录商品事实与依据图片，从商品发起创作。</p></div><Button onClick={() => open()}><Plus size={16} /> 创建商品</Button></div>
    <div className="filter-bar"><div className="search-box"><Search size={16} /><input aria-label="搜索商品" placeholder="搜索商品名称或 SKU" value={search} onChange={event => setSearch(event.target.value)} /></div><select aria-label="商品分类" value={filter} onChange={event => setFilter(event.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select><Badge>本地数据</Badge></div>
    {visible.length
      ? <div className="product-grid">{visible.map(product => <Card key={product.id} className="product-card">
        <ProductPicture product={product} />
        <div className="product-info"><Badge>{product.category}</Badge><h2>{product.name}</h2><p>SKU {product.sku}</p><small>{product.verifiedFacts || product.description || '尚未填写商品信息'}</small>
          <div className="card-actions"><Button variant="secondary" onClick={() => open(product)}><Pencil size={14} /> 编辑</Button><Button onClick={() => navigate('/', { state: { productId: product.id, prompt: `为 ${product.name} 生成商品主图`, mode: 'image' } })}><Sparkles size={14} /> 发起创作</Button></div>
        </div>
      </Card>)}</div>
      : <StatePanel type="empty" title={products.length ? '没有匹配的商品' : '还没有商品'} detail={products.length ? '试试其他搜索词或分类。' : '创建第一件商品，记录 SKU 与创作依据。'} action={!products.length ? <Button onClick={() => open()}>创建商品</Button> : undefined} />}
    <p className="footnote">商品与依据图保存在本机；云端商品和素材同步将在服务端对接后启用。</p>
    {modal && <Dialog title={editing ? '编辑商品' : '创建商品'} onClose={() => setModal(false)}>
      <div className="dialog-content form-stack">
        <Field label="商品名称"><input value={name} onChange={event => setName(event.target.value)} placeholder="例如 Signature 香水" /></Field>
        <details className="advanced-settings"><summary>商品档案与事实（选填）</summary><Field label="分类"><select value={category} onChange={event => setCategory(event.target.value)}>{categories.slice(1).map(value => <option key={value}>{value}</option>)}</select></Field>
        <Field label="SKU（选填）"><input value={sku} onChange={event => setSku(event.target.value)} placeholder="例如 PERFUME-001" /></Field>
        <Field label="描述"><textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="用途与创作背景" /></Field>
        <Field label="已核实的商品事实"><textarea value={verifiedFacts} onChange={event => setVerifiedFacts(event.target.value)} placeholder="例如瓶身为琥珀色玻璃，金色瓶盖，容量 50ml" /></Field>
        <Field label="不可添加的商品声明"><textarea value={forbiddenClaims} onChange={event => setForbiddenClaims(event.target.value)} placeholder="例如不要声称防水、纯手工或医用功效" /></Field>
        </details><Field label="商品依据图"><select value={sourceAssetId} onChange={event => setSourceAssetId(event.target.value)}><option value="">尚未选择</option>{assets.filter(asset => asset.category !== '作品').map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></Field>
        <div className="source-asset-picker"><Button variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}><ImagePlus size={16} />{uploading ? '导入中…' : '上传商品依据图'}</Button><input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => { void uploadSource(event.target.files?.[0]); event.target.value = ''; }} />{selectedAsset && <span>{selectedAsset.name}</span>}</div>
        {sourceAssetId && (sourcePreview.url ? <img className="source-asset-preview" src={sourcePreview.url} alt="所选商品依据图预览" /> : <p className="form-error">所选素材不可读取，请重新上传或选择。</p>)}
        <p className="field-hint">依据图上传后会保存在素材中心，可供其他商品复用；取消编辑不会删除素材。</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions"><Button variant="secondary" onClick={() => setModal(false)}>取消</Button><Button disabled={uploading} onClick={save}>保存商品</Button></div>
      </div>
    </Dialog>}
  </div>;
}

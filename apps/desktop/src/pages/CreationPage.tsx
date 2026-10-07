import { useEffect, useState } from 'react';
import { ArrowLeft, ImagePlus, Upload, WandSparkles } from 'lucide-react';
import { Badge, Button } from '@weavia/ui';
import { Link, useParams } from 'react-router-dom';
import type { GeneratedResult, LocalAsset, LocalTaskRecord } from '@weavia/shared';
import { AssetThumbnail } from '../components/AssetThumbnail';
import { localData, runMockModelWorkflow } from '../services/local-data';

const modelOptions = ['温雅', '利落', '自然'];
export function CreationPage({ kind }: { kind: 'model' | 'commercial' }) {
  const { projectId = '' } = useParams();
  const [assets, setAssets] = useState<LocalAsset[]>([]);
  const [selected, setSelected] = useState<string>();
  const [tasks, setTasks] = useState<LocalTaskRecord[]>([]);
  const [result, setResult] = useState<GeneratedResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const imported = assets.filter((asset) => asset.source === 'imported');
  const chosen = imported.find((asset) => asset.id === selected);
  const load = () =>
    void Promise.all([localData.listAssets(projectId), localData.listTasks(projectId)]).then(
      ([nextAssets, nextTasks]) => {
        setAssets(nextAssets);
        setTasks(nextTasks);
        setSelected(
          (current) => current ?? nextAssets.find((asset) => asset.source === 'imported')?.id,
        );
      },
    );
  useEffect(load, [projectId]);
  async function importAsset() {
    try {
      const asset = await localData.chooseAndImportAsset(projectId);
      if (asset) setSelected(asset.id);
      load();
    } catch (value) {
      setError(String(value));
    }
  }
  async function generate() {
    if (!chosen) return;
    setBusy(true);
    setError(undefined);
    const polling = setInterval(() => void localData.listTasks(projectId).then(setTasks), 25);
    try {
      setResult(await runMockModelWorkflow(projectId, chosen));
      load();
    } catch (value) {
      setError(String(value));
    } finally {
      clearInterval(polling);
      setBusy(false);
    }
  }
  if (kind === 'commercial')
    return (
      <div className="workspace-empty">
        <h2>AI 商拍将在后续阶段接入</h2>
        <p>Phase 1B 只实现 AI 模特 Mock Workflow。</p>
        <Link to={`/projects/${projectId}`}>返回项目</Link>
      </div>
    );
  const active = tasks[0];
  return (
    <div className="studio">
      <aside className="materials">
        <Link className="studio-back" to={`/projects/${projectId}`}>
          <ArrowLeft size={14} />
          项目
        </Link>
        <p className="panel-label">商品素材</p>
        <button className="upload-tile" onClick={() => void importAsset()}>
          <Upload size={19} />
          <strong>添加商品</strong>
          <span>JPG · PNG · WEBP</span>
        </button>
        <div className="material-list">
          {imported.map((asset) => (
            <button
              className={asset.id === selected ? 'selected' : ''}
              key={asset.id}
              onClick={() => setSelected(asset.id)}
            >
              <AssetThumbnail asset={asset} />
              <span>
                {asset.width} × {asset.height}
              </span>
            </button>
          ))}
        </div>
        <p className="local-note">原图复制到项目 assets/originals/</p>
      </aside>
      <section className="canvas">
        {chosen ? (
          <div className="selected-canvas">
            <AssetThumbnail asset={chosen} alt="已选商品" />
            <span>已选商品素材</span>
          </div>
        ) : (
          <div className="canvas-empty">
            <span>
              <ImagePlus />
            </span>
            <h1>添加一件商品，开始模特创作</h1>
            <p>选择本地商品图并运行 MockProvider。</p>
            <Button onClick={() => void importAsset()}>
              <Upload size={15} />
              添加商品图片
            </Button>
            <small>支持 PNG · JPG · JPEG · WEBP · 最大 20 MB</small>
          </div>
        )}
        {busy && (
          <div className="generation-progress">
            <strong>Mock AI 正在生成</strong>
            <progress max="100" value={active?.progress ?? 10} />
            <span>{active?.progress ?? 10}%</span>
          </div>
        )}
        {result && (
          <div className="generation-done">
            <strong>生成成功</strong>
            <span>{result.relativePath}</span>
          </div>
        )}
        {error && <p className="local-error">{error}</p>}
      </section>
      <aside className="parameters">
        <div className="parameters-scroll">
          <p className="panel-label">创作参数</p>
          <div className="field">
            <label>选择模特</label>
            <div className="option-grid">
              {modelOptions.map((option, index) => (
                <button className={index === 0 ? 'selected' : ''} key={option}>
                  <span className={`option-visual option-${index}`} />
                  {option}
                  {index === 0 && <Badge tone="accent">推荐</Badge>}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>姿势</label>
            <div className="segments">
              <button className="active">自动</button>
              <button>站立</button>
              <button>行走</button>
            </div>
          </div>
          <div className="field split">
            <div>
              <label>比例</label>
              <select>
                <option>3:4</option>
              </select>
            </div>
            <div>
              <label>质量</label>
              <select>
                <option>标准</option>
              </select>
            </div>
          </div>
        </div>
        <footer className="generate-footer">
          <div>
            <span>执行模式</span>
            <strong>Local Mock</strong>
          </div>
          <Button disabled={!chosen || busy} onClick={() => void generate()}>
            <WandSparkles size={15} />
            {busy ? '生成中…' : '开始生成'}
          </Button>
          <small>不会调用真实 AI 或消耗 Credits</small>
        </footer>
      </aside>
    </div>
  );
}

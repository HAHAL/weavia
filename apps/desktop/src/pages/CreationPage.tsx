import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ImagePlus, Star, Upload, WandSparkles } from 'lucide-react';
import { Badge, Button } from '@weavia/ui';
import { Link, useParams } from 'react-router-dom';
import type {
  AIEstimateResult,
  AIModelCatalogItem,
  GeneratedResult,
  GenerationQualityLevel,
  LocalAsset,
  LocalTaskRecord,
  PromptTemplate,
  Quality,
} from '@weavia/shared';
import { AssetThumbnail } from '../components/AssetThumbnail';
import { localData, runMockModelWorkflow } from '../services/local-data';
import {
  estimateCloudGeneration,
  loadCloudGenerationOptions,
  resumePendingDeliveries,
  runCloudImageWorkflow,
  type CloudGenerationStage,
} from '../services/cloud-ai';

const modelOptions = ['温雅', '利落', '自然'];
export function CreationPage({ kind }: { kind: 'model' | 'commercial' }) {
  const { projectId = '' } = useParams();
  const [assets, setAssets] = useState<LocalAsset[]>([]);
  const [selected, setSelected] = useState<string>();
  const [tasks, setTasks] = useState<LocalTaskRecord[]>([]);
  const [result, setResult] = useState<GeneratedResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [mode] = useState<'mock' | 'cloud'>('mock');
  const [stage, setStage] = useState<CloudGenerationStage>();
  const [models, setModels] = useState<AIModelCatalogItem[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [professionalAccess, setProfessionalAccess] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [qualityLevel, setQualityLevel] = useState<GenerationQualityLevel>('standard');
  const [model, setModel] = useState('qwen-image-2.0');
  const [templateId, setTemplateId] = useState('fashion-brand-ad');
  const [estimate, setEstimate] = useState<AIEstimateResult>();
  const imported = assets.filter((asset) => asset.source === 'imported');
  const chosen = imported.find((asset) => asset.id === selected);
  const automaticModelId = modelForQuality(qualityLevel, models);
  const selectedModelId = advanced ? model : automaticModelId;
  const load = useCallback(
    () =>
      void Promise.all([localData.listAssets(projectId), localData.listTasks(projectId)]).then(
        ([nextAssets, nextTasks]) => {
          setAssets(nextAssets);
          setTasks(nextTasks);
          setSelected(
            (current) =>
              current ??
              nextAssets.find((asset) => asset.role === 'REFERENCE_IMAGE')?.id ??
              nextAssets.find((asset) => asset.source === 'imported')?.id,
          );
        },
      ),
    [projectId],
  );
  useEffect(() => {
    load();
    void resumePendingDeliveries(projectId).then(load);
  }, [load, projectId]);
  useEffect(() => {
    if (mode !== 'cloud') return;
    void loadCloudGenerationOptions()
      .then(({ catalog, templates: nextTemplates }) => {
        setModels(catalog.models.filter((item) => item.enabled));
        setProfessionalAccess(catalog.professionalAccess);
        setTemplates(nextTemplates);
      })
      .catch((value) => setError(friendlyError(value)));
  }, [mode]);
  useEffect(() => {
    if (mode !== 'cloud' || !selectedModelId) return;
    void estimateCloudGeneration(
      kind === 'model' ? 'ai_model' : 'ai_commercial',
      selectedModelId,
      advanced,
    )
      .then(setEstimate)
      .catch((value) => setError(friendlyError(value)));
  }, [advanced, kind, mode, selectedModelId]);
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
    const template = templates.find((item) => item.id === templateId);
    if (mode === 'cloud' && (!estimate || !template)) {
      setError('生成参数尚未准备完成');
      return;
    }
    if (
      mode === 'cloud' &&
      !window.confirm(
        `确认生成？\n本次预计消耗 ${estimate!.credits} Credits\n预计时间 ${estimate!.estimatedTime} 秒`,
      )
    )
      return;
    setBusy(true);
    setError(undefined);
    const polling = setInterval(() => void localData.listTasks(projectId).then(setTasks), 25);
    try {
      setResult(
        mode === 'cloud'
          ? await runCloudImageWorkflow(
              projectId,
              chosen,
              kind === 'model' ? 'ai_model' : 'ai_commercial',
              setStage,
              {
                model: selectedModelId,
                prompt: template!.prompt,
                quality: qualityForLevel(qualityLevel),
                credits: estimate!.credits,
                advancedModelSelection: advanced,
              },
            )
          : await runMockModelWorkflow(projectId, chosen),
      );
      load();
    } catch (value) {
      setError(friendlyError(value));
    } finally {
      clearInterval(polling);
      setBusy(false);
    }
  }
  async function setReference(assetId: string) {
    try {
      await localData.setAssetRole(assetId, 'REFERENCE_IMAGE');
      setSelected(assetId);
      load();
    } catch (value) {
      setError(String(value));
    }
  }
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
              onContextMenu={(event) => {
                event.preventDefault();
                void setReference(asset.id);
              }}
              title="右键设为商品参考图"
            >
              <AssetThumbnail asset={asset} />
              {asset.role === 'REFERENCE_IMAGE' && (
                <strong className="reference-label">⭐ 商品参考图</strong>
              )}
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
            <span>{chosen.role === 'REFERENCE_IMAGE' ? '⭐ 商品参考图' : '已选商品素材'}</span>
            {chosen.role !== 'REFERENCE_IMAGE' && (
              <Button className="set-reference-action" onClick={() => void setReference(chosen.id)}>
                <Star size={14} />
                设为商品参考图
              </Button>
            )}
          </div>
        ) : (
          <div className="canvas-empty">
            <span>
              <ImagePlus />
            </span>
            <h1>添加一件商品，开始{kind === 'model' ? '模特' : '商拍'}创作</h1>
            <p>选择本地商品图并创建持久化生成任务。</p>
            <Button onClick={() => void importAsset()}>
              <Upload size={15} />
              添加商品图片
            </Button>
            <small>支持 PNG · JPG · JPEG · WEBP · 最大 20 MB</small>
          </div>
        )}
        {busy && (
          <div className="generation-progress">
            <strong>{mode === 'cloud' ? stageLabel(stage) : 'Mock AI 正在生成'}</strong>
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
          <div className="reference-summary">
            <span>商品</span>
            <strong>{chosen?.fileName ?? '未选择'}</strong>
            <span>参考图</span>
            <strong>{chosen?.role === 'REFERENCE_IMAGE' ? '已选择' : '未设置'}</strong>
          </div>
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
              <label>生成质量</label>
              <select
                value={qualityLevel}
                onChange={(event) => setQualityLevel(event.target.value as GenerationQualityLevel)}
              >
                <option value="fast">快速</option>
                <option value="standard">标准</option>
                <option value="professional">专业</option>
                <option value="flagship">旗舰</option>
              </select>
            </div>
          </div>
          {mode === 'cloud' && (
            <div className="field beta-generation-options">
              <label>创作模板</label>
              <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                {templates.map((template) => (
                  <option value={template.id} key={template.id}>
                    {template.category} · {template.scene}
                  </option>
                ))}
              </select>
              {professionalAccess && (
                <label className="advanced-toggle">
                  <input
                    type="checkbox"
                    checked={advanced}
                    onChange={(event) => setAdvanced(event.target.checked)}
                  />
                  专业模式：显示高级模型选择
                </label>
              )}
              {advanced && (
                <select value={model} onChange={(event) => setModel(event.target.value)}>
                  {models.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} · {item.creditsCost} Credits
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
        <footer className="generate-footer">
          <div className="segments generation-mode">
            <button className="active" type="button">
              Local Mock
            </button>
            <span className="future-provider">AI Provider · 即将接入</span>
          </div>
          <div>
            <span>{mode === 'cloud' ? '本次预计消耗' : '执行模式'}</span>
            <strong>
              {mode === 'cloud' ? `${estimate?.credits ?? '—'} Credits` : 'Local Mock'}
            </strong>
            {mode === 'cloud' && <small>预计 {estimate?.estimatedTime ?? '—'} 秒</small>}
          </div>
          <Button
            disabled={!chosen || busy || (mode === 'cloud' && chosen.role !== 'REFERENCE_IMAGE')}
            onClick={() => void generate()}
          >
            <WandSparkles size={15} />
            {busy ? '生成中…' : '开始生成'}
          </Button>
          <small>
            {mode === 'cloud'
              ? '通过 WEAVIA Cloud 安全调用；一次生成 1 张'
              : '不会调用真实 AI 或消耗 Credits'}
          </small>
        </footer>
      </aside>
    </div>
  );
}

function qualityForLevel(level: GenerationQualityLevel): Quality {
  return level === 'fast' ? 'fast' : level === 'standard' ? 'standard' : 'high';
}

function modelForQuality(level: GenerationQualityLevel, models: AIModelCatalogItem[]) {
  const target =
    level === 'fast' || level === 'standard'
      ? 'qwen-image-2.0'
      : level === 'professional'
        ? 'qwen-image-max'
        : 'qwen-image-edit-plus';
  return models.find((item) => item.id === target)?.id ?? models.at(-1)?.id ?? '';
}

function stageLabel(stage?: CloudGenerationStage) {
  return {
    preparing: '准备素材',
    submitting: '提交任务',
    generating: 'AI 生成中',
    downloading: '下载结果',
    saving: '保存到本地',
    complete: '完成',
  }[stage ?? 'preparing'];
}

function friendlyError(value: unknown) {
  const code = typeof value === 'object' && value && 'code' in value ? String(value.code) : '';
  const messages: Record<string, string> = {
    AUTH_FAILED: '登录已失效，请重新登录 WEAVIA。',
    INVALID_TOKEN: '请先登录 WEAVIA 后再使用专业生成。',
    CONCURRENCY_LIMIT: '已有专业生成任务正在运行，请稍后再试。',
    REAL_AI_DISABLED: '专业生成尚未启用，请联系开发管理员配置服务。',
    PROVIDER_UNAVAILABLE: '专业生成服务尚未就绪。',
    PROVIDER_RATE_LIMITED: '生成服务繁忙，请稍后再试。',
    CONTENT_REJECTED: '当前创作内容未通过模型安全检查。',
    UNSUPPORTED_CAPABILITY: '当前真实模型尚未开放已验证的参考图生成接口。',
  };
  return messages[code] ?? (value instanceof Error ? value.message : String(value));
}

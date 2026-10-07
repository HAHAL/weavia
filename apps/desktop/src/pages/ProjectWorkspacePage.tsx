import { useEffect, useState } from 'react';
import { ArrowRight, Camera, ImagePlus, ListChecks, Sparkles } from 'lucide-react';
import { Badge, Button, PageHeader } from '@weavia/ui';
import { Link, useParams } from 'react-router-dom';
import type { GeneratedResult, LocalAsset, LocalProject, LocalTaskRecord } from '@weavia/shared';
import { localData } from '../services/local-data';
import { AssetThumbnail } from '../components/AssetThumbnail';

export function ProjectWorkspacePage() {
  const { projectId = '' } = useParams();
  const [project, setProject] = useState<LocalProject>();
  const [assets, setAssets] = useState<LocalAsset[]>([]);
  const [tasks, setTasks] = useState<LocalTaskRecord[]>([]);
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [error, setError] = useState<string>();
  const load = () => {
    void Promise.all([
      localData.openProject(projectId),
      localData.listAssets(projectId),
      localData.listTasks(projectId),
      localData.listResults(projectId),
    ])
      .then(([p, a, t, r]) => {
        setProject(p);
        setAssets(a);
        setTasks(t);
        setResults(r);
      })
      .catch((value) => setError(String(value)));
  };
  useEffect(load, [projectId]);
  async function importAsset() {
    try {
      await localData.chooseAndImportAsset(projectId);
      load();
    } catch (value) {
      setError(String(value));
    }
  }
  if (!project) return <p className="local-loading">{error ?? '正在打开项目…'}</p>;
  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="PROJECT WORKSPACE"
        title={project.name}
        description={project.description || '本地素材、AI 任务与生成结果。'}
        action={
          <Button onClick={() => void importAsset()}>
            <ImagePlus size={15} />
            导入商品图片
          </Button>
        }
      />
      {error && <p className="local-error">{error}</p>}
      <nav className="workspace-actions">
        <Link to={`/projects/${projectId}/create/model`}>
          <Sparkles />
          AI 模特 <ArrowRight />
        </Link>
        <Link to={`/projects/${projectId}/create/commercial`}>
          <Camera />
          AI 商拍 <ArrowRight />
        </Link>
        <Link to={`/projects/${projectId}/tasks`}>
          <ListChecks />
          项目任务 <Badge>{tasks.length}</Badge>
        </Link>
      </nav>
      <section className="workspace-section">
        <div className="section-title">
          <h2>素材</h2>
          <span>{assets.length} 项</span>
        </div>
        {assets.length ? (
          <div className="asset-grid">
            {assets.map((asset) => (
              <article key={asset.id}>
                <div className="asset-preview">
                  <AssetThumbnail asset={asset} />
                </div>
                <strong>{asset.source === 'generated' ? '生成结果' : '导入素材'}</strong>
                <small>
                  {asset.width} × {asset.height} · {(asset.fileSize / 1024).toFixed(1)} KB
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className="workspace-empty">导入 PNG、JPG 或 WEBP 商品图片开始创作。</p>
        )}
      </section>
      <section className="workspace-section">
        <div className="section-title">
          <h2>生成结果</h2>
          <span>{results.length} 项</span>
        </div>
        {results.length ? (
          <div className="asset-grid">
            {results.map((result) => {
              const asset = assets.find((item) => item.id === result.assetId);
              const task = tasks.find((item) => item.id === result.taskId);
              const workflowName = task?.workflow === 'ai_commercial' ? 'AI 商拍' : 'AI 模特';
              const modeName = task?.input.logicalModel ? 'WEAVIA 专业' : 'Local Mock';
              return (
                <article key={result.id}>
                  <div className="asset-preview">
                    {asset && <AssetThumbnail asset={asset} alt={`${workflowName}生成结果`} />}
                  </div>
                  <strong>
                    {workflowName} · {modeName}
                  </strong>
                  <small>{result.relativePath}</small>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="workspace-empty">
            运行 AI 工作流后，生成文件会保存在 generated/images/。
          </p>
        )}
      </section>
    </div>
  );
}

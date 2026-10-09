import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import { Button, PageHeader } from '@weavia/ui';
import { Link } from 'react-router-dom';
import type { GeneratedResult, LocalAsset, LocalProject, LocalTaskRecord } from '@weavia/shared';
import { AssetThumbnail } from '../components/AssetThumbnail';
import { localData } from '../services/local-data';

interface ResultItem {
  project: LocalProject;
  result: GeneratedResult;
  asset: LocalAsset;
  task?: LocalTaskRecord;
}

export function ResultCenterPage() {
  const [items, setItems] = useState<ResultItem[]>([]);
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    try {
      const projects = await localData.listProjects();
      const groups = await Promise.all(
        projects.map(async (project) => {
          const [results, assets, tasks] = await Promise.all([
            localData.listResults(project.id),
            localData.listAssets(project.id),
            localData.listTasks(project.id),
          ]);
          return results.flatMap((result) => {
            const asset = assets.find((candidate) => candidate.id === result.assetId);
            if (!asset) return [];
            const task = tasks.find((candidate) => candidate.id === result.taskId);
            return [{ project, result, asset, ...(task ? { task } : {}) }];
          });
        }),
      );
      setItems(groups.flat().sort((a, b) => b.result.createdAt.localeCompare(a.result.createdAt)));
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function download(item: ResultItem) {
    const dataUrl = await localData.assetDataUrl(item.asset.id);
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = item.asset.fileName;
    anchor.click();
  }
  async function remove(item: ResultItem) {
    if (!window.confirm(`删除作品“${item.asset.fileName}”？此操作会删除本地生成文件。`)) return;
    await localData.deleteResult(item.result.id);
    await load();
  }

  return (
    <div className="result-center-page">
      <PageHeader
        eyebrow="LOCAL-FIRST GALLERY"
        title="作品中心"
        description="查看、下载、删除或基于原商品重新生成。作品只保存在本机项目目录。"
      />
      {error && <p className="local-error">{error}</p>}
      {items.length ? (
        <div className="result-center-grid">
          {items.map((item) => (
            <article key={item.result.id}>
              <div className="asset-preview">
                <AssetThumbnail asset={item.asset} alt="AI 生成作品" />
              </div>
              <div>
                <strong>{item.project.name}</strong>
                <small>
                  {String(item.task?.input.model ?? 'Local Mock')} ·{' '}
                  {String(item.task?.input.credits ?? 0)} Credits
                </small>
                <small>{new Date(item.result.createdAt).toLocaleString('zh-CN')}</small>
              </div>
              <footer>
                <Button variant="secondary" onClick={() => void download(item)}>
                  <Download size={14} /> 下载
                </Button>
                <Link to={`/projects/${item.project.id}/create/commercial`}>
                  <RefreshCw size={14} /> 重新生成
                </Link>
                <button className="result-delete" onClick={() => void remove(item)}>
                  <Trash2 size={14} /> 删除
                </button>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <p className="workspace-empty">暂无作品。完成一次 AI 商拍后会自动出现在这里。</p>
      )}
    </div>
  );
}

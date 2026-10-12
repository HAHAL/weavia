import { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { PageHeader } from '@weavia/ui';
import { Link } from 'react-router-dom';
import type { LocalAsset, LocalProject } from '@weavia/shared';
import { AssetThumbnail } from '../components/AssetThumbnail';
import { localData } from '../services/local-data';

export function AssetsPage() {
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [assets, setAssets] = useState<LocalAsset[]>([]);
  const [projectId, setProjectId] = useState('all');
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void localData.listProjects()
      .then(async (nextProjects) => {
        const lists = await Promise.all(nextProjects.map((project) => localData.listAssets(project.id)));
        if (active) {
          setProjects(nextProjects);
          setAssets(lists.flat());
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(String(reason));
      });
    return () => { active = false; };
  }, []);

  const visible = projectId === 'all' ? assets : assets.filter((asset) => asset.projectId === projectId);
  return (
    <div className="assets-page">
      <PageHeader
        eyebrow="LOCAL ASSET LIBRARY"
        title="素材库"
        description="在本地项目中浏览已导入的商品图片与生成结果。"
      />
      <div className="assets-toolbar">
        <label>项目
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="all">全部项目</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <span>{visible.length} 项素材</span>
      </div>
      {error && <p className="local-error" role="alert">{error}</p>}
      {visible.length ? (
        <div className="asset-grid">
          {visible.map((asset) => (
            <Link className="asset-library-card" to={`/projects/${asset.projectId}`} key={asset.id}>
              <div className="asset-preview"><AssetThumbnail asset={asset} /></div>
              <strong>{asset.fileName}</strong>
              <small>{projects.find((project) => project.id === asset.projectId)?.name ?? '项目'} · {asset.source === 'generated' ? '生成结果' : '导入素材'}</small>
            </Link>
          ))}
        </div>
      ) : (
        <div className="page-card assets-empty">
          <ImagePlus size={28} />
          <h2>还没有素材</h2>
          <p>先创建项目，再从电脑导入 PNG、JPG 或 WEBP 图片。</p>
          <Link className="wv-button" to="/projects">前往项目</Link>
        </div>
      )}
    </div>
  );
}

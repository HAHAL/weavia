import { useEffect, useState } from 'react';
import { ArrowRight, Camera, FolderPlus, Sparkles } from 'lucide-react';
import { PageHeader } from '@weavia/ui';
import { Link } from 'react-router-dom';
import type { LocalProject } from '@weavia/shared';
import { localData } from '../services/local-data';

export function CreateTaskPage() {
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    void localData.listProjects().then(setProjects).catch((reason: unknown) => setError(String(reason)));
  }, []);
  return (
    <div className="create-task-page">
      <PageHeader
        eyebrow="CREATE A TASK"
        title="创建任务"
        description="选择一个本地项目，导入商品图片并运行 Demo 任务。"
      />
      {error && <p className="local-error" role="alert">{error}</p>}
      {projects.length ? (
        <div className="create-task-list">
          {projects.map((project) => (
            <article key={project.id}>
              <div><strong>{project.name}</strong><small>{project.assetCount} 项素材 · {project.taskCount} 个任务</small></div>
              <div className="create-task-links">
                <Link to={`/projects/${project.id}/create/model`}><Sparkles size={16} /> AI 模特 <ArrowRight size={14} /></Link>
                <Link to={`/projects/${project.id}/create/commercial`}><Camera size={16} /> AI 商拍 <ArrowRight size={14} /></Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="page-card assets-empty">
          <FolderPlus size={28} />
          <h2>先创建项目</h2>
          <p>任务和素材会保存在项目工作区内。</p>
          <Link className="wv-button" to="/projects">创建项目</Link>
        </div>
      )}
    </div>
  );
}

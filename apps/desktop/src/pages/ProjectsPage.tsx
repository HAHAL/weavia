import { useEffect, useState, type FormEvent } from 'react';
import { Button, EmptyState, PageHeader } from '@weavia/ui';
import { FolderOpen, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { LocalProject } from '@weavia/shared';
import { localData } from '../services/local-data';

export function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const load = () =>
    void localData
      .listProjects()
      .then(setProjects)
      .catch((value) => setError(String(value)));
  useEffect(load, []);
  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      const project = await localData.createProject(name);
      setName('');
      setCreating(false);
      navigate(`/projects/${project.id}`);
    } catch (value) {
      setError(String(value));
    }
  }
  async function rename(project: LocalProject) {
    const next = window.prompt('新的项目名称', project.name)?.trim();
    if (!next || next === project.name) return;
    try {
      await localData.updateProject(project.id, next, project.description);
      load();
    } catch (value) {
      setError(String(value));
    }
  }
  async function remove(project: LocalProject) {
    if (!window.confirm(`确认删除“${project.name}”？项目素材、任务和生成结果将一并永久删除。`))
      return;
    try {
      await localData.deleteProject(project.id);
      load();
    } catch (value) {
      setError(`删除失败：${String(value)}`);
    }
  }
  return (
    <div className="projects-page">
      <PageHeader
        eyebrow="LOCAL PROJECTS"
        title="项目"
        description="项目、素材和生成结果长期保存在你的电脑。"
        action={
          <Button onClick={() => setCreating(true)}>
            <FolderPlus size={15} />
            新建项目
          </Button>
        }
      />
      {creating && (
        <form className="project-create" onSubmit={create}>
          <label>
            项目名称
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：Test Product Project"
            />
          </label>
          <div>
            <Button type="submit" disabled={!name.trim()}>
              创建项目
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              取消
            </Button>
          </div>
        </form>
      )}
      {error && <p className="local-error">{error}</p>}
      {projects.length === 0 && !creating ? (
        <div className="page-card">
          <EmptyState
            title="暂无本地项目"
            description="创建第一个项目，WEAVIA 会建立标准目录并使用 SQLite 保存项目生命周期。"
            action={<Button onClick={() => setCreating(true)}>创建第一个项目</Button>}
          />
        </div>
      ) : (
        <div className="local-project-grid">
          {projects.map((project) => (
            <article className="local-project-card" key={project.id}>
              <button
                className="project-open"
                onClick={() =>
                  void localData
                    .openProject(project.id)
                    .then(() => navigate(`/projects/${project.id}`))
                }
              >
                <span className="project-folder">
                  <FolderOpen />
                </span>
                <strong>{project.name}</strong>
                <small>
                  {project.assetCount} 素材 · {project.taskCount} 任务 · {project.resultCount} 结果
                </small>
                <time>{new Date(project.lastOpenedAt).toLocaleString('zh-CN')}</time>
              </button>
              <div>
                <button aria-label="重命名" onClick={() => void rename(project)}>
                  <Pencil size={14} />
                </button>
                <button aria-label="删除" onClick={() => void remove(project)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

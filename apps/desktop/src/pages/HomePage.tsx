import { useEffect, useState } from 'react';
import { ArrowRight, FolderOpen, ImagePlus, Sparkles } from 'lucide-react';
import { Badge, Button, Card, PageHeader } from '@weavia/ui';
import { Link, useNavigate } from 'react-router-dom';
import type { LocalProject, LocalTaskRecord } from '@weavia/shared';
import { localData } from '../services/local-data';

export function HomePage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [tasks, setTasks] = useState<LocalTaskRecord[]>([]);
  useEffect(() => {
    void localData.listProjects().then(setProjects);
    void localData.listTasks().then(setTasks);
  }, []);
  const active = tasks.filter((task) => ['pending', 'queued', 'running'].includes(task.status));
  return (
    <div className="dashboard">
      <PageHeader
        eyebrow="LOCAL FIRST STUDIO"
        title="欢迎回来，今天开始创作什么？"
        description="从本地商品素材出发，建立下一组专业视觉。"
        action={
          <Button variant="secondary" onClick={() => navigate('/projects')}>
            <ImagePlus size={15} />
            新建项目
          </Button>
        }
      />
      <section className="quick-grid">
        <Link
          to={projects[0] ? `/projects/${projects[0].id}/create/model` : '/projects'}
          className="quick-card quick-model"
        >
          <div>
            <Badge>AI MODEL</Badge>
            <h2>AI 模特</h2>
            <p>在项目内选择商品素材并运行本地 Mock Workflow。</p>
          </div>
          <ArrowRight />
        </Link>
        <Link to="/projects" className="quick-card quick-commercial">
          <div>
            <Badge>LOCAL PROJECTS</Badge>
            <h2>项目工作区</h2>
            <p>管理素材、任务历史与本地生成结果。</p>
          </div>
          <FolderOpen />
        </Link>
      </section>
      <section className="section-title">
        <h2>最近项目</h2>
        <Link to="/projects">查看全部</Link>
      </section>
      {projects.length ? (
        <div className="project-grid">
          {projects.slice(0, 3).map((project, index) => (
            <Card className="project-card" key={project.id}>
              <Link to={`/projects/${project.id}`}>
                <div className={`project-cover cover-${index + 1}`}>
                  <span>{project.resultCount ? '已有生成结果' : '本地项目'}</span>
                </div>
                <div className="project-meta">
                  <div>
                    <strong>{project.name}</strong>
                    <span>
                      {project.assetCount} 个素材 · {project.taskCount} 个任务
                    </span>
                  </div>
                  <ArrowRight size={16} />
                </div>
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <div className="home-empty">
          <p>还没有本地项目。</p>
          <Link to="/projects">创建第一个项目</Link>
        </div>
      )}
      <section className="task-strip">
        <div>
          <span className="pulse">
            <Sparkles size={14} />
          </span>
          <p>
            <strong>
              {active.length
                ? `${active.length} 个任务正在处理`
                : `${tasks.length} 条持久化任务记录`}
            </strong>
            <small>任务历史保存在本地 SQLite</small>
          </p>
        </div>
        <Link to="/tasks">
          查看任务 <ArrowRight size={14} />
        </Link>
      </section>
    </div>
  );
}

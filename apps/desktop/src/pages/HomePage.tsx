import { ArrowRight, ImagePlus, MoreHorizontal, Sparkles } from 'lucide-react';
import { Badge, Button, Card, PageHeader } from '@weavia/ui';
import { Link } from 'react-router-dom';
const projects = [
  ['2026 秋季女装', '18 个素材', '柔和摄影棚'],
  ['香氛新品 Campaign', '12 个素材', '静物与材质'],
  ['包袋系列', '8 个素材', '城市通勤'],
];
export function HomePage() {
  return (
    <div className="dashboard">
      <PageHeader
        eyebrow="TUESDAY · OCT 6"
        title="欢迎回来，今天开始创作什么？"
        description="从商品素材出发，建立下一组专业视觉。"
        action={
          <Button variant="secondary">
            <ImagePlus size={15} /> 新建项目
          </Button>
        }
      />
      <section className="quick-grid">
        <Link to="/create/model" className="quick-card quick-model">
          <div>
            <Badge>AI MODEL</Badge>
            <h2>AI 模特</h2>
            <p>让商品自然穿在理想模特身上。</p>
          </div>
          <ArrowRight />
        </Link>
        <Link to="/create/commercial" className="quick-card quick-commercial">
          <div>
            <Badge>AI COMMERCIAL</Badge>
            <h2>AI 商拍</h2>
            <p>为商品生成专业商业摄影场景。</p>
          </div>
          <ArrowRight />
        </Link>
      </section>
      <section className="section-title">
        <h2>最近项目</h2>
        <Link to="/projects">查看全部</Link>
      </section>
      <div className="project-grid">
        {projects.map(([name, count, tone], i) => (
          <Card className="project-card" key={name}>
            <div className={`project-cover cover-${i + 1}`}>
              <span>{tone}</span>
            </div>
            <div className="project-meta">
              <div>
                <strong>{name}</strong>
                <span>{count} · 今天编辑</span>
              </div>
              <button aria-label="更多">
                <MoreHorizontal />
              </button>
            </div>
          </Card>
        ))}
      </div>
      <section className="task-strip">
        <div>
          <span className="pulse">
            <Sparkles size={14} />
          </span>
          <p>
            <strong>2 个任务正在生成</strong>
            <small>关闭客户端不会丢失已提交任务</small>
          </p>
        </div>
        <Link to="/tasks">
          查看任务 <ArrowRight size={14} />
        </Link>
      </section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Badge, PageHeader } from '@weavia/ui';
import { useParams } from 'react-router-dom';
import type { LocalTaskRecord } from '@weavia/shared';
import { localData } from '../services/local-data';

const labels: Record<string, string> = {
  pending: '等待中',
  queued: '等待中',
  uploading: '处理中',
  running: '处理中',
  downloading: '处理中',
  reconciling: '处理中',
  success: '生成完成',
  failed: '失败',
  cancelled: '已取消',
};
export function TasksPage() {
  const { projectId } = useParams();
  const [tasks, setTasks] = useState<LocalTaskRecord[]>([]);
  useEffect(() => {
    const load = () => void localData.listTasks(projectId).then(setTasks);
    load();
    const timer = setInterval(load, 1000);
    return () => clearInterval(timer);
  }, [projectId]);
  return (
    <>
      <PageHeader
        eyebrow="TASK ENGINE · SQLITE"
        title={projectId ? '项目任务' : '任务中心'}
        description="任务状态、进度、错误与结果均持久化在本地 SQLite。"
      />
      <div className="tasks-table">
        <div className="task-row local-task-head">
          <span>任务</span>
          <span>状态</span>
          <span>模型 / Credits</span>
          <span>进度 / 耗时</span>
          <span>结果 / 错误</span>
        </div>
        {tasks.length ? (
          tasks.map((task) => (
            <div className="task-row local-task-row" key={task.id}>
              <strong>{task.workflow === 'ai_model' ? 'AI 模特' : 'AI 商拍'}</strong>
              <Badge
                tone={
                  task.status === 'success'
                    ? 'success'
                    : task.status === 'failed'
                      ? 'error'
                      : task.status === 'running'
                        ? 'accent'
                        : 'neutral'
                }
              >
                {labels[task.status]}
              </Badge>
              <span>
                {String(task.input.model ?? task.input.logicalModel ?? 'Local Mock')} ·{' '}
                {String(task.input.credits ?? 0)} Credits
              </span>
              <span>
                {task.progress}% · {elapsedSeconds(task)}s
              </span>
              <small>{task.error?.message ?? (task.output ? '已保存本地结果' : '—')}</small>
            </div>
          ))
        ) : (
          <p className="workspace-empty">
            暂无任务。进入项目的 AI 模特工作区创建第一个 Mock Task。
          </p>
        )}
      </div>
    </>
  );
}

function elapsedSeconds(task: LocalTaskRecord) {
  const end = task.completedAt ?? task.updatedAt;
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(task.createdAt)) / 1000));
}

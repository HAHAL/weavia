import { Badge, PageHeader } from '@weavia/ui';
const tasks = [
  ['秋季连衣裙 · AI 模特', '正在生成 2 / 4', 'running', '刚刚'],
  ['香水礼盒 · AI 商拍', '队列中', 'queued', '2 分钟前'],
  ['针织开衫 · AI 模特', '已完成 4 张', 'success', '昨天'],
];
export function TasksPage() {
  return (
    <>
      <PageHeader
        eyebrow="TASK ENGINE"
        title="任务中心"
        description="统一查看 AI 模特、商拍及未来视频任务。"
      />
      <div className="tasks-table">
        <div className="task-row task-head">
          <span>任务</span>
          <span>状态</span>
          <span>更新时间</span>
          <span>费用</span>
        </div>
        {tasks.map(([name, status, tone, time]) => (
          <div className="task-row" key={name}>
            <strong>{name}</strong>
            <Badge
              tone={tone === 'success' ? 'success' : tone === 'running' ? 'accent' : 'neutral'}
            >
              {status}
            </Badge>
            <span>{time}</span>
            <span>{tone === 'success' ? '80' : '冻结中'}</span>
          </div>
        ))}
      </div>
    </>
  );
}

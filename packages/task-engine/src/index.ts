export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'uploading'
  | 'running'
  | 'downloading'
  | 'reconciling'
  | 'success'
  | 'failed'
  | 'cancelled';
export type TaskType =
  'ai_model' | 'ai_commercial' | 'image_generation' | 'image_edit' | 'image_to_video';
export interface TaskError {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}
export interface TaskProgress {
  current: number;
  total: number;
  message?: string;
}
export interface Task<TInput = unknown, TOutput = unknown> {
  id: string;
  type: TaskType;
  status: TaskStatus;
  input: TInput;
  output?: TOutput;
  error?: TaskError;
  progress?: TaskProgress;
  attempt: number;
  createdAt: string;
  updatedAt: string;
}
export interface TaskRepository {
  create<TInput>(task: Task<TInput>): Promise<void>;
  get<TInput = unknown, TOutput = unknown>(id: string): Promise<Task<TInput, TOutput> | undefined>;
  update<TInput, TOutput>(task: Task<TInput, TOutput>): Promise<void>;
  listActive(): Promise<Task[]>;
  listByProject?(projectId: string): Promise<Task[]>;
}
export interface TaskRunner<TInput = unknown, TOutput = unknown> {
  run(task: Task<TInput, TOutput>, signal: AbortSignal): Promise<TOutput>;
  cancel?(task: Task<TInput, TOutput>): Promise<void>;
}

const allowedTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['queued', 'cancelled'],
  queued: ['uploading', 'running', 'cancelled', 'failed'],
  uploading: ['running', 'failed', 'cancelled'],
  running: ['downloading', 'reconciling', 'success', 'failed', 'cancelled'],
  downloading: ['success', 'failed', 'reconciling'],
  reconciling: ['running', 'success', 'failed', 'cancelled'],
  success: [],
  failed: ['queued'],
  cancelled: [],
};
export function transitionTask<TInput, TOutput>(
  task: Task<TInput, TOutput>,
  status: TaskStatus,
): Task<TInput, TOutput> {
  if (!allowedTransitions[task.status].includes(status))
    throw new Error(`Invalid task transition: ${task.status} -> ${status}`);
  return { ...task, status, updatedAt: new Date().toISOString() };
}
export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, Task>();
  async create<TInput>(task: Task<TInput>): Promise<void> {
    if (this.tasks.has(task.id)) throw new Error(`Task exists: ${task.id}`);
    this.tasks.set(task.id, task);
  }
  async get<TInput = unknown, TOutput = unknown>(
    id: string,
  ): Promise<Task<TInput, TOutput> | undefined> {
    return this.tasks.get(id) as Task<TInput, TOutput> | undefined;
  }
  async update<TInput, TOutput>(task: Task<TInput, TOutput>): Promise<void> {
    this.tasks.set(task.id, task);
  }
  async listActive(): Promise<Task[]> {
    return [...this.tasks.values()].filter(
      (task) => !['success', 'failed', 'cancelled'].includes(task.status),
    );
  }
}
export class MockTaskRunner<TInput, TOutput> implements TaskRunner<TInput, TOutput> {
  constructor(private readonly outputFactory: (input: TInput) => TOutput | Promise<TOutput>) {}
  async run(task: Task<TInput, TOutput>, signal: AbortSignal): Promise<TOutput> {
    if (signal.aborted) throw new DOMException('Task cancelled', 'AbortError');
    return this.outputFactory(task.input);
  }
}

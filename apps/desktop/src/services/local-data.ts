import { invoke, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { MockProvider } from '@weavia/ai-core';
import type { GeneratedResult, LocalAsset, LocalProject, LocalTaskRecord } from '@weavia/shared';
import type { Task, TaskRepository } from '@weavia/task-engine';

export interface LocalDataInfo {
  rootPath: string;
  databasePath: string;
  schemaVersion: number;
}
const provider = new MockProvider();

function requireDesktop() {
  if (!isTauri()) throw new Error('本地数据功能需要在 WEAVIA Desktop 中使用');
}

export const localData = {
  async info() {
    requireDesktop();
    return invoke<LocalDataInfo>('get_local_data_info');
  },
  async listProjects() {
    if (!isTauri()) return [];
    return invoke<LocalProject[]>('list_local_projects');
  },
  async getProject(projectId: string) {
    requireDesktop();
    return invoke<LocalProject | null>('get_local_project', { projectId });
  },
  async createProject(name: string, description = '') {
    requireDesktop();
    return invoke<LocalProject>('create_local_project', { name, description });
  },
  async openProject(projectId: string) {
    requireDesktop();
    return invoke<LocalProject>('open_local_project', { projectId });
  },
  async updateProject(projectId: string, name: string, description = '') {
    requireDesktop();
    return invoke<LocalProject>('update_local_project', { projectId, name, description });
  },
  async deleteProject(projectId: string) {
    requireDesktop();
    await invoke('delete_local_project', { projectId });
  },
  async chooseAndImportAsset(projectId: string) {
    requireDesktop();
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: '商品图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (!selected) return undefined;
    return invoke<LocalAsset>('import_local_asset', { projectId, sourcePath: selected });
  },
  async listAssets(projectId: string) {
    if (!isTauri()) return [];
    return invoke<LocalAsset[]>('list_local_assets', { projectId });
  },
  async assetDataUrl(assetId: string) {
    requireDesktop();
    return invoke<string>('get_local_asset_data_url', { assetId });
  },
  async listTasks(projectId?: string) {
    if (!isTauri()) return [];
    return invoke<LocalTaskRecord[]>('list_local_tasks', { projectId: projectId ?? null });
  },
  async listResults(projectId: string) {
    if (!isTauri()) return [];
    return invoke<GeneratedResult[]>('list_local_results', { projectId });
  },
  async setSetting(key: string, value: unknown) {
    requireDesktop();
    await invoke('set_local_setting', { key, value });
  },
  async getSetting<T>(key: string) {
    if (!isTauri()) return undefined;
    return (await invoke<T | null>('get_local_setting', { key })) ?? undefined;
  },
};

export class SQLiteTaskRepository implements TaskRepository {
  private toRecord<TInput, TOutput>(task: Task<TInput, TOutput>): LocalTaskRecord {
    const input = task.input as TInput & { projectId?: string };
    if (!input || typeof input !== 'object' || !input.projectId) {
      throw new Error('SQLiteTaskRepository requires input.projectId');
    }
    return {
      id: task.id,
      projectId: input.projectId,
      workflow: task.type === 'ai_commercial' ? 'ai_commercial' : 'ai_model',
      status: task.status,
      input: task.input as Record<string, unknown>,
      ...(task.output ? { output: task.output as Record<string, unknown> } : {}),
      ...(task.error ? { error: { code: task.error.code, message: task.error.message } } : {}),
      progress: task.progress ? Math.round((task.progress.current / task.progress.total) * 100) : 0,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private fromRecord<TInput = unknown, TOutput = unknown>(
    record: LocalTaskRecord,
  ): Task<TInput, TOutput> {
    return {
      id: record.id,
      type: record.workflow,
      status: record.status,
      input: record.input as TInput,
      ...(record.output ? { output: record.output as TOutput } : {}),
      ...(record.error
        ? { error: { ...record.error, retryable: record.error.code === 'INTERRUPTED' } }
        : {}),
      progress: { current: record.progress, total: 100 },
      attempt: 1,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async create<TInput>(task: Task<TInput>) {
    await invoke('create_local_task', { task: this.toRecord(task) });
  }
  async get<TInput = unknown, TOutput = unknown>(id: string) {
    const record = await invoke<LocalTaskRecord | null>('get_local_task', { taskId: id });
    return record ? this.fromRecord<TInput, TOutput>(record) : undefined;
  }
  async update<TInput, TOutput>(task: Task<TInput, TOutput>) {
    await invoke('update_local_task', { task: this.toRecord(task) });
  }
  async listActive() {
    return (await localData.listTasks())
      .filter((task) => !['success', 'failed', 'cancelled'].includes(task.status))
      .map((task) => this.fromRecord(task));
  }
  async listByProject(projectId: string) {
    return (await localData.listTasks(projectId)).map((task) => this.fromRecord(task));
  }
}

export async function runMockModelWorkflow(projectId: string, asset: LocalAsset) {
  requireDesktop();
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const task: LocalTaskRecord = {
    id,
    projectId,
    workflow: 'ai_model',
    status: 'queued',
    input: { assetId: asset.id, quality: 'standard', aspectRatio: '3:4' },
    progress: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await invoke('create_local_task', { task });
  await provider.generateImage({
    capability: 'image_edit',
    modelId: 'mock-image-v1',
    imageUris: [asset.relativePath],
    quality: 'standard',
    aspectRatio: '3:4',
    outputCount: 1,
    idempotencyKey: id,
  });
  return invoke<GeneratedResult>('execute_local_mock_task', { taskId: id, assetId: asset.id });
}

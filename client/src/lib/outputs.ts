import type { Task, Work } from '../types';

/** 旧版本作品没有 outputIndex，按保存顺序推断为 0..n-1。 */
export function legacySavedIndexes(works: Work[], taskId: string): number[] {
  const related = works.filter(work => work.taskId === taskId);
  const explicit = related
    .map(work => work.outputIndex)
    .filter((value): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0);
  if (explicit.length) return [...new Set(explicit)].sort((a, b) => a - b);
  return related.map((_, index) => index);
}

/** 任务已保存的输出序号；优先用任务自身的记录，旧任务回退到作品推断。 */
export function savedIndexes(task: Task, works: Work[]): number[] {
  if (Array.isArray(task.savedOutputs)) {
    return [...new Set(task.savedOutputs.filter(value => Number.isInteger(value) && value >= 0))].sort((a, b) => a - b);
  }
  return legacySavedIndexes(works, task.id);
}

/** 服务端已有、本机还缺的输出序号。 */
export function missingIndexes(saved: number[], total: number): number[] {
  const have = new Set(saved);
  const missing: number[] = [];
  for (let index = 0; index < total; index += 1) {
    if (!have.has(index)) missing.push(index);
  }
  return missing;
}

export function isResultSaveFailure(code?: string): boolean {
  return code === 'RESULT_SAVE_FAILED' || code === 'RESULT_SAVE_INCOMPLETE';
}

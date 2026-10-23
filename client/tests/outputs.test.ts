import { describe, expect, it } from 'vitest';
import { isResultSaveFailure, legacySavedIndexes, missingIndexes, savedIndexes } from '../src/lib/outputs';
import { ANONYMOUS_SCOPE, currentScope, partitionKey, setScope } from '../src/stores/scope';
import type { Task, Work } from '../src/types';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: '商品主图',
    prompt: 'a product',
    mode: 'image',
    status: 'Succeeded',
    progress: 100,
    createdAt: '2026-10-23T00:00:00.000Z',
    source: 'live',
    ...overrides,
  };
}

function work(id: string, taskId: string, outputIndex?: number): Work {
  return {
    id,
    title: id,
    mode: 'image',
    taskId,
    versions: [],
    source: 'live',
    ...(outputIndex === undefined ? {} : { outputIndex }),
  };
}

describe('逐输出恢复的序号计算', () => {
  it('只补缺失的序号', () => {
    expect(missingIndexes([0, 2], 4)).toEqual([1, 3]);
    expect(missingIndexes([], 3)).toEqual([0, 1, 2]);
    expect(missingIndexes([0, 1, 2], 3)).toEqual([]);
  });

  it('旧作品没有 outputIndex 时按保存顺序推断', () => {
    const works = [work('w1', 'task-1'), work('w2', 'task-1'), work('w9', 'task-2')];
    expect(legacySavedIndexes(works, 'task-1')).toEqual([0, 1]);
  });

  it('新作品按显式 outputIndex 去重排序', () => {
    const works = [work('w2', 'task-1', 2), work('w0', 'task-1', 0), work('w0b', 'task-1', 0)];
    expect(legacySavedIndexes(works, 'task-1')).toEqual([0, 2]);
  });

  it('任务自身的记账优先于作品推断', () => {
    const taskWithRecord = task({ savedOutputs: [1] });
    expect(savedIndexes(taskWithRecord, [work('w0', 'task-1', 0)])).toEqual([1]);
  });

  it('没有记账的旧任务回退到作品推断', () => {
    expect(savedIndexes(task(), [work('w0', 'task-1', 0), work('w2', 'task-1', 2)])).toEqual([0, 2]);
  });

  it('区分“结果未取全”和真正的任务失败', () => {
    expect(isResultSaveFailure('RESULT_SAVE_INCOMPLETE')).toBe(true);
    expect(isResultSaveFailure('RESULT_SAVE_FAILED')).toBe(true);
    expect(isResultSaveFailure('GENERATION_FAILED')).toBe(false);
    expect(isResultSaveFailure(undefined)).toBe(false);
  });
});

describe('账号作用域分区键', () => {
  it('默认匿名分区', () => {
    setScope(undefined);
    expect(currentScope()).toBe(ANONYMOUS_SCOPE);
    expect(partitionKey()).toBe(`weavia.state.v2.${ANONYMOUS_SCOPE}`);
  });

  it('不同账号落到不同分区', () => {
    setScope('user-a');
    const a = partitionKey();
    setScope('user-b');
    const b = partitionKey();
    expect(a).not.toBe(b);
    expect(a.endsWith('.user-a')).toBe(true);
    expect(b.endsWith('.user-b')).toBe(true);
    setScope(undefined);
  });
});

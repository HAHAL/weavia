import { describe, expect, it } from 'vitest';
import { transitionTask, type ProductImageGenerationTaskInput, type Task } from './index';
const task: Task = {
  id: '1',
  type: 'ai_model',
  status: 'pending',
  input: {},
  attempt: 0,
  createdAt: '2026-10-06T00:00:00Z',
  updatedAt: '2026-10-06T00:00:00Z',
};
describe('task state machine', () => {
  it('allows pending to queued', () =>
    expect(transitionTask(task, 'queued').status).toBe('queued'));
  it('rejects pending to success', () =>
    expect(() => transitionTask(task, 'success')).toThrow('Invalid task transition'));
});
describe('product image task payload', () => {
  it('keeps reference asset ids in the persisted task input', () => {
    const input: ProductImageGenerationTaskInput = {
      projectId: 'project-1',
      workflow: 'product_image_generation',
      referenceAssets: ['asset-1'],
      logicalModel: 'weavia-image-pro',
      prompt: 'Studio photo',
    };
    expect(input.referenceAssets).toEqual(['asset-1']);
  });
});

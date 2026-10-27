import { beforeEach, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ request: vi.fn(), track: vi.fn(), update: vi.fn(), add: vi.fn(), scope: 'a' }));
vi.mock('../src/services/api', () => ({
  apiRequest: mocks.request,
  ApiError: class ApiError extends Error { constructor(public code: string, message: string) { super(message); } },
}));
vi.mock('../src/services/live', () => ({ trackLiveTask: mocks.track }));
vi.mock('../src/stores/scope', () => ({ currentScope: () => mocks.scope }));
vi.mock('../src/stores/app', () => ({ useApp: { getState: () => ({ updateTask: mocks.update, submitTask: mocks.add }) } }));

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); mocks.scope = 'a';
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) || null, setItem: (k: string, v: string) => store.set(k, v) });
  vi.stubGlobal('window', new EventTarget());
  mocks.request.mockImplementation(async (path: string) => path === '/api/credits' ? { available: 100 }
    : path === '/api/ai/quotes' ? { id: 'q1', totalCredits: 10, expiresAt: '2099-01-01' } : { id: 'task1', status: 'reserved' });
});

async function confirm(s: typeof import('../src/services/submission'), accepted: boolean) {
  await vi.waitFor(() => expect(s.useQuoteConfirmation.getState().pending).not.toBeNull());
  s.useQuoteConfirmation.getState().pending!.resolve(accepted);
}

it('cancel never submits a paid task', async () => {
  const s = await import('../src/services/submission');
  const result = expect(s.quoteAndSubmit([{ body: { prompt: 'test' }, title: 'test' }])).rejects.toThrow('已取消');
  await confirm(s, false); await result;
  expect(mocks.request.mock.calls.some(([path]) => path === '/api/ai/tasks')).toBe(false);
  expect(s.pendingSubmissions()).toEqual([]);
});

it('ambiguous network failure reuses the confirmed quote on recovery', async () => {
  const s = await import('../src/services/submission'); let calls = 0;
  mocks.request.mockImplementation(async (path: string) => {
    if (path === '/api/credits') return { available: 100 };
    if (path === '/api/ai/quotes') return { id: 'q1', totalCredits: 10, expiresAt: '2099-01-01' };
    if (++calls === 1) throw new Error('network');
    return { id: 'task1', status: 'reserved' };
  });
  const result = expect(s.quoteAndSubmit([{ body: { prompt: 'test' }, title: 'test' }])).rejects.toThrow('network');
  await confirm(s, true); await result;
  expect(s.pendingSubmissions()).toHaveLength(1);
  await s.resumeSubmissions();
  const submitted = mocks.request.mock.calls.filter(([path]) => path === '/api/ai/tasks').map(([, init]) => JSON.parse(init.body));
  expect(submitted.map(x => x.idempotencyKey)).toEqual(['quote-q1', 'quote-q1']);
  expect(s.pendingSubmissions()).toHaveLength(0);
});

it('account switch cancels a visible quote without submitting', async () => {
  const s = await import('../src/services/submission');
  const result = expect(s.quoteAndSubmit([{ body: { prompt: 'test' }, title: 'test' }])).rejects.toThrow();
  await vi.waitFor(() => expect(s.useQuoteConfirmation.getState().pending).not.toBeNull());
  mocks.scope = 'b'; window.dispatchEvent(new Event('weavia:scope')); await result;
  expect(mocks.track).not.toHaveBeenCalled(); expect(s.pendingSubmissions()).toHaveLength(0);
});

it('expired quote becomes a retryable unsubmitted draft', async () => {
  const s = await import('../src/services/submission'); const { ApiError } = await import('../src/services/api');
  localStorage.setItem('weavia.pending.a', JSON.stringify([{ body: { prompt: 'test' }, title: 'test', batchId: 'b1', quote: { id: 'q1' } }]));
  mocks.request.mockRejectedValue(new ApiError('QUOTE_EXPIRED', 'expired'));
  await expect(s.resumeSubmissions()).rejects.toThrow('expired');
  expect(s.pendingSubmissions()).toHaveLength(0);
  expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ status: 'Failed', errorCode: 'QUOTE_EXPIRED' }));
});

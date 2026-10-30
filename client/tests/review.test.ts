import { describe, expect, it } from 'vitest';
import { reviewOf, withNewVersion, withReview } from '../src/lib/review';
import type { Work } from '../src/types';

const base: Work = { id: 'w', title: 't', mode: 'image', taskId: 'x', source: 'live', versions: [{ id: 'v1', createdAt: '', prompt: 'a' }] };

describe('version level review', () => {
  it('a new version starts pending even after approval', () => {
    const approved = withReview(base, 'approved');
    expect(reviewOf(approved)).toBe('approved');
    const next = withNewVersion(approved, { id: 'v2', createdAt: '', prompt: 'b' });
    expect(reviewOf(next)).toBe('pending');
    expect(next.versions[0].reviewStatus).toBe('approved');
  });

  it('legacy single-version works keep their work-level status', () => {
    expect(reviewOf({ ...base, reviewStatus: 'changes_needed' })).toBe('changes_needed');
  });
});

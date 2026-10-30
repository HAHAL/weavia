import type { Work, WorkVersion } from '../types';

export type ReviewStatus = NonNullable<Work['reviewStatus']>;

export function latestVersion(work: Work): WorkVersion | undefined {
  return work.versions[work.versions.length - 1];
}

// Review belongs to a version: a new version always starts at 待核对 and never
// inherits the approval of the image it replaced. Works saved before versions
// carried their own status keep the work-level value for their only version.
export function reviewOf(work: Work): ReviewStatus {
  const version = latestVersion(work);
  if (version?.reviewStatus) return version.reviewStatus;
  if (work.versions.length <= 1 && work.reviewStatus) return work.reviewStatus;
  return 'pending';
}

export function withReview(work: Work, status: ReviewStatus, note?: string): Work {
  const index = work.versions.length - 1;
  const versions = work.versions.map((version, i) => i === index ? { ...version, reviewStatus: status, reviewNote: note, reviewedAt: new Date().toISOString() } : version);
  return { ...work, versions, reviewStatus: status, reviewNote: note };
}

export function withNewVersion(work: Work, version: WorkVersion): Work {
  return { ...work, versions: [...work.versions, { ...version, reviewStatus: 'pending' }], reviewStatus: 'pending', reviewNote: undefined };
}

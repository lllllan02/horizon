import type { LibraryDocument } from '../types/library.ts';
import {
  parseReviewState,
  ReviewError,
  type ReviewInput,
  type ReviewState,
} from '../review-model.ts';
import {
  mergeReviewUpdate,
  parseReviewHistoryPage,
  reviewHistoryPage,
} from '../review-protocol.ts';
import { localEditing } from './library-client.ts';
import { createBrowserReviewStore } from './review-browser-store.ts';
import { withBrowserReviewLock } from './review-browser-lock.ts';

export const reviewStorageKey = `horizon:reviews:v1:${location.pathname}`;
export const reviewStorageLabel = localEditing
  ? '进度保存在本机项目中'
  : '进度仅保存在当前浏览器，不跨设备同步';

const browserStore = () => {
  try {
    return createBrowserReviewStore(localStorage, reviewStorageKey, { run: withBrowserReviewLock });
  } catch {
    throw Error('浏览器不允许保存复习记录。请允许网站存储后重试。');
  }
};

let snapshot: ReviewState | null = null;

async function requestValue(url: string, input?: ReviewInput) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...(input
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }
      : {}),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof value === 'object' &&
      value !== null &&
      'error' in value &&
      typeof value.error === 'string'
        ? value.error
        : '复习记录保存失败，请重试。';
    throw new ReviewError(message, response.status);
  }
  return value;
}

export async function fetchReviews(documents: LibraryDocument[]) {
  if (!localEditing) return browserStore().load(documents);
  snapshot = parseReviewState(await requestValue('/api/reviews'));
  return snapshot;
}

export async function updateReview(documents: LibraryDocument[], input: ReviewInput) {
  if (!localEditing) return browserStore().update(documents, input);
  const value = await requestValue('/api/reviews', input);
  let next: ReviewState | null;
  try {
    next = mergeReviewUpdate(snapshot, value);
  } catch {
    // The cached snapshot can differ in record ordering after a rename or external write.
    return fetchReviews(documents);
  }
  if (!next) return fetchReviews(documents);
  snapshot = next;
  return next;
}

export async function fetchReviewHistory(documents: LibraryDocument[], id: string, cursor = 0) {
  if (!localEditing) return reviewHistoryPage(await browserStore().load(documents), id, cursor);
  const query = new URLSearchParams({ id, limit: '20' });
  if (cursor) query.set('cursor', String(cursor));
  return parseReviewHistoryPage(await requestValue(`/api/reviews/history?${query}`));
}

/** Summary snapshots deliberately omit old request IDs; confirm against persistent events. */
export async function confirmReviewRequest(documents: LibraryDocument[], requestId: string) {
  if (!localEditing) {
    const state = await browserStore().load(documents);
    return Object.values(state.records).some((record) =>
      record.history.some((event) => event.requestId === requestId),
    );
  }
  const value = await requestValue(`/api/reviews/request?${new URLSearchParams({ requestId })}`);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('found' in value) ||
    typeof value.found !== 'boolean'
  )
    throw new ReviewError('复习保存确认响应无效，请用原反馈重试。', 500);
  return value.found;
}

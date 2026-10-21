import type { LibraryDocument } from '../types/library.ts';
import { parseReviewState, type ReviewInput } from '../review-model.ts';
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

async function request(input?: ReviewInput) {
  const response = await fetch('/api/reviews', {
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
    throw Error(message);
  }
  return parseReviewState(value);
}

export function fetchReviews(documents: LibraryDocument[]) {
  return localEditing ? request() : browserStore().load(documents);
}

export function updateReview(documents: LibraryDocument[], input: ReviewInput) {
  return localEditing ? request(input) : browserStore().update(documents, input);
}

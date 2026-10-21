import { documentTime } from './document-dates.ts';
import {
  parseReviewState,
  ReviewError,
  type ReviewEvent,
  type ReviewRecord,
  type ReviewState,
} from './review-model.ts';

export interface ReviewUpdate {
  kind: 'review-update';
  baseVersion: string;
  version: string;
  records: Record<string, ReviewRecord>;
  removed: string[];
}
export interface ReviewHistoryPage {
  version: string;
  events: ReviewEvent[];
  nextCursor: number | null;
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Only changed compact records travel back after a local write. */
export function createReviewUpdate(before: ReviewState, after: ReviewState): ReviewUpdate {
  return {
    kind: 'review-update',
    baseVersion: before.version,
    version: after.version,
    records: Object.fromEntries(
      Object.entries(after.records).filter(
        ([id, record]) =>
          !Object.hasOwn(before.records, id) ||
          JSON.stringify(record) !== JSON.stringify(before.records[id]),
      ),
    ),
    removed: Object.keys(before.records).filter((id) => !Object.hasOwn(after.records, id)),
  };
}

/** A stale patch cannot reconstruct a snapshot; callers must read the latest state. */
export function mergeReviewUpdate(state: ReviewState | null, value: unknown): ReviewState | null {
  if (
    !object(value) ||
    value.kind !== 'review-update' ||
    typeof value.baseVersion !== 'string' ||
    typeof value.version !== 'string' ||
    !object(value.records) ||
    !Array.isArray(value.removed) ||
    !value.removed.every((id) => typeof id === 'string')
  )
    throw new ReviewError('复习增量响应格式无效，请重新读取记录。', 500);
  if (!state || state.version !== value.baseVersion) return null;
  const records = { ...state.records, ...value.records };
  for (const id of value.removed) delete records[id];
  return parseReviewState({ version: value.version, records });
}

/** Browser progress keeps its complete history; expose the same bounded view as SQLite. */
export function reviewHistoryPage(
  state: ReviewState,
  id: string,
  cursor = 0,
  limit = 20,
): ReviewHistoryPage {
  if (
    !Number.isSafeInteger(cursor) ||
    cursor < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new ReviewError('复习历史分页参数无效。', 400);
  const events = (Object.hasOwn(state.records, id) ? state.records[id].history : [])
    .filter((event) => event.rating)
    .slice()
    .reverse();
  return {
    version: state.version,
    events: events.slice(cursor, cursor + limit),
    nextCursor: cursor + limit < events.length ? cursor + limit : null,
  };
}

export function parseReviewHistoryPage(value: unknown): ReviewHistoryPage {
  const invalid = () => {
    throw new ReviewError('复习历史响应格式无效，请重试。', 500);
  };
  if (
    !object(value) ||
    typeof value.version !== 'string' ||
    !Array.isArray(value.events) ||
    value.events.length > 100 ||
    !(
      value.nextCursor === null ||
      (Number.isSafeInteger(value.nextCursor) && Number(value.nextCursor) > 0)
    )
  )
    return invalid();
  const ids = new Set<string>();
  for (const event of value.events) {
    if (
      !object(event) ||
      typeof event.requestId !== 'string' ||
      !event.requestId ||
      ids.has(event.requestId) ||
      !['good', 'hard', 'forgot'].includes(String(event.rating)) ||
      event.paused !== undefined ||
      event.presented !== undefined ||
      typeof event.reviewedAt !== 'string' ||
      !Number.isFinite(documentTime(event.reviewedAt)) ||
      ![0, 1, 3, 7, 14, 30, 60].includes(Number(event.intervalDays)) ||
      typeof event.intervalDays !== 'number' ||
      (event.dueAt !== undefined &&
        (typeof event.dueAt !== 'string' || !Number.isFinite(documentTime(event.dueAt))))
    )
      return invalid();
    ids.add(event.requestId);
  }
  return value as unknown as ReviewHistoryPage;
}

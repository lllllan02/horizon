import type { LibraryDocument } from './types/library.ts';
import { beijingTimestamp, documentTime } from './document-dates.ts';

export type ReviewRating = 'forgot' | 'hard' | 'good';
export type ReviewDocument = Pick<LibraryDocument, 'id' | 'path' | 'body' | 'updated' | 'state'> &
  Partial<Pick<LibraryDocument, 'category'>>;
export interface ReviewEvent {
  requestId: string;
  rating?: ReviewRating;
  paused?: boolean;
  presented?: true;
  reviewedAt: string;
  intervalDays: number;
  dueAt?: string;
}
export interface ReviewRecord {
  id: string;
  path: string;
  fingerprint: string;
  documentUpdated: string | null;
  lastReviewedAt: string | null;
  lastPresentedAt?: string | null;
  dueAt: string | null;
  intervalDays: number;
  paused: boolean;
  history: ReviewEvent[];
}
export interface ReviewState {
  version: string;
  records: Record<string, ReviewRecord>;
}
export interface ReviewInput {
  version: string;
  id: string;
  rating?: ReviewRating;
  paused?: boolean;
  presented?: true;
  requestId: string;
  documentUpdated?: string | null;
  documentFingerprint?: string;
}
export class ReviewError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
const DAY = 86_400_000;
const intervals = [1, 3, 7, 14, 30, 60];
const own = (value: object, key: PropertyKey) => Object.hasOwn(value, key);
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const timestamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(documentTime(value));
const nullableTime = (value: unknown) => value === null || timestamp(value);
const rating = (value: unknown): value is ReviewRating =>
  value === 'forgot' || value === 'hard' || value === 'good';
const action = (value: Record<string, unknown>) =>
  (rating(value.rating) && value.paused === undefined && value.presented === undefined) ||
  (value.rating === undefined &&
    typeof value.paused === 'boolean' &&
    value.presented === undefined) ||
  (value.rating === undefined && value.paused === undefined && value.presented === true);

// Two independent 32-bit streams keep the browser and server fingerprints identical.
// This identifies revisions; it is not used as an authentication primitive.
function hash(value: string) {
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ value.charCodeAt(i);
  }
  return `${value.length.toString(16)}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}
export const reviewFingerprint = (doc: Pick<ReviewDocument, 'body'>) => hash(doc.body);
export const reviewDay = (now: number | string = Date.now()) =>
  new Date((typeof now === 'string' ? documentTime(now) : now) + 8 * 3_600_000)
    .toISOString()
    .slice(0, 10);
const withVersion = (records: ReviewState['records']): ReviewState => ({
  version: `reviews-1-${hash(JSON.stringify(records))}`,
  records,
});
export const emptyReviewState = (): ReviewState => withVersion({});

/** Refuse corrupt or future formats rather than silently discarding history. */
export function parseReviewState(value: unknown): ReviewState {
  const invalid = () => {
    throw new ReviewError('复习记录格式无效，原记录已保留。', 500);
  };
  if (!object(value) || typeof value.version !== 'string' || !object(value.records))
    return invalid();
  // Validate the original representation before inspecting optional additions so
  // old files retain their exact version and need no destructive migration.
  const state = value as unknown as ReviewState;
  if (withVersion(state.records).version !== state.version) return invalid();
  const requestIds = new Set<string>();
  for (const [id, record] of Object.entries(value.records)) {
    if (
      !object(record) ||
      record.id !== id ||
      typeof record.path !== 'string' ||
      typeof record.fingerprint !== 'string' ||
      !(record.documentUpdated === null || typeof record.documentUpdated === 'string') ||
      !nullableTime(record.lastReviewedAt) ||
      !(record.lastPresentedAt === undefined || nullableTime(record.lastPresentedAt)) ||
      !nullableTime(record.dueAt) ||
      typeof record.intervalDays !== 'number' ||
      ![0, ...intervals].includes(record.intervalDays) ||
      typeof record.paused !== 'boolean' ||
      !Array.isArray(record.history)
    )
      return invalid();
    for (const event of record.history) {
      if (
        !object(event) ||
        typeof event.requestId !== 'string' ||
        !event.requestId ||
        requestIds.has(event.requestId) ||
        !timestamp(event.reviewedAt) ||
        typeof event.intervalDays !== 'number' ||
        ![0, ...intervals].includes(event.intervalDays) ||
        (event.dueAt !== undefined && (!rating(event.rating) || !timestamp(event.dueAt))) ||
        !action(event)
      )
        return invalid();
      requestIds.add(event.requestId);
    }
    const reviews = record.history.filter((event: ReviewEvent) => event.rating !== undefined);
    const last = reviews.at(-1);
    const lastPresented = record.history.findLast((event: ReviewEvent) => event.presented);
    if (
      (last?.reviewedAt ?? null) !== record.lastReviewedAt ||
      (lastPresented?.reviewedAt ?? null) !== (record.lastPresentedAt ?? null) ||
      (record.lastReviewedAt === null) !== (record.dueAt === null)
    )
      return invalid();
  }
  return state;
}

function newRecord(doc: ReviewDocument): ReviewRecord {
  return {
    id: doc.id,
    path: doc.path,
    fingerprint: reviewFingerprint(doc),
    documentUpdated: doc.updated,
    lastReviewedAt: null,
    lastPresentedAt: null,
    dueAt: null,
    intervalDays: 0,
    paused: false,
    history: [],
  };
}

/** Orphan records are kept. Only a unique body match may transfer a renamed history. */
export function reconcileReviews(
  state: ReviewState,
  documents: ReviewDocument[],
  now = Date.now(),
): ReviewState {
  const records = { ...state.records };
  const ids = new Set(documents.map((doc) => doc.id));
  const fingerprints = new Map<string, ReviewDocument[]>();
  for (const doc of documents) {
    const key = reviewFingerprint(doc);
    fingerprints.set(key, [...(fingerprints.get(key) ?? []), doc]);
  }
  for (const doc of documents) {
    const fingerprint = reviewFingerprint(doc);
    let old = own(records, doc.id) ? records[doc.id] : undefined;
    if (!old) {
      const matches = Object.values(state.records).filter(
        (record) => !ids.has(record.id) && record.fingerprint === fingerprint,
      );
      if (matches.length === 1 && fingerprints.get(fingerprint)?.length === 1) {
        old = matches[0];
        delete records[old.id];
      }
    }
    if (!old) {
      if (doc.state === 'organized')
        Object.defineProperty(records, doc.id, {
          value: newRecord(doc),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      continue;
    }
    const revised =
      fingerprint !== old.fingerprint &&
      old.documentUpdated !== null &&
      doc.updated !== null &&
      documentTime(doc.updated) > documentTime(old.documentUpdated);
    const next = {
      ...old,
      id: doc.id,
      path: doc.path,
      fingerprint,
      documentUpdated: doc.updated,
      ...(revised && old.lastReviewedAt
        ? {
            intervalDays: 1,
            dueAt: beijingTimestamp(Math.min(documentTime(old.dueAt!), now + DAY)),
          }
        : {}),
    };
    Object.defineProperty(records, doc.id, {
      value: next,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  const next = withVersion(records);
  return next.version === state.version ? state : next;
}

export function reviewQueue<T extends ReviewDocument>(
  documents: T[],
  state: ReviewState,
  now = Date.now(),
) {
  const due: T[] = [],
    fresh: T[] = [],
    scheduled: T[] = [],
    paused: T[] = [];
  for (const doc of documents) {
    if (doc.state !== 'organized') continue;
    const record = own(state.records, doc.id) ? state.records[doc.id] : undefined;
    if (record?.paused) paused.push(doc);
    else if (!record?.lastReviewedAt) fresh.push(doc);
    else if (record.dueAt && documentTime(record.dueAt) <= now) due.push(doc);
    else scheduled.push(doc);
  }
  const stable = (a: T, b: T) => a.id.localeCompare(b.id, 'zh-CN');
  const presentedAt = (doc: T) => state.records[doc.id]?.lastPresentedAt;
  const presentedToday = (doc: T) => {
    const at = presentedAt(doc);
    return at ? Number(reviewDay(at) === reviewDay(now)) : 0;
  };
  const difficulty = (doc: T) => {
    const last = state.records[doc.id]?.history.findLast((event) => event.rating);
    return last?.rating === 'forgot' ? 0 : last?.rating === 'hard' ? 1 : 2;
  };
  due.sort(
    (a, b) =>
      presentedToday(a) - presentedToday(b) ||
      (presentedToday(a) && presentedToday(b)
        ? documentTime(presentedAt(a)!) - documentTime(presentedAt(b)!)
        : 0) ||
      documentTime(state.records[a.id].dueAt!) - documentTime(state.records[b.id].dueAt!) ||
      difficulty(a) - difficulty(b) ||
      stable(a, b),
  );
  scheduled.sort(
    (a, b) =>
      documentTime(state.records[a.id].dueAt!) - documentTime(state.records[b.id].dueAt!) ||
      stable(a, b),
  );
  const lastPresented = documents
    .filter((doc) => presentedAt(doc))
    .sort(
      (a, b) => documentTime(presentedAt(b)!) - documentTime(presentedAt(a)!) || stable(a, b),
    )[0];
  const repeatedCategory = (doc: T) =>
    Number(Boolean(doc.category && doc.category === lastPresented?.category));
  fresh.sort((a, b) => {
    const aTime = presentedAt(a),
      bTime = presentedAt(b);
    if (!aTime && !bTime) return repeatedCategory(a) - repeatedCategory(b) || stable(a, b);
    if (!aTime || !bTime) return aTime ? 1 : -1;
    return documentTime(aTime) - documentTime(bTime) || stable(a, b);
  });
  // Scheduled material remains available for voluntary practice. Rotate by the
  // last participation, so a completed or merely displayed title yields to others.
  const touched = (doc: T) => {
    const record = state.records[doc.id];
    return Math.max(
      record?.lastReviewedAt ? documentTime(record.lastReviewedAt) : 0,
      record?.lastPresentedAt ? documentTime(record.lastPresentedAt) : 0,
    );
  };
  const practice = [...scheduled].sort(
    (a, b) =>
      touched(a) - touched(b) ||
      state.records[a.id].history.filter((event) => event.rating).length -
        state.records[b.id].history.filter((event) => event.rating).length ||
      difficulty(a) - difficulty(b) ||
      repeatedCategory(a) - repeatedCategory(b) ||
      stable(a, b),
  );
  paused.sort(stable);
  return { due, fresh, scheduled, paused, recommendations: [...due, ...fresh, ...practice] };
}

export function nextReviewInterval(record: ReviewRecord | undefined, value: ReviewRating) {
  if (!record?.lastReviewedAt || value === 'forgot') return 1;
  const index = Math.max(0, intervals.indexOf(record.intervalDays));
  return intervals[
    value === 'good' ? Math.min(intervals.length - 1, index + 1) : Math.max(0, index - 1)
  ];
}

/** Early practice records feedback without rewarding rapid repetition with a longer interval. */
export function reviewSchedule(record: ReviewRecord | undefined, value: ReviewRating, now: number) {
  const early = !!record?.dueAt && documentTime(record.dueAt) > now;
  if (early && value === 'good') return { intervalDays: record.intervalDays, dueAt: record.dueAt! };
  const intervalDays = nextReviewInterval(record, value);
  const dueAt = now + intervalDays * DAY;
  return {
    intervalDays,
    dueAt: beijingTimestamp(early ? Math.min(documentTime(record!.dueAt!), dueAt) : dueAt),
  };
}

export function applyReview(
  state: ReviewState,
  documents: ReviewDocument[],
  input: ReviewInput,
  now = Date.now(),
): ReviewState {
  if (
    !object(input) ||
    typeof input.version !== 'string' ||
    typeof input.id !== 'string' ||
    typeof input.requestId !== 'string' ||
    !/^[A-Za-z0-9_-]{8,128}$/.test(input.requestId) ||
    !action(input)
  )
    throw new ReviewError('复习参数无效。', 400);
  for (const record of Object.values(state.records)) {
    const previous = record.history.find((event) => event.requestId === input.requestId);
    if (previous) {
      if (
        record.id !== input.id ||
        previous.rating !== input.rating ||
        previous.paused !== input.paused ||
        previous.presented !== input.presented
      )
        throw new ReviewError('此请求编号已用于其他复习操作。');
      return state;
    }
  }
  if (input.version !== state.version) throw new ReviewError('复习记录已更新，请同步后重试。');
  const doc = documents.find((doc) => doc.id === input.id);
  if (!doc || doc.state !== 'organized') throw new ReviewError('只有当前已整理的资料可以复习。');
  if (input.documentUpdated !== doc.updated || input.documentFingerprint !== reviewFingerprint(doc))
    throw new ReviewError('文章已更新，请重新查看后反馈。');
  const reconciled = reconcileReviews(state, documents, now);
  const record = reconciled.records[doc.id];
  const reviewing = input.rating || input.presented;
  if (reviewing && record.paused) throw new ReviewError('请先恢复这篇资料的复习。');
  const reviewedAt = beijingTimestamp(now);
  // Millisecond ties must still preserve presentation order across refreshes.
  // This clock is used only for recommendation order, never review scheduling.
  const presentedTime = input.presented
    ? beijingTimestamp(
        Math.max(
          now,
          ...Object.values(reconciled.records).map((item) =>
            item.lastPresentedAt ? documentTime(item.lastPresentedAt) + 1 : 0,
          ),
        ),
      )
    : reviewedAt;
  const schedule = input.rating ? reviewSchedule(record, input.rating, now) : null;
  const intervalDays = schedule?.intervalDays ?? record.intervalDays;
  const next: ReviewRecord = {
    ...record,
    intervalDays,
    ...(input.rating
      ? { lastReviewedAt: reviewedAt, dueAt: schedule!.dueAt }
      : input.presented
        ? { lastPresentedAt: presentedTime }
        : { paused: input.paused! }),
    history: [
      ...record.history,
      {
        requestId: input.requestId,
        reviewedAt: input.presented ? presentedTime : reviewedAt,
        intervalDays,
        ...(input.rating
          ? { rating: input.rating, dueAt: schedule!.dueAt }
          : input.presented
            ? { presented: true as const }
            : { paused: input.paused }),
      },
    ],
  };
  return withVersion({ ...reconciled.records, [doc.id]: next });
}

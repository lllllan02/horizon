import { beijingTimestamp, documentTime } from '../document-dates.ts';
import type { LibraryDocument } from '../types/library.ts';
import type { ReviewEvent, ReviewRating, ReviewState } from '../review-model.ts';
import { reviewCounts, reviewDay } from '../review-model.ts';

export type ReviewStatisticsStatus = 'fresh' | 'due' | 'scheduled' | 'paused';
export type ReviewStatisticsPeriod = 'fresh' | 'overdue' | 'today' | 'future' | 'paused';
export type ReviewStatisticsSort = 'due' | 'count' | 'recent';
export type ReviewStatisticsDocument = Pick<LibraryDocument, 'id' | 'title' | 'category' | 'state'>;
export interface ReviewStatisticsFilters {
  search?: string;
  status?: 'all' | ReviewStatisticsStatus;
  period?: 'all' | 'today' | 'overdue' | 'future' | 'fresh' | 'reviewed-today';
  sort?: ReviewStatisticsSort;
}
export type RatedReviewEvent = ReviewEvent & { rating: ReviewRating; plannedAt: string };
export interface ReviewStatisticsRow {
  doc: ReviewStatisticsDocument;
  topic: string;
  status: ReviewStatisticsStatus;
  period: ReviewStatisticsPeriod;
  reviewedToday: boolean;
  total: number;
  counts: Record<ReviewRating, number>;
  history: RatedReviewEvent[];
  lastReviewedAt: string | null;
  dueAt: string | null;
  intervalDays: number;
}
export const reviewStatisticsStatusLabels: Record<ReviewStatisticsStatus, string> = {
  fresh: '未复习',
  due: '已到期',
  scheduled: '已安排',
  paused: '已暂停',
};
export const reviewStatisticsPeriodLabels: Record<ReviewStatisticsPeriod, string> = {
  fresh: '未复习',
  overdue: '已逾期',
  today: '今日到期',
  future: '未来安排',
  paused: '已暂停',
};
export const periodLabels = reviewStatisticsPeriodLabels;
const validRating = (event: ReviewEvent): event is ReviewEvent & { rating: ReviewRating } =>
  event.rating === 'good' || event.rating === 'hard' || event.rating === 'forgot';
const day = 86_400_000;
const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
export function formatReviewTime(value: string | null) {
  return value && Number.isFinite(documentTime(value))
    ? timeFormatter.format(new Date(documentTime(value)))
    : '—';
}

/** All organized documents participate, including scheduled and paused material. */
export function buildReviewStatistics(
  documents: readonly ReviewStatisticsDocument[],
  state: ReviewState | null,
  now: number,
  filters: ReviewStatisticsFilters = {},
) {
  const today = reviewDay(now);
  const all: ReviewStatisticsRow[] = documents
    .filter((doc) => doc.state === 'organized')
    .map((doc) => {
      const record =
        state && Object.hasOwn(state.records, doc.id) ? state.records[doc.id] : undefined;
      const history = (record?.history ?? [])
        .filter(validRating)
        .map((event, index) => ({
          event: {
            ...event,
            plannedAt:
              event.dueAt ??
              beijingTimestamp(documentTime(event.reviewedAt) + event.intervalDays * day),
          },
          index,
        }))
        .sort(
          (a, b) =>
            documentTime(b.event.reviewedAt) - documentTime(a.event.reviewedAt) ||
            b.index - a.index,
        )
        .map(({ event }) => event);
      const counts = reviewCounts(record);
      const total = counts.good + counts.hard + counts.forgot;
      const status: ReviewStatisticsStatus = record?.paused
        ? 'paused'
        : total === 0
          ? 'fresh'
          : record?.dueAt && documentTime(record.dueAt) <= now
            ? 'due'
            : 'scheduled';
      const dueDay = record?.dueAt ? reviewDay(record.dueAt) : null;
      const period: ReviewStatisticsPeriod = record?.paused
        ? 'paused'
        : total === 0
          ? 'fresh'
          : dueDay === today
            ? 'today'
            : dueDay && dueDay < today
              ? 'overdue'
              : 'future';
      const reviewedToday = Boolean(
        record?.lastReviewedAt && reviewDay(record.lastReviewedAt) === today,
      );
      return {
        doc,
        topic: doc.category || '未分类',
        status,
        period,
        reviewedToday,
        total,
        counts,
        history,
        lastReviewedAt: record?.lastReviewedAt ?? null,
        dueAt: total ? (record?.dueAt ?? null) : null,
        intervalDays: total ? (record?.intervalDays ?? 0) : 0,
      };
    });
  const terms = (filters.search ?? '')
    .trim()
    .toLocaleLowerCase('zh-CN')
    .split(/\s+/)
    .filter(Boolean);
  const rows = all.filter((row) => {
    const text = `${row.doc.title} ${row.topic}`.toLocaleLowerCase('zh-CN');
    return (
      (!filters.status || filters.status === 'all' || row.status === filters.status) &&
      (!filters.period ||
        filters.period === 'all' ||
        (filters.period === 'reviewed-today'
          ? row.reviewedToday
          : row.period === filters.period)) &&
      terms.every((term) => text.includes(term))
    );
  });
  const time = (value: string | null, fallback: number) => (value ? documentTime(value) : fallback);
  rows.sort((a, b) => {
    const order =
      filters.sort === 'count'
        ? b.total - a.total
        : filters.sort === 'recent'
          ? time(b.lastReviewedAt, 0) - time(a.lastReviewedAt, 0)
          : // Paused plans are preserved for reference, but are not active due work.
            Number(a.status === 'paused') - Number(b.status === 'paused') ||
            time(a.dueAt, Infinity) - time(b.dueAt, Infinity);
    return (
      order || a.doc.title.localeCompare(b.doc.title, 'zh-CN') || a.doc.id.localeCompare(b.doc.id)
    );
  });
  const totals = rows.reduce(
    (sum, row) => ({
      documents: sum.documents + 1,
      reviewed: sum.reviewed + Number(row.total > 0),
      total: sum.total + row.total,
      good: sum.good + row.counts.good,
      hard: sum.hard + row.counts.hard,
      forgot: sum.forgot + row.counts.forgot,
    }),
    { documents: 0, reviewed: 0, total: 0, good: 0, hard: 0, forgot: 0 },
  );
  return { rows, totals, fullCount: all.length };
}

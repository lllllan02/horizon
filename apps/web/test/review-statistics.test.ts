import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  ReviewDocument,
  ReviewEvent,
  ReviewRecord,
  ReviewState,
} from '../src/review-model.ts';
import {
  applyReview,
  emptyReviewState,
  reconcileReviews,
  reviewFingerprint,
  reviewQueue,
} from '../src/review-model.ts';
import {
  buildReviewStatistics,
  formatReviewTime,
  periodLabels,
  reviewStatisticsPeriodLabels,
  type ReviewStatisticsDocument,
} from '../src/neural/review-statistics-model.ts';

const now = Date.parse('2026-10-21T04:30:00Z');
const doc = (
  id: string,
  extra: Partial<ReviewStatisticsDocument> = {},
): ReviewStatisticsDocument & ReviewDocument => ({
  id,
  title: id,
  category: '数据库',
  state: 'organized',
  path: `notes/${id}.md`,
  body: id,
  updated: null,
  ...extra,
});
const event = (id: string, extra: Partial<ReviewEvent> = {}): ReviewEvent => ({
  requestId: id,
  reviewedAt: '2026-10-20T04:30:00Z',
  intervalDays: 1,
  rating: 'good',
  ...extra,
});
const record = (
  id: string,
  history: ReviewEvent[],
  extra: Partial<ReviewRecord> = {},
): ReviewRecord => ({
  id,
  path: `notes/${id}.md`,
  fingerprint: 'test',
  documentUpdated: null,
  lastReviewedAt: history.findLast((item) => item.rating)?.reviewedAt ?? null,
  dueAt: history.some((item) => item.rating) ? new Date(now).toISOString() : null,
  intervalDays: history.some((item) => item.rating) ? 1 : 0,
  paused: false,
  history,
  ...extra,
});
const stateOf = (...records: ReviewRecord[]): ReviewState => ({
  version: 'statistics-fixture',
  records: Object.fromEntries(records.map((item) => [item.id, item])),
});

test('新旧时间混合时按北京实际时刻排序、判断到期并显示历史计划', () => {
  const state = stateOf(
    record('old', [event('old', { reviewedAt: '2026-10-21T04:00:00Z' })], {
      dueAt: '2026-10-21T12:00:00+08:00',
    }),
    record('new', [event('new', { reviewedAt: '2026-10-21 12:00:00.123' })], {
      dueAt: '2026-10-21 12:30:00.001',
    }),
  );
  const stats = buildReviewStatistics([doc('old'), doc('new')], state, now, { sort: 'recent' });
  assert.deepEqual(
    stats.rows.map((row) => row.doc.id),
    ['new', 'old'],
  );
  assert.deepEqual(
    stats.rows.map((row) => row.status),
    ['scheduled', 'due'],
  );
  assert.ok(stats.rows.every((row) => row.reviewedToday && row.period === 'today'));
  assert.equal(stats.rows[0].history[0].plannedAt, '2026-10-22 12:00:00.123');
  assert.equal(
    formatReviewTime('2026-10-21 12:00:00.123'),
    formatReviewTime('2026-10-21T04:00:00Z'),
  );
});

test('统计全部已整理资料，不包含孤儿和其他状态', () => {
  const documents = [
    ...Array.from({ length: 9 }, (_, i) => doc(`doc-${i}`)),
    doc('reading', { state: 'reading' }),
    doc('pending', { state: 'pending' }),
  ];
  const state = reconcileReviews(emptyReviewState(), documents, now);
  assert.equal(reviewQueue(documents, state, now).fresh.length, 9);
  state.records.orphan = record('orphan', [event('orphan-feedback')]);
  state.records.reading = record('reading', [event('reading-feedback')]);
  const before = structuredClone({ documents, state });
  const stats = buildReviewStatistics(documents, state, now);
  assert.equal(stats.fullCount, 9);
  assert.deepEqual(stats.totals, {
    documents: 9,
    reviewed: 0,
    total: 0,
    good: 0,
    hard: 0,
    forgot: 0,
  });
  assert.ok(stats.rows.every((row) => row.status === 'fresh' && row.dueAt === null));
  assert.deepEqual({ documents, state }, before);
});

test('只统计评分，展示和暂停不计次；历史倒序且保留当时计划', () => {
  const history = [
    event('present', { rating: undefined, presented: true }),
    event('good', { reviewedAt: '2026-10-10T04:30:00Z', intervalDays: 3 }),
    event('hard', { rating: 'hard', reviewedAt: '2026-10-13T04:30:00Z', intervalDays: 1 }),
    event('pause', { rating: undefined, paused: true }),
    event('resume', { rating: undefined, paused: false }),
    event('forgot', { rating: 'forgot', reviewedAt: '2026-10-14T04:30:00Z', intervalDays: 1 }),
    event('present-later', { rating: undefined, presented: true }),
  ];
  const state = stateOf(record('a', history, { dueAt: '2026-10-22T04:30:00Z' }));
  const before = structuredClone(state);
  const stats = buildReviewStatistics([doc('a')], state, now);
  assert.deepEqual(stats.totals, {
    documents: 1,
    reviewed: 1,
    total: 3,
    good: 1,
    hard: 1,
    forgot: 1,
  });
  const row = stats.rows[0];
  assert.equal(row.lastReviewedAt, '2026-10-14T04:30:00Z');
  assert.deepEqual(
    row.history.map((item) => item.requestId),
    ['forgot', 'hard', 'good'],
  );
  assert.equal(row.history[2].plannedAt, '2026-10-13 12:30:00.000');
  assert.equal(row.history[0].plannedAt, '2026-10-15 12:30:00.000');
  assert.equal(row.dueAt, '2026-10-22T04:30:00Z');
  assert.deepEqual(state, before);
});

test('状态筛选互斥，暂停不算到期；汇总与标题及专题筛选范围一致', () => {
  const documents = [
    doc('fresh', { title: 'Redis 缓存' }),
    doc('due', { title: 'MySQL 索引' }),
    doc('scheduled', { title: 'Go 调度', category: '并发' }),
    doc('paused', { title: 'Redis 持久化' }),
    doc('paused-fresh'),
  ];
  const state = stateOf(
    record('due', [event('due-feedback', { rating: 'hard' })]),
    record('scheduled', [event('scheduled-feedback')], { dueAt: '2026-10-22T04:30:00Z' }),
    record('paused', [event('paused-feedback', { rating: 'forgot' })], { paused: true }),
    record('paused-fresh', [event('pause-only', { rating: undefined, paused: true })], {
      paused: true,
    }),
  );
  for (const [status, ids] of [
    ['fresh', ['fresh']],
    ['due', ['due']],
    ['scheduled', ['scheduled']],
    ['paused', ['paused', 'paused-fresh']],
  ] as const) {
    const stats = buildReviewStatistics(documents, state, now, { status });
    assert.deepEqual(stats.rows.map((row) => row.doc.id).sort(), [...ids].sort());
    assert.equal(stats.totals.documents, ids.length);
    assert.equal(stats.fullCount, 5);
  }
  const redis = buildReviewStatistics(documents, state, now, { search: '  REDIS 数据库  ' });
  assert.deepEqual(redis.totals, {
    documents: 2,
    reviewed: 1,
    total: 1,
    good: 0,
    hard: 0,
    forgot: 1,
  });
  const none = buildReviewStatistics(documents, state, now, { search: '不存在' });
  assert.equal(none.rows.length, 0);
  assert.equal(none.totals.total, 0);
});

test('排序使用真实评分次数和时间，展示时间不会覆盖最近复习，暂停排在有效计划之后', () => {
  const documents = ['a', 'b', 'c', 'd'].map((id) => doc(id));
  const state = stateOf(
    record(
      'a',
      [
        event('a1', { reviewedAt: '2026-10-19T04:30:00Z' }),
        event('a-present', {
          rating: undefined,
          presented: true,
          reviewedAt: '2026-10-21T04:30:00Z',
        }),
      ],
      { dueAt: '2026-10-22T04:30:00Z' },
    ),
    record('b', [
      event('b1', { reviewedAt: '2026-10-17T04:30:00Z' }),
      event('b2', { reviewedAt: '2026-10-20T04:30:00Z' }),
    ]),
    record('c', [event('c1', { reviewedAt: '2026-10-15T04:30:00Z' })], {
      dueAt: '2026-10-16T04:30:00Z',
      paused: true,
    }),
  );
  const ids = (sort: 'due' | 'count' | 'recent') =>
    buildReviewStatistics(documents, state, now, { sort }).rows.map((row) => row.doc.id);
  assert.deepEqual(ids('due'), ['b', 'a', 'd', 'c']);
  assert.deepEqual(ids('count'), ['b', 'a', 'c', 'd']);
  assert.deepEqual(ids('recent'), ['b', 'a', 'c', 'd']);
});

test('无记录保留零值，日期按北京时间精确到分钟并正确跨日', () => {
  const result = buildReviewStatistics([doc('missing')], emptyReviewState(), now);
  assert.deepEqual(result.rows[0].counts, { good: 0, hard: 0, forgot: 0 });
  assert.equal(result.rows[0].intervalDays, 0);
  assert.equal(result.rows[0].lastReviewedAt, null);
  assert.equal(result.rows[0].dueAt, null);
  assert.equal(formatReviewTime('2026-10-20T16:03:59Z'), '2026/10/21 00:03');
  assert.equal(formatReviewTime(null), '—');
  assert.equal(formatReviewTime('invalid'), '—');
  assert.doesNotThrow(() => buildReviewStatistics([doc('null-state')], null, now));
});

test('日期范围按北京时间区分过去、今天稍后和次日，暂停优先且旧状态保持不变', () => {
  const documents = [
    'overdue',
    'today-early',
    'today-later',
    'future',
    'fresh',
    'paused-past',
    'paused-today',
    'paused-future',
    'paused-fresh',
  ].map((id) => doc(id));
  const state = stateOf(
    record('overdue', [event('overdue-rating')], { dueAt: '2026-10-20T15:59:59Z' }),
    record('today-early', [event('early-rating')], { dueAt: '2026-10-20T16:00:00Z' }),
    record('today-later', [event('later-rating')], { dueAt: '2026-10-21T15:59:59Z' }),
    record('future', [event('future-rating')], { dueAt: '2026-10-21T16:00:00Z' }),
    record('fresh', [event('fresh-shown', { rating: undefined, presented: true })]),
    record('paused-past', [event('paused-past-rating')], {
      paused: true,
      dueAt: '2026-10-20T15:59:59Z',
    }),
    record('paused-today', [event('paused-today-rating')], { paused: true }),
    record('paused-future', [event('paused-future-rating')], {
      paused: true,
      dueAt: '2026-10-21T16:00:00Z',
    }),
    record('paused-fresh', [], { paused: true }),
  );
  const before = structuredClone({ documents, state });
  const rows = buildReviewStatistics(documents, state, now).rows;
  const byId = new Map(rows.map((row) => [row.doc.id, row]));
  assert.equal(byId.get('today-early')?.status, 'due');
  assert.equal(byId.get('today-later')?.status, 'scheduled');
  assert.equal(byId.get('today-early')?.period, 'today');
  assert.equal(byId.get('today-later')?.period, 'today');
  assert.equal(byId.get('paused-fresh')?.period, 'paused');
  assert.equal(byId.get('fresh')?.period, 'fresh');
  for (const [period, expected] of [
    ['overdue', ['overdue']],
    ['today', ['today-early', 'today-later']],
    ['future', ['future']],
    ['fresh', ['fresh']],
  ] as const) {
    const filtered = buildReviewStatistics(documents, state, now, { period });
    assert.deepEqual(filtered.rows.map((row) => row.doc.id).sort(), [...expected].sort());
    assert.equal(filtered.totals.documents, expected.length);
    assert.equal(filtered.fullCount, documents.length);
  }
  const scheduledToday = buildReviewStatistics(documents, state, now, {
    period: 'today',
    status: 'scheduled',
    search: 'later 数据库',
  });
  assert.deepEqual(
    scheduledToday.rows.map((row) => row.doc.id),
    ['today-later'],
  );
  assert.deepEqual({ documents, state }, before);
  assert.equal(periodLabels, reviewStatisticsPeriodLabels);
  assert.deepEqual(Object.keys(periodLabels).sort(), [
    'fresh',
    'future',
    'overdue',
    'paused',
    'today',
  ]);
});

test('北京时间跨午夜时今日安排转为过去，次日计划转为今日而非按 UTC 日期划分', () => {
  const documents = ['past', 'next'].map((id) => doc(id));
  const state = stateOf(
    record('past', [event('past-rating')], { dueAt: '2026-10-21T15:59:59Z' }),
    record('next', [event('next-rating')], { dueAt: '2026-10-21T16:00:00Z' }),
  );
  const ids = (at: string, period: 'today' | 'overdue' | 'future') =>
    buildReviewStatistics(documents, state, Date.parse(at), { period }).rows.map(
      (row) => row.doc.id,
    );
  assert.deepEqual(ids('2026-10-21T15:59:58Z', 'today'), ['past']);
  assert.deepEqual(ids('2026-10-21T15:59:58Z', 'future'), ['next']);
  assert.deepEqual(ids('2026-10-21T16:00:00Z', 'overdue'), ['past']);
  assert.deepEqual(ids('2026-10-21T16:00:00Z', 'today'), ['next']);
  assert.deepEqual(ids('2026-10-21T16:00:00Z', 'future'), []);
});

test('今日已复习只依据最近真实评分日期，包含后续安排与暂停，排除仅展示或暂停事件', () => {
  const documents = ['rated', 'paused-rated', 'shown', 'paused-only', 'fresh'].map((id) => doc(id));
  const todayRating = '2026-10-20T16:00:00Z';
  const state = stateOf(
    record('rated', [event('rated-today', { reviewedAt: todayRating, rating: 'hard' })], {
      dueAt: '2026-10-21T16:00:00Z',
    }),
    record(
      'paused-rated',
      [
        event('rated-yesterday', { reviewedAt: '2026-10-20T15:59:59Z' }),
        event('paused-rated-today', { reviewedAt: todayRating, rating: 'forgot' }),
        event('pause-today', {
          reviewedAt: '2026-10-21T04:00:00Z',
          rating: undefined,
          paused: true,
        }),
      ],
      { paused: true, dueAt: '2026-10-21T16:00:00Z' },
    ),
    record('shown', [
      event('shown-rating', { reviewedAt: '2026-10-20T15:59:59Z' }),
      event('shown-today', { reviewedAt: todayRating, rating: undefined, presented: true }),
    ]),
    record(
      'paused-only',
      [event('pause-only-today', { reviewedAt: todayRating, rating: undefined, paused: true })],
      { paused: true },
    ),
  );
  const stats = buildReviewStatistics(documents, state, now, { period: 'reviewed-today' });
  assert.deepEqual(stats.rows.map((row) => row.doc.id).sort(), ['paused-rated', 'rated']);
  assert.deepEqual(stats.rows.map((row) => row.period).sort(), ['future', 'paused']);
  assert.ok(stats.rows.every((row) => row.reviewedToday));
  assert.deepEqual(stats.totals, {
    documents: 2,
    reviewed: 2,
    total: 3,
    good: 1,
    hard: 1,
    forgot: 1,
  });
  const other = buildReviewStatistics(documents, state, now).rows.filter(
    (row) => !row.reviewedToday,
  );
  assert.deepEqual(other.map((row) => row.doc.id).sort(), ['fresh', 'paused-only', 'shown']);
  assert.equal(
    buildReviewStatistics(documents, state, Date.parse('2026-10-21T16:00:00Z'), {
      period: 'reviewed-today',
    }).rows.length,
    0,
  );
});

test('提前练习历史展示实际保留的计划，不按练习时间重新推后', () => {
  const documents = [doc('early')];
  let state = reconcileReviews(emptyReviewState(), documents, now);
  const submitAt = (at: number) => {
    state = applyReview(
      state,
      documents,
      {
        version: state.version,
        id: 'early',
        rating: 'good',
        requestId: `practice-${at}`,
        documentUpdated: documents[0].updated,
        documentFingerprint: reviewFingerprint(documents[0]),
      },
      at,
    );
  };
  submitAt(now);
  const dueAt = state.records.early.dueAt;
  submitAt(now + 3_600_000);
  const row = buildReviewStatistics(documents, state, now + 3_600_000).rows[0];
  assert.equal(row.history.length, 2);
  assert.equal(row.history[0].plannedAt, dueAt);
  assert.equal(row.dueAt, dueAt);
});

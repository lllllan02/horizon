import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReview,
  emptyReviewState,
  nextReviewInterval,
  parseReviewState,
  reconcileReviews,
  reviewDay,
  reviewFingerprint,
  reviewQueue,
  type ReviewDocument,
  type ReviewInput,
  type ReviewState,
} from '../src/review-model.ts';

const now = Date.parse('2026-10-20T04:00:00Z');
const day = 86_400_000;
const doc = (id = 'a', extra: Partial<ReviewDocument> = {}): ReviewDocument => ({
  id,
  path: `notes/${id}.md`,
  body: `正文 ${id}`,
  updated: '2026-10-01',
  state: 'organized',
  ...extra,
});
let serial = 0;
function submit(
  state: ReviewState,
  documents: ReviewDocument[],
  id = documents[0].id,
  extra: Partial<ReviewInput> = {},
  at = now,
) {
  const document = documents.find((d) => d.id === id)!;
  return applyReview(
    state,
    documents,
    {
      version: state.version,
      id,
      requestId: `request-${++serial}`,
      documentUpdated: document.updated,
      documentFingerprint: reviewFingerprint(document),
      rating: 'good',
      ...extra,
    },
    at,
  );
}

test('只复习已整理资料，首次每日全局五篇，完成后不会无限补位', () => {
  const documents = [
    ...Array.from({ length: 8 }, (_, i) => doc(`doc-${i}`)),
    doc('pending', { state: 'pending' }),
    doc('reading', { state: 'reading' }),
  ];
  const untouched = structuredClone(documents);
  let state = reconcileReviews(emptyReviewState(), documents, now);
  assert.equal(Object.keys(state.records).length, 8);
  assert.equal(reviewQueue(documents, state, now).fresh.length, 5);
  assert.equal(reviewQueue(documents, state, now).freshRemaining, 3);
  for (let i = 0; i < 5; i++) {
    state = submit(state, documents, `doc-${i}`);
    assert.equal(reviewQueue(documents, state, now).fresh.length, 4 - i);
    assert.equal(reviewQueue(documents, state, now).freshRemaining, 3);
  }
  assert.throws(() => submit(state, documents, 'doc-5'), /首次复习/);
  assert.equal(reviewQueue(documents, state, now + day).fresh.length, 3);
  assert.equal(reviewQueue(documents, state, now + day).due.length, 5);
  assert.equal(reviewQueue(documents, state, now).scheduled.length, 5);
  assert.throws(() => submit(state, documents, 'reading'), /已整理/);
  assert.deepEqual(documents, untouched);
  assert.deepEqual(parseReviewState(JSON.parse(JSON.stringify(state))), state);
});

test('反馈按档位调度，迟复习按实际时间计算，暂停和跳过不构成完成', () => {
  const documents = [doc()];
  let state = reconcileReviews(emptyReviewState(), documents, now);
  assert.equal(nextReviewInterval(undefined, 'good'), 1);
  assert.equal(nextReviewInterval(undefined, 'hard'), 1);
  state = submit(state, documents);
  assert.equal(state.records.a.dueAt, new Date(now + day).toISOString());
  const late = now + day * 4;
  state = submit(state, documents, 'a', {}, late);
  assert.equal(state.records.a.intervalDays, 3);
  assert.equal(state.records.a.dueAt, new Date(late + day * 3).toISOString());
  state = submit(state, documents, 'a', {}, late + day * 3);
  assert.equal(state.records.a.intervalDays, 7);
  state = submit(state, documents, 'a', { rating: 'hard' }, late + day * 10);
  assert.equal(state.records.a.intervalDays, 3);
  state = submit(state, documents, 'a', { rating: 'forgot' }, late + day * 13);
  assert.equal(state.records.a.intervalDays, 1);
  const last = state.records.a.lastReviewedAt;
  state = submit(state, documents, 'a', { rating: undefined, paused: true });
  assert.equal(state.records.a.lastReviewedAt, last);
  assert.equal(reviewQueue(documents, state, now + day * 100).paused.length, 1);
  assert.throws(() => submit(state, documents), /先恢复/);
  state = submit(state, documents, 'a', { rating: undefined, paused: false });
  assert.equal(reviewQueue(documents, state, now + day * 100).due.length, 1);
  assert.equal(reviewQueue([doc('a', { state: 'reading' })], state, now).due.length, 0);
  assert.equal(reviewQueue([doc('a', { state: 'reading' })], state, now).scheduled.length, 0);
  assert.equal(parseReviewState(state), state);
});

test('日界固定北京时间，due按到期时间排序且不消耗首次名额', () => {
  assert.equal(reviewDay('2026-10-20T15:59:59Z'), '2026-10-20');
  assert.equal(reviewDay('2026-10-20T16:00:00Z'), '2026-10-21');
  const documents = [doc('a'), doc('b'), doc('c')];
  let state = reconcileReviews(emptyReviewState(), documents, now);
  state = submit(state, documents, 'b', {}, now - day * 3);
  state = submit(state, documents, 'a', {}, now - day * 2);
  assert.deepEqual(
    reviewQueue(documents, state, now).due.map((d) => d.id),
    ['b', 'a'],
  );
  assert.deepEqual(
    reviewQueue(documents, state, now).fresh.map((d) => d.id),
    ['c'],
  );
});

test('重命名只迁移唯一正文匹配，重复正文保留孤儿且不串历史', () => {
  const original = doc();
  let state = reconcileReviews(emptyReviewState(), [original], now);
  state = submit(state, [original]);
  const renamed = doc('renamed', { body: original.body });
  const migrated = reconcileReviews(state, [renamed], now);
  assert.equal(migrated.records.a, undefined);
  assert.deepEqual(migrated.records.renamed.history, state.records.a.history);
  assert.equal(migrated.records.renamed.lastReviewedAt, state.records.a.lastReviewedAt);
  const ambiguous = reconcileReviews(
    state,
    [renamed, doc('duplicate', { body: original.body })],
    now,
  );
  assert.equal(ambiguous.records.a.history.length, 1);
  assert.equal(ambiguous.records.renamed.history.length, 0);
  assert.equal(ambiguous.records.duplicate.history.length, 0);
  const moved = reconcileReviews(state, [doc('a', { path: 'readings/a.md' })], now);
  assert.equal(moved.records.a.path, 'readings/a.md');
  assert.deepEqual(moved.records.a.history, state.records.a.history);
});

test('实质修订缩短周期，单独正文或元数据变动保持周期和原状态', () => {
  const original = doc();
  let state = reconcileReviews(emptyReviewState(), [original], now);
  for (let i = 0; i < 4; i++)
    state = submit(
      state,
      [original],
      'a',
      {},
      state.records.a.dueAt ? Date.parse(state.records.a.dueAt) : now - 11 * day,
    );
  assert.equal(state.records.a.intervalDays, 14);
  const changed = doc('a', { body: '新正文', updated: '2026-10-20' });
  const revised = reconcileReviews(state, [changed], now);
  assert.equal(revised.records.a.intervalDays, 1);
  assert.equal(revised.records.a.dueAt, new Date(now + day).toISOString());
  assert.equal(changed.state, 'organized');
  assert.deepEqual(revised.records.a.history, state.records.a.history);
  for (const small of [doc('a', { body: '链接调整' }), doc('a', { updated: '2026-10-20' })]) {
    assert.equal(reconcileReviews(state, [small], now).records.a.intervalDays, 14);
  }
  assert.equal(reconcileReviews(revised, [changed], now + day), revised);
  // Source metadata can contain an unknown date; preserve its identity without
  // interpreting it as a revision or making the review file unreadable.
  const undated = reconcileReviews(emptyReviewState(), [doc('unknown', { updated: '未知' })], now);
  assert.equal(parseReviewState(undated), undated);
});

test('幂等重试、版本冲突、迟到正文与参数校验', () => {
  const documents = [doc()];
  const state = reconcileReviews(emptyReviewState(), documents, now);
  const input: ReviewInput = {
    version: state.version,
    id: 'a',
    rating: 'good',
    requestId: 'retry-request',
    documentUpdated: documents[0].updated,
    documentFingerprint: reviewFingerprint(documents[0]),
  };
  const done = applyReview(state, documents, input, now);
  assert.equal(applyReview(done, documents, input, now + day), done);
  assert.throws(() => applyReview(done, documents, { ...input, rating: 'hard' }), /编号/);
  assert.throws(
    () => applyReview(done, documents, { ...input, requestId: 'new-request' }),
    /已更新/,
  );
  assert.throws(() => applyReview(state, [doc('a', { body: '编辑中' })], input), /文章已更新/);
  assert.throws(
    () => applyReview(state, documents, { ...input, documentUpdated: undefined }),
    /文章已更新/,
  );
  for (const bad of [null, [], {}, { ...input, paused: true }, { ...input, rating: 'easy' }])
    assert.throws(() => applyReview(state, documents, bad as ReviewInput), /参数/);
  for (const bad of [
    null,
    {},
    { ...done, version: 'future' },
    { ...done, records: { a: { ...done.records.a, history: [] } } },
  ])
    assert.throws(() => parseReviewState(bad), /格式/);
});

test('已同步的另一会话仍不能重复提交未来复习，同请求可重试且到期可再次反馈', () => {
  const documents = [doc()];
  const state = reconcileReviews(emptyReviewState(), documents, now);
  const input: ReviewInput = {
    version: state.version,
    id: 'a',
    rating: 'good',
    requestId: 'first-session',
    documentUpdated: documents[0].updated,
    documentFingerprint: reviewFingerprint(documents[0]),
  };
  const done = applyReview(state, documents, input, now);
  assert.equal(applyReview(done, documents, input, now + 1), done);
  const secondInput = { ...input, version: done.version, requestId: 'second-session' };
  for (const rating of ['forgot', 'hard', 'good'] as const)
    assert.throws(
      () => applyReview(done, documents, { ...secondInput, rating }, now + day - 1),
      /尚未到期/,
    );
  const second = applyReview(done, documents, secondInput, now + day);
  assert.equal(second.records.a.history.length, 2);
  assert.equal(second.records.a.intervalDays, 3);
  assert.equal(second.records.a.dueAt, new Date(now + day * 4).toISOString());
});

test('旧版记录缺少展示字段仍按原版本读取并保留全部反馈历史', () => {
  const legacy = {
    version: 'reviews-1-143-29178f43-6505e44d',
    records: {
      a: {
        id: 'a',
        path: 'notes/a.md',
        fingerprint: 'legacy-body',
        documentUpdated: '2026-10-01',
        lastReviewedAt: '2026-10-19T04:00:00.000Z',
        dueAt: '2026-10-20T04:00:00.000Z',
        intervalDays: 1,
        paused: false,
        history: [
          {
            requestId: 'legacy-feedback',
            rating: 'good',
            reviewedAt: '2026-10-19T04:00:00.000Z',
            intervalDays: 1,
          },
        ],
      },
    },
  };
  const before = JSON.stringify(legacy);
  const parsed = parseReviewState(legacy);
  assert.equal(parsed, legacy);
  assert.equal(JSON.stringify(parsed), before);
  const reconciled = reconcileReviews(parsed, [doc()], now);
  assert.equal(reconciled.records.a.lastPresentedAt, undefined);
  assert.deepEqual(reconciled.records.a.history, legacy.records.a.history);
  assert.equal(parseReviewState(reconciled), reconciled);
});

test('展示可幂等持久化但不构成复习，不改周期、状态和每日完成额度', () => {
  const documents = Array.from({ length: 8 }, (_, i) => doc(`doc-${i}`));
  const untouched = structuredClone(documents);
  const initial = reconcileReviews(emptyReviewState(), documents, now);
  const input: ReviewInput = {
    version: initial.version,
    id: 'doc-7',
    requestId: 'present-request',
    presented: true,
    documentUpdated: documents[7].updated,
    documentFingerprint: reviewFingerprint(documents[7]),
  };
  const shown = applyReview(initial, documents, input, now);
  assert.equal(shown.records['doc-7'].lastPresentedAt, new Date(now).toISOString());
  assert.equal(shown.records['doc-7'].lastReviewedAt, null);
  assert.equal(shown.records['doc-7'].dueAt, null);
  assert.equal(shown.records['doc-7'].intervalDays, 0);
  assert.equal(reviewQueue(documents, shown, now).fresh.length, 5);
  assert.equal(reviewQueue(documents, shown, now).eligibleFresh.length, 8);
  assert.equal(applyReview(shown, documents, input, now + 100), shown);
  assert.equal(parseReviewState(shown), shown);
  assert.throws(
    () => applyReview(shown, documents, { ...input, presented: undefined, rating: 'good' }),
    /编号/,
  );
  for (const extra of [
    { presented: false },
    { presented: true, rating: 'good' },
    { presented: true, paused: false },
  ])
    assert.throws(
      () => applyReview(initial, documents, { ...input, ...extra } as ReviewInput, now),
      /参数/,
    );
  const finished = submit(shown, documents, 'doc-7', {}, now + 10);
  assert.equal(finished.records['doc-7'].lastPresentedAt, shown.records['doc-7'].lastPresentedAt);
  assert.equal(finished.records['doc-7'].lastReviewedAt, new Date(now + 10).toISOString());
  assert.deepEqual(documents, untouched);
});

test('刷新后从全部未完成资料轮换，超过五篇也不困在窗口内，同一毫秒仍能轮换', () => {
  const documents = Array.from({ length: 8 }, (_, i) => doc(`doc-${i}`));
  let state = reconcileReviews(emptyReviewState(), documents, now);
  const selected: string[] = [];
  for (let i = 0; i < 16; i++) {
    const queue = reviewQueue(documents, state, now);
    assert.equal(queue.fresh.length, 5);
    assert.equal(queue.eligibleFresh.length, 8);
    const id = queue.eligibleFresh[0].id;
    selected.push(id);
    state = submit(state, documents, id, { rating: undefined, presented: true });
    state = parseReviewState(JSON.parse(JSON.stringify(state)));
  }
  assert.equal(new Set(selected.slice(0, 8)).size, 8);
  assert.deepEqual(selected.slice(8), selected.slice(0, 8));
  assert.ok(Object.values(state.records).every((record) => record.lastReviewedAt === null));
});

test('未展示候选优先切换专题，展示过的资料按最久展示顺序返回', () => {
  const documents = [
    doc('a', { category: '数据库' }),
    doc('b', { category: '数据库' }),
    doc('c', { category: 'Go' }),
    doc('d', { category: 'Go' }),
  ];
  let state = reconcileReviews(emptyReviewState(), documents, now);
  const order: string[] = [];
  for (let i = 0; i < 4; i++) {
    const id = reviewQueue(documents, state, now).eligibleFresh[0].id;
    order.push(id);
    state = submit(state, documents, id, { rating: undefined, presented: true }, now + i);
  }
  assert.deepEqual(order, ['a', 'c', 'b', 'd']);
  assert.deepEqual(
    reviewQueue(documents, state, now + 5).eligibleFresh.map((item) => item.id),
    order,
  );
});

test('任意未完成候选可反馈，但展示和刷新不能绕过每天五篇首次完成额度', () => {
  const documents = Array.from({ length: 9 }, (_, i) => doc(`doc-${i}`));
  let state = reconcileReviews(emptyReviewState(), documents, now);
  for (const id of ['doc-8', 'doc-7', 'doc-6', 'doc-5', 'doc-4']) {
    state = submit(state, documents, id, { rating: undefined, presented: true });
    state = submit(state, documents, id);
    state = parseReviewState(JSON.parse(JSON.stringify(state)));
  }
  assert.equal(reviewQueue(documents, state, now).eligibleFresh.length, 0);
  assert.equal(reviewQueue(documents, state, now).fresh.length, 0);
  assert.throws(() => submit(state, documents, 'doc-0'), /首次复习/);
  assert.throws(
    () => submit(state, documents, 'doc-0', { rating: undefined, presented: true }),
    /首次复习/,
  );
  // Removing completed documents must not restore their consumed quota.
  assert.equal(reviewQueue(documents.slice(0, 4), state, now).eligibleFresh.length, 0);
  assert.equal(reviewQueue(documents, state, now + day).eligibleFresh.length, 4);
});

test('到期队列优先未展示资料，同日展示后降位，到期时间相同优先忘记和模糊', () => {
  const documents = [doc('a'), doc('b'), doc('c'), doc('older'), doc('fresh')];
  let state = reconcileReviews(emptyReviewState(), documents, now);
  state = submit(state, documents, 'a', { rating: 'good' }, now - 2 * day);
  state = submit(state, documents, 'b', { rating: 'hard' }, now - 2 * day);
  state = submit(state, documents, 'c', { rating: 'forgot' }, now - 2 * day);
  state = submit(state, documents, 'older', {}, now - 3 * day);
  const due = (at = now) => reviewQueue(documents, state, at).due.map((item) => item.id);
  assert.deepEqual(due(), ['older', 'c', 'b', 'a']);
  state = submit(state, documents, 'older', { rating: undefined, presented: true });
  assert.deepEqual(due(), ['c', 'b', 'a', 'older']);
  state = parseReviewState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(due(), ['c', 'b', 'a', 'older']);
  state = submit(state, documents, 'c', { rating: 'forgot' }, now);
  assert.deepEqual(due(), ['b', 'a', 'older']);
  assert.deepEqual(due(now + day), ['older', 'b', 'a', 'c']);
  assert.equal(reviewQueue(documents, state, now).eligibleFresh[0].id, 'fresh');
});

test('展示不能绕过暂停、未来到期、原文变化或整理状态检查', () => {
  const documents = [doc(), doc('reading', { state: 'reading' })];
  const initial = reconcileReviews(emptyReviewState(), documents, now);
  const shown = { rating: undefined, presented: true } as const;
  const paused = submit(initial, documents, 'a', { rating: undefined, paused: true });
  assert.throws(() => submit(paused, documents, 'a', shown), /先恢复/);
  const done = submit(initial, documents);
  assert.throws(() => submit(done, documents, 'a', shown), /尚未到期/);
  assert.throws(() => submit(initial, documents, 'reading', shown), /已整理/);
  assert.throws(
    () => submit(initial, documents, 'a', { ...shown, documentFingerprint: 'stale' }),
    /文章已更新/,
  );
});

test('今日所有到期资料都展示后仍按展示先后轮转，不反复停在最旧的一篇', () => {
  const documents = [doc('a'), doc('b'), doc('c')];
  let state = reconcileReviews(emptyReviewState(), documents, now);
  for (const [i, document] of documents.entries())
    state = submit(state, documents, document.id, {}, now - (5 - i) * day);
  const order: string[] = [];
  for (let i = 0; i < 7; i++) {
    const id = reviewQueue(documents, state, now).due[0].id;
    order.push(id);
    state = submit(state, documents, id, { rating: undefined, presented: true });
    state = parseReviewState(JSON.parse(JSON.stringify(state)));
  }
  assert.deepEqual(order, ['a', 'b', 'c', 'a', 'b', 'c', 'a']);
  assert.equal(state.records.a.lastReviewedAt, new Date(now - 5 * day).toISOString());
});

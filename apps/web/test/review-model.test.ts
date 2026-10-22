import test from 'node:test';
import assert from 'node:assert/strict';
import { beijingTimestamp, documentTime } from '../src/document-dates.ts';
import { parseReviewPriorities } from '../src/review-priorities.ts';
import {
  applyReview,
  emptyReviewState,
  nextReviewInterval,
  parseReviewState,
  reconcileReviews,
  reviewDay,
  reviewFingerprint,
  reviewQueue,
  reviewStateFromRecords,
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

test('目录优先级用于首次推荐，未展示优先，跨目录多轮轮换且不修改历史', () => {
  const documents = [
    doc('a-glossary', { collection: 'glossary' }),
    doc('b-reading', { collection: 'readings' }),
    doc('c-note', { collection: 'notes', category: '其他专题' }),
    doc('d-interview', { collection: 'interviews', category: '最近专题' }),
    doc('e-interview', { collection: 'interviews', category: '最近专题' }),
  ];
  let state = reconcileReviews(emptyReviewState(), documents, now);
  const order: string[] = [];
  for (let i = 0; i < documents.length * 2; i++) {
    const before = structuredClone(state);
    const queue = reviewQueue(documents, state, now);
    assert.deepEqual(state, before);
    const id = queue.recommendations[0].id;
    order.push(id);
    state = submit(state, documents, id, { rating: undefined, presented: true }, now);
    state = parseReviewState(JSON.parse(JSON.stringify(state)));
  }
  const expected = ['d-interview', 'e-interview', 'c-note', 'a-glossary', 'b-reading'];
  assert.deepEqual(order, [...expected, ...expected]);
  assert.ok(Object.values(state.records).every((record) => record.lastReviewedAt === null));
  // Next Beijing day restores directory preference among previously shown items.
  assert.equal(reviewQueue(documents, state, now + day).fresh[0].id, 'd-interview');
  const added = [...documents, doc('new-low', { collection: 'glossary' })];
  assert.equal(reviewQueue(added, state, now + day).fresh[0].id, 'new-low');
});

test('推荐使用读取的设置，支持自定义目录、零优先级和未知目录默认值', () => {
  const documents = [
    doc('a-interview', { collection: 'interviews' }),
    doc('b-reference', { collection: 'reference' }),
    doc('c-note', { collection: 'notes' }),
    doc('d-unknown', { collection: 'unconfigured' }),
  ];
  const priorities = parseReviewPriorities({ interviews: 0, reference: 9, notes: 2 });
  assert.deepEqual(
    reviewQueue(documents, emptyReviewState(), now, priorities).fresh.map((item) => item.id),
    ['b-reference', 'c-note', 'a-interview', 'd-unknown'],
  );
  for (const value of [
    null,
    [],
    { notes: -1 },
    { notes: 0.5 },
    { notes: '3' },
    { '../x': 1 },
    { notes: Number.MAX_SAFE_INTEGER + 1 },
  ])
    assert.throws(() => parseReviewPriorities(value), /优先级/);
});

test('到期仍先于首次和提前练习，同组目录优先并保留同日展示轮换', () => {
  const documents = [
    doc('due-note', { collection: 'notes' }),
    doc('due-interview', { collection: 'interviews' }),
    doc('fresh-interview', { collection: 'interviews' }),
    doc('practice-interview', { collection: 'interviews' }),
    doc('paused-interview', { collection: 'interviews' }),
    doc('reading-interview', { collection: 'interviews', state: 'reading' }),
  ];
  let state = reconcileReviews(emptyReviewState(), documents, now);
  state = submit(state, documents, 'due-note', {}, now - 5 * day);
  state = submit(state, documents, 'due-interview', {}, now - 2 * day);
  state = submit(state, documents, 'practice-interview', {}, now);
  state = submit(state, documents, 'paused-interview', { rating: undefined, paused: true });
  assert.deepEqual(
    reviewQueue(documents, state, now).recommendations.map((item) => item.id),
    ['due-interview', 'due-note', 'fresh-interview', 'practice-interview'],
  );
  state = submit(state, documents, 'due-interview', { rating: undefined, presented: true });
  assert.deepEqual(
    reviewQueue(documents, state, now).due.map((item) => item.id),
    ['due-note', 'due-interview'],
  );
});

test('提前练习按目录优先，每日参与后让位并持续轮换，计划列表仍按到期时间', () => {
  const documents = [
    doc('a-note', { collection: 'notes' }),
    doc('b-interview', { collection: 'interviews' }),
    doc('c-glossary', { collection: 'glossary' }),
  ];
  let state = reconcileReviews(emptyReviewState(), documents, now);
  // Reach a three-day interval with deliberately different participation times.
  for (const [i, document] of documents.entries()) {
    state = submit(state, documents, document.id, {}, now - 3 * day + i);
    state = submit(state, documents, document.id, {}, now - 2 * day + i);
  }
  const original = structuredClone(state);
  assert.deepEqual(
    reviewQueue(documents, state, now).scheduled.map((item) => item.id),
    ['a-note', 'b-interview', 'c-glossary'],
  );
  const order: string[] = [];
  for (let i = 0; i < 6; i++) {
    const id = reviewQueue(documents, state, now + i).recommendations[0].id;
    order.push(id);
    // A direct rating also yields, even without a presentation event.
    state = submit(state, documents, id, {}, now + i);
    state = parseReviewState(JSON.parse(JSON.stringify(state)));
  }
  assert.deepEqual(order, [
    'b-interview',
    'a-note',
    'c-glossary',
    'b-interview',
    'a-note',
    'c-glossary',
  ]);
  for (const document of documents) {
    assert.equal(state.records[document.id].dueAt, original.records[document.id].dueAt);
    assert.equal(state.records[document.id].intervalDays, 3);
  }
});

test('只复习已整理资料，首次不限量，完成后仍可继续下一轮', () => {
  const documents = [
    ...Array.from({ length: 8 }, (_, i) => doc(`doc-${i}`)),
    doc('pending', { state: 'pending' }),
    doc('reading', { state: 'reading' }),
  ];
  const untouched = structuredClone(documents);
  let state = reconcileReviews(emptyReviewState(), documents, now);
  assert.equal(Object.keys(state.records).length, 8);
  assert.equal(reviewQueue(documents, state, now).fresh.length, 8);
  for (let i = 0; i < 8; i++) {
    state = submit(state, documents, `doc-${i}`);
    assert.equal(reviewQueue(documents, state, now).fresh.length, 7 - i);
  }
  assert.equal(reviewQueue(documents, state, now).recommendations.length, 8);
  assert.equal(reviewQueue(documents, state, now + day).fresh.length, 0);
  assert.equal(reviewQueue(documents, state, now + day).due.length, 8);
  assert.equal(reviewQueue(documents, state, now).scheduled.length, 8);
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
  assert.equal(state.records.a.dueAt, beijingTimestamp(now + day));
  const late = now + day * 4;
  state = submit(state, documents, 'a', {}, late);
  assert.equal(state.records.a.intervalDays, 3);
  assert.equal(state.records.a.dueAt, beijingTimestamp(late + day * 3));
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

test('日界固定北京时间，due按到期时间排序并保留未复习资料', () => {
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
      state.records.a.dueAt ? documentTime(state.records.a.dueAt) : now - 11 * day,
    );
  assert.equal(state.records.a.intervalDays, 14);
  const changed = doc('a', { body: '新正文', updated: '2026-10-20' });
  const revised = reconcileReviews(state, [changed], now);
  assert.equal(revised.records.a.intervalDays, 1);
  assert.equal(revised.records.a.dueAt, beijingTimestamp(now + day));
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

test('无偏移的正文更新时间按北京时间比较，早于旧偏移时刻不会缩短周期', () => {
  const original = doc('a', { updated: '2026-10-20T04:00:00Z' });
  let state = reconcileReviews(emptyReviewState(), [original], now);
  for (let i = 0; i < 3; i++)
    state = submit(
      state,
      [original],
      'a',
      {},
      state.records.a.dueAt ? documentTime(state.records.a.dueAt) : now - 4 * day,
    );
  assert.equal(state.records.a.intervalDays, 7);
  for (const updated of ['2026-10-20T11:59:59', '2026-10-20T12:00:00']) {
    const changed = doc('a', { body: '更新正文', updated });
    assert.equal(reconcileReviews(state, [changed], now).records.a.intervalDays, 7);
  }
  const revised = reconcileReviews(
    state,
    [doc('a', { body: '更新正文', updated: '2026-10-20T12:00:01' })],
    now,
  );
  assert.equal(revised.records.a.intervalDays, 1);
  assert.equal(revised.records.a.dueAt, '2026-10-21 12:00:00.000');
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

test('同请求幂等，提前练习不推长周期，到期评分正常升档', () => {
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
  for (const rating of ['forgot', 'hard', 'good'] as const) {
    const practice = applyReview(done, documents, { ...secondInput, rating }, now + day - 1);
    assert.equal(practice.records.a.intervalDays, 1);
    assert.equal(practice.records.a.dueAt, done.records.a.dueAt);
    assert.equal(practice.records.a.history.length, 2);
    assert.equal(parseReviewState(practice), practice);
  }
  const second = applyReview(done, documents, secondInput, now + day);
  assert.equal(second.records.a.history.length, 2);
  assert.equal(second.records.a.intervalDays, 3);
  assert.equal(second.records.a.dueAt, beijingTimestamp(now + day * 4));
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
  const completed = submit(reconciled, [doc()], 'a', {}, now);
  assert.deepEqual(completed.records.a.history.slice(0, 1), legacy.records.a.history);
  assert.equal(completed.records.a.lastReviewedAt, '2026-10-20 12:00:00.000');
  assert.equal(completed.records.a.dueAt, '2026-10-23 12:00:00.000');
  assert.equal(parseReviewState(completed), completed);
});

test('展示可幂等持久化但不构成复习，不改周期、状态和完成次数', () => {
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
  assert.equal(shown.records['doc-7'].lastPresentedAt, beijingTimestamp(now));
  assert.equal(shown.records['doc-7'].lastReviewedAt, null);
  assert.equal(shown.records['doc-7'].dueAt, null);
  assert.equal(shown.records['doc-7'].intervalDays, 0);
  assert.equal(reviewQueue(documents, shown, now).fresh.length, 8);
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
  assert.equal(finished.records['doc-7'].lastReviewedAt, beijingTimestamp(now + 10));
  assert.deepEqual(documents, untouched);
});

test('刷新后从全部未完成资料轮换，超过五篇也不困在窗口内，同一毫秒仍能轮换', () => {
  const documents = Array.from({ length: 8 }, (_, i) => doc(`doc-${i}`));
  let state = reconcileReviews(emptyReviewState(), documents, now);
  const selected: string[] = [];
  for (let i = 0; i < 16; i++) {
    const queue = reviewQueue(documents, state, now);
    assert.equal(queue.fresh.length, 8);
    const id = queue.fresh[0].id;
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
    const id = reviewQueue(documents, state, now).fresh[0].id;
    order.push(id);
    state = submit(state, documents, id, { rating: undefined, presented: true }, now + i);
  }
  assert.deepEqual(order, ['a', 'c', 'b', 'd']);
  assert.deepEqual(
    reviewQueue(documents, state, now + 5).fresh.map((item) => item.id),
    order,
  );
});

test('新增已整理资料立即加入推荐，不受当天完成量或已删除资料历史影响', () => {
  const documents = Array.from({ length: 9 }, (_, i) => doc(`doc-${i}`));
  let state = reconcileReviews(emptyReviewState(), documents, now);
  for (const document of documents) state = submit(state, documents, document.id);
  const added = [...documents, doc('new')];
  state = reconcileReviews(state, added, now);
  assert.equal(reviewQueue(added, state, now).recommendations[0].id, 'new');
  state = submit(state, added, 'new');
  assert.equal(reviewQueue(added, state, now).recommendations.length, 10);
  assert.equal(reviewQueue(added.slice(-1), state, now).recommendations.length, 1);
});

test('全部完成后持续轮转多轮，刷新保持顺序且提前记得不改变计划', () => {
  const documents = [doc('a'), doc('b'), doc('c')];
  let state = reconcileReviews(emptyReviewState(), documents, now);
  const order: string[] = [];
  for (let i = 0; i < 12; i++) {
    const at = now + i;
    const id = reviewQueue(documents, state, at).recommendations[0].id;
    order.push(id);
    state = submit(state, documents, id, { rating: undefined, presented: true }, at);
    state = submit(state, documents, id, {}, at);
    state = parseReviewState(JSON.parse(JSON.stringify(state)));
  }
  assert.deepEqual(order, Array.from({ length: 4 }, () => ['a', 'b', 'c']).flat());
  for (const [index, document] of documents.entries()) {
    const record = state.records[document.id];
    assert.equal(record.history.filter((event) => event.rating).length, 4);
    assert.equal(record.intervalDays, 1);
    assert.equal(record.dueAt, beijingTimestamp(now + index + day));
  }
});

test('提前忘记或模糊可缩短计划，记得不会延长，暂停和未整理不会补入下一轮', () => {
  const documents = [doc('a'), doc('paused'), doc('reading', { state: 'reading' })];
  let state = reconcileReviews(emptyReviewState(), documents, now);
  state = submit(state, documents, 'a', {}, now - 5 * day);
  state = submit(state, documents, 'a', {}, now - 4 * day);
  state = submit(state, documents, 'a', {}, now - day);
  assert.equal(state.records.a.intervalDays, 7);
  state = submit(state, documents, 'paused', { rating: undefined, paused: true });
  assert.deepEqual(
    reviewQueue(documents, state, now).recommendations.map((item) => item.id),
    ['a'],
  );
  for (const [rating, interval] of [
    ['good', 7],
    ['hard', 3],
    ['forgot', 1],
  ] as const) {
    const practiced = submit(state, documents, 'a', { rating });
    assert.equal(practiced.records.a.intervalDays, interval);
    assert.equal(
      practiced.records.a.dueAt,
      rating === 'good' ? state.records.a.dueAt : beijingTimestamp(now + interval * day),
    );
  }
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
  assert.equal(reviewQueue(documents, state, now).fresh[0].id, 'fresh');
});

test('提前展示不改计划，仍校验暂停、原文变化和整理状态', () => {
  const documents = [doc(), doc('reading', { state: 'reading' })];
  const initial = reconcileReviews(emptyReviewState(), documents, now);
  const shown = { rating: undefined, presented: true } as const;
  const paused = submit(initial, documents, 'a', { rating: undefined, paused: true });
  assert.throws(() => submit(paused, documents, 'a', shown), /先恢复/);
  const done = submit(initial, documents);
  const practiced = submit(done, documents, 'a', shown);
  assert.equal(practiced.records.a.dueAt, done.records.a.dueAt);
  assert.equal(practiced.records.a.lastReviewedAt, done.records.a.lastReviewedAt);
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
  assert.equal(state.records.a.lastReviewedAt, beijingTimestamp(now - 5 * day));
});

test('摘要计数验证并随评分增量更新，推荐轮转使用全量次数', () => {
  const documents = [doc('a'), doc('b')];
  let state = reconcileReviews(emptyReviewState(), documents, now);
  state = submit(state, documents, 'a');
  state = submit(state, documents, 'b');
  const a = { ...state.records.a, counts: { good: 10, hard: 3, forgot: 2 } };
  const b = { ...state.records.b, counts: { good: 2, hard: 0, forgot: 0 } };
  const summary = reviewStateFromRecords({ a, b });
  assert.equal(parseReviewState(summary), summary);
  assert.deepEqual(
    reviewQueue(documents, summary, now).recommendations.map((item) => item.id),
    ['b', 'a'],
  );
  const next = submit(summary, documents, 'a', { rating: 'hard' });
  assert.deepEqual(next.records.a.counts, { good: 10, hard: 4, forgot: 2 });
  assert.equal(parseReviewState(next), next);
  assert.deepEqual(summary.records.a.counts, { good: 10, hard: 3, forgot: 2 });
  const paused = submit(next, documents, 'a', { rating: undefined, paused: true });
  assert.deepEqual(paused.records.a.counts, next.records.a.counts);
  for (const counts of [
    { good: -1, hard: 0, forgot: 0 },
    { good: 0, hard: 0, forgot: 0 },
    { good: 1.5, hard: 0, forgot: 0 },
    { good: Number.MAX_SAFE_INTEGER + 1, hard: 0, forgot: 0 },
    { good: Number.MAX_SAFE_INTEGER, hard: 1, forgot: 0 },
    { good: 1, hard: 0 },
  ])
    assert.throws(
      () => parseReviewState(reviewStateFromRecords({ a: { ...a, counts } as typeof a })),
      /格式/,
    );
});

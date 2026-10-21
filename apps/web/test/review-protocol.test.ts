import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReview,
  emptyReviewState,
  reconcileReviews,
  reviewFingerprint,
  reviewStateFromRecords,
  type ReviewDocument,
} from '../src/review-model.ts';
import {
  createReviewUpdate,
  mergeReviewUpdate,
  parseReviewHistoryPage,
  reviewHistoryPage,
} from '../src/review-protocol.ts';

const doc = (id: string): ReviewDocument => ({
  id,
  path: `notes/${id}.md`,
  body: id,
  updated: null,
  state: 'organized',
});
const documents = [doc('a'), doc('b')];
const initial = () =>
  reconcileReviews(emptyReviewState(), documents, Date.parse('2026-10-21T04:00:00Z'));
const review = (state: ReturnType<typeof initial>, n = 1) =>
  applyReview(
    state,
    documents,
    {
      version: state.version,
      id: 'a',
      rating: 'good',
      requestId: `protocol-request-${n}`,
      documentUpdated: null,
      documentFingerprint: reviewFingerprint(documents[0]),
    },
    Date.parse('2026-10-21T04:00:00Z') + n,
  );

test('增量仅含变更行，合并校验完整hash，删除和新增也保留其余记录', () => {
  const before = initial();
  const after = review(before);
  const patch = createReviewUpdate(before, after);
  assert.deepEqual(Object.keys(patch.records), ['a']);
  assert.deepEqual(patch.removed, []);
  const merged = mergeReviewUpdate(before, patch)!;
  assert.deepEqual(merged, after);
  assert.equal(merged.records.b, before.records.b);
  assert.equal(before.records.a.history.length, 0);
  const renamed = reviewStateFromRecords({
    b: after.records.b,
    renamed: { ...after.records.a, id: 'renamed' },
  });
  assert.deepEqual(mergeReviewUpdate(after, createReviewUpdate(after, renamed)), renamed);
});

test('缺少快照或版本不符必须重新读取，损坏增量不能作为完整state采用', () => {
  const before = initial();
  const after = review(before);
  const patch = createReviewUpdate(before, after);
  assert.equal(mergeReviewUpdate(null, patch), null);
  assert.equal(mergeReviewUpdate(after, patch), null);
  assert.throws(() => mergeReviewUpdate(before, after), /增量/);
  assert.throws(() => mergeReviewUpdate(before, { ...patch, version: before.version }), /格式/);
  assert.throws(() => mergeReviewUpdate(before, { ...patch, removed: [2] }), /增量/);
});

test('浏览器完整history按需分页，展示和暂停不混入评分，精确保留当时计划', () => {
  let state = initial();
  for (let n = 0; n < 45; n++) {
    state = review(state, n);
    if (n % 5 === 0)
      state = applyReview(state, documents, {
        version: state.version,
        id: 'a',
        presented: true,
        requestId: `shown-request-${n}`,
        documentUpdated: null,
        documentFingerprint: reviewFingerprint(documents[0]),
      });
  }
  const pages = [
    reviewHistoryPage(state, 'a'),
    reviewHistoryPage(state, 'a', 20),
    reviewHistoryPage(state, 'a', 40),
  ];
  assert.deepEqual(
    pages.map((page) => page.events.length),
    [20, 20, 5],
  );
  assert.deepEqual(
    pages.map((page) => page.nextCursor),
    [20, 40, null],
  );
  assert.deepEqual(
    pages.flatMap((page) => page.events.map((event) => event.requestId)),
    Array.from({ length: 45 }, (_, i) => `protocol-request-${44 - i}`),
  );
  assert.ok(pages.every((page) => page.events.every((event) => event.rating && event.dueAt)));
  for (const page of pages) assert.deepEqual(parseReviewHistoryPage(page), page);
  assert.deepEqual(reviewHistoryPage(state, 'missing').events, []);
  assert.throws(() => reviewHistoryPage(state, 'a', -1), /分页/);
  assert.throws(() => parseReviewHistoryPage({ ...pages[0], nextCursor: -1 }), /格式/);
  assert.throws(
    () =>
      parseReviewHistoryPage({
        ...pages[0],
        events: [{ ...pages[0].events[0], rating: undefined, presented: true }],
      }),
    /格式/,
  );
});

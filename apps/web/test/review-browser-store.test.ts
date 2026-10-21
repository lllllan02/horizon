import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewHistoryPage } from '../src/review-protocol.ts';
import { createBrowserReviewStore } from '../src/data/review-browser-store.ts';
import { parseDocument, renderDocument } from '../src/library.ts';
import { reviewFingerprint, reviewQueue } from '../src/review-model.ts';

function fixture() {
  const parsed = parseDocument(
    '---\nlearning_status: organized\n---\n独立的复习正文',
    'notes/review.md',
  );
  const doc = renderDocument(parsed, [parsed]);
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  return { doc, data, storage, store: createBrowserReviewStore(storage, 'reviews') };
}

test('浏览器进度持久化、重复请求幂等，原文与整理状态保持不变', async () => {
  const { doc, store, storage } = fixture();
  const original = JSON.stringify(doc);
  const first = await store.load([doc]);
  assert.equal(first.records[doc.id].lastReviewedAt, null);
  const input = {
    id: doc.id,
    version: first.version,
    requestId: 'browser-review-001',
    rating: 'good' as const,
    documentUpdated: doc.updated,
    documentFingerprint: reviewFingerprint(doc),
  };
  const next = await store.update([doc], input);
  const restored = await createBrowserReviewStore(storage, 'reviews').load([doc]);
  assert.deepEqual(next, restored);
  assert.equal(restored.records[doc.id].history.length, 1);
  assert.deepEqual(await store.update([doc], input), next);
  assert.equal(JSON.stringify(doc), original);
});

test('展示历史跨浏览器存储实例保留，重载后从全部未复习资料继续推荐', async () => {
  const { doc, store, storage } = fixture();
  const documents = [
    doc,
    ...Array.from({ length: 7 }, (_, i) => ({
      ...doc,
      id: `other-${i}`,
      path: `notes/other-${i}.md`,
      body: `其他正文 ${i}`,
    })),
  ];
  const before = JSON.stringify(documents);
  let state = await store.load(documents);
  const seen: string[] = [];
  for (let i = 0; i < documents.length; i++) {
    const next = reviewQueue(documents, state).fresh[0];
    seen.push(next.id);
    const input = {
      version: state.version,
      id: next.id,
      requestId: `browser-present-${i}`,
      presented: true as const,
      documentUpdated: next.updated,
      documentFingerprint: reviewFingerprint(next),
    };
    const shown = await store.update(documents, input);
    assert.deepEqual(await store.update(documents, input), shown);
    state = await createBrowserReviewStore(storage, 'reviews').load(documents);
    assert.deepEqual(state, shown);
    assert.equal(reviewQueue(documents, state).fresh.length, 8);
  }
  assert.equal(new Set(seen).size, documents.length);
  assert.equal(reviewQueue(documents, state).fresh[0].id, seen[0]);
  assert.ok(Object.values(state.records).every((record) => record.lastReviewedAt === null));
  assert.equal(JSON.stringify(documents), before);
});

test('失效版本拒绝覆盖另一标签页已保存的结果', async () => {
  const { doc, store } = fixture();
  const first = await store.load([doc]);
  const input = {
    id: doc.id,
    version: first.version,
    requestId: 'browser-review-002',
    rating: 'forgot' as const,
    documentUpdated: doc.updated,
    documentFingerprint: reviewFingerprint(doc),
  };
  const next = await store.update([doc], input);
  await assert.rejects(
    store.update([doc], { ...input, requestId: 'browser-review-003' }),
    /已更新/,
  );
  assert.deepEqual(await store.load([doc]), next);
});

test('损坏记录和存储写失败均显式失败，保留原记录', async () => {
  const { doc, store, data, storage } = fixture();
  data.set('reviews', '{broken');
  await assert.rejects(store.load([doc]), /原记录/);
  assert.equal(data.get('reviews'), '{broken');
  data.delete('reviews');
  const blocked = createBrowserReviewStore(
    {
      ...storage,
      setItem: () => {
        throw Error('storage blocked');
      },
    },
    'reviews',
  );
  await assert.rejects(blocked.load([doc]), /storage blocked/);
  assert.equal(data.has('reviews'), false);
});

test('浏览器保留完整历史供分页和旧请求确认，摘要升级不截断localStorage', async () => {
  const { doc, store, storage } = fixture();
  let state = await store.load([doc]);
  const firstInput = {
    id: doc.id,
    version: state.version,
    requestId: 'full-history-first',
    rating: 'good' as const,
    documentUpdated: doc.updated,
    documentFingerprint: reviewFingerprint(doc),
  };
  state = await store.update([doc], firstInput);
  for (let n = 0; n < 43; n++)
    state = await store.update([doc], {
      ...firstInput,
      version: state.version,
      requestId: `full-history-next-${n}`,
    });
  const restored = await createBrowserReviewStore(storage, 'reviews').load([doc]);
  assert.equal(restored.records[doc.id].counts, undefined);
  assert.equal(restored.records[doc.id].history.length, 44);
  const first = reviewHistoryPage(restored, doc.id);
  const second = reviewHistoryPage(restored, doc.id, first.nextCursor!);
  const third = reviewHistoryPage(restored, doc.id, second.nextCursor!);
  assert.deepEqual([first.events.length, second.events.length, third.events.length], [20, 20, 4]);
  assert.equal(third.events.at(-1)?.requestId, firstInput.requestId);
  assert.deepEqual(await store.update([doc], firstInput), restored);
});

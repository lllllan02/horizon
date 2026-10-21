import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.ts';
import { loadLibrary } from '../src/library.ts';
import {
  applyReview,
  emptyReviewState,
  reconcileReviews,
  reviewFingerprint,
} from '../src/review-model.ts';
import { mergeReviewUpdate } from '../src/review-protocol.ts';

test('SQLite接口返回有界摘要和单题增量，历史分页完整，旧请求仍能确认和幂等重试', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'horizon-storage-api-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'notes'));
  const raw = '---\ntitle: 测试\nlearning_status: organized\n---\n原始正文';
  for (const id of ['a', 'b']) await writeFile(path.join(root, `notes/${id}.md`), raw + id);
  const library = await loadLibrary(root);
  const doc = library.documents.find((doc) => doc.id === 'a')!;
  let legacy = reconcileReviews(emptyReviewState(), library.documents);
  for (let i = 0; i < 45; i++)
    legacy = applyReview(
      legacy,
      library.documents,
      {
        version: legacy.version,
        id: 'a',
        requestId: `legacy-request-${i}`,
        rating: 'good',
        documentUpdated: doc.updated,
        documentFingerprint: reviewFingerprint(doc),
      },
      Date.parse('2026-10-21T04:00:00Z') + i,
    );
  const source = JSON.stringify(legacy);
  await writeFile(path.join(root, '.reviews.json'), source);
  const app = await startServer({ root, port: 0, optimizeDependencies: false, development: true });
  t.after(() => app.close());
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const headers = { 'Sec-Fetch-Site': 'same-origin' };
  const get = (route: string) => fetch(url + route, { headers });
  const before = await (await get('/api/reviews')).json();
  assert.equal(before.records.a.counts.good, 45);
  assert.equal(before.records.a.history.length, 1);
  const input = {
    version: before.version,
    id: 'a',
    requestId: 'new-rating-request',
    rating: 'hard',
    documentUpdated: doc.updated,
    documentFingerprint: reviewFingerprint(doc),
  };
  const post = (value: unknown) =>
    fetch(url + '/api/reviews', {
      method: 'POST',
      headers: { Origin: url, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
  const response = await post(input);
  assert.equal(response.status, 200);
  const patch = await response.json();
  assert.equal(patch.kind, 'review-update');
  assert.deepEqual(Object.keys(patch.records), ['a']);
  assert.ok(patch.records.a.history.length <= 2);
  const state = mergeReviewUpdate(before, patch)!;
  assert.equal(state.records.a.counts!.good, 45);
  assert.equal(state.records.a.counts!.hard, 1);
  assert.equal(state.records.b, before.records.b);
  const ids: string[] = [];
  let cursor = 0;
  do {
    const page = await (await get(`/api/reviews/history?id=a&cursor=${cursor}&limit=20`)).json();
    assert.ok(page.events.length <= 20);
    ids.push(...page.events.map((event: { requestId: string }) => event.requestId));
    cursor = page.nextCursor;
  } while (cursor !== null);
  assert.equal(ids.length, 46);
  assert.equal(new Set(ids).size, 46);
  assert.equal(ids[0], input.requestId);
  assert.equal(ids.at(-1), 'legacy-request-0');
  assert.deepEqual(await (await get('/api/reviews/request?requestId=legacy-request-0')).json(), {
    found: true,
  });
  const retried = await post({
    ...input,
    version: 'old-version',
    requestId: 'legacy-request-0',
    rating: 'good',
  });
  assert.equal(retried.status, 200);
  assert.deepEqual((await retried.json()).records, {});
  assert.equal((await (await get('/api/reviews')).json()).records.a.counts.good, 45);
  assert.equal(await readFile(path.join(root, '.reviews.json'), 'utf8'), source);
  for (const route of [
    '/api/reviews/history?id=a',
    '/api/reviews/request?requestId=legacy-request-0',
  ])
    assert.equal((await fetch(url + route)).status, 403);
  for (const query of ['id=a&cursor=-1', 'id=a&limit=101', 'id=a&cursor=nan', 'limit=20'])
    assert.equal((await get('/api/reviews/history?' + query)).status, 400);
});

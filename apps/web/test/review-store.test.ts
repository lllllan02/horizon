import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, rename, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import {
  reviewStore,
  exportReviews,
  reviewHistory,
  reviewRequest,
  migrateReviews,
} from '../src/review-store.ts';
import { withApplicationDatabase, APPLICATION_DATABASE } from '../src/app-database.ts';
import { loadLibrary } from '../src/library.ts';
import {
  applyReview,
  emptyReviewState,
  parseReviewState,
  reviewFingerprint,
  reviewQueue,
  type ReviewInput,
} from '../src/review-model.ts';
import { startServer } from '../server.ts';

async function fixture(t: { after: (fn: () => Promise<unknown>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'horizon-reviews-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'notes'));
  const file = path.join(root, 'notes/a.md');
  const raw = '---\ntitle: 示例\nlearning_status: organized\nupdated_at: "2026-10-01"\n---\n正文。';
  await writeFile(file, raw);
  return { root, file, raw, read: () => loadLibrary(root) };
}
async function inputFor(
  root: string,
  read: () => ReturnType<typeof loadLibrary>,
  requestId = 'request-test',
): Promise<ReviewInput> {
  const state = await reviewStore(root, read);
  const doc = (await read()).documents[0];
  return {
    version: state.version,
    id: doc.id,
    requestId,
    rating: 'good',
    documentUpdated: doc.updated,
    documentFingerprint: reviewFingerprint(doc),
  };
}

async function seedLegacy(root: string, read: () => ReturnType<typeof loadLibrary>, count = 45) {
  const library = await read();
  const doc = library.documents[0];
  let state = emptyReviewState();
  for (let index = 0; index < count; index++)
    state = applyReview(
      state,
      library.documents,
      {
        version: state.version,
        id: doc.id,
        requestId: `legacy-request-${index}`,
        rating: index % 3 === 0 ? 'hard' : 'good',
        documentUpdated: doc.updated,
        documentFingerprint: reviewFingerprint(doc),
      },
      Date.parse('2026-10-01T00:00:00Z') + index * 86400000,
    );
  const source = JSON.stringify(state, null, 2) + '\n';
  await writeFile(path.join(root, '.reviews.json'), source);
  return { state, source };
}

test('SQLite首次迁移保留全部历史与JSON原件，摘要计数精确，后续不再读取旧文件', async (t) => {
  const { root, file, raw, read } = await fixture(t);
  const { state: legacy, source } = await seedLegacy(root, read);
  const activity = '{"existing":"untouched"}';
  await writeFile(path.join(root, '.activity.json'), activity);
  const state = await reviewStore(root, read);
  assert.equal(state.records.a.history.length, 1);
  assert.deepEqual(state.records.a.counts, { good: 30, hard: 15, forgot: 0 });
  assert.deepEqual(await exportReviews(root), legacy);
  assert.equal(await readFile(path.join(root, '.reviews.json'), 'utf8'), source);
  assert.equal(await readFile(file, 'utf8'), raw);
  assert.equal(await readFile(path.join(root, '.activity.json'), 'utf8'), activity);
  await writeFile(path.join(root, '.reviews.json'), '{obsolete source');
  assert.deepEqual(await reviewStore(root, read), state);
  assert.ok((await readdir(root)).includes(APPLICATION_DATABASE));
  await migrateReviews(root);
});

test('每次只更新相关摘要行并追加事件，长期记录不膨胀评分响应', async (t) => {
  const { root, read, raw } = await fixture(t);
  await writeFile(path.join(root, 'notes/b.md'), raw.replace('正文。', '另一个正文。'));
  const input = await inputFor(root, read);
  await withApplicationDatabase(root, (db) =>
    db.exec(`
    CREATE TABLE review_test_updates (id TEXT);
    CREATE TRIGGER review_test_update AFTER UPDATE ON review_records BEGIN INSERT INTO review_test_updates(id) VALUES (new.id); END;
  `),
  );
  let state = await reviewStore(root, read, input);
  for (let i = 0; i < 30; i++)
    state = await reviewStore(root, read, {
      ...input,
      version: state.version,
      requestId: `bounded-request-${i}`,
    });
  assert.equal(state.records.a.history.length, 1);
  assert.deepEqual(state.records.a.counts, { good: 31, hard: 0, forgot: 0 });
  await withApplicationDatabase(root, (db) => {
    assert.deepEqual(
      db
        .prepare('SELECT DISTINCT id FROM review_test_updates')
        .all()
        .map((row) => row.id),
      ['a'],
    );
    assert.equal(db.prepare('SELECT count(*) AS count FROM review_events').get()?.count, 31);
  });
  assert.equal((await exportReviews(root)).records.a.history.length, 31);
});

test('请求编号通过数据库去重，在后续操作后重试仍幂等，并拒绝编号复用于其他动作', async (t) => {
  const { root, read } = await fixture(t);
  const input = await inputFor(root, read);
  let state = await reviewStore(root, read, input);
  state = await reviewStore(root, read, {
    ...input,
    version: state.version,
    requestId: 'second-request',
    rating: 'hard',
  });
  assert.deepEqual(await reviewStore(root, read, input), state);
  assert.deepEqual(await reviewRequest(root, input.requestId), { found: true });
  assert.deepEqual(await reviewRequest(root, 'missing-request'), { found: false });
  await assert.rejects(reviewStore(root, read, { ...input, rating: 'forgot' }), /其他复习操作/);
  await assert.rejects(reviewStore(root, read, { ...input, presented: true }), /参数无效/);
  const pause = {
    ...input,
    version: state.version,
    requestId: 'pause-request',
    rating: undefined,
    paused: true,
  };
  const paused = await reviewStore(root, read, pause);
  assert.equal(paused.records.a.paused, true);
  assert.deepEqual(await reviewStore(root, read, pause), paused);
  assert.equal((await exportReviews(root)).records.a.history.length, 3);
});

test('评分历史按需分页，只返回反馈，新增评分不会打乱已有序列游标', async (t) => {
  const { root, read } = await fixture(t);
  await seedLegacy(root, read);
  let input = await inputFor(root, read);
  let state = await reviewStore(root, read, {
    ...input,
    requestId: 'present-request',
    rating: undefined,
    presented: true,
  });
  const first = await reviewHistory(root, 'a', undefined, 20);
  assert.equal(first.events.length, 20);
  assert.equal(first.events[0].requestId, 'legacy-request-44');
  assert.ok(first.nextCursor);
  assert.ok(first.events.every((event) => event.rating));
  state = await reviewStore(root, read, {
    ...input,
    version: state.version,
    requestId: 'newest-request',
  });
  const second = await reviewHistory(root, 'a', first.nextCursor!, 20);
  const third = await reviewHistory(root, 'a', second.nextCursor!, 20);
  assert.equal(second.events[0].requestId, 'legacy-request-24');
  assert.equal(third.events.length, 5);
  assert.equal(third.nextCursor, null);
  assert.equal(
    new Set([...first.events, ...second.events, ...third.events].map((event) => event.requestId))
      .size,
    45,
  );
  assert.equal((await reviewHistory(root, 'a')).events[0].requestId, 'newest-request');
  assert.equal((await reviewHistory(root, 'missing')).events.length, 0);
  assert.equal((await reviewHistory(root, 'a')).version, state.version);
  await assert.rejects(reviewHistory(root, 'a', -1), /参数无效/);
  await assert.rejects(reviewHistory(root, 'a', undefined, 101), /参数无效/);
  await assert.rejects(reviewRequest(root, 'x'), /参数无效/);
});

test('改名迁移全部事件关联，删除文档后保留孤儿历史', async (t) => {
  const { root, read, file } = await fixture(t);
  await seedLegacy(root, read, 12);
  await reviewStore(root, read);
  const renamedFile = path.join(root, 'notes/renamed.md');
  await rename(file, renamedFile);
  const renamed = await reviewStore(root, read);
  assert.equal(renamed.records.a, undefined);
  assert.equal(renamed.records.renamed.counts?.good, 8);
  assert.equal((await reviewHistory(root, 'renamed')).events.length, 12);
  assert.equal((await reviewHistory(root, 'a')).events.length, 0);
  await rm(renamedFile);
  await reviewStore(root, read);
  const exported = await exportReviews(root);
  assert.equal(exported.records.renamed.history.length, 12);
  assert.deepEqual(parseReviewState(exported), exported);
});

test('展示持久化跨进程继续轮转，摘要保留最后一次展示和评分', async (t) => {
  const { root, raw, read } = await fixture(t);
  for (const id of ['b', 'c'])
    await writeFile(path.join(root, `notes/${id}.md`), raw.replace('正文。', `正文 ${id}`));
  const input = await inputFor(root, read);
  const shown = await reviewStore(root, read, {
    ...input,
    requestId: 'file-present-001',
    rating: undefined,
    presented: true,
  });
  const script = `import { reviewStore } from './src/review-store.ts'; import { loadLibrary } from './src/library.ts'; process.stdout.write(JSON.stringify(await reviewStore(${JSON.stringify(root)}, () => loadLibrary(${JSON.stringify(root)}))));`;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    cwd: path.resolve(import.meta.dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null) child.kill();
  });
  let output = '',
    errors = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (errors += chunk));
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(Error(errors))));
  });
  const restarted = JSON.parse(output);
  assert.deepEqual(restarted, shown);
  const queue = reviewQueue((await read()).documents, restarted);
  assert.equal(queue.fresh.length, 3);
  assert.equal(queue.recommendations.at(-1)?.id, 'a');
  const rated = await reviewStore(root, read, {
    ...input,
    version: shown.version,
    requestId: 'after-show-rating',
  });
  assert.equal(rated.records.a.history.length, 2);
  assert.ok(rated.records.a.lastPresentedAt);
  assert.ok(rated.records.a.lastReviewedAt);
});

test('损坏迁移不覆盖原件且无半迁移，修复后可重试；损坏SQLite不静默重建', async (t) => {
  const { root, read } = await fixture(t);
  const json = path.join(root, '.reviews.json');
  await writeFile(json, '{broken');
  await assert.rejects(reviewStore(root, read), /原记录已保留/);
  assert.equal(await readFile(json, 'utf8'), '{broken');
  await withApplicationDatabase(root, (db) => {
    assert.equal(
      db.prepare("SELECT value FROM app_metadata WHERE key = 'reviews_imported'").get(),
      undefined,
    );
    assert.equal(
      db.prepare("SELECT name FROM sqlite_master WHERE name = 'review_records'").get(),
      undefined,
    );
  });
  await writeFile(json, JSON.stringify(emptyReviewState()));
  await reviewStore(root, read);
  const db = path.join(root, APPLICATION_DATABASE);
  await writeFile(db, '{broken database');
  await assert.rejects(reviewStore(root, read), /原记录已保留/);
  assert.equal(await readFile(db, 'utf8'), '{broken database');
});

test('两次读取之间的文档并发编辑拒绝写入，竞争版本只允许一个事务提交', async (t) => {
  const { root, file, raw, read } = await fixture(t);
  const input = await inputFor(root, read);
  const before = await exportReviews(root);
  let calls = 0;
  await assert.rejects(
    reviewStore(
      root,
      async () => {
        if (++calls === 2) await writeFile(file, raw + '\n新段落');
        return read();
      },
      input,
    ),
    /文档库已更新/,
  );
  assert.deepEqual(await exportReviews(root), before);
  await writeFile(file, raw);
  const results = await Promise.allSettled([
    reviewStore(root, read, { ...input, requestId: 'concurrent-one' }),
    reviewStore(root, read, { ...input, requestId: 'concurrent-two' }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal((await exportReviews(root)).records.a.history.length, 1);
  assert.ok(!(await readdir(root)).some((file) => file.endsWith('.tmp')));
});

test('HTTP复习权限、反馈冲突与按需历史接口', async (t) => {
  const { root, file, raw, read } = await fixture(t);
  const app = await startServer({ root, port: 0, optimizeDependencies: false, development: true });
  t.after(() => app.close());
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const get = (suffix = '') =>
    fetch(url + '/api/reviews' + suffix, { headers: { 'Sec-Fetch-Site': 'same-origin' } });
  assert.equal((await fetch(url + '/api/reviews')).status, 403);
  assert.equal(
    (
      await fetch(url + '/api/reviews', {
        headers: { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://elsewhere.example' },
      })
    ).status,
    403,
  );
  const state = await (await get()).json();
  const doc = (await read()).documents[0];
  const input = {
    version: state.version,
    id: 'a',
    rating: 'good',
    requestId: 'http-review-1',
    documentUpdated: doc.updated,
    documentFingerprint: reviewFingerprint(doc),
  };
  const post = (body: unknown) =>
    fetch(url + '/api/reviews', {
      method: 'POST',
      headers: { Origin: url, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const result = await post(input);
  assert.equal(result.status, 200);
  const update = await result.json();
  assert.equal(update.kind, 'review-update');
  assert.deepEqual(Object.keys(update.records), ['a']);
  assert.equal((await post(input)).status, 200);
  assert.equal((await post({ ...input, requestId: 'http-review-2' })).status, 409);
  assert.equal((await post(null)).status, 400);
  assert.equal((await post({ ...input, rating: 'easy' })).status, 400);
  const history = await (await get('/history?id=a')).json();
  assert.equal(history.events.length, 1);
  assert.equal(history.events[0].requestId, input.requestId);
  assert.equal(history.nextCursor, null);
  assert.deepEqual(await (await get('/request?requestId=http-review-1')).json(), { found: true });
  assert.equal((await get('/history?id=a&limit=101')).status, 400);
  assert.equal(await readFile(file, 'utf8'), raw);
});

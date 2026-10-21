import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { reviewStore } from '../src/review-store.ts';
import { loadLibrary } from '../src/library.ts';
import { reviewFingerprint, reviewQueue, type ReviewInput } from '../src/review-model.ts';
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
): Promise<ReviewInput> {
  const state = await reviewStore(root, read);
  const doc = (await read()).documents[0];
  return {
    version: state.version,
    id: doc.id,
    requestId: 'request-test',
    rating: 'good',
    documentUpdated: doc.updated,
    documentFingerprint: reviewFingerprint(doc),
  };
}

test('复习存储只更新独立JSON，保留Markdown与活动记录，原子提交与幂等重试', async (t) => {
  const { root, file, raw, read } = await fixture(t);
  const activity = '{"existing":"untouched"}';
  await writeFile(path.join(root, '.activity.json'), activity);
  const input = await inputFor(root, read);
  const result = await reviewStore(root, read, input);
  assert.equal(result.records.a.history.length, 1);
  assert.deepEqual(await reviewStore(root, read, input), result);
  assert.equal(await readFile(file, 'utf8'), raw);
  assert.equal(await readFile(path.join(root, '.activity.json'), 'utf8'), activity);
  assert.deepEqual((await readdir(root)).sort(), ['.activity.json', '.reviews.json', 'notes']);
});

test('展示记录在独立文件原子保存，新的服务进程仍记住未完成题目并推荐其他资料', async (t) => {
  const { root, file, raw, read } = await fixture(t);
  for (const id of ['b', 'c', 'd', 'e', 'f', 'g'])
    await writeFile(path.join(root, `notes/${id}.md`), raw.replace('正文。', `正文 ${id}`));
  const input = await inputFor(root, read);
  const presented: ReviewInput = {
    ...input,
    requestId: 'file-present-001',
    rating: undefined,
    presented: true,
  };
  const shown = await reviewStore(root, read, presented);
  assert.ok(shown.records.a.lastPresentedAt);
  assert.equal(shown.records.a.lastReviewedAt, null);
  assert.equal(shown.records.a.dueAt, null);
  assert.equal(shown.records.a.intervalDays, 0);
  assert.deepEqual(await reviewStore(root, read, presented), shown);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, '.reviews.json'), 'utf8')), shown);
  const script = `
    import { reviewStore } from './src/review-store.ts';
    import { loadLibrary } from './src/library.ts';
    const root = ${JSON.stringify(root)};
    process.stdout.write(JSON.stringify(await reviewStore(root, () => loadLibrary(root))));
  `;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    cwd: path.resolve(import.meta.dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null) child.kill();
  });
  let output = '';
  let errors = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (errors += chunk));
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(Error(errors))));
  });
  const restarted = JSON.parse(output);
  assert.deepEqual(restarted, shown);
  const queue = reviewQueue((await read()).documents, restarted);
  assert.equal(queue.fresh.length, 5);
  assert.equal(queue.eligibleFresh.length, 7);
  assert.notEqual(queue.eligibleFresh[0].id, 'a');
  assert.equal(queue.eligibleFresh.at(-1)?.id, 'a');
  const completed = await reviewStore(root, read, {
    ...input,
    version: shown.version,
    requestId: 'file-rate-001',
  });
  assert.equal(completed.records.a.history.length, 2);
  assert.ok(completed.records.a.lastReviewedAt);
  assert.equal(
    reviewQueue((await read()).documents, await reviewStore(root, read)).scheduled[0].id,
    'a',
  );
  assert.equal(await readFile(file, 'utf8'), raw);
  assert.deepEqual((await readdir(root)).sort(), ['.reviews.json', 'notes']);
});

test('损坏记录不覆盖，文档并发编辑拒绝提交且清理临时文件', async (t) => {
  const { root, file, raw, read } = await fixture(t);
  const input = await inputFor(root, read);
  const reviewFile = path.join(root, '.reviews.json');
  const before = await readFile(reviewFile, 'utf8');
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
  assert.equal(await readFile(reviewFile, 'utf8'), before);
  assert.deepEqual((await readdir(root)).sort(), ['.reviews.json', 'notes']);
  await writeFile(reviewFile, '{broken');
  await assert.rejects(reviewStore(root, read), /原记录已保留/);
  await assert.rejects(reviewStore(root, read, input), /原记录已保留/);
  assert.equal(await readFile(reviewFile, 'utf8'), '{broken');
});

test('多个进程不能跨越同一复习锁；释放后可正常写入', async (t) => {
  const { root, read } = await fixture(t);
  const input = await inputFor(root, read);
  const script = `
    import { acquireActivityLock } from './src/activity-lock.ts';
    const release = await acquireActivityLock(${JSON.stringify(path.join(root, '.reviews.json'))});
    process.stdout.write('locked\\n');
    process.stdin.once('data', async () => { await release(); process.exit(0); });
  `;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    cwd: path.resolve(import.meta.dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null) child.kill();
  });
  await new Promise<void>((resolve, reject) => {
    child.stdout.once('data', () => resolve());
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code) reject(Error(`writer exited ${code}`));
    });
  });
  await assert.rejects(reviewStore(root, read, input), /其他服务/);
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.stdin.write('release');
  await exited;
  assert.equal((await reviewStore(root, read, input)).records.a.history.length, 1);
});

test('HTTP复习访问限制、无Origin同源GET、反馈与冲突，不调用状态或活动写入', async (t) => {
  const { root, file, raw, read } = await fixture(t);
  const app = await startServer({ root, port: 0, optimizeDependencies: false, development: true });
  t.after(() => app.close());
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const get = () => fetch(url + '/api/reviews', { headers: { 'Sec-Fetch-Site': 'same-origin' } });
  assert.equal((await fetch(url + '/api/reviews')).status, 403);
  assert.equal(
    (
      await fetch(url + '/api/reviews', {
        headers: { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://elsewhere.example' },
      })
    ).status,
    403,
  );
  assert.equal((await get()).status, 200);
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
  assert.equal((await post(input)).status, 200);
  const retry = await post(input);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).records.a.history.length, 1);
  assert.equal((await post({ ...input, requestId: 'http-review-2' })).status, 409);
  assert.equal((await post(null)).status, 400);
  assert.equal((await post({ ...input, rating: 'easy' })).status, 400);
  assert.equal(await readFile(file, 'utf8'), raw);
  assert.deepEqual((await readdir(root)).sort(), ['.reviews.json', 'notes']);
  const current = await (await get()).json();
  const early = await post({ ...input, version: current.version, requestId: 'http-early-review' });
  assert.equal(early.status, 409);
  assert.match((await early.json()).error, /尚未到期/);
  assert.deepEqual(await (await get()).json(), current);
  await writeFile(file, raw.replace('正文。', '修订正文。').replace('2026-10-01', '2026-10-21'));
  assert.equal(
    (await post({ ...input, version: current.version, requestId: 'http-review-3' })).status,
    409,
  );
  assert.match(await readFile(file, 'utf8'), /learning_status: organized/);
});

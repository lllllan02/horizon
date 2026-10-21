import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { APPLICATION_DATABASE, withApplicationDatabase } from '../src/app-database.ts';
import { exportReviews, migrateReviews, reviewStore } from '../src/review-store.ts';
import { loadLibrary } from '../src/library.ts';
import { emptyReviewState, reviewFingerprint } from '../src/review-model.ts';

async function fixture(t: { after: (fn: () => Promise<unknown>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'horizon-review-sqlite-'));
  t.after(() => rm(root, { force: true, recursive: true }));
  await mkdir(path.join(root, 'notes'));
  await writeFile(path.join(root, 'notes/a.md'), '---\nlearning_status: organized\n---\n正文。');
  return { root, read: () => loadLibrary(root) };
}

test('JSON导出在无数据库或仅活动数据库时只读旧JSON，显式迁移才创建复习表', async (t) => {
  const { root } = await fixture(t);
  assert.deepEqual(await exportReviews(root), emptyReviewState());
  assert.deepEqual(await readdir(root), ['notes']);
  const original = JSON.stringify(emptyReviewState()) + '\n';
  await writeFile(path.join(root, '.reviews.json'), original);
  assert.deepEqual(await exportReviews(root), emptyReviewState());
  assert.ok(!(await readdir(root)).includes(APPLICATION_DATABASE));
  await withApplicationDatabase(root, () => undefined);
  assert.deepEqual(await exportReviews(root), emptyReviewState());
  await withApplicationDatabase(root, (db) => {
    assert.equal(
      db.prepare("SELECT name FROM sqlite_master WHERE name = 'review_records'").get(),
      undefined,
    );
  });
  await migrateReviews(root);
  const databaseBefore = await readFile(path.join(root, APPLICATION_DATABASE));
  assert.deepEqual(await exportReviews(root), emptyReviewState());
  assert.deepEqual(await readFile(path.join(root, APPLICATION_DATABASE)), databaseBefore);
  assert.equal(await readFile(path.join(root, '.reviews.json'), 'utf8'), original);
});

test('两个独立服务进程使用相同版本评分时，只提交一个评分且没有丢失更新', async (t) => {
  const { root, read } = await fixture(t);
  const state = await reviewStore(root, read);
  const doc = (await read()).documents[0];
  const input = {
    version: state.version,
    id: 'a',
    requestId: 'parent-process-review',
    rating: 'good',
    documentUpdated: doc.updated,
    documentFingerprint: reviewFingerprint(doc),
  };
  const script = `
    import { reviewStore } from './src/review-store.ts';
    import { loadLibrary } from './src/library.ts';
    const root = ${JSON.stringify(root)};
    const input = ${JSON.stringify({ ...input, requestId: 'child-process-review' })};
    process.stdout.write('ready\\n');
    process.stdin.once('data', async () => {
      try {
        await reviewStore(root, () => loadLibrary(root), input);
        process.stdout.write('committed');
      } catch (error) { process.stdout.write('conflict:' + error.message); }
      process.exit(0);
    });
  `;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    cwd: path.resolve(import.meta.dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode === null) child.kill();
  });
  let output = '',
    errors = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (errors += chunk));
  const exited = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolve() : reject(Error(errors))));
  });
  await new Promise<void>((resolve, reject) => {
    child.stdout.once('data', () => resolve());
    child.once('error', reject);
  });
  child.stdin.write('go');
  const parent = await Promise.allSettled([reviewStore(root, read, input)]);
  await exited;
  const committed = Number(parent[0].status === 'fulfilled') + Number(output.includes('committed'));
  assert.equal(committed, 1, output);
  if (parent[0].status === 'rejected') assert.match(String(parent[0].reason), /已更新/);
  else assert.match(output, /conflict:复习记录已更新/);
  assert.equal((await exportReviews(root)).records.a.history.length, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { APPLICATION_DATABASE, withApplicationDatabase } from '../src/app-database.ts';
import { defaultReviewPriorities } from '../src/review-priorities.ts';
import {
  loadReviewPriorities,
  saveReviewPriorities,
  setReviewPriority,
} from '../src/review-priority-store.ts';
import { exportReviews, migrateReviews } from '../src/review-store.ts';
import { runStorage } from '../scripts/storage.ts';
import { startServer } from '../server.ts';

async function fixture(t: { after: (fn: () => Promise<unknown>) => void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'horizon-priorities-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('首次读取将默认优先级写入同一SQLite，覆盖设置跨连接保留且不影响复习历史', async (t) => {
  const root = await fixture(t);
  await migrateReviews(root);
  const reviews = await exportReviews(root);
  assert.deepEqual(await loadReviewPriorities(root), defaultReviewPriorities);
  await withApplicationDatabase(root, (db) => {
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM review_priorities').get()?.count, 4);
  });
  await saveReviewPriorities(root, { interviews: 0, custom: 7 });
  assert.deepEqual(await loadReviewPriorities(root), {
    ...defaultReviewPriorities,
    interviews: 0,
    custom: 7,
  });
  await saveReviewPriorities(root, { notes: 8 });
  assert.deepEqual(await loadReviewPriorities(root), { ...defaultReviewPriorities, notes: 8 });
  assert.deepEqual(await exportReviews(root), reviews);
  assert.ok((await readdir(root)).includes(APPLICATION_DATABASE));
  assert.ok(!(await readdir(root)).some((file) => file.endsWith('.json')));
});

test('单项修改保留其他目录；无效值拒绝保存并保留原设置', async (t) => {
  const root = await fixture(t);
  await Promise.all([setReviewPriority(root, 'custom', 9), setReviewPriority(root, 'notes', 0)]);
  const before = await loadReviewPriorities(root);
  assert.deepEqual(before, { ...defaultReviewPriorities, custom: 9, notes: 0 });
  for (const values of [
    null,
    [],
    { notes: -1 },
    { notes: 1.5 },
    { notes: Number.MAX_SAFE_INTEGER + 1 },
    { '../notes': 1 },
    { 'invalid/id': 3 },
  ]) {
    await assert.rejects(
      saveReviewPriorities(root, values),
      (error: unknown) => error instanceof Error && 'status' in error && error.status === 400,
    );
  }
  assert.deepEqual(await loadReviewPriorities(root), before);
});

test('损坏数据库不会被重建或覆盖', async (t) => {
  const root = await fixture(t);
  const file = path.join(root, APPLICATION_DATABASE);
  const original = 'broken database';
  await writeFile(file, original);
  await assert.rejects(loadReviewPriorities(root), /原数据已保留/);
  assert.equal(await readFile(file, 'utf8'), original);
});

test('数据库中的非法字段拒绝读取并保留原行', async (t) => {
  const root = await fixture(t);
  await loadReviewPriorities(root);
  await withApplicationDatabase(root, (db) => {
    db.prepare('INSERT INTO review_priorities(collection, priority) VALUES (?, ?)').run(null, 2);
  });
  await assert.rejects(
    loadReviewPriorities(root),
    (error: unknown) => error instanceof Error && 'status' in error && error.status === 500,
  );
  await withApplicationDatabase(root, (db) => {
    assert.equal(
      db.prepare('SELECT priority FROM review_priorities WHERE collection IS NULL').get()?.priority,
      2,
    );
    db.exec('DELETE FROM review_priorities WHERE collection IS NULL');
    db.prepare('INSERT INTO review_priorities(collection, priority) VALUES (?, ?)').run(
      'custom',
      'invalid',
    );
  });
  await assert.rejects(
    loadReviewPriorities(root),
    (error: unknown) => error instanceof Error && 'status' in error && error.status === 500,
  );
  await withApplicationDatabase(root, (db) => {
    assert.equal(
      db.prepare("SELECT priority FROM review_priorities WHERE collection = 'custom'").get()
        ?.priority,
      'invalid',
    );
  });
});

test('storage命令读写优先级并拒绝无效或缺失参数', async (t) => {
  const root = await fixture(t);
  const lines: string[] = [];
  const run = (...args: string[]) =>
    runStorage(['--root', root, 'review-priorities', ...args], (line) => lines.push(line));
  await run();
  assert.deepEqual(JSON.parse(lines.at(-1)!), defaultReviewPriorities);
  await run('readings', '12');
  assert.equal((await loadReviewPriorities(root)).readings, 12);
  await run('custom', '0');
  assert.equal((await loadReviewPriorities(root)).custom, 0);
  for (const args of [
    ['notes'],
    ['notes', '-1'],
    ['notes', '1.5'],
    ['notes', '9007199254740992'],
    ['notes', '1', 'extra'],
  ])
    await assert.rejects(run(...args));
  assert.equal((await loadReviewPriorities(root)).readings, 12);
});

test('HTTP优先级接口遵循本机同源权限，持久化合法map并拒绝非法请求', async (t) => {
  const root = await fixture(t);
  const app = await startServer({
    root,
    port: 0,
    host: '127.0.0.1',
    optimizeDependencies: false,
    development: true,
  });
  t.after(() => app.close());
  const address = app.server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const url = origin + '/api/reviews/priorities';
  assert.equal((await fetch(url)).status, 403);
  assert.equal(
    (
      await fetch(url, {
        headers: { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://elsewhere.example' },
      })
    ).status,
    403,
  );
  const get = () => fetch(url, { headers: { 'Sec-Fetch-Site': 'same-origin' } });
  assert.deepEqual(await (await get()).json(), defaultReviewPriorities);
  const post = (value: unknown, requestOrigin = origin) =>
    fetch(url, {
      method: 'POST',
      headers: { Origin: requestOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
  assert.equal((await post({ priorities: { notes: 6 } }, 'https://elsewhere.example')).status, 403);
  const saved = await post({ priorities: { notes: 6, custom: 2 } });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { ...defaultReviewPriorities, notes: 6, custom: 2 });
  for (const value of [
    null,
    {},
    { priorities: [] },
    { priorities: { notes: -2 } },
    { priorities: { '../notes': 2 } },
  ])
    assert.equal((await post(value)).status, 400);
  assert.equal(
    (
      await fetch(url, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: '{broken',
      })
    ).status,
    400,
  );
  assert.equal((await fetch(url, { method: 'PUT', headers: { Origin: origin } })).status, 405);
  assert.deepEqual(await (await get()).json(), { ...defaultReviewPriorities, notes: 6, custom: 2 });
  assert.deepEqual(await loadReviewPriorities(root), {
    ...defaultReviewPriorities,
    notes: 6,
    custom: 2,
  });
});

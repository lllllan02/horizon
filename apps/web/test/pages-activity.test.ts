import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { activityForLibrary } from '../src/activity.ts';
import { APPLICATION_DATABASE, withApplicationDatabase } from '../src/app-database.ts';
import { loadLibrary } from '../src/library.ts';
import { exportPagesActivity, loadPagesActivity } from '../src/pages-activity.ts';
import { pagesLibrary } from '../scripts/build-pages.ts';

async function fixture(t: TestContext) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'horizon-pages-activity-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = path.join(base, 'content');
  for (const directory of ['notes', 'assets'])
    await mkdir(path.join(root, directory), { recursive: true });
  const file = path.join(root, 'notes/a.md');
  await writeFile(file, '---\ntitle: A\ncreated_at: 2026-10-01\n---\n正文 ![](assets/chart.png)');
  await writeFile(path.join(root, 'assets/chart.png'), 'first image');
  return { root, base, file, snapshot: path.join(base, 'data/activity.json') };
}

async function observe(root: string) {
  const activity = await activityForLibrary(root, await loadLibrary(root), {
    observe: true,
    now: '2026-10-21 16:00:00',
  });
  assert.equal(activity.error, undefined);
  return activity;
}

async function removeDatabase(root: string) {
  for (const suffix of ['', '-wal', '-shm'])
    await rm(path.join(root, APPLICATION_DATABASE + suffix), { force: true });
}

test('SQLite 新活动进入公开快照，删除旧 JSON 后本机与无数据库构建一致', async (t) => {
  const { root, file, snapshot } = await fixture(t);
  await observe(root);
  await writeFile(file, (await readFile(file, 'utf8')) + '\n新增正文');
  await writeFile(path.join(root, 'assets/chart.png'), 'changed image');
  await observe(root);
  // An obsolete or corrupt legacy source must never override the migrated database.
  await writeFile(path.join(root, '.activity.json'), '{bad legacy activity');
  await writeFile(path.join(root, '.reviews.json'), '{private legacy reviews');
  const activity = await exportPagesActivity(root, snapshot);
  assert.ok(
    activity.events.some((event) => event.kind === 'updated' && event.source === 'observed'),
  );
  assert.ok(activity.events.some((event) => event.kind === 'image-updated'));
  const bytes = await readFile(snapshot, 'utf8');
  assert.doesNotMatch(bytes, /"files"|"documents"|"digest"|"records"|新增正文/);
  await rm(path.join(root, '.activity.json'));
  await rm(path.join(root, '.reviews.json'));
  const local = await pagesLibrary(root, { includeActivity: true, snapshotPath: snapshot });
  assert.deepEqual(local.library.activity, activity);
  await removeDatabase(root);
  const ci = await pagesLibrary(root, { includeActivity: true, snapshotPath: snapshot });
  assert.deepEqual(ci.library.activity, local.library.activity);
  assert.equal(await readFile(snapshot, 'utf8'), bytes);
});

test('CI 按当前正文和图片引用过滤，新增文档使用明确日期且不改写快照', async (t) => {
  const { root, file, snapshot } = await fixture(t);
  await observe(root);
  await writeFile(path.join(root, 'assets/chart.png'), 'changed image');
  await observe(root);
  await exportPagesActivity(root, snapshot);
  const saved = JSON.parse(await readFile(snapshot, 'utf8'));
  saved.activity.events[0].files = ['private-source.png'];
  saved.activity.events[0].body = 'PRIVATE_BODY';
  saved.records = { secret: 'PRIVATE_REVIEW' };
  const bytes = JSON.stringify(saved);
  await writeFile(snapshot, bytes);
  await removeDatabase(root);
  await writeFile(file, '---\ntitle: A\ncreated_at: 2026-10-01\n---\n不再引用图片');
  await writeFile(
    path.join(root, 'notes/b.md'),
    '---\ntitle: B\ncreated_at: 2026-10-20\n---\n新文档',
  );
  let activity = await loadPagesActivity(root, await loadLibrary(root), snapshot);
  assert.ok(activity.events.every((event) => !event.kind.startsWith('image-')));
  assert.ok(activity.events.some((event) => event.docId === 'b' && event.source === 'metadata'));
  assert.doesNotMatch(JSON.stringify(activity), /private-source|PRIVATE_BODY|PRIVATE_REVIEW/);
  await rm(file);
  activity = await loadPagesActivity(root, await loadLibrary(root), snapshot);
  assert.ok(activity.events.every((event) => event.docId === 'b'));
  assert.equal(await readFile(snapshot, 'utf8'), bytes);
});

test('CI 补充已有文档的新 updated_at，按北京时间去重检测事件且重复构建稳定', async (t) => {
  const { root, file, snapshot } = await fixture(t);
  await writeFile(
    file,
    (await readFile(file, 'utf8')).replace(
      'created_at: 2026-10-01',
      'created_at: 2026-10-01\nupdated_at: 2026-10-05',
    ),
  );
  await observe(root);
  await exportPagesActivity(root, snapshot);
  await writeFile(file, (await readFile(file, 'utf8')).replace('2026-10-05', '2026-10-20'));
  const local = await loadPagesActivity(root, await loadLibrary(root), null);
  assert.ok(local.events.some((event) => event.kind === 'updated' && event.time === '2026-10-20'));
  const before = await readFile(snapshot, 'utf8');
  await removeDatabase(root);
  const ci = await loadPagesActivity(root, await loadLibrary(root), snapshot);
  assert.deepEqual(ci, local);
  assert.deepEqual(await loadPagesActivity(root, await loadLibrary(root), snapshot), ci);
  assert.equal(await readFile(snapshot, 'utf8'), before);
  const value = JSON.parse(before);
  value.activity.events.push({
    ...value.activity.events.find((event: { kind: string }) => event.kind === 'updated'),
    id: 'observed-update',
    source: 'observed',
    time: '2026-10-19T17:00:00Z',
  });
  await writeFile(snapshot, JSON.stringify(value));
  const deduplicated = await loadPagesActivity(root, await loadLibrary(root), snapshot);
  assert.ok(deduplicated.events.some((event) => event.id === 'observed-update'));
  assert.ok(!deduplicated.events.some((event) => event.time === '2026-10-20'));
});

test('缺失、损坏或未迁移数据库不回退旧 JSON，也不覆盖已有快照', async (t) => {
  const { root, snapshot } = await fixture(t);
  const library = await loadLibrary(root);
  await assert.rejects(loadPagesActivity(root, library, snapshot), /缺少网页活动快照/);
  await assert.rejects(exportPagesActivity(root, snapshot), /需要本机 SQLite/);
  await observe(root);
  await exportPagesActivity(root, snapshot);
  const before = await readFile(snapshot, 'utf8');
  await withApplicationDatabase(root, (database) => {
    database.prepare("DELETE FROM app_metadata WHERE key = 'activity_imported'").run();
  });
  await writeFile(path.join(root, '.activity.json'), '{bad');
  await assert.rejects(loadPagesActivity(root, library, snapshot), /尚未完成迁移/);
  assert.equal(await readFile(snapshot, 'utf8'), before);
  await removeDatabase(root);
  await writeFile(path.join(root, APPLICATION_DATABASE), 'broken database');
  await assert.rejects(loadPagesActivity(root, library, snapshot));
  assert.equal(await readFile(snapshot, 'utf8'), before);
});

test('损坏快照与符号链接保留原样，目标不能覆盖数据库或旧存储', async (t) => {
  const { root, base, snapshot } = await fixture(t);
  await observe(root);
  await mkdir(path.dirname(snapshot));
  await writeFile(snapshot, '{broken');
  await assert.rejects(exportPagesActivity(root, snapshot));
  assert.equal(await readFile(snapshot, 'utf8'), '{broken');
  await rm(snapshot);
  const original = path.join(base, 'original.json');
  await writeFile(original, 'keep original');
  await symlink(original, snapshot);
  await assert.rejects(exportPagesActivity(root, snapshot), /普通 JSON 文件/);
  assert.equal(await readFile(original, 'utf8'), 'keep original');
  await rm(snapshot);
  await mkdir(snapshot);
  await assert.rejects(exportPagesActivity(root, snapshot), /普通 JSON 文件/);
  for (const name of [APPLICATION_DATABASE, '.activity.json', '.reviews.json'])
    await assert.rejects(exportPagesActivity(root, path.join(root, name)), /不能覆盖本地存储/);
});

test('无数据库快照严格校验日期、事件唯一性和实体，测试辅助不生成存储', async (t) => {
  const { root, snapshot } = await fixture(t);
  await observe(root);
  await exportPagesActivity(root, snapshot);
  const valid = JSON.parse(await readFile(snapshot, 'utf8'));
  await removeDatabase(root);
  for (const mutate of [
    (value: typeof valid) => {
      value.activity.events[0].time = '2026-02-30';
    },
    (value: typeof valid) => {
      value.activity.events.push(value.activity.events[0]);
    },
    (value: typeof valid) => {
      value.activity.events[0].entity = 'doc:other';
    },
    (value: typeof valid) => {
      value.schema = 2;
    },
  ]) {
    const malformed = structuredClone(valid);
    mutate(malformed);
    await writeFile(snapshot, JSON.stringify(malformed));
    await assert.rejects(loadPagesActivity(root, await loadLibrary(root), snapshot), /格式无效/);
  }
  await writeFile(path.join(root, '.activity.json'), '{bad');
  const fixtureLibrary = await pagesLibrary(root, { includeActivity: true });
  assert.equal(fixtureLibrary.library.activity?.events.length, 1);
  await assert.rejects(readFile(path.join(root, APPLICATION_DATABASE)), { code: 'ENOENT' });
});

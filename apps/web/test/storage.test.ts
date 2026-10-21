import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { exportStorage, importStorage, runStorage } from '../scripts/storage.ts';
import { applicationDatabaseExists } from '../src/app-database.ts';
import { exportReviews } from '../src/review-store.ts';
import { exportActivity } from '../src/activity.ts';
import {
  applyReview,
  emptyReviewState,
  reconcileReviews,
  reviewFingerprint,
  type ReviewDocument,
} from '../src/review-model.ts';

async function fixture(t: { after(fn: () => Promise<unknown>): void }) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'horizon-storage-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = path.join(base, 'content');
  await mkdir(root);
  const docs: ReviewDocument[] = [
    { id: 'a', path: 'notes/a.md', body: '示例正文', updated: null, state: 'organized' },
  ];
  let reviews = reconcileReviews(emptyReviewState(), docs);
  for (let i = 0; i < 45; i++)
    reviews = applyReview(
      reviews,
      docs,
      {
        version: reviews.version,
        id: 'a',
        requestId: `legacy-event-${i}`,
        rating: 'good',
        documentUpdated: null,
        documentFingerprint: reviewFingerprint(docs[0]),
      },
      Date.parse('2026-10-21T04:00:00Z') + i,
    );
  const activity = {
    schema: 1,
    startedAt: '2026-10-21 12:00:00.000',
    documents: { a: { title: '示例', collection: 'notes', state: 'organized', digest: 'body' } },
    images: {},
    events: [
      {
        id: 'legacy-activity',
        kind: 'created',
        time: '2026-10-21 12:00:00.000',
        entity: 'doc:a',
        docId: 'a',
        title: '示例',
        collections: ['notes'],
        source: 'observed',
      },
    ],
  };
  const reviewRaw = JSON.stringify(reviews);
  const activityRaw = JSON.stringify(activity);
  await writeFile(path.join(root, '.reviews.json'), reviewRaw);
  await writeFile(path.join(root, '.activity.json'), activityRaw);
  return { base, root, reviews, activity, reviewRaw, activityRaw };
}

test('旧JSON可只读导出，显式迁移与完整导出再恢复保留所有历史', async (t) => {
  const { base, root, reviews, activity, reviewRaw, activityRaw } = await fixture(t);
  const oldExport = path.join(base, 'legacy-export');
  await exportStorage(root, oldExport);
  assert.equal(await applicationDatabaseExists(root), false);
  assert.deepEqual(
    JSON.parse(await readFile(path.join(oldExport, 'reviews.json'), 'utf8')),
    reviews,
  );
  await runStorage(['--root', root, 'migrate'], () => {});
  assert.equal(await applicationDatabaseExists(root), true);
  assert.equal(await readFile(path.join(root, '.reviews.json'), 'utf8'), reviewRaw);
  assert.equal(await readFile(path.join(root, '.activity.json'), 'utf8'), activityRaw);
  const destination = path.join(base, 'export');
  const counts = await exportStorage(root, destination);
  assert.deepEqual(counts, { documents: 1, reviews: 45, activity: 1 });
  assert.deepEqual(
    JSON.parse(await readFile(path.join(destination, 'reviews.json'), 'utf8')),
    reviews,
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(destination, 'activity.json'), 'utf8')),
    activity,
  );
  const restored = path.join(base, 'restored');
  await mkdir(restored);
  await importStorage(restored, destination);
  assert.deepEqual(await exportReviews(restored), reviews);
  assert.deepEqual(await exportActivity(restored), activity);
  await assert.rejects(importStorage(restored, destination), /已有数据库/);
  await assert.rejects(exportStorage(root, destination), /EEXIST/);
});

test('导入任一组件损坏时不发布半份数据库，原始导出与目标均保留', async (t) => {
  const { base, root } = await fixture(t);
  const destination = path.join(base, 'export');
  await exportStorage(root, destination);
  await writeFile(path.join(destination, 'activity.json'), '{broken');
  const restored = path.join(base, 'restored');
  await mkdir(restored);
  await assert.rejects(importStorage(restored, destination));
  assert.equal(await applicationDatabaseExists(restored), false);
  assert.equal(await readFile(path.join(destination, 'activity.json'), 'utf8'), '{broken');
});

test('网页快照命令从SQLite生成活动数据，旧JSON移除后仍可完整备份恢复', async (t) => {
  const { base, root, reviews, activity } = await fixture(t);
  await runStorage(['--root', root, 'migrate'], () => {});
  await mkdir(path.join(root, 'notes'));
  await writeFile(path.join(root, 'notes/a.md'), '---\ntitle: 示例\n---\n示例正文');
  await rm(path.join(root, '.reviews.json'));
  await rm(path.join(root, '.activity.json'));
  const snapshot = path.join(base, 'pages', 'activity.json');
  await runStorage(['--root', root, 'pages-snapshot', snapshot], () => {});
  const saved = JSON.parse(await readFile(snapshot, 'utf8'));
  assert.match(JSON.stringify(saved), /legacy-activity/);
  assert.doesNotMatch(JSON.stringify(saved), /legacy-event-0|"documents"|"records"|"digest"/);
  assert.equal(await applicationDatabaseExists(root), true);
  const destination = path.join(base, 'export-without-legacy');
  await exportStorage(root, destination);
  const restored = path.join(base, 'restored-without-legacy');
  await mkdir(restored);
  await importStorage(restored, destination);
  assert.deepEqual(await exportReviews(restored), reviews);
  assert.deepEqual(await exportActivity(restored), activity);
});

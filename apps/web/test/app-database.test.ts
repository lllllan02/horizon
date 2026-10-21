import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  APPLICATION_DATABASE,
  applicationDatabaseExists,
  backupApplicationDatabase,
  withApplicationDatabase,
  withTransaction,
} from '../src/app-database.ts';

async function fixture(t: { after(fn: () => Promise<unknown>): void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'horizon-database-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('数据库按需创建且仅允许普通文件，只读访问不会创建新库', async (t) => {
  const root = await fixture(t);
  assert.equal(await applicationDatabaseExists(root), false);
  await assert.rejects(withApplicationDatabase(root, () => null, { readonly: true }));
  assert.equal(await applicationDatabaseExists(root), false);
  await withApplicationDatabase(root, (db) => {
    db.prepare('INSERT INTO app_metadata VALUES (?, ?)').run('sample', 'saved');
  });
  assert.equal(await applicationDatabaseExists(root), true);
  assert.equal((await stat(path.join(root, APPLICATION_DATABASE))).mode & 0o777, 0o600);
  assert.equal(
    await withApplicationDatabase(
      root,
      (db) => db.prepare('SELECT value FROM app_metadata WHERE key = ?').get('sample')?.value,
      { readonly: true },
    ),
    'saved',
  );
});

test('事务失败完整回滚，新的连接只看到已提交数据', async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    withApplicationDatabase(root, (db) =>
      withTransaction(db, () => {
        db.prepare('INSERT INTO app_metadata VALUES (?, ?)').run('rolled-back', 'no');
        throw Error('interrupt');
      }),
    ),
    /interrupt/,
  );
  assert.equal(
    await withApplicationDatabase(
      root,
      (db) => db.prepare('SELECT COUNT(*) count FROM app_metadata').get()?.count,
    ),
    0,
  );
});

test('备份包含事务提交内容，目标独占发布且原数据不被覆盖', async (t) => {
  const root = await fixture(t);
  await withApplicationDatabase(root, (db) => {
    db.prepare('INSERT INTO app_metadata VALUES (?, ?)').run('history', 'keep');
  });
  const target = path.join(root, 'backup.sqlite');
  await backupApplicationDatabase(root, target);
  const snapshot = new DatabaseSync(target, { readOnly: true });
  try {
    assert.equal(snapshot.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
    assert.equal(
      snapshot.prepare('SELECT value FROM app_metadata WHERE key = ?').get('history')?.value,
      'keep',
    );
  } finally {
    snapshot.close();
  }
  const before = await readFile(target);
  await assert.rejects(backupApplicationDatabase(root, target), /已存在/);
  assert.deepEqual(await readFile(target), before);
});

test('损坏、未来schema和外指符号链接保留原文件并拒绝写入', async (t) => {
  const root = await fixture(t);
  const file = path.join(root, APPLICATION_DATABASE);
  await writeFile(file, 'broken database');
  await assert.rejects(withApplicationDatabase(root, () => null));
  assert.equal(await readFile(file, 'utf8'), 'broken database');
  await rm(file);
  await withApplicationDatabase(root, (db) => db.exec('PRAGMA user_version = 999'));
  await assert.rejects(
    withApplicationDatabase(root, () => null),
    /版本不受支持/,
  );
  await rm(file);
  const outside = path.join(root, 'other.sqlite');
  await writeFile(outside, 'untouched');
  await symlink(outside, file);
  await assert.rejects(
    withApplicationDatabase(root, () => null),
    /普通文件/,
  );
  assert.equal(await readFile(outside, 'utf8'), 'untouched');
});

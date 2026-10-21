import { DatabaseSync } from 'node:sqlite';
import { chmod, link, lstat, mkdtemp, realpath, rm } from 'node:fs/promises';
import path from 'node:path';

export const APPLICATION_DATABASE = '.horizon.sqlite';
const applicationId = 0x48525a4e;
const schemaVersion = 1;

async function ordinaryFile(file: string, optional = false) {
  const info = await lstat(file).catch((error: NodeJS.ErrnoException) => {
    if (optional && error.code === 'ENOENT') return null;
    throw error;
  });
  if (info && !info.isFile()) throw Error('应用数据库及辅助文件必须是普通文件，原文件已保留。');
  return info !== null;
}

export async function applicationDatabaseExists(root: string) {
  return ordinaryFile(path.join(await realpath(root), APPLICATION_DATABASE), true);
}

export function withTransaction<T>(database: DatabaseSync, task: () => T): T {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = task();
    if (result instanceof Promise) throw Error('数据库事务内不能执行异步操作。');
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

/** A short-lived connection keeps separate server processes coordinated by SQLite. */
export async function withApplicationDatabase<T>(
  root: string,
  task: (database: DatabaseSync) => T,
  { readonly = false } = {},
): Promise<T> {
  const file = path.join(await realpath(root), APPLICATION_DATABASE);
  await ordinaryFile(file, !readonly);
  for (const suffix of ['-wal', '-shm', '-journal']) await ordinaryFile(file + suffix, true);
  const database = new DatabaseSync(file, { readOnly: readonly });
  try {
    database.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
    const id = database.prepare('PRAGMA application_id').get()?.application_id;
    const version = database.prepare('PRAGMA user_version').get()?.user_version;
    if ((id !== 0 && id !== applicationId) || Number(version) > schemaVersion)
      throw Error('应用数据库版本不受支持，原文件已保留。');
    if (!readonly) {
      // SQLite inherits the main file's permissions for the WAL and shared-memory files.
      await chmod(file, 0o600);
      database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
      if (id === 0)
        withTransaction(database, () => {
          // Another process may have initialized the file while this one waited.
          if (database.prepare('PRAGMA application_id').get()?.application_id === applicationId)
            return;
          const tables = database
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .all();
          if (tables.length) throw Error('该文件不是视界应用数据库，原文件已保留。');
          database.exec(`
          CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
          PRAGMA application_id = ${applicationId};
          PRAGMA user_version = ${schemaVersion};
        `);
        });
    } else if (id !== applicationId || version !== schemaVersion) {
      throw Error('该文件不是可读取的视界应用数据库，原文件已保留。');
    }
    const result = task(database);
    if (result instanceof Promise) throw Error('数据库连接回调必须同步完成。');
    return result;
  } finally {
    database.close();
  }
}

/** VACUUM INTO includes committed WAL contents in a consistent standalone snapshot. */
export async function backupApplicationDatabase(root: string, destination: string) {
  const target = path.resolve(destination);
  const exists = await lstat(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (exists) throw Error('备份目标已存在，请选择新文件；现有文件未被覆盖。');
  const temporary = await mkdtemp(path.join(path.dirname(target), '.horizon-backup-'));
  const snapshotFile = path.join(temporary, 'snapshot.sqlite');
  try {
    await withApplicationDatabase(
      root,
      (database) => {
        database.prepare('VACUUM INTO ?').run(snapshotFile);
      },
      { readonly: true },
    );
    await chmod(snapshotFile, 0o600);
    const snapshot = new DatabaseSync(snapshotFile, { readOnly: true });
    try {
      if (snapshot.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok')
        throw Error('数据库备份未通过完整性检查。');
    } finally {
      snapshot.close();
    }
    // Publishing by link is exclusive: a concurrent backup cannot be overwritten.
    await link(snapshotFile, target);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

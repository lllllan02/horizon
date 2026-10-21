import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  APPLICATION_DATABASE,
  applicationDatabaseExists,
  backupApplicationDatabase,
} from '../src/app-database.ts';
import { exportReviews, migrateReviews } from '../src/review-store.ts';
import { exportActivity, migrateActivity } from '../src/activity.ts';
import { exportPagesActivity, PAGES_ACTIVITY_SNAPSHOT } from '../src/pages-activity.ts';

const defaultRoot = fileURLToPath(new URL('../../../content', import.meta.url));

async function copyLegacy(root: string, target: string) {
  for (const name of ['.reviews.json', '.activity.json']) {
    const file = path.join(root, name);
    const info = await lstat(file).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!info) continue;
    if (!info.isFile()) throw Error('旧记录必须是普通文件，原记录已保留。');
    await copyFile(file, path.join(target, name));
  }
}

/** Export both components from the same SQLite snapshot; sources stay untouched. */
export async function exportStorage(root: string, destination: string) {
  const snapshot = await mkdtemp(path.join(os.tmpdir(), 'horizon-export-'));
  try {
    await copyLegacy(root, snapshot);
    if (await applicationDatabaseExists(root))
      await backupApplicationDatabase(root, path.join(snapshot, APPLICATION_DATABASE));
    const reviews = await exportReviews(snapshot);
    const activity = await exportActivity(snapshot);
    const target = path.resolve(destination);
    await mkdir(target, { mode: 0o700 });
    try {
      await writeFile(path.join(target, 'reviews.json'), JSON.stringify(reviews, null, 2) + '\n', {
        flag: 'wx',
        mode: 0o600,
      });
      await writeFile(
        path.join(target, 'activity.json'),
        JSON.stringify(activity, null, 2) + '\n',
        {
          flag: 'wx',
          mode: 0o600,
        },
      );
    } catch (error) {
      await rm(target, { recursive: true, force: true });
      throw error;
    }
    return {
      documents: Object.keys(reviews.records).length,
      reviews: Object.values(reviews.records).reduce((sum, item) => sum + item.history.length, 0),
      activity: activity.events.length,
    };
  } finally {
    await rm(snapshot, { recursive: true, force: true });
  }
}

/** Restore into a new database only. Validation and migration happen in isolation first. */
export async function importStorage(root: string, source: string) {
  const target = path.join(await realpath(root), APPLICATION_DATABASE);
  if (await applicationDatabaseExists(root))
    throw Error('项目已有数据库，导入未执行。请在新的内容目录恢复或先另行备份现有数据库。');
  const staging = await mkdtemp(path.join(os.tmpdir(), 'horizon-import-'));
  try {
    for (const [name, legacy] of [
      ['reviews.json', '.reviews.json'],
      ['activity.json', '.activity.json'],
    ]) {
      const file = path.resolve(source, name);
      if (!(await lstat(file)).isFile()) throw Error('导入记录必须是普通 JSON 文件。');
      await writeFile(path.join(staging, legacy), await readFile(file), { mode: 0o600 });
    }
    await migrateReviews(staging);
    await migrateActivity(staging);
    await backupApplicationDatabase(staging, target);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function runStorage(args: string[], log = console.log) {
  const { values, positionals } = parseArgs({
    args,
    options: { root: { type: 'string' }, help: { type: 'boolean' } },
    allowPositionals: true,
  });
  const [command, destination] = positionals;
  if (values.help || !command) {
    log(
      '用法：npm run storage -- [--root <content目录>] migrate | export <新目录> | import <导出目录> | backup <新SQLite文件> | pages-snapshot [快照文件]',
    );
    return;
  }
  const root = await realpath(path.resolve(values.root || defaultRoot));
  if (positionals.length > 2) throw Error('存储命令参数过多。');
  if (command === 'migrate' && !destination) {
    await migrateReviews(root);
    await migrateActivity(root);
    log(`已迁移到 ${path.join(root, APPLICATION_DATABASE)}；旧 JSON 保留且不会继续写入。`);
  } else if (command === 'export' && destination) {
    const counts = await exportStorage(root, destination);
    log(
      `已导出到 ${path.resolve(destination)}：${counts.documents} 篇资料，${counts.reviews} 条复习操作，${counts.activity} 条活动。`,
    );
  } else if (command === 'import' && destination) {
    await importStorage(root, destination);
    log(`已从 JSON 恢复到 ${path.join(root, APPLICATION_DATABASE)}。`);
  } else if (command === 'backup' && destination) {
    await backupApplicationDatabase(root, destination);
    log(`已创建一致数据库备份：${path.resolve(destination)}`);
  } else if (command === 'pages-snapshot') {
    const target = destination ? path.resolve(destination) : PAGES_ACTIVITY_SNAPSHOT;
    await exportPagesActivity(root, target);
    log(`已从 SQLite 更新网页活动快照：${target}`);
  } else {
    throw Error('存储命令或参数无效，使用 --help 查看用法。');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runStorage(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : '存储操作失败。');
    process.exitCode = 1;
  });
}

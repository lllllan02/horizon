import type { DatabaseSync } from 'node:sqlite';
import { withApplicationDatabase, withTransaction } from './app-database.ts';
import { ReviewError } from './review-model.ts';
import { defaultReviewPriorities, parseReviewPriorities } from './review-priorities.ts';

function validate(value: unknown) {
  try {
    return parseReviewPriorities(value);
  } catch (error) {
    throw new ReviewError(error instanceof Error ? error.message : '复习目录优先级无效。', 400);
  }
}

function initialize(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS review_priorities (
    collection TEXT PRIMARY KEY,
    priority INTEGER NOT NULL CHECK(priority >= 0)
  )`);
  const insert = db.prepare(
    'INSERT OR IGNORE INTO review_priorities(collection, priority) VALUES (?, ?)',
  );
  for (const [collection, priority] of Object.entries(defaultReviewPriorities))
    insert.run(collection, priority);
}

function read(db: DatabaseSync): Record<string, number> {
  return parseReviewPriorities(
    Object.fromEntries(
      db
        .prepare('SELECT collection, priority FROM review_priorities ORDER BY collection')
        .all()
        .map((row) => {
          if (typeof row.collection !== 'string' || typeof row.priority !== 'number')
            throw Error('复习设置包含无效数据库字段。');
          return [row.collection, row.priority];
        }),
    ),
  );
}

async function operation(root: string, task: (db: DatabaseSync) => Record<string, number>) {
  try {
    return await withApplicationDatabase(root, (db) =>
      withTransaction(db, () => {
        initialize(db);
        return task(db);
      }),
    );
  } catch (error) {
    if (error instanceof ReviewError) throw error;
    if (error instanceof Error && /locked|busy/i.test(error.message))
      throw new ReviewError('复习设置正被其他服务使用，请稍后重试。', 503);
    throw new ReviewError('复习设置无法读取或保存，原数据已保留。', 500);
  }
}

export async function loadReviewPriorities(root: string): Promise<Record<string, number>> {
  return operation(root, read);
}

/** Replace preferences in one transaction without touching review records or events. */
export async function saveReviewPriorities(
  root: string,
  values: unknown,
): Promise<Record<string, number>> {
  const priorities = { ...defaultReviewPriorities, ...validate(values) };
  return operation(root, (db) => {
    db.exec('DELETE FROM review_priorities');
    const insert = db.prepare('INSERT INTO review_priorities(collection, priority) VALUES (?, ?)');
    for (const [collection, priority] of Object.entries(priorities))
      insert.run(collection, priority);
    return read(db);
  });
}

/** A single-row update prevents concurrent CLI commands from losing other preferences. */
export async function setReviewPriority(
  root: string,
  collection: string,
  priority: number,
): Promise<Record<string, number>> {
  validate({ [collection]: priority });
  return operation(root, (db) => {
    db.prepare(
      'INSERT INTO review_priorities(collection, priority) VALUES (?, ?) ON CONFLICT(collection) DO UPDATE SET priority = excluded.priority',
    ).run(collection, priority);
    return read(db);
  });
}

import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import {
  applicationDatabaseExists,
  withApplicationDatabase,
  withTransaction,
} from './app-database.ts';
import type { Library } from './types/library.ts';
import {
  applyReview,
  emptyReviewState,
  parseReviewState,
  reconcileReviews,
  reviewStateFromRecords,
  validateReviewInput,
  ReviewError,
  type ReviewEvent,
  type ReviewRecord,
  type ReviewState,
} from './review-model.ts';

const imported = (db: DatabaseSync) =>
  db.prepare("SELECT value FROM app_metadata WHERE key = 'reviews_imported'").get() !== undefined;

async function legacyReviews(root: string): Promise<ReviewState> {
  const file = path.join(await realpath(root), '.reviews.json');
  try {
    if (!(await lstat(file)).isFile()) throw new ReviewError('复习记录必须是普通文件。', 500);
    return parseReviewState(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyReviewState();
    if (error instanceof ReviewError) throw error;
    throw new ReviewError('复习记录无法读取，原记录已保留。', 500);
  }
}

/** Keep just the events needed for scheduling; full history lives in review_events. */
function summary(record: ReviewRecord): ReviewRecord {
  const counts = record.counts ?? { good: 0, hard: 0, forgot: 0 };
  if (!record.counts) for (const event of record.history) if (event.rating) counts[event.rating]++;
  const lastRating = record.history.findLast((event) => event.rating);
  const lastPresented = record.history.findLast((event) => event.presented);
  return {
    ...record,
    counts: { ...counts },
    history: record.history.filter((event) => event === lastRating || event === lastPresented),
  };
}

function createReviews(db: DatabaseSync, legacy: ReviewState) {
  if (imported(db)) return;
  db.exec(`
    CREATE TABLE review_records (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE review_events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL UNIQUE,
      document_id TEXT NOT NULL REFERENCES review_records(id),
      rating TEXT,
      reviewed_at TEXT NOT NULL,
      event TEXT NOT NULL
    );
    CREATE INDEX review_events_document_seq ON review_events(document_id, seq);
    CREATE INDEX review_events_rating_seq ON review_events(document_id, seq) WHERE rating IS NOT NULL;
  `);
  const insertRecord = db.prepare('INSERT INTO review_records(id, data) VALUES (?, ?)');
  const insertEvent = db.prepare(
    'INSERT INTO review_events(request_id, document_id, rating, reviewed_at, event) VALUES (?, ?, ?, ?, ?)',
  );
  for (const record of Object.values(legacy.records)) {
    insertRecord.run(record.id, JSON.stringify(summary(record)));
    for (const event of record.history)
      insertEvent.run(
        event.requestId,
        record.id,
        event.rating ?? null,
        event.reviewedAt,
        JSON.stringify(event),
      );
  }
  db.prepare("INSERT INTO app_metadata(key, value) VALUES ('reviews_imported', '1')").run();
}

async function migrationSource(root: string): Promise<ReviewState | undefined> {
  const needed = await withApplicationDatabase(root, (db) => !imported(db));
  return needed ? legacyReviews(root) : undefined;
}

function readState(db: DatabaseSync): ReviewState {
  const records = Object.fromEntries(
    db
      .prepare('SELECT id, data FROM review_records ORDER BY rowid')
      .all()
      .map((row) => [String(row.id), JSON.parse(String(row.data)) as ReviewRecord]),
  );
  return parseReviewState(reviewStateFromRecords(records));
}

function saveChanges(db: DatabaseSync, before: ReviewState, after: ReviewState) {
  const upsert = db.prepare(
    'INSERT INTO review_records(id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
  );
  for (const [id, record] of Object.entries(after.records)) {
    if (JSON.stringify(before.records[id]) !== JSON.stringify(record))
      upsert.run(id, JSON.stringify(record));
  }
  // Reconciliation only deletes an old id after a unique fingerprint match.
  // Transfer all event rows in the same transaction as the new record.
  for (const [id, record] of Object.entries(before.records)) {
    if (Object.hasOwn(after.records, id)) continue;
    const replacement = Object.values(after.records).find(
      (candidate) =>
        !Object.hasOwn(before.records, candidate.id) &&
        candidate.fingerprint === record.fingerprint,
    );
    if (!replacement) throw new ReviewError('复习记录关联迁移失败，原记录已保留。', 500);
    db.prepare('UPDATE review_events SET document_id = ? WHERE document_id = ?').run(
      replacement.id,
      id,
    );
    db.prepare('DELETE FROM review_records WHERE id = ?').run(id);
  }
}

function insertEvent(db: DatabaseSync, id: string, event: ReviewEvent) {
  db.prepare(
    'INSERT INTO review_events(request_id, document_id, rating, reviewed_at, event) VALUES (?, ?, ?, ?, ?)',
  ).run(event.requestId, id, event.rating ?? null, event.reviewedAt, JSON.stringify(event));
}

async function storageOperation<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof ReviewError) throw error;
    const message = error instanceof Error ? error.message : '';
    if (/locked|busy/i.test(message))
      throw new ReviewError('复习记录正被其他服务使用，请稍后重试。', 503);
    throw new ReviewError('复习数据库无法读取或保存，原记录已保留。', 500);
  }
}

/** All writes are short SQLite transactions; legacy JSON is imported exactly once. */
export async function reviewStore(
  root: string,
  readLibrary: () => Promise<Library>,
  input?: unknown,
  onBefore?: (state: ReviewState) => void,
): Promise<ReviewState> {
  return storageOperation(async () => {
    if (input !== undefined) validateReviewInput(input);
    const legacy = await migrationSource(root);
    const library = await readLibrary();
    // Check again just before the synchronous transaction. No database lock spans
    // an asynchronous document read (which may itself update activity records).
    if ((await readLibrary()).version !== library.version)
      throw new ReviewError('文档库已更新，请同步后重试。');
    return withApplicationDatabase(root, (db) =>
      withTransaction(db, () => {
        createReviews(db, legacy ?? emptyReviewState());
        const state = readState(db);
        onBefore?.(state);
        if (input !== undefined) {
          validateReviewInput(input);
          const previous = db
            .prepare('SELECT document_id, event FROM review_events WHERE request_id = ?')
            .get(input.requestId);
          if (previous) {
            const event = JSON.parse(String(previous.event)) as ReviewEvent;
            if (
              previous.document_id !== input.id ||
              event.rating !== input.rating ||
              event.paused !== input.paused ||
              event.presented !== input.presented
            )
              throw new ReviewError('此请求编号已用于其他复习操作。');
            return state;
          }
        }
        const next =
          input === undefined
            ? reconcileReviews(state, library.documents)
            : applyReview(state, library.documents, input);
        const event =
          input === undefined
            ? undefined
            : next.records[input.id].history.find((event) => event.requestId === input.requestId);
        const compact = reviewStateFromRecords(
          Object.fromEntries(
            Object.entries(next.records).map(([id, record]) => [id, summary(record)]),
          ),
        );
        saveChanges(db, state, compact);
        if (event && input !== undefined) insertEvent(db, input.id, event);
        return compact;
      }),
    );
  });
}

async function readReviews<T>(root: string, task: (db: DatabaseSync) => T): Promise<T> {
  return storageOperation(async () => {
    const legacy = await migrationSource(root);
    return withApplicationDatabase(root, (db) =>
      withTransaction(db, () => {
        createReviews(db, legacy ?? emptyReviewState());
        return task(db);
      }),
    );
  });
}

/** Explicit migration for backups and the storage CLI, without changing document associations. */
export async function migrateReviews(root: string): Promise<void> {
  await readReviews(root, () => undefined);
}

/** Explicit interchange export reconstructs complete history, including orphan records. */
export async function exportReviews(root: string): Promise<ReviewState> {
  return storageOperation(async () => {
    if (!(await applicationDatabaseExists(root))) return legacyReviews(root);
    const state = await withApplicationDatabase(
      root,
      (db) => {
        db.exec('BEGIN');
        try {
          if (!imported(db)) return undefined;
          const state = readState(db);
          const records = Object.fromEntries(
            Object.entries(state.records).map(([id, record]) => {
              const { counts: _counts, ...full } = record;
              full.history = [];
              return [id, full];
            }),
          );
          for (const row of db
            .prepare('SELECT document_id, event FROM review_events ORDER BY seq')
            .all())
            records[String(row.document_id)].history.push(
              JSON.parse(String(row.event)) as ReviewEvent,
            );
          return parseReviewState(reviewStateFromRecords(records));
        } finally {
          db.exec('ROLLBACK');
        }
      },
      { readonly: true },
    );
    return state ?? legacyReviews(root);
  });
}

/** Rating history is fetched only when expanded, newest first, with a stable sequence cursor. */
export async function reviewHistory(
  root: string,
  id: string,
  cursor?: number,
  limit = 20,
): Promise<{ version: string; events: ReviewEvent[]; nextCursor: number | null }> {
  if (
    !id ||
    (cursor !== undefined && (!Number.isSafeInteger(cursor) || cursor <= 0)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new ReviewError('复习历史参数无效。', 400);
  return readReviews(root, (db) => {
    const state = readState(db);
    const rows = db
      .prepare(
        'SELECT seq, event FROM review_events WHERE document_id = ? AND rating IS NOT NULL AND seq < ? ORDER BY seq DESC LIMIT ?',
      )
      .all(id, cursor ?? Number.MAX_SAFE_INTEGER, limit + 1);
    const page = rows.slice(0, limit);
    return {
      version: state.version,
      events: page.map((row) => JSON.parse(String(row.event)) as ReviewEvent),
      nextCursor: rows.length > limit ? Number(page.at(-1)!.seq) : null,
    };
  });
}

/** Confirm ambiguous submissions even after later events have replaced the summary. */
export async function reviewRequest(root: string, requestId: string): Promise<{ found: boolean }> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) throw new ReviewError('复习参数无效。', 400);
  return readReviews(root, (db) => ({
    found: !!db.prepare('SELECT 1 FROM review_events WHERE request_id = ?').get(requestId),
  }));
}

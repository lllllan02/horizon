import {
  array,
  dictionary,
  object,
  number,
  nullable,
  optional,
  string,
  literal,
} from './data/validation.ts';
import { isActivityEvent } from './data/library-schema.ts';
import type {
  Library,
  LibraryDocument,
  LibraryActivity,
  ActivityEvent,
  ActivityKind,
} from './types/library.ts';
interface ImageSnapshot {
  title: string;
  files: Record<string, string>;
  collections: string[];
}
export interface ActivityState {
  schema: number;
  startedAt: string | null;
  documents: Record<
    string,
    {
      title: string;
      collection: string;
      state: string | null;
      digest: string;
      bodyDigest?: string;
      updatedAt?: string | null;
    }
  >;
  images: Record<string, ImageSnapshot>;
  events: ActivityEvent[];
}
import path from 'node:path';
import { readFile, readdir, lstat, realpath } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { beijingTimestamp, documentTime } from './document-dates.ts';
import { safeAsset } from './library.ts';
import { CONTENT_COLLECTIONS } from './collections.ts';
import { updateDocumentState } from './update-document-state.ts';
import type { DatabaseSync } from 'node:sqlite';
import {
  applicationDatabaseExists,
  withApplicationDatabase,
  withTransaction,
} from './app-database.ts';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const imageExt = /\.(png|jpe?g|webp|gif|svg|excalidraw)$/i;
const groupId = (file: string) => file.replace(imageExt, '');
const cache = new Map<string, { signature: string; digest: string }>();
export function metadataEvents(documents: LibraryDocument[]): ActivityEvent[] {
  return documents.flatMap((doc) => {
    const events: ActivityEvent[] = [];
    for (const [kind, time] of [
      ['created', doc.created],
      ['updated', doc.updated],
    ] as const) {
      if (
        !Number.isFinite(documentTime(time)) ||
        (kind === 'updated' &&
          Number.isFinite(documentTime(doc.created)) &&
          documentTime(time) <= documentTime(doc.created))
      )
        continue;
      events.push({
        id: `metadata:${doc.id}:${kind}:${time}`,
        kind,
        time: time!,
        entity: `doc:${doc.id}`,
        docId: doc.id,
        title: doc.title,
        collections: [doc.collection],
        source: 'metadata',
      });
    }
    return events;
  });
}
async function imageSnapshot(root: string, documents: LibraryDocument[]) {
  const images: Record<string, ImageSnapshot> = {};
  async function walk(dir: string) {
    let entries;
    try {
      if (!(await lstat(path.join(root, dir))).isDirectory()) return;
      entries = await readdir(path.join(root, dir), { withFileTypes: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw e;
    }
    for (const entry of entries) {
      const file = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile() && imageExt.test(file)) {
        const absolute = path.join(root, file),
          info = await lstat(absolute);
        const cached = cache.get(absolute);
        const signature = `${info.mtimeMs}:${info.size}`;
        const digest =
          cached?.signature === signature ? cached.digest : hash(await readFile(absolute));
        cache.set(absolute, { signature, digest });
        const id = groupId(file);
        images[id] ||= { title: path.posix.basename(id), files: {}, collections: [] };
        images[id].files[file] = digest;
      }
    }
  }
  await walk('assets');
  for (const doc of documents) {
    for (const match of doc.html.matchAll(/\/api\/asset\?[^"\s<>]+/g)) {
      const url = new URL(match[0].replaceAll('&amp;', '&'), 'http://local');
      const asset = await safeAsset(root, url.searchParams.get('path') || '', doc.path);
      const image = asset && images[groupId(asset.path)];
      if (image && !image.collections.includes(doc.collection))
        image.collections.push(doc.collection);
    }
  }
  for (const image of Object.values(images)) image.collections.sort();
  return images;
}
function publicActivity(
  state: Pick<ActivityState, 'events' | 'startedAt'>,
  documents: LibraryDocument[],
): LibraryActivity {
  const ids = new Set(documents.map((d) => d.id));
  // Only current, exported documents and enabled collection scopes reach the UI.
  const events = state.events.filter(
    (e) =>
      (!e.docId || ids.has(e.docId)) &&
      (!e.collections.length || e.collections.some((c) => CONTENT_COLLECTIONS.includes(c))),
  );
  return { startedAt: state.startedAt, events, version: hash(JSON.stringify(events)) };
}
const validState = object<ActivityState>({
  schema: number,
  startedAt: nullable(string),
  documents: dictionary(
    object({
      title: string,
      collection: string,
      state: nullable(literal('pending', 'reading', 'organized', 'understood', 'unread', 'read')),
      digest: string,
      bodyDigest: optional(string),
      updatedAt: optional(nullable(string)),
    }),
  ),
  images: dictionary(
    object<ImageSnapshot>({ title: string, files: dictionary(string), collections: array(string) }),
  ),
  events: array(isActivityEvent),
});
async function readState(file: string): Promise<ActivityState | null> {
  try {
    if (!(await lstat(file)).isFile()) throw Error('活动记录不是普通文件');
    const state: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (
      !validState(state) ||
      state.schema !== 1 ||
      (state.startedAt !== null && !Number.isFinite(documentTime(state.startedAt))) ||
      !state.events.every((event) => Number.isFinite(documentTime(event.time))) ||
      new Set(state.events.map((event) => event.id)).size !== state.events.length
    )
      throw Error('活动记录格式无效');
    return state;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}
const emptyState = (): ActivityState => ({
  schema: 1,
  startedAt: null,
  documents: {},
  images: {},
  events: [],
});
const imported = (db: DatabaseSync) => {
  const marker = db.prepare("SELECT value FROM app_metadata WHERE key = 'activity_imported'").get();
  if (marker && marker.value !== '1') throw Error('活动记录数据库版本无效');
  if (marker) db.prepare('SELECT seq, id, time, event FROM activity_events LIMIT 0');
  return Boolean(marker);
};
const metadata = (db: DatabaseSync, key: string): string => {
  const value = db.prepare('SELECT value FROM app_metadata WHERE key = ?').get(key)?.value;
  if (typeof value !== 'string') throw Error('活动记录数据库元数据无效');
  return value;
};
function putMetadata(db: DatabaseSync, key: string, value: string) {
  db.prepare(
    'INSERT INTO app_metadata(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}
function readSnapshots(db: DatabaseSync): Omit<ActivityState, 'events'> {
  const documents = Object.fromEntries(
    db
      .prepare('SELECT id, data FROM activity_documents ORDER BY rowid')
      .all()
      .map((row) => [row.id, JSON.parse(String(row.data))]),
  );
  const images = Object.fromEntries(
    db
      .prepare('SELECT id, data FROM activity_images ORDER BY rowid')
      .all()
      .map((row) => [row.id, JSON.parse(String(row.data))]),
  );
  const state = {
    schema: 1,
    startedAt: JSON.parse(metadata(db, 'activity_started_at')),
    documents,
    images,
    events: [],
  };
  if (
    !validState(state) ||
    (state.startedAt !== null && !Number.isFinite(documentTime(state.startedAt)))
  )
    throw Error('活动记录数据库快照无效');
  return state;
}
const historyCache = new Map<string, { revision: string; events: ActivityEvent[] }>();
const publicCache = new Map<string, { key: string; activity: LibraryActivity }>();
function readEvents(db: DatabaseSync, root: string): ActivityEvent[] {
  db.prepare('SELECT id, time, event FROM activity_events LIMIT 0');
  const revision = metadata(db, 'activity_revision');
  const cached = historyCache.get(root);
  if (cached?.revision === revision) return cached.events;
  const events = db
    .prepare('SELECT id, time, event FROM activity_events ORDER BY seq')
    .all()
    .map((row) => {
      const value: unknown = JSON.parse(String(row.event));
      if (
        !isActivityEvent(value) ||
        !Number.isFinite(documentTime(value.time)) ||
        value.id !== row.id ||
        value.time !== row.time
      )
        throw Error('活动记录数据库事件无效');
      return value;
    });
  historyCache.set(root, { revision, events });
  return events;
}
function appendEvents(db: DatabaseSync, events: ActivityEvent[]) {
  const insert = db.prepare('INSERT INTO activity_events(id, time, event) VALUES (?, ?, ?)');
  for (const event of events) insert.run(event.id, event.time, JSON.stringify(event));
}
function updateSnapshots(
  db: DatabaseSync,
  table: 'activity_documents' | 'activity_images',
  old: Record<string, unknown>,
  current: Record<string, unknown>,
) {
  let changed = false;
  const write = db.prepare(
    `INSERT INTO ${table}(id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
  );
  const remove = db.prepare(`DELETE FROM ${table} WHERE id = ?`);
  for (const [id, value] of Object.entries(current)) {
    const serialized = JSON.stringify(value);
    if (!Object.hasOwn(old, id) || JSON.stringify(old[id]) !== serialized) {
      write.run(id, serialized);
      changed = true;
    }
  }
  for (const id of Object.keys(old))
    if (!Object.hasOwn(current, id)) {
      remove.run(id);
      changed = true;
    }
  return changed;
}
function initializeActivity(db: DatabaseSync, state: ActivityState) {
  // All creation and legacy import share the observation transaction. Failed imports leave no marker.
  if (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'activity_%'")
      .all().length
  )
    throw Error('活动记录数据库结构不完整，原记录已保留');
  db.exec(`
    CREATE TABLE activity_documents (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE activity_images (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE activity_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, time TEXT NOT NULL, event TEXT NOT NULL);
    CREATE INDEX activity_events_time ON activity_events(time);
  `);
  updateSnapshots(db, 'activity_documents', {}, state.documents);
  updateSnapshots(db, 'activity_images', {}, state.images);
  appendEvents(db, state.events);
  putMetadata(db, 'activity_started_at', JSON.stringify(state.startedAt));
  putMetadata(db, 'activity_revision', randomUUID());
  putMetadata(db, 'activity_imported', '1');
  // An empty migration has not observed the library yet. A null start alone does not
  // imply emptiness: legacy snapshots and historical events remain valid baselines.
  const hasBaseline =
    state.startedAt !== null ||
    Object.keys(state.documents).length > 0 ||
    Object.keys(state.images).length > 0 ||
    state.events.length > 0;
  putMetadata(db, 'activity_observed', hasBaseline ? '1' : '0');
}
async function needsImport(root: string) {
  return (
    !(await applicationDatabaseExists(root)) ||
    !(await withApplicationDatabase(root, imported, { readonly: true }))
  );
}
/** Import without observing documents, for lossless backups and portable JSON restoration. */
export async function migrateActivity(root: string): Promise<void> {
  root = await realpath(root);
  if (!(await needsImport(root))) return;
  const legacy = await readState(path.join(root, '.activity.json'));
  await withApplicationDatabase(root, (db) =>
    withTransaction(db, () => {
      if (!imported(db)) initializeActivity(db, legacy || emptyState());
    }),
  );
}
async function storedActivity(root: string): Promise<ActivityState | null> {
  if (await applicationDatabaseExists(root)) {
    const state = await withApplicationDatabase(
      root,
      (db) => {
        db.exec('BEGIN');
        try {
          const state = imported(db)
            ? { ...readSnapshots(db), events: readEvents(db, root) }
            : null;
          db.exec('COMMIT');
          return state;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      },
      { readonly: true },
    );
    if (state) return state;
  }
  return readState(path.join(root, '.activity.json'));
}
/** JSON remains the portable interchange format; exporting never creates or migrates storage. */
export async function exportActivity(root: string): Promise<ActivityState> {
  return structuredClone((await storedActivity(await realpath(root))) || emptyState());
}
const normalizeState = (state: string) =>
  state === 'understood' || state === 'read' ? 'organized' : state === 'unread' ? 'pending' : state;

/** Only the local service writes progress back; exporters and retrieval remain read-only. */
export async function reconcileDocumentStates(
  root: string,
  library: Library,
  readLibrary?: () => Promise<Library>,
): Promise<Library> {
  // Reconciliation precedes first observation, so an existing legacy baseline must remain available.
  const previous = await readDocumentSnapshots(root);
  if (!previous) return library;
  let current = library;
  for (const doc of library.documents) {
    const old = Object.hasOwn(previous, doc.id) ? previous[doc.id] : null;
    if (!old || normalizeState(old.state ?? '') !== 'organized' || doc.state !== 'organized')
      continue;
    // updated_at marks a substantive revision; links, formatting and minor edits keep it.
    // Missing/legacy baselines cannot establish revision intent, so observe them first.
    const revisionAdvanced = documentTime(doc.updated) > documentTime(old.updatedAt);
    if (old.bodyDigest && revisionAdvanced && old.bodyDigest !== hash(doc.body))
      current = await updateDocumentState(
        root,
        {
          id: doc.id,
          state: 'reading',
          version: current.version,
        },
        readLibrary,
      );
  }
  return current;
}
async function readDocumentSnapshots(root: string): Promise<ActivityState['documents'] | null> {
  if (await applicationDatabaseExists(root)) {
    const documents = await withApplicationDatabase(
      root,
      (db) => (imported(db) ? readSnapshots(db).documents : null),
      { readonly: true },
    );
    if (documents) return documents;
  }
  return (await readState(path.join(root, '.activity.json')))?.documents || null;
}

export async function activityForLibrary(
  root: string,
  library: Library,
  { observe = false, publicExport = false, now = beijingTimestamp() } = {},
) {
  root = await realpath(root);
  try {
    let result: LibraryActivity;
    if (!observe) {
      const previous = await storedActivity(root);
      result = publicActivity(
        previous || { events: metadataEvents(library.documents), startedAt: null },
        library.documents,
      );
    } else {
      // Finish all file I/O before acquiring SQLite's synchronous write transaction.
      const documents = Object.fromEntries(
        library.documents.map((doc) => [
          doc.id,
          {
            title: doc.title,
            collection: doc.collection,
            state: doc.state,
            digest: hash(doc.title + '\n' + doc.body),
            bodyDigest: hash(doc.body),
            updatedAt: doc.updated,
          },
        ]),
      );
      const images = await imageSnapshot(root, library.documents);
      const legacy = (await needsImport(root))
        ? await readState(path.join(root, '.activity.json'))
        : null;
      const observed = await withApplicationDatabase(root, (db) =>
        withTransaction(db, () => {
          const fresh = !imported(db);
          if (fresh)
            initializeActivity(
              db,
              legacy || {
                schema: 1,
                startedAt: now,
                documents,
                images,
                events: metadataEvents(library.documents),
              },
            );
          const previous = readSnapshots(db);
          const firstObservation =
            db.prepare("SELECT value FROM app_metadata WHERE key = 'activity_observed'").get()
              ?.value === '0';
          const comparisonDocuments = firstObservation ? documents : previous.documents;
          const comparisonImages = firstObservation ? images : previous.images;
          const events: ActivityEvent[] = firstObservation ? metadataEvents(library.documents) : [];
          const emit = (
            kind: ActivityKind,
            entity: string,
            item: { title: string; collections?: string[]; collection?: string },
            extra: Partial<ActivityEvent> = {},
          ) =>
            events.push({
              id: randomUUID(),
              kind,
              entity,
              title: item.title,
              time: now,
              collections: item.collections || [item.collection!],
              source: 'observed',
              ...extra,
            });
          for (const [id, doc] of Object.entries(documents)) {
            const old = Object.hasOwn(comparisonDocuments, id) ? comparisonDocuments[id] : null;
            if (!old) emit('created', `doc:${id}`, doc, { docId: id });
            else {
              if (old.collection !== doc.collection)
                emit('moved', `doc:${id}`, doc, {
                  docId: id,
                  from: old.collection,
                  to: doc.collection,
                  collections: [...new Set([old.collection, doc.collection])],
                });
              if (
                old.collection === doc.collection &&
                old.state != null &&
                doc.state != null &&
                normalizeState(old.state) !== doc.state
              )
                emit('state-changed', `doc:${id}`, doc, {
                  docId: id,
                  from: normalizeState(old.state),
                  to: doc.state,
                });
              if (old.digest !== doc.digest) emit('updated', `doc:${id}`, doc, { docId: id });
            }
          }
          for (const [id, image] of Object.entries(images)) {
            const old = Object.hasOwn(comparisonImages, id) ? comparisonImages[id] : null;
            if (!old)
              emit('image-created', `image:${id}`, image, { files: Object.keys(image.files) });
            else {
              const added = Object.keys(image.files).filter(
                (file) => !Object.hasOwn(old.files, file),
              );
              const changed = Object.keys(image.files).filter(
                (file) => Object.hasOwn(old.files, file) && old.files[file] !== image.files[file],
              );
              if (added.length) emit('image-format', `image:${id}`, image, { files: added });
              if (changed.length) emit('image-updated', `image:${id}`, image, { files: changed });
            }
          }
          const changedDocuments = updateSnapshots(
            db,
            'activity_documents',
            previous.documents,
            documents,
          );
          const changedImages = updateSnapshots(db, 'activity_images', previous.images, images);
          if (events.length) appendEvents(db, events);
          if (firstObservation) putMetadata(db, 'activity_observed', '1');
          if (!previous.startedAt) putMetadata(db, 'activity_started_at', JSON.stringify(now));
          if (events.length || changedDocuments || changedImages || !previous.startedAt)
            putMetadata(db, 'activity_revision', randomUUID());
          const revision = metadata(db, 'activity_revision');
          const key = `${revision}:${library.version}`;
          const cached = publicCache.get(root);
          if (cached?.key === key) return cached.activity;
          const activity = publicActivity(
            { startedAt: previous.startedAt || now, events: readEvents(db, root) },
            library.documents,
          );
          // Cache publication occurs after the synchronous transaction has committed below.
          return { activity, key };
        }),
      );
      if ('activity' in observed) {
        publicCache.set(root, observed);
        result = observed.activity;
      } else result = observed;
    }
    if (publicExport) {
      const images = new Set<string>();
      for (const doc of library.documents)
        for (const match of doc.html.matchAll(/\/api\/asset\?[^"\s<>]+/g)) {
          const url = new URL(match[0].replaceAll('&amp;', '&'), 'http://local');
          const asset = await safeAsset(root, url.searchParams.get('path') || '', doc.path);
          if (asset) images.add(`image:${groupId(asset.path)}`);
        }
      // Static exports expose counts and referenced identities, not unreferenced source filenames.
      const events = result.events
        .filter((e) => e.docId || images.has(e.entity))
        .map(({ files, ...event }) => event);
      return { ...result, events, version: hash(JSON.stringify(events)) };
    }
    return result;
  } catch (error) {
    historyCache.delete(root);
    publicCache.delete(root);
    return {
      ...publicActivity(
        { events: metadataEvents(library.documents), startedAt: null },
        library.documents,
      ),
      error: /locked|busy/i.test(String(error))
        ? '活动记录正被其他服务使用，稍后自动重试。'
        : '活动记录暂不可用，当前仅展示文档日期；原记录已保留。',
    };
  }
}

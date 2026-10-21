import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activityForLibrary, metadataEvents } from './activity.ts';
import { applicationDatabaseExists, withApplicationDatabase } from './app-database.ts';
import { CONTENT_COLLECTIONS } from './collections.ts';
import { isActivityEvent } from './data/library-schema.ts';
import { record } from './data/validation.ts';
import { beijingTimestamp, documentTime } from './document-dates.ts';
import { loadLibrary, safeAsset } from './library.ts';
import type { ActivityEvent, Library, LibraryActivity } from './types/library.ts';

export const PAGES_ACTIVITY_SNAPSHOT = fileURLToPath(
  new URL('../data/activity-snapshot.json', import.meta.url),
);
const version = (events: ActivityEvent[]) =>
  createHash('sha256').update(JSON.stringify(events)).digest('hex');
const imageExtension = /\.(png|jpe?g|webp|gif|svg|excalidraw)$/i;
const invalidSnapshot = '网页活动快照格式无效，请先另存损坏快照，再从 SQLite 重新导出。';

async function ordinaryFile(file: string) {
  const info = await lstat(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (info && !info.isFile()) throw Error('网页活动快照必须是普通 JSON 文件。');
  return info !== null;
}

function parseSnapshot(value: unknown): LibraryActivity {
  if (!record(value) || value.schema !== 1 || !record(value.activity)) throw Error(invalidSnapshot);
  const activity = value.activity;
  if (
    !(
      activity.startedAt === null ||
      (typeof activity.startedAt === 'string' && Number.isFinite(documentTime(activity.startedAt)))
    ) ||
    typeof activity.version !== 'string' ||
    activity.error !== undefined ||
    !Array.isArray(activity.events) ||
    !activity.events.every(
      (event) =>
        isActivityEvent(event) &&
        Number.isFinite(documentTime(event.time)) &&
        (event.docId
          ? event.entity === `doc:${event.docId}` && !event.kind.startsWith('image-')
          : event.entity.startsWith('image:') && event.kind.startsWith('image-')),
    ) ||
    new Set(activity.events.map((event) => event.id)).size !== activity.events.length
  )
    throw Error(invalidSnapshot);
  // Reconstruct the public schema so stale/private fields never enter the built library.
  const events: ActivityEvent[] = activity.events.map((event: ActivityEvent) => ({
    id: event.id,
    kind: event.kind,
    time: event.time,
    entity: event.entity,
    title: event.title,
    collections: event.collections,
    source: event.source,
    ...(event.docId === undefined ? {} : { docId: event.docId }),
    ...(event.from === undefined ? {} : { from: event.from }),
    ...(event.to === undefined ? {} : { to: event.to }),
  }));
  return { startedAt: activity.startedAt, events, version: version(events) };
}

async function readSnapshot(file: string) {
  if (!(await ordinaryFile(file)))
    throw Error('缺少网页活动快照，请在有 SQLite 数据库的本机运行 storage pages-snapshot。');
  const source = await readFile(file, 'utf8');
  try {
    return parseSnapshot(JSON.parse(source));
  } catch (error) {
    if (error instanceof SyntaxError) throw Error(invalidSnapshot);
    throw error;
  }
}

async function currentPublicActivity(root: string, library: Library, activity: LibraryActivity) {
  const documentIds = new Set(library.documents.map((doc) => doc.id));
  const images = new Set<string>();
  for (const doc of library.documents)
    for (const match of doc.html.matchAll(/\/api\/asset\?[^"\s<>]+/g)) {
      const url = new URL(match[0].replaceAll('&amp;', '&'), 'http://local');
      const asset = await safeAsset(root, url.searchParams.get('path') || '', doc.path);
      if (asset && imageExtension.test(asset.path))
        images.add(`image:${asset.path.replace(imageExtension, '')}`);
    }
  const events = activity.events.filter(
    (event) =>
      (event.docId ? documentIds.has(event.docId) : images.has(event.entity)) &&
      (!event.collections.length ||
        event.collections.some((collection) => CONTENT_COLLECTIONS.includes(collection))),
  );
  // Content can reach CI before its next local observation. Preserve explicit new dates
  // without duplicating a recorded change of the same kind on the same Beijing day.
  const eventKey = (event: ActivityEvent) =>
    JSON.stringify([event.docId, event.kind, documentTime(event.time)]);
  const dayKey = (event: ActivityEvent) =>
    JSON.stringify([
      event.docId,
      event.kind,
      beijingTimestamp(documentTime(event.time)).slice(0, 10),
    ]);
  const recorded = new Set(events.map(eventKey));
  const observed = new Set(events.filter((event) => event.source === 'observed').map(dayKey));
  events.push(
    ...metadataEvents(library.documents).filter(
      (event) => !recorded.has(eventKey(event)) && !observed.has(dayKey(event)),
    ),
  );
  return parseSnapshot({ schema: 1, activity: { ...activity, events } });
}

async function fromDatabase(root: string, library: Library) {
  await withApplicationDatabase(
    root,
    (database) => {
      if (
        database.prepare("SELECT value FROM app_metadata WHERE key = 'activity_imported'").get()
          ?.value !== '1'
      )
        throw Error('SQLite 活动数据尚未完成迁移，请先运行 storage migrate。');
    },
    { readonly: true },
  );
  const activity = await activityForLibrary(root, library, { publicExport: true });
  if (activity.error) throw Error(activity.error);
  return currentPublicActivity(root, library, activity);
}

async function writeSnapshot(root: string, file: string, activity: LibraryActivity) {
  const target = path.resolve(file);
  const name = path.basename(target);
  if (
    path.extname(target) !== '.json' ||
    (path.resolve(path.dirname(target)) === root &&
      (name === '.activity.json' || name === '.reviews.json'))
  )
    throw Error('网页快照目标必须是独立的 .json 文件，不能覆盖本地存储。');
  // A malformed existing snapshot is evidence of an error, not permission to erase it.
  if (await ordinaryFile(target)) await readSnapshot(target);
  await mkdir(path.dirname(target), { recursive: true });
  if (
    (await realpath(path.dirname(target))) === root &&
    (name === '.activity.json' || name === '.reviews.json')
  )
    throw Error('网页快照不能覆盖本地存储，不能写回旧 JSON 路径。');
  const temporary = await mkdtemp(path.join(path.dirname(target), '.activity-snapshot-'));
  try {
    const staged = path.join(temporary, 'snapshot.json');
    await writeFile(staged, JSON.stringify({ schema: 1, activity }, null, 2) + '\n', {
      flag: 'wx',
    });
    await ordinaryFile(target);
    await rename(staged, target);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

/** Explicitly derive a public build snapshot; legacy JSON is never consulted. */
export async function exportPagesActivity(root: string, snapshotPath = PAGES_ACTIVITY_SNAPSHOT) {
  root = await realpath(root);
  if (!(await applicationDatabaseExists(root)))
    throw Error('导出网页活动快照需要本机 SQLite 数据库。');
  const activity = await fromDatabase(root, await loadLibrary(root));
  await writeSnapshot(root, snapshotPath, activity);
  return activity;
}

/** null disables persistence for fixture callers; production always supplies a snapshot. */
export async function loadPagesActivity(
  root: string,
  library: Library,
  snapshotPath: string | null = PAGES_ACTIVITY_SNAPSHOT,
): Promise<LibraryActivity> {
  root = await realpath(root);
  if (await applicationDatabaseExists(root)) {
    const activity = await fromDatabase(root, library);
    if (snapshotPath) await writeSnapshot(root, snapshotPath, activity);
    return activity;
  }
  if (snapshotPath) return currentPublicActivity(root, library, await readSnapshot(snapshotPath));
  const events = metadataEvents(library.documents);
  return { startedAt: null, events, version: version(events) };
}

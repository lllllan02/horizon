import { randomUUID } from 'node:crypto';
import { lstat, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { acquireActivityLock } from './activity-lock.ts';
import type { Library } from './types/library.ts';
import {
  applyReview,
  emptyReviewState,
  parseReviewState,
  reconcileReviews,
  ReviewError,
  type ReviewInput,
  type ReviewState,
} from './review-model.ts';

async function readReviews(file: string) {
  try {
    if (!(await lstat(file)).isFile()) throw new ReviewError('复习记录必须是普通文件。', 500);
    return parseReviewState(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyReviewState();
    if (error instanceof ReviewError) throw error;
    throw new ReviewError('复习记录无法读取，原记录已保留。', 500);
  }
}

/** The lock spans read, revision check and atomic replacement, across server processes. */
export async function reviewStore(
  root: string,
  readLibrary: () => Promise<Library>,
  input?: unknown,
): Promise<ReviewState> {
  const file = path.join(await realpath(root), '.reviews.json');
  let release: (() => Promise<void>) | undefined;
  try {
    release = await acquireActivityLock(file);
    const state = await readReviews(file);
    const library = await readLibrary();
    const next =
      input === undefined
        ? reconcileReviews(state, library.documents)
        : applyReview(state, library.documents, input as ReviewInput);
    if (state.version === next.version) return next;
    const temp = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, JSON.stringify(next, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      // A concurrent editor may change the document while the temporary file is written.
      if ((await readLibrary()).version !== library.version)
        throw new ReviewError('文档库已更新，请同步后重试。');
      await rename(temp, file);
    } finally {
      await unlink(temp).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
    return next;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new ReviewError('复习记录正被其他服务使用，请稍后重试。', 503);
    throw error;
  } finally {
    await release?.();
  }
}

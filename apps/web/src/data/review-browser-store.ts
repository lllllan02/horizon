import type { LibraryDocument } from '../types/library.ts';
import {
  applyReview,
  emptyReviewState,
  parseReviewState,
  reconcileReviews,
  type ReviewInput,
  type ReviewState,
} from '../review-model.ts';

/** Browser-only progress is kept separate from the file-backed local service. */
export function createBrowserReviewStore(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key: string,
  locks?: { run<T>(key: string, task: () => T): Promise<T> },
) {
  const read = (): ReviewState => {
    const raw = storage.getItem(key);
    if (raw === null) return emptyReviewState();
    try {
      return parseReviewState(JSON.parse(raw));
    } catch {
      throw Error('复习记录无法读取，已保留原记录。请检查浏览器存储后重试。');
    }
  };
  const persist = (before: ReviewState, after: ReviewState) => {
    if (before.version !== after.version) storage.setItem(key, JSON.stringify(after));
    return after;
  };
  const exclusive = <T>(task: () => T): Promise<T> =>
    locks ? locks.run(key, task) : Promise.resolve().then(task);
  return {
    load(documents: LibraryDocument[]) {
      return exclusive(() => {
        const before = read();
        return persist(before, reconcileReviews(before, documents));
      });
    },
    update(documents: LibraryDocument[], input: ReviewInput) {
      return exclusive(() => {
        const before = read();
        return persist(before, applyReview(before, documents, input));
      });
    },
  };
}

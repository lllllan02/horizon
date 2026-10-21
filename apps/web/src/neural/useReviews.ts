import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReaderGraph } from '../types/graph.ts';
import type { LibraryDocument } from '../types/library.ts';
import type { ReviewController } from '../types/review-ui.ts';
import {
  emptyReviewState,
  ReviewError,
  reviewFingerprint,
  reviewQueue,
  type ReviewInput,
  type ReviewRating,
  type ReviewState,
} from '../review-model.ts';
import {
  fetchReviews,
  reviewStorageKey,
  reviewStorageLabel,
  updateReview,
} from '../data/review-client.ts';
import { isDocumentNode } from './graph.ts';
import { clientId } from '../client-id.ts';

export function useReviews(graph: ReaderGraph): ReviewController {
  const documents = useMemo(() => graph.nodes.filter(isDocumentNode), [graph]);
  const docsRef = useRef<LibraryDocument[]>(documents);
  docsRef.current = documents;
  const [state, setState] = useState<ReviewState | null>(null);
  const current = useRef(state);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const busy = useRef(false);
  const generation = useRef(0);
  const alive = useRef(true);
  const retries = useRef(
    new Map<string, { requestId: string; revision: string; rating?: ReviewRating }>(),
  );
  const publish = useCallback((next: ReviewState) => {
    current.current = next;
    setState((old) => (old?.version === next.version ? old : next));
  }, []);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    const token = ++generation.current;
    try {
      const next = await fetchReviews(docsRef.current);
      if (!alive.current || token !== generation.current) return;
      publish(next);
      setError('');
    } catch (cause) {
      if (alive.current && token === generation.current)
        setError(cause instanceof Error ? cause.message : '无法读取复习记录，请重试。');
    } finally {
      if (alive.current && token === generation.current) setLoading(false);
    }
  }, [publish]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const update = () => {
      if (document.visibilityState === 'hidden') return;
      setNow(Date.now());
      void refresh();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === reviewStorageKey) update();
    };
    const interval = setInterval(update, 60000);
    window.addEventListener('focus', update);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', update);
    return () => {
      alive.current = false;
      generation.current++;
      clearInterval(interval);
      window.removeEventListener('focus', update);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh]);
  useEffect(() => {
    void refresh();
  }, [documents, refresh]);

  const save = useCallback(
    async (
      doc: LibraryDocument,
      action: { rating?: ReviewRating; paused?: boolean; presented?: true },
    ) => {
      if (busy.current || !current.current) return false;
      const latest = docsRef.current.find((item) => item.id === doc.id);
      if (
        !latest ||
        latest.state !== 'organized' ||
        latest.updated !== doc.updated ||
        latest.body !== doc.body
      ) {
        setError('资料已更新或不再是已整理，请重新打开后复习。');
        return false;
      }
      const revision = JSON.stringify([doc.id, doc.updated, reviewFingerprint(doc)]);
      const key = JSON.stringify([revision, action]);
      const unresolved = [...retries.current.values()].find(
        (item) => item.revision === revision && item.rating,
      );
      if (unresolved && action.rating && unresolved.rating !== action.rating) {
        setError('上次评分尚未确认，请先用原反馈重试。');
        return false;
      }
      const requestId = retries.current.get(key)?.requestId ?? clientId();
      retries.current.set(key, { requestId, revision, rating: action.rating });
      busy.current = true;
      generation.current++;
      setPending(true);
      setError('');
      try {
        const input: ReviewInput = {
          ...action,
          id: doc.id,
          requestId,
          version: current.current.version,
          documentUpdated: doc.updated,
          documentFingerprint: reviewFingerprint(doc),
        };
        const next = await updateReview(docsRef.current, input);
        if (!alive.current) return false;
        publish(next);
        retries.current.delete(key);
        setNow(Date.now());
        return true;
      } catch (cause) {
        if (!alive.current) return false;
        // A rejected version never committed this request, so it is safe to start
        // a new attempt after synchronizing instead of retaining an uncertain save.
        if (cause instanceof ReviewError && cause.status === 409) retries.current.delete(key);
        // Confirm ambiguous saves from the persisted request ID; otherwise retain the ID for retry.
        try {
          const latestState = await fetchReviews(docsRef.current);
          if (alive.current) {
            publish(latestState);
            const committed = Object.values(latestState.records).some((record) =>
              record.history.some((event) => event.requestId === requestId),
            );
            if (committed) {
              retries.current.delete(key);
              setError('');
              setNow(Date.now());
              return true;
            }
          }
        } catch {
          /* Keep the last known state and the original actionable error. */
        }
        if (alive.current)
          setError(cause instanceof Error ? cause.message : '复习记录保存失败，请重试。');
        return false;
      } finally {
        busy.current = false;
        if (alive.current) {
          setPending(false);
          setLoading(false);
        }
      }
    },
    [publish],
  );
  const queue = useMemo(
    () => reviewQueue(documents, state ?? emptyReviewState(), now),
    [documents, state, now],
  );
  return {
    state,
    queue,
    loading,
    pending,
    error,
    storageLabel: reviewStorageLabel,
    now,
    pendingRating: (doc) => {
      const revision = JSON.stringify([doc.id, doc.updated, reviewFingerprint(doc)]);
      return (
        [...retries.current.values()].find((item) => item.revision === revision && item.rating)
          ?.rating ?? null
      );
    },
    refresh,
    submit: (doc, rating) => save(doc, { rating }),
    present: (doc) => save(doc, { presented: true }),
    setPaused: (doc, paused) => save(doc, { paused }),
  };
}

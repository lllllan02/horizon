import { useCallback, useEffect, useRef, useState } from 'react';
import { beijingTimestamp, documentTime } from '../document-dates.ts';
import type { ReviewEvent, ReviewRating } from '../review-model.ts';
import type { LibraryDocument } from '../types/library.ts';
import type { ReviewController } from '../types/review-ui.ts';
import { formatReviewTime } from './review-statistics-model.ts';

const ratingLabels = { good: '记得', hard: '模糊', forgot: '忘了' } as const;

export function ReviewHistory({
  doc,
  total,
  paused,
  reviews,
}: {
  doc: LibraryDocument;
  total: number;
  paused: boolean;
  reviews: ReviewController;
}) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const inFlight = useRef(false);
  const version = reviews.state?.version;
  const loadHistory = reviews.loadHistory;
  const load = useCallback(
    async (cursor = 0) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const token = generation.current;
      setLoading(true);
      setError('');
      try {
        const page = await loadHistory(doc.id, cursor);
        if (token !== generation.current) return;
        setEvents((previous) => (cursor ? [...previous, ...page.events] : page.events));
        setNextCursor(page.nextCursor);
        setLoaded(true);
      } catch (cause) {
        if (token === generation.current)
          setError(cause instanceof Error ? cause.message : '复习历史加载失败，请重试。');
      } finally {
        if (token === generation.current) {
          inFlight.current = false;
          setLoading(false);
        }
      }
    },
    [doc.id, loadHistory],
  );
  useEffect(() => {
    generation.current++;
    inFlight.current = false;
    setEvents([]);
    setNextCursor(null);
    setLoaded(false);
    setLoading(false);
    setError('');
    if (open) void load();
    return () => {
      generation.current++;
      inFlight.current = false;
    };
  }, [version, doc.id, open, load]);
  return (
    <details className="db-rstat-history" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary title="展开或收起复习历史" aria-label={`复习历史，共 ${total} 次`}>
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="m9 5 7 7-7 7" />
        </svg>
      </summary>
      <div className="db-rstat-history-content" aria-busy={loading}>
        <div className="db-rstat-history-heading">
          <h4>
            复习历史 <span>{total} 次</span>
          </h4>
          <span title="当时计划由该次反馈的时间与间隔计算，后续反馈或正文修订可能已调整。">
            按反馈时间倒序
          </span>
          <button
            type="button"
            className="db-text-button"
            disabled={reviews.pending}
            onClick={() => void reviews.setPaused(doc, !paused)}
          >
            {paused ? '恢复复习' : '暂停复习'}
          </button>
        </div>
        {events.length > 0 && (
          <ol>
            {events.map((event) => {
              const plannedAt =
                event.dueAt ??
                beijingTimestamp(documentTime(event.reviewedAt) + event.intervalDays * 86_400_000);
              return (
                <li key={event.requestId}>
                  <time dateTime={event.reviewedAt}>{formatReviewTime(event.reviewedAt)}</time>
                  <span className="db-rstat-rating" data-rating={event.rating}>
                    {ratingLabels[event.rating as ReviewRating]}
                  </span>
                  <span>间隔 {event.intervalDays} 天</span>
                  <span>
                    当时计划 <time dateTime={plannedAt}>{formatReviewTime(plannedAt)}</time>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {loading && (
          <p className="db-rstat-note" role="status">
            正在加载复习历史…
          </p>
        )}
        {error && (
          <p className="db-rstat-note" role="alert">
            {error}{' '}
            <button
              type="button"
              className="db-text-button"
              onClick={() => void load(loaded ? (nextCursor ?? 0) : 0)}
            >
              重试加载
            </button>
          </p>
        )}
        {!loading && !error && loaded && events.length === 0 && (
          <p className="db-rstat-note">尚无反馈记录，完成首次复习后会显示在这里。</p>
        )}
        {!error && nextCursor !== null && (
          <button
            type="button"
            className="db-text-button"
            disabled={loading}
            onClick={() => void load(nextCursor)}
          >
            加载更多
          </button>
        )}
      </div>
    </details>
  );
}

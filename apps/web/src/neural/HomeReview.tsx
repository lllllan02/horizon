import { useEffect, useRef, useState } from 'react';
import type { LibraryDocument } from '../types/library.ts';
import type { ReviewController } from '../types/review-ui.ts';
import type { ReviewRating } from '../review-model.ts';
import './home-review.css';

const ratings: { id: ReviewRating; label: string }[] = [
  { id: 'forgot', label: '忘了' },
  { id: 'hard', label: '有点模糊' },
  { id: 'good', label: '记得' },
];

/** Every rating advances after a successful save; opening a document is explicit. */
export function useHomeReview(reviews: ReviewController) {
  const [doc, setDoc] = useState<LibraryDocument | null>(null);
  const [saved, setSaved] = useState(false);
  const [rating, setRating] = useState<ReviewRating | null>(null);
  const [turn, setTurn] = useState(0);
  const busy = useRef(false);
  const attempted = useRef<ReviewRating | null>(null);
  const observedReview = useRef<string | null>(null);
  const pendingRating = doc ? (reviews.pendingRating(doc) ?? attempted.current) : null;
  const available = reviews.queue.recommendations;
  const all = [...available, ...reviews.queue.paused];
  const current = doc ? all.find((item) => item.id === doc.id) : null;
  const changed =
    !!doc &&
    (!current ||
      current.state !== 'organized' ||
      current.body !== doc.body ||
      current.updated !== doc.updated);
  const lastReview = (id: string) =>
    reviews.state?.records[id]?.history.findLast((event) => event.rating)?.requestId ?? null;
  const completedElsewhere =
    !!doc && !saved && !reviews.pendingRating(doc) && lastReview(doc.id) !== observedReview.current;
  const paused = !!doc && !!reviews.state?.records[doc.id]?.paused;
  const unavailable = !!doc && !saved && !available.some((item) => item.id === doc.id);
  // An ambiguous save may already have committed. Retrying the same selection
  // lets the controller reuse its request ID instead of silently counting it twice.
  const blocked = changed || paused || completedElsewhere || (unavailable && !attempted.current);
  useEffect(() => {
    if (doc || reviews.loading || !reviews.state) return;
    observedReview.current = available[0] ? lastReview(available[0].id) : null;
    setDoc(available[0] ?? null);
  }, [doc, reviews.loading, reviews.state, available]);
  const select = (nextDoc: LibraryDocument | null) => {
    observedReview.current = nextDoc ? lastReview(nextDoc.id) : null;
    setDoc(nextDoc);
    setTurn((value) => value + 1);
    setSaved(false);
    setRating(null);
    attempted.current = null;
  };
  const save = async (choice: ReviewRating) => {
    if (!doc || saved || blocked || reviews.pending || busy.current) return false;
    if (pendingRating && pendingRating !== choice) return false;
    busy.current = true;
    attempted.current = choice;
    try {
      const success = await reviews.submit(doc, choice);
      if (success) setSaved(true);
      return success;
    } finally {
      busy.current = false;
    }
  };
  const choose = async (choice: ReviewRating) => {
    if (!doc || saved || blocked || reviews.pending || busy.current) return false;
    if (pendingRating && pendingRating !== choice) return false;
    setRating(choice);
    return save(choice);
  };
  const next = () => {
    if (reviews.pending || busy.current) return;
    select(available.find((item) => item.id !== doc?.id) ?? available[0] ?? null);
  };
  useEffect(() => {
    if (!saved) return;
    select(available.find((item) => item.id !== doc?.id) ?? available[0] ?? null);
  }, [saved, doc, available]);
  return {
    doc,
    saved,
    rating,
    attemptedRating: pendingRating,
    changed,
    blocked,
    canMoveOn: blocked || (unavailable && !!reviews.error),
    remaining: available.length,
    turn,
    message: changed
      ? '资料已更新或不再是已整理，请进入下一题。'
      : completedElsewhere
        ? '这篇资料已在其他页面完成，请进入下一题。'
        : paused
          ? '这篇资料已暂停复习。'
          : unavailable && !saved && !attempted.current
            ? '这篇资料已不在当前复习范围。'
            : '',
    choose,
    next,
  };
}

export type HomeReviewSession = ReturnType<typeof useHomeReview>;
type SharedProps = { session: HomeReviewSession; reviews: ReviewController };

function Feedback({
  session,
  reviews,
  onOpen,
}: SharedProps & { onOpen: (doc: LibraryDocument) => void }) {
  return (
    <div className="home-review-feedback" aria-label="本次回忆情况">
      {ratings.map((choice) => (
        <button
          key={choice.id}
          type="button"
          aria-label={choice.label}
          aria-pressed={session.rating === choice.id}
          disabled={
            reviews.pending ||
            session.saved ||
            session.blocked ||
            (!!session.attemptedRating && session.attemptedRating !== choice.id)
          }
          onClick={async () => {
            const selected = session.doc;
            const success = await session.choose(choice.id);
            if (success && selected && choice.id !== 'good') onOpen(selected);
          }}
        >
          {choice.id === 'hard' ? '模糊' : choice.label}
        </button>
      ))}
    </div>
  );
}

function Status({ session, reviews, onRetry }: SharedProps & { onRetry: () => void }) {
  return (
    <>
      {reviews.pending && <p role="status">正在保存…</p>}
      {session.saved && (
        <p className="home-review-saved" role="status">
          已保存，已安排下次复习。
        </p>
      )}
      {session.message && <p role="status">{session.message}</p>}
      {reviews.error && (
        <div className="home-review-error" role="alert">
          <p>{reviews.error}</p>
          <button type="button" disabled={reviews.pending} onClick={onRetry}>
            重新读取记录
          </button>
        </div>
      )}
    </>
  );
}

export function HomeReviewCard({
  session,
  reviews,
  onOpen,
  visible,
}: SharedProps & {
  onOpen: (doc: LibraryDocument) => void;
  visible: boolean;
}) {
  const title = useRef<HTMLButtonElement>(null);
  const focusTitle = useRef(false);
  const presentationAttempt = useRef<string | null>(null);
  const [presentationRetry, setPresentationRetry] = useState(0);
  useEffect(() => {
    const presentVisible = () => {
      if (
        !visible ||
        document.visibilityState !== 'visible' ||
        !session.doc ||
        session.rating ||
        session.saved ||
        session.blocked ||
        reviews.pending
      )
        return;
      const key = `${session.doc.id}:${session.turn}`;
      if (presentationAttempt.current === key) return;
      // One automatic attempt per turn; an explicit retry can reset a failed attempt.
      presentationAttempt.current = key;
      void reviews.present(session.doc);
    };
    presentVisible();
    document.addEventListener('visibilitychange', presentVisible);
    return () => document.removeEventListener('visibilitychange', presentVisible);
  }, [
    visible,
    session.doc,
    session.turn,
    session.rating,
    session.saved,
    session.blocked,
    reviews.pending,
    reviews.present,
    presentationRetry,
  ]);
  const retryPresentation = async () => {
    await reviews.refresh();
    if (!session.rating && !session.saved) {
      presentationAttempt.current = null;
      setPresentationRetry((value) => value + 1);
    }
  };
  useEffect(() => {
    if (!focusTitle.current) return;
    title.current?.focus();
    focusTitle.current = false;
  }, [session.doc]);
  return (
    <section
      className="galaxy-review home-review-card"
      aria-label="间隔复习"
      aria-busy={reviews.pending}
    >
      <div className="home-review-content">
        {session.doc ? (
          <>
            <button
              ref={title}
              type="button"
              className="home-review-title"
              title={session.doc.title}
              onClick={() => session.doc && onOpen(session.doc)}
            >
              <span aria-live="polite" aria-atomic="true">
                {session.doc.title}
              </span>
            </button>
            <Feedback session={session} reviews={reviews} onOpen={onOpen} />
            {session.canMoveOn && (
              <button
                type="button"
                className="home-review-next"
                aria-label="进入下一题"
                title="进入下一题"
                disabled={reviews.pending}
                onClick={() => {
                  focusTitle.current = true;
                  session.next();
                }}
              >
                ›
              </button>
            )}
          </>
        ) : (
          <span className="home-review-empty" role="status">
            {reviews.loading ? '正在读取…' : !reviews.state ? '记录未载入' : '暂无可复习资料'}
          </span>
        )}
      </div>
      {(reviews.pending || session.saved || session.message || reviews.error) && (
        <div className="home-review-status">
          <Status session={session} reviews={reviews} onRetry={() => void retryPresentation()} />
        </div>
      )}
    </section>
  );
}

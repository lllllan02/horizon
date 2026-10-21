import { useEffect, useRef, useState } from 'react';
import type { ReaderGraph } from '../types/graph.ts';
import type { LibraryDocument } from '../types/library.ts';
import type { ReviewController } from '../types/review-ui.ts';
import { nextReviewInterval, type ReviewRating } from '../review-model.ts';
import { MarkdownArticle } from './MarkdownArticle.tsx';
import { docHref } from './dashboard-data.ts';
import { ReviewStatistics } from './ReviewStatistics.tsx';
import './dashboard-review.css';

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const date = (value: string | null | undefined) =>
  value ? dateFormatter.format(new Date(value)) : '尚未复习';
const topicOf = (doc: LibraryDocument) => doc.category || '未分类';
const ratings: { id: ReviewRating; label: string }[] = [
  { id: 'forgot', label: '忘了' },
  { id: 'hard', label: '有点模糊' },
  { id: 'good', label: '记得' },
];

export function DashboardReview({
  graph,
  reviews,
}: {
  graph: ReaderGraph;
  reviews: ReviewController;
}) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [session, setSession] = useState<LibraryDocument | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedRating, setSelectedRating] = useState<ReviewRating | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const opener = useRef<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const { queue, state, pending } = reviews;
  const available = [...queue.due, ...queue.eligibleFresh].filter(
    (doc) => !skipped.includes(doc.id),
  );
  const current = session ? graph.index.get(session.id) : null;
  const changed =
    !!session &&
    (current?.nodeType !== 'document' ||
      current.state !== 'organized' ||
      current.body !== session.body ||
      current.updated !== session.updated);
  const paused = !!session && !!state?.records[session.id]?.paused;
  const close = () => {
    setSession(null);
    setSaved(false);
    setRevealed(false);
    requestAnimationFrame(() => {
      // Restore the originating row when it is still actionable; otherwise focus search.
      const originatingButton = opener.current
        ? (host.current?.querySelector<HTMLElement>(
            `[data-review-start="${CSS.escape(opener.current)}"]`,
          ) ?? host.current?.querySelector<HTMLInputElement>('.db-rstat-search input'))
        : host.current?.querySelector<HTMLInputElement>('.db-rstat-search input');
      const target = originatingButton?.matches(':disabled')
        ? host.current?.querySelector<HTMLInputElement>('.db-rstat-search input')
        : originatingButton;
      target?.focus();
    });
  };
  useEffect(() => {
    if (!session) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || reviews.pending) return;
      // Image/code viewers own Escape while their dialog is open.
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [session, reviews.pending]);
  useEffect(() => {
    if (session) title.current?.focus();
  }, [session]);
  useEffect(() => {
    if (revealed) body.current?.focus({ preventScroll: true });
  }, [revealed]);
  const start = (doc: LibraryDocument, element?: HTMLElement) => {
    if (element) opener.current = element.dataset.reviewStart ?? null;
    setSession(doc);
    setRevealed(false);
    setSaved(false);
    setSelectedRating(null);
    setCopyMessage('');
  };
  const next = () => {
    const doc = available.find((item) => item.id !== session?.id);
    if (doc) start(doc);
    else close();
  };
  const skip = () => {
    if (session) setSkipped((ids) => (ids.includes(session.id) ? ids : [...ids, session.id]));
    next();
  };
  const submit = async (rating: ReviewRating) => {
    if (!session || changed || paused || saved || pending) return;
    if (await reviews.submit(session, rating)) setSaved(true);
  };
  const chooseRating = (rating: ReviewRating) => {
    if (pending || saved || changed || paused) return;
    if (rating === 'good') {
      void submit(rating);
    } else {
      setSelectedRating(rating);
      setRevealed(true);
    }
  };
  return (
    <div className="db-review" data-review-panel="records" ref={host}>
      {reviews.error && (
        <div className="db-warning" role="alert">
          <p>{reviews.error}</p>
          <button
            className="db-text-button"
            disabled={pending}
            onClick={() => void reviews.refresh()}
          >
            重新读取记录
          </button>
        </div>
      )}
      {reviews.loading ? (
        <p role="status" className="db-empty">
          正在加载复习记录…
        </p>
      ) : !state ? (
        <p className="db-empty">复习记录尚未载入，请重试后开始。</p>
      ) : (
        <>
          <div hidden={!!session}>
            <div className="db-review-entrybar">
              <div>
                <p className="db-review-storage">{reviews.storageLabel} · 北京时间</p>
                {queue.freshRemaining > 0 && queue.eligibleFresh.length === 0 && (
                  <p className="db-review-quota">
                    今日首次复习已满 5 篇，其余未复习资料明日继续；已到期资料仍可复习。
                  </p>
                )}
              </div>
              <button
                className="db-primary"
                data-review-start="today"
                disabled={pending || !available.length}
                onClick={(event) => start(available[0], event.currentTarget)}
              >
                开始今日复习
              </button>
            </div>
            <ReviewStatistics graph={graph} reviews={reviews} onStart={start} />
            {skipped.length > 0 && (
              <p className="db-review-skip-note">
                本次已跳过 {skipped.length} 篇，尚未记为完成。
                <button className="db-text-button" onClick={() => setSkipped([])}>
                  重新显示
                </button>
              </p>
            )}
          </div>
          {session && (
            <section
              className="db-review-session"
              aria-labelledby="review-session-title"
              aria-busy={pending}
            >
              <div className="db-review-session-nav">
                <span>回忆 → 按需查看 → 完成</span>
                <button className="db-text-button" disabled={pending} onClick={close}>
                  退出复习
                </button>
              </div>
              <p className="db-eyebrow">{topicOf(session)} · 已整理</p>
              <h2 id="review-session-title" ref={title} tabIndex={-1}>
                {session.title}
              </h2>
              {!changed && !paused && (
                <>
                  {saved ? (
                    <div className="db-review-saved" role="status">
                      <p>已保存，下次复习：{date(state.records[session.id]?.dueAt)}</p>
                      <button className="db-primary" onClick={next}>
                        {available.some((doc) => doc.id !== session.id) ? '下一篇' : '返回复习列表'}
                      </button>
                    </div>
                  ) : (
                    <div className="db-review-feedback">
                      <h3>看到标题，还记得吗？</h3>
                      <p>记得可直接完成；有点模糊或忘了，先查看原文再完成。</p>
                      <div>
                        {ratings.map((rating) => (
                          <button
                            key={rating.id}
                            disabled={pending}
                            aria-pressed={selectedRating === rating.id}
                            onClick={() => chooseRating(rating.id)}
                          >
                            <strong>{rating.label}</strong>
                            <span>
                              {nextReviewInterval(state.records[session.id], rating.id)} 天后
                            </span>
                          </button>
                        ))}
                      </div>
                      {pending && <p role="status">正在保存…</p>}
                    </div>
                  )}
                </>
              )}
              {changed || paused ? (
                <div className="db-warning" role="status">
                  <p>
                    {changed
                      ? '资料已更新或不再是已整理，请返回列表重新打开。'
                      : '这篇资料已暂停复习，请返回列表恢复后再开始。'}
                  </p>
                  <button className="db-text-button" onClick={close}>
                    返回复习列表
                  </button>
                </div>
              ) : saved ? null : !revealed ? (
                <div className="db-review-recall">
                  <p>先用自己的话回忆：它讲了什么？解决什么问题？有哪些关键点？</p>
                  <p>也可以先查看原文，再选择上面的回忆情况。</p>
                  <button className="db-primary" onClick={() => setRevealed(true)}>
                    查看原文
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="db-review-body"
                    ref={body}
                    tabIndex={-1}
                    role="region"
                    aria-label="复习原文"
                    onClick={async (event) => {
                      const button = (event.target as Element).closest<HTMLButtonElement>(
                        '.copy-code',
                      );
                      if (!button || button.disabled) return;
                      const code = button
                        .closest('.code-block')
                        ?.querySelector(
                          button.closest('.diagram-block') ? '.diagram-source code' : 'pre code',
                        )?.textContent;
                      if (code === undefined || code === null) return;
                      button.disabled = true;
                      try {
                        await navigator.clipboard.writeText(code);
                        setCopyMessage('代码已复制');
                      } catch {
                        setCopyMessage('复制失败，请手动选择代码进行复制。');
                      } finally {
                        button.disabled = false;
                      }
                    }}
                  >
                    <MarkdownArticle html={session.html} zoomable />
                  </div>
                  {copyMessage && (
                    <p className="db-caption" role="status">
                      {copyMessage}
                    </p>
                  )}
                  <a className="db-text-button" href={docHref(session.id)}>
                    查看完整文档 ↗
                  </a>
                  {!saved && selectedRating && (
                    <div className="db-review-complete">
                      <p>
                        本次回忆：{ratings.find((rating) => rating.id === selectedRating)?.label}。
                        看完后完成复习，按这次回忆情况安排下次时间。
                      </p>
                      <button
                        className="db-primary"
                        disabled={pending}
                        onClick={() => void submit(selectedRating)}
                      >
                        {pending ? '正在保存…' : '完成复习'}
                      </button>
                    </div>
                  )}
                </>
              )}
              {!saved && !changed && !paused && (
                <button className="db-text-button" disabled={pending} onClick={skip}>
                  进入下一题
                </button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

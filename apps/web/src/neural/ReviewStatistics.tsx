import { useMemo, useState } from 'react';
import type { ReaderGraph } from '../types/graph.ts';
import type { ReviewController } from '../types/review-ui.ts';
import type { LibraryDocument } from '../types/library.ts';
import { isDocumentNode } from './graph.ts';
import { docHref } from './dashboard-data.ts';
import {
  buildReviewStatistics,
  formatReviewTime,
  reviewStatisticsStatusLabels,
  reviewStatisticsPeriodLabels,
  type ReviewStatisticsFilters,
  type ReviewStatisticsSort,
  type ReviewStatisticsStatus,
} from './review-statistics-model.ts';
import './review-statistics.css';

const ratingLabels = { good: '记得', hard: '模糊', forgot: '忘了' } as const;
const ratingKeys = ['good', 'hard', 'forgot'] as const;
const periods = [
  ['all', '全部时间'],
  ['today', '今日到期'],
  ['overdue', '已逾期'],
  ['future', '未来安排'],
  ['fresh', '未复习'],
  ['reviewed-today', '今日已复习'],
] as const;
function ReviewTime({ value, empty }: { value: string | null; empty: string }) {
  if (!value) return <span className="db-rstat-unset">{empty}</span>;
  const [day, clock] = formatReviewTime(value).split(' ');
  return (
    <time dateTime={value}>
      <span>{day}</span> <small>{clock}</small>
    </time>
  );
}

export function ReviewStatistics({
  graph,
  reviews,
  onStart,
}: {
  graph: ReaderGraph;
  reviews: ReviewController;
  onStart: (doc: LibraryDocument, element?: HTMLElement) => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | ReviewStatisticsStatus>('all');
  const [sort, setSort] = useState<ReviewStatisticsSort>('due');
  const [period, setPeriod] = useState<NonNullable<ReviewStatisticsFilters['period']>>('all');
  const stats = useMemo(
    () =>
      buildReviewStatistics(graph.nodes.filter(isDocumentNode), reviews.state, reviews.now, {
        search,
        status,
        sort,
        period,
      }),
    [graph, reviews.state, reviews.now, search, status, sort, period],
  );
  const { totals } = stats;
  const filtered = !!search.trim() || status !== 'all' || period !== 'all';
  const eligible = new Set(
    [...reviews.queue.due, ...reviews.queue.eligibleFresh].map((doc) => doc.id),
  );
  const clear = () => {
    setSearch('');
    setStatus('all');
    setPeriod('all');
  };
  if (!reviews.state)
    return (
      <p className="db-empty" role="status">
        复习记录尚未载入。
      </p>
    );
  return (
    <section className="db-review-statistics" aria-label="复习统计">
      <h2 className="db-sr-only">全部复习记录</h2>
      <div className="db-rstat-summary" data-review-summary>
        <div className="db-rstat-metric">
          <p className="db-rstat-metric-label">已整理资料</p>
          <p className="db-rstat-metric-value">
            <span data-review-summary-count="documents">{totals.documents}</span>
            <small>篇</small>
          </p>
          <div className="db-rstat-meter" aria-hidden="true">
            <span
              style={{
                width: `${totals.documents ? (totals.reviewed / totals.documents) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="db-rstat-metric-caption">
            已复习 <span data-review-summary-count="reviewed">{totals.reviewed}</span> 篇
            <span>未复习 {totals.documents - totals.reviewed} 篇</span>
          </p>
        </div>
        <div className="db-rstat-metric">
          <p className="db-rstat-metric-label">累计复习</p>
          <p className="db-rstat-metric-value">
            <span data-review-summary-count="total">{totals.total}</span>
            <small>次</small>
          </p>
          <p className="db-rstat-metric-caption">
            {filtered ? '当前筛选资料' : '全部已整理资料'}的反馈记录
          </p>
        </div>
        <div className="db-rstat-metric db-rstat-distribution">
          <p className="db-rstat-metric-label">回忆反馈分布</p>
          <div className="db-rstat-meter db-rstat-distribution-bar" aria-hidden="true">
            {ratingKeys.map((rating) => (
              <span
                key={rating}
                data-rating={rating}
                style={{ width: `${totals.total ? (totals[rating] / totals.total) * 100 : 0}%` }}
              />
            ))}
          </div>
          <dl className="db-rstat-legend">
            {ratingKeys.map((rating) => (
              <div key={rating} data-rating={rating}>
                <dt>
                  <i aria-hidden="true" />
                  {ratingLabels[rating]}
                </dt>
                <dd>
                  <span data-review-summary-count={rating}>{totals[rating]}</span>
                  <small>次</small>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <div className="db-rstat-table-panel">
        <nav className="db-rstat-periods" aria-label="复习时间筛选">
          {periods.map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="db-rstat-filters">
          <label className="db-rstat-search">
            <span className="db-sr-only">搜索资料</span>
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              type="search"
              name="review-search"
              autoComplete="off"
              value={search}
              placeholder="搜索标题或专题…"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span className="db-sr-only">复习状态</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option value="all">全部状态</option>
              {Object.entries(reviewStatisticsStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="db-sr-only">排序方式</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as ReviewStatisticsSort)}
            >
              <option value="due">下次复习 ↑</option>
              <option value="count">复习次数 ↓</option>
              <option value="recent">最近复习 ↓</option>
            </select>
          </label>
        </div>
        <div className="db-rstat-result-line">
          <p role="status">
            {filtered ? '筛选结果' : '全部记录'} <strong>{totals.documents}</strong>
            <span> / {stats.fullCount} 篇</span>
          </p>
          {filtered && (
            <button type="button" onClick={clear}>
              清除筛选
            </button>
          )}
          <span className="db-rstat-timezone">北京时间</span>
        </div>
        {stats.rows.length ? (
          <div className="db-rstat-list">
            <div className="db-rstat-columns" aria-hidden="true">
              <span>文档</span>
              <div>
                <span>总计</span>
                {ratingKeys.map((rating) => (
                  <span key={rating}>{ratingLabels[rating]}</span>
                ))}
              </div>
              <span>上次复习</span>
              <span>下次复习</span>
              <span />
            </div>
            {stats.rows.map((row) => {
              const doc = graph.index.get(row.doc.id);
              if (!doc || !isDocumentNode(doc)) return null;
              return (
                <article
                  className="db-rstat-row"
                  data-review-stat-id={row.doc.id}
                  data-review-id={row.doc.id}
                  key={row.doc.id}
                >
                  <div className="db-rstat-main">
                    <div className="db-rstat-document">
                      <h3>
                        <a href={docHref(row.doc.id)}>{row.doc.title}</a>
                      </h3>
                      <p>
                        <span
                          className="db-rstat-badge"
                          data-review-stat-status={row.status}
                          data-review-period={row.period}
                        >
                          {row.period === 'today' &&
                          row.dueAt &&
                          Date.parse(row.dueAt) > reviews.now
                            ? '今日稍后'
                            : reviewStatisticsPeriodLabels[row.period]}
                        </span>
                        <span className="db-rstat-topic">{row.topic}</span>
                        {row.reviewedToday && (
                          <span className="db-rstat-reviewed-today">今日已复习</span>
                        )}
                      </p>
                    </div>
                    <dl className="db-rstat-counts">
                      <div className="db-rstat-total">
                        <dt>总计</dt>
                        <dd data-review-count="total">{row.total}</dd>
                      </div>
                      {ratingKeys.map((rating) => (
                        <div key={rating} data-rating={rating} data-zero={row.counts[rating] === 0}>
                          <dt>{ratingLabels[rating]}</dt>
                          <dd data-review-count={rating}>{row.counts[rating]}</dd>
                        </div>
                      ))}
                    </dl>
                    <dl className="db-rstat-date db-rstat-last">
                      <dt>上次复习</dt>
                      <dd>
                        <ReviewTime value={row.lastReviewedAt} empty="尚未复习" />
                      </dd>
                    </dl>
                    <dl className="db-rstat-date db-rstat-next">
                      <dt>{row.status === 'paused' ? '原计划' : '下次复习'}</dt>
                      <dd>
                        {row.status === 'paused' && (
                          <span className="db-rstat-paused-label">原计划 · </span>
                        )}
                        <ReviewTime value={row.dueAt} empty="首次复习后安排" />
                        {row.total > 0 && (
                          <span className="db-rstat-interval">
                            间隔 {row.intervalDays} 天{row.status === 'paused' && ' · 已暂停'}
                          </span>
                        )}
                        {eligible.has(row.doc.id) && (
                          <button
                            type="button"
                            className="db-rstat-review-action"
                            data-review-start={`doc:${row.doc.id}`}
                            disabled={reviews.pending}
                            onClick={(event) => onStart(doc, event.currentTarget)}
                          >
                            开始复习
                          </button>
                        )}
                      </dd>
                    </dl>
                  </div>
                  <details className="db-rstat-history">
                    <summary title="展开或收起复习历史" aria-label={`复习历史，共 ${row.total} 次`}>
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
                    <div className="db-rstat-history-content">
                      <div className="db-rstat-history-heading">
                        <h4>
                          复习历史 <span>{row.total} 次</span>
                        </h4>
                        <span title="当时计划由该次反馈的时间与间隔计算，后续反馈或正文修订可能已调整。">
                          按反馈时间倒序
                        </span>
                        <button
                          type="button"
                          className="db-text-button"
                          disabled={reviews.pending}
                          onClick={() => void reviews.setPaused(doc, row.status !== 'paused')}
                        >
                          {row.status === 'paused' ? '恢复复习' : '暂停复习'}
                        </button>
                      </div>
                      {row.history.length ? (
                        <ol>
                          {row.history.map((event) => (
                            <li key={event.requestId}>
                              <time dateTime={event.reviewedAt}>
                                {formatReviewTime(event.reviewedAt)}
                              </time>
                              <span className="db-rstat-rating" data-rating={event.rating}>
                                {ratingLabels[event.rating]}
                              </span>
                              <span>间隔 {event.intervalDays} 天</span>
                              <span>
                                当时计划{' '}
                                <time dateTime={event.plannedAt}>
                                  {formatReviewTime(event.plannedAt)}
                                </time>
                              </span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="db-rstat-note">尚无反馈记录，完成首次复习后会显示在这里。</p>
                      )}
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="db-rstat-empty">
            <p>{stats.fullCount ? '没有找到匹配的资料' : '还没有已整理的资料'}</p>
            <span>
              {stats.fullCount
                ? '试试其他关键词，或清除筛选条件。'
                : '资料整理完成后，会自动加入复习记录。'}
            </span>
            {filtered && (
              <button type="button" onClick={clear}>
                显示全部资料
              </button>
            )}
          </div>
        )}
      </div>
      <p className="db-rstat-footnote">
        统计当前范围的全部反馈历史；展示、查看和暂停不计入复习次数。
      </p>
    </section>
  );
}

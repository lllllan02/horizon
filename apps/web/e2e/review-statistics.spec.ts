import { test, expect } from '@playwright/test';
import {
  applyReview,
  emptyReviewState,
  reconcileReviews,
  reviewFingerprint,
  type ReviewDocument,
  type ReviewInput,
  type ReviewState,
} from '../src/review-model.ts';

const now = Date.parse('2026-10-20T12:00:00+08:00');
const storageKey = 'horizon:reviews:v1:/';
const docs: ReviewDocument[] = Array.from({ length: 9 }, (_, i) => ({
  id: `stat-${i}`,
  path: `content/notes/stat-${i}.md`,
  body: `统计测试正文 ${i}。`,
  updated: '2026-10-01T12:00:00+08:00',
  state: 'organized',
}));
function fixture() {
  let state = reconcileReviews(emptyReviewState(), docs, now);
  let sequence = 0;
  const update = (
    id: number,
    day: number,
    action: Pick<ReviewInput, 'rating' | 'presented' | 'paused'>,
  ) => {
    const doc = docs[id];
    state = applyReview(
      state,
      docs,
      {
        version: state.version,
        id: doc.id,
        requestId: `stat-event-${++sequence}`,
        documentUpdated: doc.updated,
        documentFingerprint: reviewFingerprint(doc),
        ...action,
      },
      Date.parse(`2026-10-${day}T12:00:00+08:00`),
    );
  };
  update(0, 10, { rating: 'good' });
  update(0, 11, { rating: 'hard' });
  update(0, 12, { rating: 'forgot' });
  update(1, 20, { rating: 'good' });
  update(2, 19, { rating: 'good' });
  update(2, 20, { paused: true });
  update(3, 20, { presented: true });
  update(7, 18, { rating: 'forgot' });
  update(8, 18, { rating: 'hard' });
  return state;
}

test.beforeEach(async ({ page, context }) => {
  await page.clock.setFixedTime(new Date(now));
  await context.route('**/library.json', async (route) => {
    const response = await route.fetch();
    const library = await response.json();
    const base = library.documents.find((doc: { id: string }) => doc.id === 'first');
    library.documents = docs.slice(0, 8).map((doc, i) => ({
      ...base,
      ...doc,
      state: i === 7 ? 'reading' : 'organized',
      title: `统计样例 ${i}`,
      category: i % 2 ? '系统专题' : '数据库专题',
      html: `<p>${doc.body}</p>`,
      summary: '复习数据面板验收',
      aliases: [],
      references: [],
      backlinks: [],
      issues: [],
      readingSuggestions: [],
      parent: null,
      parentTarget: null,
    }));
    library.activity = { version: 'statistics-test', startedAt: null, events: [] };
    await route.fulfill({ response, json: library });
  });
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: storageKey, state: fixture() },
  );
  await page.goto('/#/dashboard/review');
  await expect(page.locator('.db-review-statistics')).toBeVisible();
  await expect(page.getByRole('button', { name: '今日安排', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '复习记录', exact: true })).toHaveCount(0);
});

test('全量文档统计按反馈计数，排除展示、暂停与范围外历史', async ({ page }, testInfo) => {
  const panel = page.locator('.db-review-statistics');
  await expect(panel.locator('[data-review-stat-id]')).toHaveCount(7);
  for (const [metric, value] of Object.entries({
    documents: 7,
    reviewed: 3,
    total: 5,
    good: 3,
    hard: 1,
    forgot: 1,
  }))
    await expect(panel.locator(`[data-review-summary-count="${metric}"]`)).toHaveText(
      String(value),
    );
  const row = panel.locator('[data-review-stat-id="stat-0"]');
  for (const [metric, value] of Object.entries({ total: 3, good: 1, hard: 1, forgot: 1 }))
    await expect(row.locator(`[data-review-count="${metric}"]`)).toHaveText(String(value));
  await expect(row).toContainText('2026/10/12');
  await expect(row).toContainText('2026/10/13');
  await expect(row).toContainText('12:00');
  await expect(
    panel.locator('[data-review-stat-id="stat-3"] [data-review-count="total"]'),
  ).toHaveText('0');
  await expect(panel.locator('[data-review-stat-id="stat-6"]')).toBeVisible();
  await expect(panel).not.toContainText('统计样例 7');
  await page.screenshot({
    path: testInfo.outputPath('review-statistics-overview.png'),
    fullPage: true,
  });
  if (testInfo.project.name === 'wide') {
    const collapsedHeight = await row.boundingBox();
    expect(collapsedHeight!.height).toBeLessThan(120);
  }
  await row.locator('summary').click();
  const history = row.locator('details');
  await expect(history).toContainText('2026/10/10');
  await expect(history).toContainText('2026/10/11');
  await expect(history).toContainText('2026/10/12');
  const events = history.locator('tbody tr, ol > li');
  await expect(events).toHaveCount(3);
  await expect(events.first()).toContainText('忘了');
  await expect(events.last()).toContainText('记得');
  await page.screenshot({ path: testInfo.outputPath('review-statistics.png'), fullPage: true });
  await page.reload();
  await expect(panel.locator('[data-review-summary-count="total"]')).toHaveText('5');
});

test('长标题与不同可用宽度下的复习明细保持对齐且可键盘展开', async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'wide', '响应式布局单独验证');
  await context.route('**/library.json', async (route) => {
    const response = await route.fetch();
    const library = await response.json();
    const base = library.documents.find((doc: { id: string }) => doc.id === 'first');
    const titles = [
      'MySQL 的多版本并发控制：Read View 如何决定事务可见性',
      'Go 调度器中的抢占、阻塞与线程复用',
      'Redis 缓存一致性与失效策略',
      'Agent 的工具调用、状态恢复与取消传播',
      '数据库索引的覆盖扫描与回表',
      '高并发服务中的背压与流量控制',
      '系统设计：从问题定位到可验证的改进',
    ];
    library.documents = docs.slice(0, 7).map((doc, i) => ({
      ...base,
      ...doc,
      title: titles[i],
      category: i % 2 ? '系统设计' : '数据库',
      html: `<p>${doc.body}</p>`,
      aliases: [],
      references: [],
      backlinks: [],
      issues: [],
      readingSuggestions: [],
      parent: null,
      parentTarget: null,
    }));
    library.activity = { version: 'visual-statistics', startedAt: null, events: [] };
    await route.fulfill({ response, json: library });
  });
  await page.reload();
  const panel = page.locator('.db-review-statistics');
  for (const width of [1440, 1100, 1024, 950, 900, 820, 600, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    for (const area of [page.locator('.workbench'), panel, panel.locator('.db-rstat-table-panel')])
      expect(
        await area.evaluate((element) => element.scrollWidth - element.clientWidth),
      ).toBeLessThanOrEqual(1);
    await expect(panel.getByRole('combobox', { name: '复习状态', exact: true })).toBeVisible();
    if (width === 1440 || width === 390 || width === 320)
      await page.screenshot({
        path: testInfo.outputPath(`review-redesign-${width}.png`),
        fullPage: true,
      });
  }
  const history = panel.locator('[data-review-stat-id="stat-0"] details');
  await history.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(history).toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(history).not.toHaveAttribute('open');
});

test('复习记录搜索与状态过滤同步统计，可清除并从标题进入正文', async ({ page }) => {
  const panel = page.locator('.db-review-statistics');
  const storedBefore = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  await panel.getByRole('combobox', { name: '复习状态', exact: true }).selectOption('paused');
  await expect(panel.locator('[data-review-stat-id]')).toHaveCount(1);
  await expect(panel.locator('[data-review-stat-id="stat-2"]')).toContainText('已暂停');
  await expect(panel.locator('[data-review-summary-count="total"]')).toHaveText('1');
  await panel.getByRole('combobox', { name: '复习状态', exact: true }).selectOption('fresh');
  await expect(panel.locator('[data-review-stat-id]')).toHaveCount(4);
  await expect(panel.locator('[data-review-summary-count="total"]')).toHaveText('0');
  await panel.getByRole('combobox', { name: '复习状态', exact: true }).selectOption('due');
  await expect(panel.locator('[data-review-stat-id]')).toHaveCount(1);
  await expect(panel.locator('[data-review-stat-id="stat-0"]')).toBeVisible();
  await panel.getByRole('combobox', { name: '复习状态', exact: true }).selectOption('scheduled');
  await expect(panel.locator('[data-review-stat-id]')).toHaveCount(1);
  await expect(panel.locator('[data-review-stat-id="stat-1"]')).toBeVisible();
  await panel.getByRole('combobox', { name: '复习状态', exact: true }).selectOption('all');
  await panel.getByRole('combobox', { name: '排序方式', exact: true }).selectOption('count');
  await expect(panel.locator('[data-review-stat-id]').first()).toHaveAttribute(
    'data-review-stat-id',
    'stat-0',
  );
  await panel.getByRole('combobox', { name: '排序方式', exact: true }).selectOption('recent');
  await expect(panel.locator('[data-review-stat-id]').first()).toHaveAttribute(
    'data-review-stat-id',
    'stat-1',
  );
  await panel.getByLabel('搜索资料', { exact: true }).fill('系统专题');
  await expect(panel.locator('[data-review-stat-id]')).toHaveCount(3);
  await panel.getByLabel('搜索资料', { exact: true }).fill('不存在的题目');
  await expect(panel.locator('[data-review-stat-id]')).toHaveCount(0);
  await expect(panel.locator('[data-review-summary-count="documents"]')).toHaveText('0');
  await panel.getByLabel('搜索资料', { exact: true }).fill('统计样例 0');
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(storedBefore);
  await panel.getByRole('link', { name: '统计样例 0', exact: true }).click();
  await expect(page.locator('.document-reader[data-document-id="stat-0"]')).toBeVisible();
  await expect(page.locator('.home-review-title')).toBeVisible();
  await expect
    .poll(
      async () =>
        JSON.parse((await page.evaluate((key) => localStorage.getItem(key), storageKey))!).records[
          'stat-0'
        ].lastPresentedAt,
    )
    .toBeTruthy();
  const after: ReviewState = JSON.parse(
    (await page.evaluate((key) => localStorage.getItem(key), storageKey))!,
  );
  const before: ReviewState = JSON.parse(storedBefore!);
  for (const [id, record] of Object.entries(before.records)) {
    const { lastPresentedAt: _presentedBefore, history: beforeHistory, ...beforeSchedule } = record;
    const {
      lastPresentedAt: _presentedAfter,
      history: afterHistory,
      ...afterSchedule
    } = after.records[id];
    expect(afterSchedule).toEqual(beforeSchedule);
    expect(afterHistory.filter((event) => !event.presented)).toEqual(
      beforeHistory.filter((event) => !event.presented),
    );
  }
});

test('底栏保存的新反馈进入统计，刷新后次数与下次时间保留', async ({ page }) => {
  await page.goto('/');
  const dock = page.locator('.home-review-card');
  await expect(dock.locator('.home-review-title')).toBeVisible();
  await expect(dock.locator('.home-review-title')).toHaveText('统计样例 0');
  await dock.getByRole('button', { name: '记得', exact: true }).click();
  await expect(dock.locator('.home-review-title')).not.toHaveText('统计样例 0');
  await page.goto('/#/dashboard/review');
  const panel = page.locator('.db-review-statistics');
  await expect(panel.locator('[data-review-summary-count="total"]')).toHaveText('6');
  const row = panel.locator('[data-review-stat-id="stat-0"]');
  await expect(row.locator('[data-review-count="total"]')).toHaveText('4');
  await expect(row.locator('[data-review-count="good"]')).toHaveText('2');
  await expect(row).toContainText('2026/10/23 12:00');
  await page.reload();
  await expect(row.locator('[data-review-count="total"]')).toHaveText('4');
});

test('日期筛选按北京时间整日归类，暂停不进入计划且筛选不改记录', async ({ page }) => {
  let state = fixture();
  let sequence = 0;
  const update = (id: number, at: string, action: Pick<ReviewInput, 'rating' | 'paused'>) => {
    const doc = docs[id];
    state = applyReview(
      state,
      docs,
      {
        version: state.version,
        id: doc.id,
        requestId: `date-filter-${++sequence}`,
        documentUpdated: doc.updated,
        documentFingerprint: reviewFingerprint(doc),
        ...action,
      },
      Date.parse(at),
    );
  };
  update(4, '2026-10-19T12:00:00+08:00', { rating: 'good' });
  update(5, '2026-10-19T23:30:00+08:00', { rating: 'good' });
  update(2, '2026-10-20T12:00:00+08:00', { paused: false });
  update(2, '2026-10-20T12:00:00+08:00', { rating: 'good' });
  update(2, '2026-10-20T12:00:00+08:00', { paused: true });
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key: storageKey,
    state,
  });
  await page.reload();
  const panel = page.locator('.db-review-statistics');
  await expect(panel).toBeVisible();
  const storedBefore = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  for (const [label, ids, total] of [
    ['今日到期', ['stat-4', 'stat-5'], 2],
    ['已逾期', ['stat-0'], 3],
    ['未来安排', ['stat-1'], 1],
    ['未复习', ['stat-3', 'stat-6'], 0],
    ['今日已复习', ['stat-1', 'stat-2'], 3],
    ['全部时间', ['stat-0', 'stat-1', 'stat-2', 'stat-3', 'stat-4', 'stat-5', 'stat-6'], 8],
  ] as const) {
    const button = panel.getByRole('button', { name: label, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.locator('[data-review-stat-id]')).toHaveCount(ids.length);
    expect(
      await panel
        .locator('[data-review-stat-id]')
        .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-review-stat-id')).sort()),
    ).toEqual([...ids].sort());
    await expect(panel.locator('[data-review-summary-count="documents"]')).toHaveText(
      String(ids.length),
    );
    await expect(panel.locator('[data-review-summary-count="total"]')).toHaveText(String(total));
  }
  await panel.getByRole('button', { name: '今日到期', exact: true }).click();
  await expect(
    panel
      .locator('[data-review-stat-id="stat-4"]')
      .getByRole('button', { name: '开始复习', exact: true }),
  ).toBeEnabled();
  const laterToday = panel.locator('[data-review-stat-id="stat-5"]');
  await expect(laterToday).toContainText('今日');
  await expect(laterToday).toContainText('23:30');
  await expect(laterToday.getByRole('button', { name: '开始复习', exact: true })).toBeEnabled();
  await panel.getByRole('combobox', { name: '复习状态', exact: true }).selectOption('scheduled');
  await expect(panel.locator('[data-review-stat-id]')).toHaveCount(1);
  await expect(laterToday).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(storedBefore);
});

test('未来安排保留原到期日并可提前打开与反馈', async ({ page }) => {
  const panel = page.locator('.db-review-statistics');
  await panel.getByRole('button', { name: '未来安排', exact: true }).click();
  const row = panel.locator('[data-review-stat-id="stat-1"]');
  await expect(row).toContainText('2026/10/21 12:00');
  const before = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), storageKey))!)
    .records['stat-1'];
  await row.getByRole('button', { name: '开始复习', exact: true }).click();
  const session = page.locator('.db-review-session');
  await expect(session).toContainText('统计样例 1');
  await session.getByRole('button', { name: /^记得/ }).click();
  await expect(session.locator('.db-review-saved')).toBeVisible();
  await session.getByRole('button', { name: '退出复习' }).click();
  await expect(panel.getByRole('button', { name: '未来安排', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(row).toContainText('2026/10/21 12:00');
  await expect(row.locator('[data-review-count="total"]')).toHaveText('2');
  const after = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), storageKey))!)
    .records['stat-1'];
  expect(after.history.filter((event: { rating?: string }) => event.rating)).toHaveLength(2);
  expect(after.dueAt).toBe(before.dueAt);
  expect(after.intervalDays).toBe(before.intervalDays);
});

test('北京时间跨日更新日期筛选，记录入口退出后保留筛选与历史展开', async ({ page }) => {
  const panel = page.locator('.db-review-statistics');
  const storedBefore = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  await panel.getByRole('button', { name: '已逾期', exact: true }).click();
  await panel.getByLabel('搜索资料', { exact: true }).fill('统计样例 0');
  const row = panel.locator('[data-review-stat-id="stat-0"]');
  await row.locator('summary').click();
  const start = row.getByRole('button', { name: '开始复习', exact: true });
  await start.click();
  await expect(panel).toBeHidden();
  await expect(page.locator('.db-review-session')).toContainText('统计样例 0');
  await page.keyboard.press('Escape');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: '已逾期', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(panel.getByLabel('搜索资料', { exact: true })).toHaveValue('统计样例 0');
  await expect(row.locator('details')).toHaveAttribute('open', '');
  await expect(start).toBeFocused();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(storedBefore);
  await panel.getByLabel('搜索资料', { exact: true }).fill('');
  await page.clock.setFixedTime(new Date('2026-10-21T00:00:00+08:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await panel.getByRole('button', { name: '今日到期', exact: true }).click();
  await expect(panel.locator('[data-review-stat-id]')).toHaveCount(1);
  await expect(panel.locator('[data-review-stat-id="stat-1"]')).toBeVisible();
  await panel.getByRole('button', { name: '今日已复习', exact: true }).click();
  await expect(panel.locator('[data-review-stat-id]')).toHaveCount(0);
  await expect(panel.locator('[data-review-summary-count="total"]')).toHaveText('0');
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(storedBefore);
});

test('窄屏复习记录与展开明细不导致页面横向溢出', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'narrow', '手机布局单独验证');
  await page.setViewportSize({ width: 320, height: 568 });
  const panel = page.locator('.db-review-statistics');
  const row = panel.locator('[data-review-stat-id="stat-0"]');
  await row.locator('summary').click();
  for (const locator of [page.locator('.workbench'), panel, row]) {
    const overflow = await locator.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
  await expect(row.locator('[data-review-count="total"]')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('review-statistics-mobile.png'),
    fullPage: true,
  });
});

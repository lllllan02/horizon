import { test, expect, type Page } from '@playwright/test';
import { applyReview } from '../src/review-model.ts';

const storageKey = 'horizon:reviews:v1:/';
async function progress(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
}
async function loseRatingResponse(page: Page, blockRead = false) {
  await page.evaluate((blockRead) => {
    const originalSet = Storage.prototype.setItem;
    const originalGet = Storage.prototype.getItem;
    let failed = false;
    Storage.prototype.setItem = function (key, value) {
      const result = originalSet.call(this, key, value);
      if (
        !failed &&
        key.startsWith('horizon:reviews:') &&
        JSON.parse(value).records['review-0'].lastReviewedAt
      ) {
        failed = true;
        throw Error('模拟已写入但响应丢失');
      }
      return result;
    };
    Storage.prototype.getItem = function (key) {
      if (failed && blockRead && key.startsWith('horizon:reviews:'))
        throw Error('模拟复习记录暂不可读取');
      return originalGet.call(this, key);
    };
    (window as Window & { restoreReviewStorage?: () => void }).restoreReviewStorage = () => {
      Storage.prototype.setItem = originalSet;
      Storage.prototype.getItem = originalGet;
    };
  }, blockRead);
}

test.beforeEach(async ({ page, context }) => {
  await page.clock.setFixedTime(new Date('2026-10-20T12:00:00+08:00'));
  await context.route('**/library.json', async (route) => {
    const response = await route.fetch();
    const library = await response.json();
    const base = library.documents.find((doc: { id: string }) => doc.id === 'first');
    library.documents = Array.from({ length: 8 }, (_, i) => ({
      ...base,
      id: `review-${i}`,
      path: `content/notes/review-${i}.md`,
      title: `复习样例 ${i}`,
      category: i % 2 ? '系统专题' : '数据库专题',
      state: i === 7 ? 'reading' : 'organized',
      updated: '2026-10-19T12:00:00+08:00',
      body: `独立测试正文 ${i}。`,
      html: `<h2>核对原理 ${i}</h2><p>独立测试正文 ${i}。</p><div class="code-block"><button type="button" class="copy-code" aria-label="复制代码">复制代码</button><pre><code>${'very_long_code_'.repeat(40)}</code></pre></div>`,
      summary: '独立复习验收资料',
      aliases: [],
      references: [],
      backlinks: [],
      issues: [],
      readingSuggestions: [],
      parent: null,
      parentTarget: null,
    }));
    library.activity = { version: 'review-test', startedAt: null, events: [] };
    await route.fulfill({ response, json: library });
  });
  await page.goto('/#/dashboard/review');
  await expect(page.locator('.db-review-statistics')).toBeVisible();
  await expect(page.locator('[data-review-stat-id]')).toHaveCount(7);
});

test('全部已整理记录直接可开始复习，打开和退出不完成，反馈持久化并保留状态', async ({ page }) => {
  const review = page.locator('.db-review');
  await expect(review).not.toContainText('复习样例 7');
  await expect(review.locator('[data-review-id]')).toHaveCount(7);
  await expect(
    review.locator('[data-review-id]').getByRole('button', { name: '开始复习', exact: true }),
  ).toHaveCount(7);
  await expect(review.getByRole('button', { name: '今日安排', exact: true })).toHaveCount(0);
  await expect(review.getByRole('button', { name: '复习记录', exact: true })).toHaveCount(0);
  const row = review.locator('[data-review-id="review-0"]');
  await row.getByRole('button', { name: '开始复习', exact: true }).click();
  await expect(review.locator('.markdown')).toHaveCount(0);
  expect((await progress(page)).records['review-0'].lastReviewedAt).toBeNull();
  await page.keyboard.press('Escape');
  await expect(row.getByRole('button', { name: '开始复习', exact: true })).toBeFocused();
  await row.getByRole('button', { name: '开始复习', exact: true }).click();
  for (const label of ['忘了', '有点模糊', '记得']) {
    await expect(review.getByRole('button', { name: new RegExp(`^${label}`) })).toBeVisible();
  }
  await expect(review.locator('.markdown')).toHaveCount(0);
  await review.getByRole('button', { name: /^记得/ }).click();
  await expect(review.getByRole('status')).toContainText('已保存，下次复习：2026/10/21');
  const state = await progress(page);
  expect(state.records['review-0'].history).toHaveLength(1);
  expect(state.records['review-0'].history[0].rating).toBe('good');
  await page.reload();
  await expect(review.locator('.db-review-statistics')).toBeVisible();
  await expect(review.locator('[data-review-summary-count="reviewed"]')).toHaveText('1');
  await review.getByRole('combobox', { name: '复习状态', exact: true }).selectOption('scheduled');
  await expect(review.locator('[data-review-id="review-0"]')).toContainText('未来安排');
  await expect(
    review
      .locator('[data-review-id="review-0"]')
      .getByRole('button', { name: '开始复习', exact: true }),
  ).toBeEnabled();
  expect((await progress(page)).records['review-0'].history).toHaveLength(1);
});

for (const [label, rating] of [
  ['有点模糊', 'hard'],
  ['忘了', 'forgot'],
] as const) {
  test(`${label}展开原文，读完显式完成才保存最初反馈`, async ({ page }) => {
    const review = page.locator('.db-review');
    await review
      .locator('.db-review-entrybar')
      .getByRole('button', { name: '开始复习', exact: true })
      .click();
    await review.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    await expect(review.getByRole('region', { name: '复习原文' })).toBeFocused();
    await expect(review.locator('.markdown')).toContainText('独立测试正文 0');
    expect((await progress(page)).records['review-0'].lastReviewedAt).toBeNull();
    await review.getByRole('button', { name: '退出复习' }).click();
    expect((await progress(page)).records['review-0'].history).toHaveLength(0);
    await review
      .locator('.db-review-entrybar')
      .getByRole('button', { name: '开始复习', exact: true })
      .click();
    await review.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    await review.getByRole('button', { name: '完成复习', exact: true }).click();
    await expect(review.locator('.db-review-saved')).toContainText('已保存');
    const record = (await progress(page)).records['review-0'];
    expect(record.history).toHaveLength(1);
    expect(record.history[0].rating).toBe(rating);
    await review.getByRole('button', { name: '下一篇', exact: true }).click();
    await expect(review.locator('.markdown')).toHaveCount(0);
    await expect(review.getByRole('button', { name: '完成复习', exact: true })).toHaveCount(0);
  });
}

test('首次复习没有每日五篇上限，全部完成后仍可开始新一轮', async ({ page }) => {
  const review = page.locator('.db-review');
  for (let i = 0; i < 7; i++) {
    await review
      .locator(`[data-review-id="review-${i}"]`)
      .getByRole('button', { name: '开始复习', exact: true })
      .click();
    await review.getByRole('button', { name: /^记得/ }).click();
    await expect(review.locator('.db-review-saved')).toBeVisible();
    await review.getByRole('button', { name: '退出复习' }).click();
  }
  await expect(review.locator('[data-review-id]')).toHaveCount(7);
  await expect(review.locator('[data-review-summary-count="reviewed"]')).toHaveText('7');
  await expect(
    review.locator('.db-review-entrybar').getByRole('button', { name: '开始复习', exact: true }),
  ).toBeEnabled();
  await review.getByRole('combobox', { name: '复习状态', exact: true }).selectOption('fresh');
  await expect(review.locator('[data-review-id]')).toHaveCount(0);
  await review.getByRole('combobox', { name: '复习状态', exact: true }).selectOption('scheduled');
  await expect(
    review.locator('[data-review-id]').getByRole('button', { name: '开始复习', exact: true }),
  ).toHaveCount(7);
  const before = (await progress(page)).records['review-0'];
  await review
    .locator('[data-review-id="review-0"]')
    .getByRole('button', { name: '开始复习', exact: true })
    .click();
  await review.getByRole('button', { name: /^记得/ }).click();
  await expect(review.locator('.db-review-saved')).toBeVisible();
  const after = (await progress(page)).records['review-0'];
  expect(after.history).toHaveLength(2);
  expect(after.intervalDays).toBe(before.intervalDays);
  expect(after.dueAt).toBe(before.dueAt);
});

test('详情内暂停恢复、专题筛选和进入下一题不计完成，退出保留筛选与展开', async ({ page }) => {
  const review = page.locator('.db-review');
  const paused = review.locator('[data-review-id="review-0"]');
  await paused.locator('summary').click();
  await paused.getByRole('button', { name: '暂停复习' }).click();
  await expect(paused).toContainText('已暂停');
  await expect(paused.getByRole('button', { name: '恢复复习' })).toBeVisible();
  expect((await progress(page)).records['review-0'].lastReviewedAt).toBeNull();
  await paused.getByRole('button', { name: '恢复复习' }).click();
  await expect(paused.getByRole('button', { name: '开始复习', exact: true })).toBeVisible();
  await review.getByLabel('搜索资料', { exact: true }).fill('系统专题');
  await expect(review.locator('[data-review-id="review-0"]')).toHaveCount(0);
  const row = review.locator('[data-review-id="review-1"]');
  await row.locator('summary').click();
  await row.getByRole('button', { name: '开始复习', exact: true }).click();
  await expect(review.locator('.db-review-statistics')).toBeHidden();
  await review.getByRole('button', { name: '进入下一题' }).click();
  await review.getByRole('button', { name: '退出复习' }).click();
  await expect(review.getByLabel('搜索资料', { exact: true })).toHaveValue('系统专题');
  await expect(row.locator('details')).toHaveAttribute('open', '');
  await expect(row.getByRole('button', { name: '开始复习', exact: true })).toBeFocused();
  await expect(review).toContainText('本次已跳过 1 篇');
  await expect(row).toBeVisible();
  expect((await progress(page)).records['review-1'].lastReviewedAt).toBeNull();
  await row.getByRole('button', { name: '开始复习', exact: true }).click();
  await review.getByRole('button', { name: '进入下一题' }).click();
  await review.getByRole('button', { name: '退出复习' }).click();
  await expect(review).toContainText('本次已跳过 1 篇');
  await review.getByRole('button', { name: '重新显示' }).click();
  await expect(review).not.toContainText('本次已跳过');
  await expect(row).toBeVisible();
});

test('保存失败保留正文并可重试，读取失败保留记录', async ({ page }) => {
  const review = page.locator('.db-review');
  await review
    .locator('.db-review-entrybar')
    .getByRole('button', { name: '开始复习', exact: true })
    .click();
  await review.getByRole('button', { name: /^有点模糊/ }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('horizon:reviews:')) throw Error('测试：存储暂不可写');
      return original.call(this, key, value);
    };
    (window as Window & { restoreReviewStorage?: () => void }).restoreReviewStorage = () => {
      Storage.prototype.setItem = original;
    };
  });
  await review.getByRole('button', { name: '完成复习', exact: true }).click();
  await expect(review.getByRole('alert')).toContainText('存储暂不可写');
  await expect(review.locator('.markdown')).toBeVisible();
  expect((await progress(page)).records['review-0'].lastReviewedAt).toBeNull();
  await page.evaluate(() =>
    (window as Window & { restoreReviewStorage?: () => void }).restoreReviewStorage?.(),
  );
  await review.getByRole('button', { name: '完成复习', exact: true }).click();
  await expect(review.getByRole('status')).toContainText('已保存');
  expect((await progress(page)).records['review-0'].history).toHaveLength(1);
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), storageKey);
  await page.reload();
  await expect(review.getByRole('alert')).toContainText('复习记录无法读取');
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe('{broken');
  await page.evaluate((key) => localStorage.removeItem(key), storageKey);
  await review.getByRole('button', { name: '重新读取记录' }).click();
  await expect(page.locator('.db-review-statistics')).toBeVisible();
  await expect(page.locator('[data-review-stat-id]')).toHaveCount(7);
});

test('看板评分响应丢失后同步确认成功，自动显示已保存且只记一次', async ({ page }) => {
  const review = page.locator('.db-review');
  await review
    .locator('[data-review-id="review-0"]')
    .getByRole('button', { name: '开始复习', exact: true })
    .click();
  await review.getByRole('button', { name: /^有点模糊/ }).click();
  await loseRatingResponse(page);
  await review.getByRole('button', { name: '完成复习', exact: true }).click();
  await expect(review.locator('.db-review-saved')).toBeVisible();
  await expect(review.getByRole('alert')).toHaveCount(0);
  const events = (await progress(page)).records['review-0'].history.filter(
    (event: { rating?: string }) => event.rating,
  );
  expect(events).toHaveLength(1);
  expect(events[0].rating).toBe('hard');
});

test('看板评分写入与同步确认均失败时锁定最初评分，恢复后原请求重试只记一次', async ({ page }) => {
  const review = page.locator('.db-review');
  await review
    .locator('[data-review-id="review-0"]')
    .getByRole('button', { name: '开始复习', exact: true })
    .click();
  await review.getByRole('button', { name: /^有点模糊/ }).click();
  await loseRatingResponse(page, true);
  await review.getByRole('button', { name: '完成复习', exact: true }).click();
  await expect(review.getByRole('alert')).toContainText('模拟已写入但响应丢失');
  await expect(review.getByRole('button', { name: /^记得/ })).toBeDisabled();
  await expect(review.getByRole('button', { name: /^忘了/ })).toBeDisabled();
  await expect(review.getByRole('button', { name: /^有点模糊/ })).toBeEnabled();
  await expect(review.locator('.markdown')).toBeVisible();
  await page.evaluate(() =>
    (window as Window & { restoreReviewStorage?: () => void }).restoreReviewStorage?.(),
  );
  expect(
    (await progress(page)).records['review-0'].history.filter(
      (event: { rating?: string }) => event.rating,
    ),
  ).toHaveLength(1);
  await review.getByRole('button', { name: '完成复习', exact: true }).click();
  await expect(review.locator('.db-review-saved')).toBeVisible();
  const events = (await progress(page)).records['review-0'].history.filter(
    (event: { rating?: string }) => event.rating,
  );
  expect(events).toHaveLength(1);
  expect(events[0].rating).toBe('hard');
  await review.getByRole('button', { name: '下一篇', exact: true }).click();
  for (const label of ['记得', '有点模糊', '忘了']) {
    await expect(review.getByRole('button', { name: new RegExp(`^${label}`) })).toBeEnabled();
  }
});

test('手机竖屏横屏和长代码保持正文可读，导航可刷新', async ({ page }, testInfo) => {
  const dashboard = page.locator('.workbench');
  const review = page.locator('.db-review');
  await expect(dashboard).toHaveAttribute('data-dashboard-view', 'review');
  await page.screenshot({ path: testInfo.outputPath('review-list.png'), fullPage: true });
  await review
    .locator('.db-review-entrybar')
    .getByRole('button', { name: '开始复习', exact: true })
    .click();
  await page.screenshot({ path: testInfo.outputPath('review-recall.png'), fullPage: true });
  await review.getByRole('button', { name: '查看原文', exact: true }).click();
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await dashboard.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(review.getByRole('button', { name: /^忘了/ })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`review-${viewport.width}.png`),
      fullPage: true,
    });
  }
  await page.reload();
  await expect(dashboard).toHaveAttribute('data-dashboard-view', 'review');
  await dashboard
    .getByRole('navigation', { name: '看板视图' })
    .getByRole('link', { name: '学习概况', exact: true })
    .click();
  await page.goBack();
  await expect(dashboard).toHaveAttribute('data-dashboard-view', 'review');
});

test('无 Web Locks 的两个标签并发保存不同资料，重试后两份历史均保留', async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
  });
  await page.reload();
  const other = await context.newPage();
  await other.goto('/#/dashboard/review');
  for (const [tab, id] of [
    [page, 'review-0'],
    [other, 'review-1'],
  ] as const) {
    await tab
      .locator(`[data-review-id="${id}"]`)
      .getByRole('button', { name: '开始复习', exact: true })
      .click();
    await tab.getByRole('button', { name: '查看原文', exact: true }).click();
  }
  await Promise.all([page, other].map((tab) => tab.getByRole('button', { name: /^记得/ }).click()));
  for (const tab of [page, other]) {
    await expect(tab.locator('.db-review-session')).toHaveAttribute('aria-busy', 'false');
    if ((await tab.locator('.db-review-saved').count()) === 0) {
      await expect(tab.getByRole('alert')).toContainText('已更新');
      await tab.getByRole('button', { name: /^记得/ }).click();
    }
    await expect(tab.locator('.db-review-saved')).toBeVisible();
  }
  const saved = await progress(page);
  expect(saved.records['review-0'].history).toHaveLength(1);
  expect(saved.records['review-1'].history).toHaveLength(1);
  await other.close();
});

test('复习原文的代码复制按钮连接到剪贴板，复制不计完成', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as Window & { copiedReviewCode?: string }).copiedReviewCode = text;
        },
      },
    });
  });
  await page
    .locator('.db-review-entrybar')
    .getByRole('button', { name: '开始复习', exact: true })
    .click();
  await page.getByRole('button', { name: '查看原文', exact: true }).click();
  await page.getByRole('button', { name: '复制代码', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('代码已复制');
  expect(
    await page.evaluate(() => (window as Window & { copiedReviewCode?: string }).copiedReviewCode),
  ).toBe('very_long_code_'.repeat(40));
  expect((await progress(page)).records['review-0'].lastReviewedAt).toBeNull();
});

test('HTTP 局域网缺少 randomUUID 和 Web Locks 时仍能反馈、刷新和暂停', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true });
  });
  await page.reload();
  expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe('undefined');
  expect(await page.evaluate(() => typeof navigator.locks)).toBe('undefined');
  const review = page.locator('.db-review');
  await review
    .locator('.db-review-entrybar')
    .getByRole('button', { name: '开始复习', exact: true })
    .click();
  await review.getByRole('button', { name: '查看原文', exact: true }).click();
  await review.getByRole('button', { name: /^记得/ }).click();
  await expect(review.getByRole('status')).toContainText('已保存');
  await expect(review.locator('.db-review-session')).toHaveAttribute('aria-busy', 'false');
  let state = await progress(page);
  expect(state.records['review-0'].history).toHaveLength(1);
  expect(state.records['review-0'].history[0].requestId).toMatch(/^r-/);
  await page.reload();
  await expect(review.locator('.db-review-statistics')).toBeVisible();
  await expect(review.locator('[data-review-summary-count="reviewed"]')).toHaveText('1');
  await review.locator('[data-review-id="review-1"] summary').click();
  await review
    .locator('[data-review-id="review-1"]')
    .getByRole('button', { name: '暂停复习' })
    .click();
  await expect(
    review.locator('[data-review-id="review-1"]').getByRole('button', { name: '恢复复习' }),
  ).toBeEnabled();
  state = await progress(page);
  expect(state.records['review-0'].history).toHaveLength(1);
  expect(state.records['review-1'].paused).toBe(true);
  expect(state.records['review-1'].lastReviewedAt).toBeNull();
});

test('两标签同步同一篇后仍可提前复习，真实反馈增加但不提前升级间隔', async ({ page, context }) => {
  const other = await context.newPage();
  await other.clock.setFixedTime(new Date('2026-10-20T12:00:00+08:00'));
  await other.goto('/#/dashboard/review');
  for (const tab of [page, other]) {
    const review = tab.locator('.db-review');
    await review
      .locator('[data-review-id="review-0"]')
      .getByRole('button', { name: '开始复习', exact: true })
      .click();
    await review.getByRole('button', { name: '查看原文', exact: true }).click();
  }
  await page.locator('.db-review').getByRole('button', { name: /^记得/ }).click();
  await expect(page.locator('.db-review').getByRole('status')).toContainText('已保存');
  const before = (await progress(page)).records['review-0'];
  await expect.poll(async () => (await progress(other)).records['review-0'].history.length).toBe(1);
  await expect(other.locator('.db-review-session')).toContainText('这篇资料已在其他页面完成');
  await other.locator('.db-review').getByRole('button', { name: '退出复习', exact: true }).click();
  await other
    .locator('[data-review-id="review-0"]')
    .getByRole('button', { name: '开始复习', exact: true })
    .click();
  await other.locator('.db-review').getByRole('button', { name: /^记得/ }).click();
  await expect(other.locator('.db-review-saved')).toBeVisible();
  const after = (await progress(other)).records['review-0'];
  expect(after.history).toHaveLength(2);
  expect(after.intervalDays).toBe(before.intervalDays);
  expect(after.dueAt).toBe(before.dueAt);
  await other.close();
});

test('底栏默认展示推荐题且没有开始按钮，首次展示不计完成，记得保存后自动下一题', async ({
  page,
}, testInfo) => {
  expect(
    Object.values((await progress(page)).records).some(
      (record: unknown) => (record as { lastPresentedAt?: string }).lastPresentedAt,
    ),
  ).toBe(false);
  await page.goto('/');
  const dock = page.locator('.home-review-card');
  await expect(dock.locator('.home-review-title')).toBeVisible();
  await expect(dock.locator('.home-review-title')).toContainText('复习样例 0');
  await expect(dock.getByRole('button', { name: '开始复习', exact: true })).toHaveCount(0);
  await expect
    .poll(async () => (await progress(page)).records['review-0'].lastPresentedAt)
    .toBeTruthy();
  const initial = await progress(page);
  expect(initial.records['review-0'].lastReviewedAt).toBeNull();
  expect(initial.records['review-0'].dueAt).toBeNull();
  expect(
    initial.records['review-0'].history.filter((event: { rating?: string }) => event.rating),
  ).toHaveLength(0);
  const feedback = dock.locator('.home-review-feedback button');
  for (const button of await feedback.all())
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  const backgrounds = await feedback.evaluateAll((buttons) =>
    buttons.map((button) => getComputedStyle(button).backgroundColor),
  );
  expect(new Set(backgrounds).size).toBe(1);
  await expect(dock.getByRole('button', { name: '进入下一题', exact: true })).toHaveCount(0);
  const searchBox = (await page.locator('.galaxy-search').boundingBox())!;
  const reviewBox = (await dock.boundingBox())!;
  expect(Math.abs(searchBox.y - reviewBox.y)).toBeLessThan(5);
  expect(reviewBox.x).toBeGreaterThanOrEqual(searchBox.x + searchBox.width);
  await page.screenshot({ path: testInfo.outputPath('review-bottom-row.png') });
  await dock.getByRole('button', { name: '记得', exact: true }).click();
  await expect(dock.locator('.home-review-title')).toContainText('复习样例 1');
  for (const button of await feedback.all())
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(
    (await progress(page)).records['review-0'].history.find(
      (event: { rating?: string }) => event.rating,
    ).rating,
  ).toBe('good');
  await expect(page).not.toHaveURL(/dashboard/);
});

for (const [label, rating] of [
  ['有点模糊', 'hard'],
  ['忘了', 'forgot'],
] as const) {
  test(`底栏${label}打开原文，阅读时继续显示复习并切换其他卡片`, async ({ page }, testInfo) => {
    await page.goto('/');
    const dock = page.locator('.home-review-card');
    await expect(dock.locator('.home-review-title')).toBeVisible();
    await dock.getByRole('button', { name: label, exact: true }).click();
    const reader = page.locator('.document-reader[data-document-id="review-0"]');
    await expect(reader).toBeVisible();
    await expect(dock).toBeVisible();
    await expect(reader.locator('.markdown')).toContainText('独立测试正文 0');
    expect((await progress(page)).records['review-0'].lastReviewedAt).toBeTruthy();
    await expect(dock.getByRole('button', { name: '完成复习', exact: true })).toHaveCount(0);
    await expect(dock.getByRole('button', { name: '进入下一题', exact: true })).toHaveCount(0);
    expect(
      (await progress(page)).records['review-0'].history.find(
        (event: { rating?: string }) => event.rating,
      ).rating,
    ).toBe(rating);
    await expect(reader).toBeVisible();
    await expect(dock.locator('.home-review-title')).toContainText('复习样例 1');
    for (const button of await dock.locator('.home-review-feedback button').all())
      await expect(button).toHaveAttribute('aria-pressed', 'false');
    await dock.getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('.document-reader[data-document-id="review-1"]')).toBeVisible();
    await expect(dock.locator('.home-review-title')).toContainText('复习样例 2');
    await expect(dock).toBeVisible();
    const shellBox = (await page.locator('.reader-shell').boundingBox())!;
    const dockBox = (await page.locator('.galaxy-search-dock').boundingBox())!;
    expect(shellBox.y + shellBox.height).toBeLessThanOrEqual(dockBox.y);
    await page.screenshot({ path: testInfo.outputPath(`reader-bottom-${rating}.png`) });
  });
}

for (const label of ['记得', '有点模糊', '忘了']) {
  test(`底栏${label}保存失败不跳题或打开正文，重试成功后自动下一题`, async ({ page }) => {
    await page.goto('/');
    const dock = page.locator('.home-review-card');
    await expect(dock.locator('.home-review-title')).toBeVisible();
    await expect
      .poll(async () => (await progress(page)).records['review-0'].lastPresentedAt)
      .toBeTruthy();
    await expect(dock).toHaveAttribute('aria-busy', 'false');
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('horizon:reviews:')) throw Error('测试：存储暂不可写');
        return original.call(this, key, value);
      };
      (window as Window & { restoreReviewStorage?: () => void }).restoreReviewStorage = () => {
        Storage.prototype.setItem = original;
      };
    });
    await dock.getByRole('button', { name: label, exact: true }).click();
    await expect(dock.getByRole('alert')).toContainText('存储暂不可写');
    await expect(dock.locator('.home-review-title')).toContainText('复习样例 0');
    expect((await progress(page)).records['review-0'].lastReviewedAt).toBeNull();
    await expect(page.locator('.document-reader')).toHaveCount(0);
    await page.evaluate(() =>
      (window as Window & { restoreReviewStorage?: () => void }).restoreReviewStorage?.(),
    );
    await dock.getByRole('button', { name: label, exact: true }).click();
    await expect(dock.locator('.home-review-title')).toContainText('复习样例 1');
    if (label !== '记得')
      await expect(page.locator('.document-reader[data-document-id="review-0"]')).toBeVisible();
    expect(
      (await progress(page)).records['review-0'].history.filter(
        (event: { rating?: string }) => event.rating,
      ),
    ).toHaveLength(1);
  });
}

test('阅读时可连续完成超过五篇并自动轮转两轮，记得不切换正文或延后原计划', async ({ page }) => {
  await page.goto('/#/doc/review-0');
  const reader = page.locator('.document-reader[data-document-id="review-0"]');
  await expect(reader).toBeVisible();
  const dock = page.locator('.home-review-card');
  const rounds: string[][] = [[], []];
  let firstSchedule: Record<string, { dueAt: string; intervalDays: number }> = {};
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 7; i++) {
      await expect(dock.locator('.home-review-title')).toBeVisible();
      await expect(dock).toHaveAttribute('aria-busy', 'false');
      const currentTitle = await dock.locator('.home-review-title').innerText();
      expect(rounds[round]).not.toContain(currentTitle);
      rounds[round].push(currentTitle);
      await dock.getByRole('button', { name: '记得', exact: true }).click();
      await expect(dock.locator('.home-review-title')).not.toHaveText(currentTitle);
      await expect(reader).toBeVisible();
    }
    const state = await progress(page);
    for (let i = 0; i < 7; i++) {
      const record = state.records[`review-${i}`];
      expect(record.history.filter((event: { rating?: string }) => event.rating)).toHaveLength(
        round + 1,
      );
      if (round === 1) {
        expect(record.dueAt).toBe(firstSchedule[`review-${i}`].dueAt);
        expect(record.intervalDays).toBe(firstSchedule[`review-${i}`].intervalDays);
      }
    }
    if (round === 0) firstSchedule = state.records;
  }
  expect(new Set(rounds[0])).toEqual(new Set(rounds[1]));
  await page.reload();
  await expect(dock.getByRole('button', { name: '记得', exact: true })).toBeEnabled();
});

test('仅一篇资料时连续三次反馈自动开启下一轮，并逐次保存展示与真实反馈', async ({
  page,
  context,
}) => {
  await context.route('**/library.json', async (route) => {
    const response = await route.fetch();
    const library = await response.json();
    const base = library.documents.find((doc: { id: string }) => doc.id === 'first');
    library.documents = [
      {
        ...base,
        title: '单篇轮转样例',
        state: 'organized',
        references: [],
        backlinks: [],
        readingSuggestions: [],
        parent: null,
        parentTarget: null,
      },
    ];
    await route.fulfill({ response, json: library });
  });
  await page.goto('/');
  const dock = page.locator('.home-review-card');
  await expect(dock.locator('.home-review-title')).toHaveText('单篇轮转样例');
  let originalDue: string | undefined;
  for (let round = 0; round < 3; round++) {
    await expect(dock.getByRole('button', { name: '记得', exact: true })).toBeEnabled();
    await dock.getByRole('button', { name: '记得', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await progress(page)).records.first.history.filter(
            (event: { rating?: string }) => event.rating,
          ).length,
      )
      .toBe(round + 1);
    await expect
      .poll(
        async () =>
          (await progress(page)).records.first.history.filter(
            (event: { presented?: boolean }) => event.presented,
          ).length,
      )
      .toBe(round + 2);
    const record = (await progress(page)).records.first;
    if (round === 0) originalDue = record.dueAt;
    expect(record.dueAt).toBe(originalDue);
    expect(record.intervalDays).toBe(1);
    await expect(dock.locator('.home-review-title')).toHaveText('单篇轮转样例');
  }
});

test('底栏展示记录在刷新后轮换，优先尚未复习的资料', async ({ page }) => {
  await page.goto('/');
  const dock = page.locator('.home-review-card');
  await expect(dock.locator('.home-review-title')).toBeVisible();
  const first = await dock.locator('.home-review-title').innerText();
  await expect
    .poll(async () =>
      Object.values((await progress(page)).records).some(
        (record: unknown) => !!(record as { lastPresentedAt?: string }).lastPresentedAt,
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(dock.locator('.home-review-title')).toBeVisible();
  await expect(dock.locator('.home-review-title')).not.toHaveText(first);
  await expect(dock.getByRole('button', { name: '开始复习', exact: true })).toHaveCount(0);
  await expect
    .poll(
      async () =>
        Object.values((await progress(page)).records).filter(
          (record: unknown) => (record as { lastPresentedAt?: string }).lastPresentedAt,
        ).length,
    )
    .toBe(2);
  expect(
    Object.values((await progress(page)).records).some(
      (record: unknown) => (record as { lastReviewedAt?: string }).lastReviewedAt,
    ),
  ).toBe(false);
  const completed = await dock.locator('.home-review-title').innerText();
  await dock.getByRole('button', { name: '记得', exact: true }).click();
  await expect(dock.locator('.home-review-title')).not.toHaveText(completed);
  await page.reload();
  await expect(dock.locator('.home-review-title')).toBeVisible();
  await expect(dock.locator('.home-review-title')).not.toHaveText(completed);
});

test('展示写入失败可明确重试，展示仍不计为完成', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('review-presentation-restored')) return;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('horizon:reviews:')) throw Error('展示记录暂不可写');
      return original.call(this, key, value);
    };
    (window as Window & { restoreReviewStorage?: () => void }).restoreReviewStorage = () => {
      Storage.prototype.setItem = original;
      sessionStorage.setItem('review-presentation-restored', 'true');
    };
  });
  await page.goto('/');
  const dock = page.locator('.home-review-card');
  await expect(dock.locator('.home-review-title')).toBeVisible();
  await expect(dock.getByRole('alert')).toContainText('展示记录暂不可写');
  expect((await progress(page)).records['review-0'].lastPresentedAt).toBeFalsy();
  await page.evaluate(() =>
    (window as Window & { restoreReviewStorage?: () => void }).restoreReviewStorage?.(),
  );
  await dock.getByRole('button', { name: '重新读取记录' }).click();
  await expect
    .poll(async () => (await progress(page)).records['review-0'].lastPresentedAt)
    .toBeTruthy();
  expect((await progress(page)).records['review-0'].lastReviewedAt).toBeNull();
  await page.reload();
  await expect(dock.locator('.home-review-title')).toBeVisible();
  await expect(dock.locator('.home-review-title')).not.toHaveText('复习样例 0');
});

test('底栏评分响应丢失后同步确认成功，自动下一题且只记一次', async ({ page }) => {
  await page.goto('/');
  const dock = page.locator('.home-review-card');
  await expect(dock.locator('.home-review-title')).toBeVisible();
  await expect
    .poll(async () => (await progress(page)).records['review-0'].lastPresentedAt)
    .toBeTruthy();
  await expect(dock).toHaveAttribute('aria-busy', 'false');
  await loseRatingResponse(page);
  await dock.getByRole('button', { name: '记得', exact: true }).click();
  await expect(dock.locator('.home-review-title')).not.toHaveText('复习样例 0');
  await expect(dock.getByRole('alert')).toHaveCount(0);
  expect(
    (await progress(page)).records['review-0'].history.filter(
      (event: { rating?: string }) => event.rating,
    ),
  ).toHaveLength(1);
});

test('底栏评分写入与同步确认均失败时锁定原评分，恢复后原请求重试只记一次', async ({ page }) => {
  await page.goto('/');
  const dock = page.locator('.home-review-card');
  await expect(dock.locator('.home-review-title')).toBeVisible();
  await expect
    .poll(async () => (await progress(page)).records['review-0'].lastPresentedAt)
    .toBeTruthy();
  await expect(dock).toHaveAttribute('aria-busy', 'false');
  await loseRatingResponse(page, true);
  await dock.getByRole('button', { name: '记得', exact: true }).click();
  await expect(dock.getByRole('alert')).toContainText('模拟已写入但响应丢失');
  await expect(dock.locator('.home-review-title')).toHaveText('复习样例 0');
  await expect(dock.getByRole('button', { name: '忘了', exact: true })).toBeDisabled();
  await expect(dock.getByRole('button', { name: '有点模糊', exact: true })).toBeDisabled();
  await expect(dock.getByRole('button', { name: '记得', exact: true })).toBeEnabled();
  await page.evaluate(() =>
    (window as Window & { restoreReviewStorage?: () => void }).restoreReviewStorage?.(),
  );
  expect(
    (await progress(page)).records['review-0'].history.filter(
      (event: { rating?: string }) => event.rating,
    ),
  ).toHaveLength(1);
  await dock.getByRole('button', { name: '记得', exact: true }).click();
  await expect(dock.locator('.home-review-title')).not.toHaveText('复习样例 0');
  for (const label of ['记得', '有点模糊', '忘了']) {
    await expect(dock.getByRole('button', { name: label, exact: true })).toBeEnabled();
  }
  expect(
    (await progress(page)).records['review-0'].history.filter(
      (event: { rating?: string }) => event.rating,
    ),
  ).toHaveLength(1);
});

test('首页未知评分跨看板入口保留原请求，其他资料评分后仍可幂等重试', async ({ page }) => {
  await page.goto('/');
  const dock = page.locator('.home-review-card');
  await expect(dock.locator('.home-review-title')).toHaveText('复习样例 0');
  await expect
    .poll(async () => (await progress(page)).records['review-0'].lastPresentedAt)
    .toBeTruthy();
  await expect(dock).toHaveAttribute('aria-busy', 'false');
  await loseRatingResponse(page, true);
  await dock.getByRole('button', { name: '记得', exact: true }).click();
  await expect(dock.getByRole('alert')).toContainText('模拟已写入但响应丢失');
  await page.evaluate(() =>
    (window as Window & { restoreReviewStorage?: () => void }).restoreReviewStorage?.(),
  );
  await page.getByRole('button', { name: '统计看板', exact: true }).click();
  await page
    .locator('.workbench')
    .getByRole('navigation', { name: '看板视图' })
    .getByRole('link', { name: '复习面板', exact: true })
    .click();
  const review = page.locator('.db-review');
  await review.getByRole('button', { name: '重新读取记录', exact: true }).click();
  await expect(review.getByRole('alert')).toHaveCount(0);
  await review
    .locator('[data-review-id="review-1"]')
    .getByRole('button', { name: '开始复习', exact: true })
    .click();
  await review.getByRole('button', { name: /^记得/ }).click();
  await expect(review.locator('.db-review-saved')).toBeVisible();
  await review.getByRole('button', { name: '退出复习', exact: true }).click();
  await review
    .locator('[data-review-id="review-0"]')
    .getByRole('button', { name: '开始复习', exact: true })
    .click();
  await expect(review.getByRole('button', { name: /^有点模糊/ })).toBeDisabled();
  await expect(review.getByRole('button', { name: /^忘了/ })).toBeDisabled();
  await expect(review.getByRole('button', { name: /^记得/ })).toBeEnabled();
  await review.getByRole('button', { name: /^记得/ }).click();
  await expect(review.locator('.db-review-saved')).toBeVisible();
  const state = await progress(page);
  for (const id of ['review-0', 'review-1']) {
    const events = state.records[id].history.filter((event: { rating?: string }) => event.rating);
    expect(events).toHaveLength(1);
    expect(events[0].rating).toBe('good');
  }
  await page.getByRole('button', { name: '返回星图', exact: true }).click();
  await expect(dock.locator('.home-review-title')).toHaveText('复习样例 0');
  for (const label of ['记得', '有点模糊', '忘了']) {
    await expect(dock.getByRole('button', { name: label, exact: true })).toBeDisabled();
  }
  await dock.getByRole('button', { name: '进入下一题', exact: true }).click();
  await expect(dock.locator('.home-review-title')).not.toHaveText('复习样例 0');
  expect(
    (await progress(page)).records['review-0'].history.filter(
      (event: { rating?: string }) => event.rating,
    ),
  ).toHaveLength(1);
});

test('底栏遇到其他页面已完成的提交冲突时只可进入下一题，旧轮次不重复评分', async ({ page }) => {
  await page.goto('/');
  const dock = page.locator('.home-review-card');
  await expect(dock.locator('.home-review-title')).toBeVisible();
  await expect
    .poll(async () => (await progress(page)).records['review-0'].lastPresentedAt)
    .toBeTruthy();
  await expect(dock).toHaveAttribute('aria-busy', 'false');
  const before = await progress(page);
  const record = before.records['review-0'];
  const updated = applyReview(
    before,
    [
      {
        id: 'review-0',
        path: record.path,
        body: '独立测试正文 0。',
        updated: record.documentUpdated,
        state: 'organized',
      },
    ],
    {
      version: before.version,
      id: 'review-0',
      rating: 'good',
      requestId: 'other-page-completion',
      documentUpdated: record.documentUpdated,
      documentFingerprint: record.fingerprint,
    },
    Date.parse('2026-10-20T12:00:00+08:00'),
  );
  // Same-window storage replacement simulates another writer winning before its
  // storage notification reaches this page's controller.
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: JSON.stringify(updated),
  });
  await dock.getByRole('button', { name: '记得', exact: true }).click();
  await expect(dock.getByRole('alert')).toContainText('复习记录已更新');
  for (const label of ['记得', '有点模糊', '忘了']) {
    await expect(dock.getByRole('button', { name: label, exact: true })).toBeDisabled();
  }
  await dock.getByRole('button', { name: '进入下一题', exact: true }).click();
  await expect(dock.locator('.home-review-title')).not.toHaveText('复习样例 0');
  expect(
    (await progress(page)).records['review-0'].history.filter(
      (event: { rating?: string }) => event.rating,
    ),
  ).toHaveLength(1);
  const after = (await progress(page)).records['review-0'];
  expect(after.dueAt).toBe(updated.records['review-0'].dueAt);
  expect(after.intervalDays).toBe(updated.records['review-0'].intervalDays);
});

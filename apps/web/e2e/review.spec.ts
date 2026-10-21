import { test, expect, type Page } from '@playwright/test';
import { applyReview } from '../src/review-model.ts';

const storageKey = 'horizon:reviews:v1:/';
async function progress(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
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
  await expect(review.getByRole('button', { name: '开始复习', exact: true })).toHaveCount(7);
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
    await expect(
      review.getByRole('button', { name: `${label} 1 天后`, exact: true }),
    ).toBeVisible();
  }
  await expect(review.locator('.markdown')).toHaveCount(0);
  await review.getByRole('button', { name: '记得 1 天后', exact: true }).click();
  await expect(review.getByRole('status')).toContainText('已保存，下次复习：2026/10/21');
  const state = await progress(page);
  expect(state.records['review-0'].history).toHaveLength(1);
  expect(state.records['review-0'].history[0].rating).toBe('good');
  await page.reload();
  await expect(review.locator('.db-review-statistics')).toBeVisible();
  await expect(review.locator('[data-review-summary-count="reviewed"]')).toHaveText('1');
  await review.getByRole('combobox', { name: '复习状态', exact: true }).selectOption('scheduled');
  await expect(review.locator('[data-review-id="review-0"]')).toContainText('未来安排');
  await expect(review.locator('[data-review-id="review-0"]')).not.toContainText('开始复习');
  expect((await progress(page)).records['review-0'].history).toHaveLength(1);
});

for (const [label, rating] of [
  ['有点模糊', 'hard'],
  ['忘了', 'forgot'],
] as const) {
  test(`${label}展开原文，读完显式完成才保存最初反馈`, async ({ page }) => {
    const review = page.locator('.db-review');
    await review.getByRole('button', { name: '开始今日复习' }).click();
    await review.getByRole('button', { name: `${label} 1 天后`, exact: true }).click();
    await expect(review.getByRole('region', { name: '复习原文' })).toBeFocused();
    await expect(review.locator('.markdown')).toContainText('独立测试正文 0');
    expect((await progress(page)).records['review-0'].lastReviewedAt).toBeNull();
    await review.getByRole('button', { name: '退出复习' }).click();
    expect((await progress(page)).records['review-0'].history).toHaveLength(0);
    await review.getByRole('button', { name: '开始今日复习' }).click();
    await review.getByRole('button', { name: `${label} 1 天后`, exact: true }).click();
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

test('全部记录保持可见，每日完成五篇后其余首次复习入口停止接受新任务', async ({ page }) => {
  const review = page.locator('.db-review');
  for (let i = 0; i < 5; i++) {
    await review
      .locator(`[data-review-id="review-${i}"]`)
      .getByRole('button', { name: '开始复习', exact: true })
      .click();
    await review.getByRole('button', { name: '记得 1 天后', exact: true }).click();
    await expect(review.locator('.db-review-saved')).toBeVisible();
    await review.getByRole('button', { name: '退出复习' }).click();
  }
  await expect(review.locator('[data-review-id]')).toHaveCount(7);
  await expect(review.locator('[data-review-summary-count="reviewed"]')).toHaveText('5');
  await expect(review).toContainText('今日首次复习已满 5 篇');
  await expect(review.getByRole('button', { name: '开始今日复习', exact: true })).toBeDisabled();
  await expect(review.getByRole('button', { name: '开始复习', exact: true })).toHaveCount(0);
  await review.getByRole('combobox', { name: '复习状态', exact: true }).selectOption('fresh');
  await expect(review.locator('[data-review-id]')).toHaveCount(2);
  await expect(review.locator('[data-review-id="review-5"]')).toBeVisible();
  expect((await progress(page)).records['review-5'].lastReviewedAt).toBeNull();
  expect((await progress(page)).records['review-6'].lastReviewedAt).toBeNull();
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
  await review.getByRole('button', { name: '开始今日复习' }).click();
  await review.getByRole('button', { name: '有点模糊 1 天后', exact: true }).click();
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

test('手机竖屏横屏和长代码保持正文可读，导航可刷新', async ({ page }, testInfo) => {
  const dashboard = page.locator('.workbench');
  const review = page.locator('.db-review');
  await expect(dashboard).toHaveAttribute('data-dashboard-view', 'review');
  await page.screenshot({ path: testInfo.outputPath('review-list.png'), fullPage: true });
  await review.getByRole('button', { name: '开始今日复习' }).click();
  await page.screenshot({ path: testInfo.outputPath('review-recall.png'), fullPage: true });
  await review.getByRole('button', { name: '查看原文', exact: true }).click();
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await dashboard.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(review.getByRole('button', { name: '忘了 1 天后', exact: true })).toBeVisible();
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
  await Promise.all(
    [page, other].map((tab) =>
      tab.getByRole('button', { name: '记得 1 天后', exact: true }).click(),
    ),
  );
  for (const tab of [page, other]) {
    await expect(tab.locator('.db-review-session')).toHaveAttribute('aria-busy', 'false');
    if ((await tab.locator('.db-review-saved').count()) === 0) {
      await expect(tab.getByRole('alert')).toContainText('已更新');
      await tab.getByRole('button', { name: '记得 1 天后', exact: true }).click();
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
  await page.getByRole('button', { name: '开始今日复习', exact: true }).click();
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
  await review.getByRole('button', { name: '开始今日复习' }).click();
  await review.getByRole('button', { name: '查看原文', exact: true }).click();
  await review.getByRole('button', { name: '记得 1 天后', exact: true }).click();
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

test('两标签同时打开同一篇，已完成后的旧会话不能再次推进复习', async ({ page, context }) => {
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
    await expect(review.getByRole('button', { name: '记得 1 天后', exact: true })).toBeEnabled();
  }
  await page
    .locator('.db-review')
    .getByRole('button', { name: '记得 1 天后', exact: true })
    .click();
  await expect(page.locator('.db-review').getByRole('status')).toContainText('已保存');
  // The storage event refreshes the open session; its preview proves it has the new record.
  await expect(other.getByRole('button', { name: '记得 3 天后', exact: true })).toBeEnabled();
  const before = await progress(page);
  await other.getByRole('button', { name: '记得 3 天后', exact: true }).click();
  await expect(other.locator('.db-review').getByRole('alert')).toContainText('尚未到期');
  await expect(other.locator('.db-review-session')).toHaveAttribute('aria-busy', 'false');
  const after = await progress(other);
  expect(after.records['review-0']).toEqual(before.records['review-0']);
  expect(after.records['review-0'].history).toHaveLength(1);
  expect(after.records['review-0'].intervalDays).toBe(1);
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

test('阅读时连续点记得遵守每日额度且不切换正文', async ({ page }) => {
  await page.goto('/#/doc/review-0');
  const reader = page.locator('.document-reader[data-document-id="review-0"]');
  await expect(reader).toBeVisible();
  const dock = page.locator('.home-review-card');
  await expect(dock.locator('.home-review-title')).toBeVisible();
  const completedTitles = new Set<string>();
  for (let i = 0; i < 5; i++) {
    await expect(dock.locator('.home-review-title')).toBeVisible();
    const currentTitle = await dock.locator('.home-review-title').innerText();
    expect(completedTitles.has(currentTitle)).toBe(false);
    completedTitles.add(currentTitle);
    await dock.getByRole('button', { name: '记得', exact: true }).click();
    if (i < 4) await expect(dock.locator('.home-review-title')).not.toHaveText(currentTitle);
  }
  await expect(dock.locator('.home-review-title')).toHaveCount(0);
  await expect(reader).toBeVisible();
  const state = await progress(page);
  expect(
    Object.values(state.records as Record<string, { lastReviewedAt: string | null }>).filter(
      (record) => record.lastReviewedAt,
    ),
  ).toHaveLength(5);
  await page.reload();
  await expect(dock.getByRole('button', { name: '记得', exact: true })).toHaveCount(0);
});

test('底栏展示记录在刷新后轮换，已完成资料未到期不再推荐', async ({ page }) => {
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

test('反馈已写入但响应失败时，重新读取不覆盖原请求，重试只完成一次', async ({ page }) => {
  await page.goto('/');
  const dock = page.locator('.home-review-card');
  await expect(dock.locator('.home-review-title')).toBeVisible();
  await expect
    .poll(async () => (await progress(page)).records['review-0'].lastPresentedAt)
    .toBeTruthy();
  await expect(dock).toHaveAttribute('aria-busy', 'false');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let failed = false;
    Storage.prototype.setItem = function (key, value) {
      const result = original.call(this, key, value);
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
  });
  await dock.getByRole('button', { name: '记得', exact: true }).click();
  await expect(dock.getByRole('alert')).toContainText('模拟已写入但响应丢失');
  await expect(dock.locator('.home-review-title')).toHaveText('复习样例 0');
  await dock.getByRole('button', { name: '重新读取记录' }).click();
  await expect(dock.getByRole('alert')).toHaveCount(0);
  await dock.getByRole('button', { name: '记得', exact: true }).click();
  await expect(dock.locator('.home-review-title')).not.toHaveText('复习样例 0');
  expect(
    (await progress(page)).records['review-0'].history.filter(
      (event: { rating?: string }) => event.rating,
    ),
  ).toHaveLength(1);
});

test('底栏遇到其他页面已完成的提交冲突时，可以进入下一题', async ({ page }) => {
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
  await dock.getByRole('button', { name: '进入下一题', exact: true }).click();
  await expect(dock.locator('.home-review-title')).not.toHaveText('复习样例 0');
  expect(
    (await progress(page)).records['review-0'].history.filter(
      (event: { rating?: string }) => event.rating,
    ),
  ).toHaveLength(1);
});

import { test, expect } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.ts';
import { loadLibrary } from '../src/library.ts';
import {
  applyReview,
  emptyReviewState,
  reconcileReviews,
  reviewFingerprint,
} from '../src/review-model.ts';
import { exportReviews } from '../src/review-store.ts';

test('SQLite迁入完整旧历史，展开时分页、失败可重试，评分增量更新并使历史失效', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'reduced', '数据持久化在桌面和手机各覆盖一次');
  test.setTimeout(120000);
  const root = await mkdtemp(path.join(os.tmpdir(), 'horizon-sqlite-browser-'));
  let service: Awaited<ReturnType<typeof startServer>> | undefined;
  try {
    await mkdir(path.join(root, 'notes'));
    const raw = '---\ntitle: SQLite复习样例\nlearning_status: organized\n---\n必须保留的原文。';
    await writeFile(path.join(root, 'notes/history.md'), raw);
    const library = await loadLibrary(root);
    const doc = library.documents[0];
    let legacy = reconcileReviews(emptyReviewState(), library.documents);
    for (let i = 0; i < 45; i++)
      legacy = applyReview(
        legacy,
        library.documents,
        {
          version: legacy.version,
          id: doc.id,
          requestId: `browser-legacy-${i}`,
          rating: 'good',
          documentUpdated: doc.updated,
          documentFingerprint: reviewFingerprint(doc),
        },
        Date.parse('2026-10-21T04:00:00Z') + i,
      );
    const source = JSON.stringify(legacy);
    await writeFile(path.join(root, '.reviews.json'), source);
    service = await startServer({ root, port: 0 });
    const address = service.server.address();
    if (!address || typeof address === 'string') throw Error('Missing test server');
    const url = `http://127.0.0.1:${address.port}`;
    await page.clock.setFixedTime(new Date('2026-10-21T04:00:01Z'));
    let historyRequests = 0;
    let fail = true;
    await page.route('**/api/reviews/history?*', async (route) => {
      historyRequests++;
      if (fail) {
        fail = false;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: '测试：历史暂不可读' }),
        });
      } else await route.continue();
    });
    await page.goto(url + '/#/dashboard/review');
    const row = page.locator('[data-review-id="history"]');
    const history = row.locator('.db-rstat-history');
    await expect(row).toBeVisible();
    await expect(page.locator('[data-review-summary-count="total"]')).toHaveText('45');
    expect(historyRequests).toBe(0);
    await row.locator('summary').click();
    await expect(history.getByRole('alert')).toContainText('历史暂不可读');
    await history.getByRole('button', { name: '重试加载', exact: true }).click();
    await expect(history.locator('li')).toHaveCount(20);
    await history.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(history.locator('li')).toHaveCount(40);
    await history.getByRole('button', { name: '加载更多', exact: true }).click();
    await expect(history.locator('li')).toHaveCount(45);
    await expect(history.getByRole('button', { name: '加载更多', exact: true })).toHaveCount(0);
    const submitted = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/reviews') && response.request().method() === 'POST',
    );
    await row.getByRole('button', { name: '开始复习', exact: true }).click();
    await page.locator('.db-review-session').getByRole('button', { name: /^记得/ }).click();
    const patch = await (await submitted).json();
    expect(patch.kind).toBe('review-update');
    expect(Object.keys(patch.records)).toEqual(['history']);
    expect(patch.records.history.history.length).toBeLessThanOrEqual(2);
    await expect(page.locator('.db-review-saved')).toBeVisible();
    await page.getByRole('button', { name: '退出复习', exact: true }).click();
    await expect(page.locator('[data-review-summary-count="total"]')).toHaveText('46');
    await expect(history.locator('li')).toHaveCount(20);
    expect(
      (await exportReviews(root)).records.history.history.filter((event) => event.rating),
    ).toHaveLength(46);
    expect(await readFile(path.join(root, '.reviews.json'), 'utf8')).toBe(source);
    expect(await readFile(path.join(root, 'notes/history.md'), 'utf8')).toBe(raw);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath('sqlite-history.png') });
  } finally {
    await service?.close();
    await rm(root, { recursive: true, force: true });
  }
});

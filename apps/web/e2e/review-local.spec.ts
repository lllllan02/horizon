import { test, expect } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { startServer } from '../server.ts';

let app: Awaited<ReturnType<typeof startServer>>;
let root: string;
let url: string;
const original =
  '---\ntitle: 本机复习样例\ncategory: 复习验收\nlearning_status: organized\n' +
  'learning_status_changed_at: "2026-10-01T12:00:00+08:00"\n' +
  'updated_at: "2026-10-01T12:00:00+08:00"\n---\n# 本机复习样例\n原文应完整保留。\n';

test.beforeAll(async () => {
  test.setTimeout(120000);
  root = await mkdtemp(path.join(os.tmpdir(), 'horizon-review-browser-'));
  await mkdir(path.join(root, 'notes'));
  await writeFile(path.join(root, 'notes/local-review.md'), original);
  app = await startServer({ root, port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw Error('Missing test server');
  url = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  await app?.close();
  if (root) await rm(root, { recursive: true, force: true });
});

test('本机页面读写独立复习文件，打开和反馈均不改原文及状态', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'wide', '本机API集成单独覆盖一次');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url + '/#/dashboard/review');
  const review = page.locator('.db-review');
  await expect(review).toContainText('进度保存在本机项目中');
  await review
    .locator('.db-review-entrybar')
    .getByRole('button', { name: '开始复习', exact: true })
    .click();
  await expect(review.locator('.markdown')).toHaveCount(0);
  const before = JSON.parse(await readFile(path.join(root, '.reviews.json'), 'utf8'));
  expect(before.records['local-review'].lastReviewedAt).toBeNull();
  await review.getByRole('button', { name: '查看原文', exact: true }).click();
  await expect(review.locator('.markdown')).toContainText('原文应完整保留');
  await review.getByRole('button', { name: /^记得/ }).click();
  await expect(review).toContainText('已保存，下次复习');
  const after = JSON.parse(await readFile(path.join(root, '.reviews.json'), 'utf8'));
  expect(after.records['local-review'].history).toHaveLength(1);
  expect(after.records['local-review'].history[0].rating).toBe('good');
  await review.getByRole('button', { name: '再来一轮', exact: true }).click();
  await expect(review.getByRole('button', { name: /^记得/ })).toBeEnabled();
  await review.getByRole('button', { name: /^记得/ }).click();
  await expect(review.locator('.db-review-saved')).toBeVisible();
  const repeated = JSON.parse(await readFile(path.join(root, '.reviews.json'), 'utf8')).records[
    'local-review'
  ];
  expect(repeated.history).toHaveLength(2);
  expect(repeated.dueAt).toBe(after.records['local-review'].dueAt);
  expect(repeated.intervalDays).toBe(after.records['local-review'].intervalDays);
  expect(await readFile(path.join(root, 'notes/local-review.md'), 'utf8')).toBe(original);
  await page.reload();
  await expect(review.locator('.db-review-statistics')).toBeVisible();
  await review.getByRole('combobox', { name: '复习状态', exact: true }).selectOption('scheduled');
  await expect(review.locator('[data-review-id="local-review"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('首页复习打开原阅读面板，完成后不改原文与状态', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'narrow', '首页本机写入覆盖手机');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(url);
  const dock = page.locator('.home-review-card');
  await expect(dock.locator('.home-review-title')).toBeVisible();
  await expect(dock.getByRole('button', { name: '开始复习', exact: true })).toHaveCount(0);
  await expect
    .poll(
      async () =>
        JSON.parse(await readFile(path.join(root, '.reviews.json'), 'utf8')).records['local-review']
          .lastPresentedAt,
    )
    .toBeTruthy();
  const before = JSON.parse(await readFile(path.join(root, '.reviews.json'), 'utf8'));
  expect(before.records['local-review'].lastReviewedAt).toBeNull();
  expect(before.records['local-review'].dueAt).toBeNull();
  expect(await readFile(path.join(root, 'notes/local-review.md'), 'utf8')).toBe(original);
  await dock.getByRole('button', { name: '忘了', exact: true }).click();
  const reader = page.locator('.document-reader[data-document-id="local-review"]');
  await expect(reader).toBeVisible();
  await expect(reader.locator('.markdown')).toContainText('原文应完整保留');
  await expect(dock.locator('.home-review-title')).toHaveText('本机复习样例');
  await expect(dock.getByRole('button', { name: '记得', exact: true })).toBeEnabled();
  await expect(dock.getByRole('button', { name: '完成复习', exact: true })).toHaveCount(0);
  expect(await readFile(path.join(root, 'notes/local-review.md'), 'utf8')).toBe(original);
  const after = JSON.parse(await readFile(path.join(root, '.reviews.json'), 'utf8'));
  expect(
    after.records['local-review'].history.find((event: { rating?: string }) => event.rating).rating,
  ).toBe('forgot');
  const scheduled = after.records['local-review'];
  await dock.getByRole('button', { name: '记得', exact: true }).click();
  await expect
    .poll(async () => {
      const stored = JSON.parse(await readFile(path.join(root, '.reviews.json'), 'utf8'));
      return stored.records['local-review'].history.filter(
        (event: { rating?: string }) => event.rating,
      ).length;
    })
    .toBe(2);
  const secondRound = JSON.parse(await readFile(path.join(root, '.reviews.json'), 'utf8')).records[
    'local-review'
  ];
  expect(secondRound.dueAt).toBe(scheduled.dueAt);
  expect(secondRound.intervalDays).toBe(scheduled.intervalDays);
  await expect(dock.getByRole('button', { name: '进入下一题', exact: true })).toHaveCount(0);
  await expect(page).not.toHaveURL(/dashboard/);
  await expect(dock).toBeVisible();
});

test('本机重启服务后记住展示与完成，原文状态保持不变', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'wide', '本机持久化单独覆盖一次');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'horizon-review-restart-'));
  let service: Awaited<ReturnType<typeof startServer>> | undefined;
  const sources = Array.from({ length: 7 }, (_, i) =>
    original.replaceAll('本机复习样例', `本机轮换 ${i}`),
  );
  try {
    await mkdir(path.join(dir, 'notes'));
    for (let i = 0; i < sources.length; i++)
      await writeFile(path.join(dir, `notes/item-${i}.md`), sources[i]);
    service = await startServer({ root: dir, port: 0 });
    const serverURL = () => {
      const address = service!.server.address();
      if (!address || typeof address === 'string') throw Error('Missing test server');
      return `http://127.0.0.1:${address.port}`;
    };
    await page.goto(serverURL());
    const dock = page.locator('.home-review-card');
    await expect(dock.locator('.home-review-title')).toBeVisible();
    const first = await dock.locator('.home-review-title').innerText();
    await expect
      .poll(async () => {
        const stored = JSON.parse(await readFile(path.join(dir, '.reviews.json'), 'utf8'));
        return Object.values(stored.records).some(
          (record: unknown) => !!(record as { lastPresentedAt?: string }).lastPresentedAt,
        );
      })
      .toBe(true);
    const displayed = JSON.parse(await readFile(path.join(dir, '.reviews.json'), 'utf8'));
    expect(
      Object.values(displayed.records).some(
        (record: unknown) => (record as { lastReviewedAt: string | null }).lastReviewedAt,
      ),
    ).toBe(false);
    await service.close();
    service = await startServer({ root: dir, port: 0 });
    await page.goto(serverURL());
    await expect(dock.locator('.home-review-title')).toBeVisible();
    await expect(dock.locator('.home-review-title')).not.toHaveText(first);
    const remembered = await dock.locator('.home-review-title').innerText();
    await dock.getByRole('button', { name: '记得', exact: true }).click();
    await expect(dock.locator('.home-review-title')).not.toHaveText(remembered);
    await expect(dock).toHaveAttribute('aria-busy', 'false');
    await service.close();
    service = await startServer({ root: dir, port: 0 });
    await page.goto(serverURL());
    await expect(dock.locator('.home-review-title')).toBeVisible();
    await expect(dock.locator('.home-review-title')).not.toHaveText(remembered);
    const stored = JSON.parse(await readFile(path.join(dir, '.reviews.json'), 'utf8'));
    expect(
      Object.values(stored.records).filter(
        (record: unknown) => (record as { lastReviewedAt: string | null }).lastReviewedAt,
      ),
    ).toHaveLength(1);
    for (let i = 0; i < sources.length; i++)
      expect(await readFile(path.join(dir, `notes/item-${i}.md`), 'utf8')).toBe(sources[i]);
  } finally {
    await service?.close();
    await rm(dir, { recursive: true, force: true });
  }
});

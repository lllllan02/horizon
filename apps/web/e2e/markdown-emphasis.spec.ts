import { test, expect } from '@playwright/test';

test('中文标点前的加粗内链和代码正常显示，链接仍可跳转', async ({ page }, testInfo) => {
  await page.goto('/#/doc/first');
  const reader = page.locator('.document-reader[data-document-id="first"]');
  await expect(reader).toBeVisible();
  await expect(page.locator('.reader-shell')).not.toHaveAttribute('inert');
  const link = reader.locator('strong > a.wiki-link').filter({ hasText: '选择并提升从节点' });
  const code = reader.locator('strong > code').filter({ hasText: 'quorum' });
  await expect(link).toHaveAttribute('href', '#/doc/second');
  await expect(code).toHaveText('quorum');
  await code.scrollIntoViewIfNeeded();
  await expect(code).toBeInViewport();
  await expect(link).toBeInViewport();
  expect(await link.evaluate((el) => el.closest('li')!.textContent)).toBe(
    '选择并提升从节点：确认新的主节点。',
  );
  expect(await code.evaluate((el) => el.closest('p')!.textContent)).toBe(
    '😀quorum：确认故障所需的哨兵数量。',
  );
  const isolation = reader
    .locator('strong')
    .filter({ hasText: '「读未提交（Read Uncommitted）」' });
  await expect(isolation).toHaveText('「读未提交（Read Uncommitted）」');
  expect(await isolation.evaluate((el) => el.closest('p')!.textContent)).toBe(
    '「读未提交（Read Uncommitted）」允许读取其他事务尚未提交的数据。',
  );
  for (const label of ['「重点」', '（重点）', '“重点”']) {
    await expect(reader.locator('strong').filter({ hasText: label })).toHaveText(label);
  }
  await page.screenshot({ path: testInfo.outputPath('markdown-emphasis.png') });
  await link.click();
  await expect(page.locator('.document-reader[data-document-id="second"]')).toBeVisible();
});

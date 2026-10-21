import { test, expect } from '@playwright/test';
import type { Locator } from '@playwright/test';

async function expectEmphasizedLinks(article: Locator) {
  const controller = article.locator('strong > a.wiki-link').filter({ hasText: 'Controller' });
  const ordinary = article.locator('a.wiki-link').filter({ hasText: '普通内链' });
  const strong = article.locator('strong').filter({ hasText: '普通加粗' });
  await expect(controller).toHaveAttribute('href', '#/doc/second');
  expect(await controller.evaluate((el) => el.closest('li')!.textContent)).toBe(
    'Controller负责管理集群。',
  );
  const weight = (element: Locator) =>
    element.evaluate((el) => Number(getComputedStyle(el).fontWeight));
  expect(await weight(controller)).toBe(await weight(strong));
  expect(await weight(controller)).toBeGreaterThan(await weight(ordinary));
  await expect(ordinary).toHaveCSS('font-weight', '500');
  for (const label of ['中文紧贴内链', '嵌套强调内链']) {
    const nested = article.locator('strong a.wiki-link').filter({ hasText: label });
    expect(await weight(nested)).toBe(await weight(strong));
  }
  // Emphasis changes weight while preserving the destination's state color and marker.
  for (const property of ['color', 'background-image', 'box-decoration-break']) {
    const style = (element: Locator) =>
      element.evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property);
    expect(await style(controller)).toBe(await style(ordinary));
  }
}

test('中文正文紧贴加粗内链时生成强调并保持链接样式和跳转', async ({ page }, testInfo) => {
  await page.goto('/#/doc/emphasis');
  const reader = page.locator('.document-reader[data-document-id="emphasis"]');
  await expect(reader).toBeVisible();
  await expect(page.locator('.reader-shell')).not.toHaveAttribute('inert');
  await expectEmphasizedLinks(reader.locator('.markdown'));
  await page.screenshot({ path: testInfo.outputPath('bold-wikilink-reader.png') });
  await reader.locator('strong > a.wiki-link').filter({ hasText: 'Controller' }).click();
  await expect(page.locator('.document-reader[data-document-id="second"]')).toBeVisible();
});

test('键盘打开的文档预览保留加粗内链并可继续跳转', async ({ page }, testInfo) => {
  await page.goto('/#/doc/second');
  const reader = page.locator('.document-reader[data-document-id="second"]');
  await expect(reader).toBeVisible();
  await expect(page.locator('.reader-shell')).not.toHaveAttribute('inert');
  await reader.getByRole('link', { name: /^内链加粗验收/ }).focus();
  const preview = page.getByRole('dialog', { name: '预览：内链加粗验收' });
  await expect(preview).toBeVisible();
  await expectEmphasizedLinks(preview.locator('.markdown'));
  await page.screenshot({ path: testInfo.outputPath('bold-wikilink-preview.png') });
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(reader.getByRole('link', { name: /^内链加粗验收/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.document-reader[data-document-id="emphasis"]')).toBeVisible();
});

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

import { test, expect } from '@playwright/test';

test('图片链接支持预览、放大、键盘与布局边界', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/doc/first');
  const link = page.locator('.document-reader .image-asset-link').filter({ hasText: '架构图片' });
  await expect(link).toBeVisible();
  const preview = page.getByRole('dialog', { name: '图片预览：diagram.png', exact: true });
  if (testInfo.project.name !== 'narrow') {
    await link.hover();
    await expect(preview).toBeVisible();
  }
  await link.click();
  const enlarge = preview.getByRole('button', { name: '放大查看：diagram.png' });
  await expect(enlarge).toBeEnabled();
  await expect(preview.locator('img')).toHaveJSProperty('naturalWidth', 640);
  const box = (await preview.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  const inline = await preview.evaluate((element) => element.classList.contains('is-inline'));
  if (inline) {
    const linkBox = (await link.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(linkBox.y + linkBox.height);
    const next = (await page.locator('.document-reader .diagram-block').first().boundingBox())!;
    expect(next.y).toBeGreaterThanOrEqual(box.y + box.height);
  } else {
    const reader = (await page.locator('.reader-shell').boundingBox())!;
    expect(box.x + box.width <= reader.x || box.x >= reader.x + reader.width).toBeTruthy();
  }
  expect(await link.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain(
    'linear-gradient',
  );
  if (testInfo.project.name === 'reduced')
    expect(await preview.evaluate((element) => getComputedStyle(element).animationName)).toBe(
      'none',
    );
  await page.screenshot({ path: testInfo.outputPath('image-preview.png') });
  await enlarge.click();
  const viewer = page.getByRole('dialog', { name: '图片放大查看', exact: true });
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('img')).toHaveJSProperty('naturalWidth', 640);
  await viewer.getByRole('button', { name: '放大图片', exact: true }).click();
  await expect(viewer.locator('output')).not.toHaveText('100%');
  await viewer.getByRole('button', { name: '原始大小', exact: true }).click();
  await expect(viewer.locator('output')).toHaveText('100%');
  await page.screenshot({ path: testInfo.outputPath('image-viewer.png') });
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(preview).toBeVisible();
  await expect(enlarge).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(link).toBeFocused();
  await link.blur();
  await link.focus();
  await expect(preview).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(preview.getByRole('button', { name: '关闭图片附件预览' })).toBeFocused();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  await expect(preview).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.document-reader[data-document-id="first"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('缺失和损坏图片可见反馈，切换目标后正常读取', async ({ page }) => {
  await page.goto('/#/doc/first');
  for (const name of ['缺失图片', '损坏图片']) {
    await page.locator('.document-reader .image-asset-link').filter({ hasText: name }).click();
    await expect(page.getByRole('alert')).toContainText('图片加载失败');
    await page.getByRole('button', { name: '关闭图片附件预览' }).click();
  }
  await page.locator('.document-reader .image-asset-link').filter({ hasText: '架构图片' }).click();
  await expect(page.getByRole('button', { name: '放大查看：diagram.png' })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

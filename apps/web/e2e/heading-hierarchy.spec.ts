import { test, expect } from '@playwright/test';

test('标题层级随字号保留，目录缩进并支持键盘跳转', async ({ page }, testInfo) => {
  await page.goto('/#/doc/headings');
  const reader = page.locator('.document-reader[data-document-id="headings"]');
  const article = reader.locator('.markdown');
  await expect(article.locator('h6')).toHaveText('边界情况');
  const size = reader.getByRole('combobox', { name: '文档字号' });
  for (const scale of ['85', '115', '150']) {
    await size.selectOption(scale);
    const metrics = await article.evaluate((element) => {
      const fontSize = (node: Element) => parseFloat(getComputedStyle(node).fontSize);
      return {
        body: fontSize(element),
        headings: [...element.querySelectorAll('h2,h3,h4,h5,h6')].slice(0, 5).map(fontSize),
        overflow: element.scrollWidth > element.clientWidth,
      };
    });
    expect(metrics.overflow).toBe(false);
    for (let index = 1; index < metrics.headings.length; index++) {
      expect(metrics.headings[index - 1]).toBeGreaterThan(metrics.headings[index]);
    }
    expect(metrics.headings[4]).toBeGreaterThanOrEqual(metrics.body);
  }
  await size.selectOption('115');
  await reader.getByRole('button', { name: '目录', exact: true }).click();
  const toc = reader.getByRole('navigation', { name: '文章目录' });
  const section = toc.getByRole('link', { name: '工具和程序的升级策略', exact: true });
  const subsection = toc.getByRole('link', { name: '停止支持旧工具', exact: true });
  const detail = toc.getByRole('link', { name: '参数与返回结果', exact: true });
  const inset = (link: typeof section) =>
    link.evaluate((element) => parseFloat(getComputedStyle(element).paddingInlineStart));
  expect(await inset(subsection)).toBeGreaterThan(await inset(section));
  expect(await inset(detail)).toBeGreaterThan(await inset(subsection));
  await subsection.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(
    (url) => decodeURIComponent(url.hash) === '#/doc/headings/停止支持旧工具',
  );
  const heading = article.getByRole('heading', { name: '停止支持旧工具', exact: true });
  await expect(heading).toBeInViewport();
  await expect(toc).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('heading-hierarchy.png') });
});

test('小屏与横屏的长标题在放大字号后仍留在正文内', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/#/doc/headings');
    const reader = page.locator('.document-reader[data-document-id="headings"]');
    await reader.getByRole('combobox', { name: '文档字号' }).selectOption('150');
    await expect(reader.locator('.markdown h6')).toBeAttached();
    const overflow = await reader.locator('.markdown').evaluate((element) =>
      [...element.querySelectorAll('h2,h3,h4,h5,h6')].some((heading) => {
        const box = heading.getBoundingClientRect();
        const parent = element.getBoundingClientRect();
        return heading.scrollWidth > heading.clientWidth || box.right > parent.right + 1;
      }),
    );
    expect(overflow).toBe(false);
  }
});

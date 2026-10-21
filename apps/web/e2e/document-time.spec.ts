import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'America/Los_Angeles' });

test('详情同时显示创建和修改时间，浏览器时区不影响北京时间', async ({ page }, testInfo) => {
  await page.route('**/library.json', async (route) => {
    const response = await route.fetch();
    const library = await response.json();
    Object.assign(
      library.documents.find((doc: { id: string }) => doc.id === 'first'),
      {
        created: '2026-10-21 01:02:03',
        updated: '2026-10-21T10:20:30+08:00',
      },
    );
    Object.assign(
      library.documents.find((doc: { id: string }) => doc.id === 'second'),
      {
        created: '2026-10-01',
        updated: null,
      },
    );
    await route.fulfill({ response, json: library });
  });
  await page.goto('/#/doc/first');
  const reader = page.locator('.document-reader[data-document-id="first"]');
  await expect(reader).toBeVisible();
  await reader.getByRole('button', { name: '详情', exact: true }).click();
  const details = reader.locator('#reader-details');
  await expect(details).toContainText('创建于 2026-10-21 01:02:03');
  await expect(details).toContainText('修改于 2026-10-21 10:20:30');
  await expect(details.locator('time')).toHaveCount(2);
  await expect(details).not.toContainText(/UTC|GMT|\+08:00|17:02:03Z/);
  await expect(details.locator('span[title^="创建于"]')).toHaveAttribute(
    'title',
    '创建于 2026-10-21 01:02:03',
  );
  for (const width of page.viewportSize()!.width < 900 ? [320, 390] : [1440]) {
    await page.setViewportSize({ width, height: 960 });
    await expect(details).toBeInViewport();
    const bounds = await details.boundingBox();
    for (const time of await details.locator('time').all()) {
      const rect = (await time.boundingBox())!;
      expect(rect.x).toBeGreaterThanOrEqual(bounds!.x);
      expect(rect.x + rect.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
    }
    await page.screenshot({ path: testInfo.outputPath(`document-time-${width}.png`) });
  }
  await reader.getByRole('link', { name: /^回归终点/ }).click();
  const nextReader = page.locator('.document-reader[data-document-id="second"]');
  await nextReader.getByRole('button', { name: '详情', exact: true }).click();
  await expect(nextReader.locator('#reader-details')).toContainText('创建于 2026-10-01');
  await expect(nextReader.locator('#reader-details time')).toHaveCount(1);
});

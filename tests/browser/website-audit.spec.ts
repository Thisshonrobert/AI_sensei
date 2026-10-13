import { test, expect } from '@playwright/test';

test('study routes remain usable at narrow widths without evidence disclosures', async ({page}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.name));
  const routes = ['/', '/review', '/weekly', '/practice', '/grammar/exercises'];
  for (const kind of ['vocabulary', 'kanji', 'grammar']) {
    await page.goto(`/${kind}`);
    routes.push(`/${kind}`, (await page.locator('[data-item-link]').first().getAttribute('href'))!, `/${kind}/flashcards`);
  }
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({width, height: 900});
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      await expect(page.locator('main h1')).toBeVisible();
      if (await page.locator('.browse-card').count()) await page.locator('.browse-card').click();
      await expect(page.locator('main summary').filter({hasText: /evidence/i})).toHaveCount(0);
      await expect(page.locator('main a[href^="/sources"]')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

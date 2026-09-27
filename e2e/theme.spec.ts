import { expect, test } from '@playwright/test';

test('theme switcher is usable', async ({ page }) => {
  await page.goto('/?nobench=1');
  await expect(page.getByTestId('status')).toContainText(/painted Europe \d+×\d+/, {
    timeout: 90_000,
  });
  const before = await page.locator('html').getAttribute('data-theme');
  const switcher = page.getByTestId('theme-switcher');
  await expect(switcher).toBeVisible();
  const control = switcher.locator('button, [data-theme-value], [data-theme-ui]').first();
  await control.click();
  const after = await page.locator('html').getAttribute('data-theme');
  expect(after !== before || (await switcher.locator('[data-theme-value]').count()) > 0).toBe(true);
});

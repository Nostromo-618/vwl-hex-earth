import { expect, test } from '@playwright/test';

test('stats panel opens and closes', async ({ page }) => {
  await page.goto('/?nobench=1');
  await expect(page.getByTestId('status')).toContainText(/painted 240×120/, { timeout: 60_000 });
  await page.getByTestId('stats-toggle').click();
  await expect(page.getByTestId('stats-panel')).toBeVisible();
  await page.getByTestId('stats-close').click();
  await expect(page.getByTestId('stats-panel')).toHaveCount(0);
});

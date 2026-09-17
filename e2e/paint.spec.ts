import { expect, test } from '@playwright/test';

test('paints the low-resolution globe', async ({ page }) => {
  await page.goto('/?nobench=1');
  await expect(page.getByTestId('status')).toContainText(/painted 240×120/, { timeout: 60_000 });
  await expect(page.locator('[data-testid="hex-host"] canvas')).toBeVisible();
});

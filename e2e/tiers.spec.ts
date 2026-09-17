import { expect, test } from '@playwright/test';

test('mid and high tiers paint; ultra stays gated', async ({ page }) => {
  await page.goto('/?nobench=1');
  await expect(page.getByTestId('status')).toContainText(/painted 240×120/, { timeout: 60_000 });
  await page.getByTestId('tier-mid').click();
  await expect(page.getByTestId('status')).toContainText(/painted 360×180/, { timeout: 60_000 });
  await page.getByTestId('tier-high').click();
  await expect(page.getByTestId('status')).toContainText(/painted 480×240/, { timeout: 90_000 });
  await expect(page.getByTestId('tier-ultra')).toBeDisabled();
});

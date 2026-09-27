import { expect, test } from '@playwright/test';

test('lower tiers paint; ultra stays enabled', async ({ page }) => {
  await page.goto('/?nobench=1');
  await expect(page.getByTestId('status')).toContainText(/painted Europe \d+×\d+/, {
    timeout: 90_000,
  });
  await expect(page.getByTestId('tier-ultra')).toBeEnabled();
  await page.getByTestId('tier-low').click();
  await expect(page.getByTestId('status')).toContainText(/painted Europe \d+×\d+/, {
    timeout: 60_000,
  });
  await page.getByTestId('tier-mid').click();
  await expect(page.getByTestId('status')).toContainText(/painted Europe \d+×\d+/, {
    timeout: 60_000,
  });
  await page.getByTestId('tier-high').click();
  await expect(page.getByTestId('status')).toContainText(/painted Europe \d+×\d+/, {
    timeout: 90_000,
  });
  await page.getByTestId('tier-ultra').click();
  await expect(page.getByTestId('tier-ultra')).toHaveClass(/active/);
});

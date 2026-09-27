import { expect, test } from '@playwright/test';

test('defaults to Europe ultra and can switch to the World globe', async ({ page }) => {
  await page.goto('/?nobench=1');
  await expect(page.getByTestId('status')).toContainText(/painted Europe \d+×\d+/, {
    timeout: 90_000,
  });
  await expect(page.getByTestId('region-europe')).toHaveClass(/active/);
  await expect(page.getByTestId('tier-ultra')).toBeEnabled();
  await page.getByTestId('region-world').click();
  await expect(page.getByTestId('status')).toContainText(/painted World 720×360/, {
    timeout: 90_000,
  });
  await expect(page.getByTestId('region-world')).toHaveClass(/active/);
});

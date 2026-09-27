import { expect, test } from '@playwright/test';

test('zoom buttons change the on-screen hex readout', async ({ page }) => {
  await page.goto('/?nobench=1');
  await expect(page.getByTestId('status')).toContainText(/painted Europe \d+×\d+/, {
    timeout: 90_000,
  });
  const before = await page.getByTestId('zoom-readout').innerText();
  for (let i = 0; i < 6; i++) await page.getByTestId('zoom-in').click();
  await expect(page.getByTestId('zoom-readout')).not.toHaveText(before);
  const zoomed = await page.getByTestId('zoom-readout').innerText();
  for (let i = 0; i < 6; i++) await page.getByTestId('zoom-out').click();
  await expect(page.getByTestId('zoom-readout')).not.toHaveText(zoomed);
  await page.getByTestId('zoom-fit').click();
  await expect(page.getByTestId('zoom-readout')).toHaveText(before);
});

import { expect, test } from '@playwright/test';

test('path mode draws a route after two canvas clicks', async ({ page }) => {
  await page.goto('/?nobench=1');
  await expect(page.getByTestId('status')).toContainText(/painted 240×120/, { timeout: 60_000 });
  await page.getByTestId('path-mode').click();
  await expect(page.getByTestId('status')).toContainText(/path mode on/);
  const canvas = page.locator('[data-testid="hex-host"] canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas missing');
  await canvas.click({ position: { x: box.width * 0.4, y: box.height * 0.45 } });
  await expect(page.getByTestId('status')).toContainText(/A set/);
  await canvas.click({ position: { x: box.width * 0.6, y: box.height * 0.55 } });
  await expect(page.getByTestId('status')).toContainText(/path drawn/);
});

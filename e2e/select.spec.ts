import { expect, test } from '@playwright/test';

test('clicking a hex reports latitude and longitude', async ({ page }) => {
  await page.goto('/?nobench=1');
  await expect(page.getByTestId('status')).toContainText(/painted 240×120/, { timeout: 60_000 });
  const canvas = page.locator('[data-testid="hex-host"] canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas missing');
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  await expect(page.getByTestId('status')).toContainText(/°/);
});

import { expect, test } from '@playwright/test';

test('the web app boots against the workspace packages', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('KOMETA');
  await expect(page.locator('#app')).toHaveAttribute('data-sim-version', /^[1-9]\d*$/);
});

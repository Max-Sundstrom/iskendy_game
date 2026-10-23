import { expect, test } from '@playwright/test';

// P1-01 acceptance: a 10 000-tick run hashes identically in Node (packages/sim/src/determinism.test.ts) and in
// the browser. Needs the dev server (the probe page is not in the production build), so it skips on containers.
test.skip(Boolean(process.env['BASE_URL']), 'probe page exists only on the dev server');

test('the sim hashes the same in the browser as in Node', async ({ page }) => {
  await page.goto('/test/determinism.html?seed=7&ticks=10000');
  await expect(page.locator('body')).toHaveAttribute('data-tick', '10000');
  await expect(page.locator('body')).toHaveAttribute('data-hash', 'eb26e68b');
});

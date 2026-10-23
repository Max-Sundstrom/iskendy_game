import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __cspViolations: string[];
  }
}

test('the game boots, renders and drives forward', async ({ page }) => {
  // Report-only violations (Trusted Types) fire this event too, so the container run proves the CSP holds.
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(`${e.disposition} ${e.effectiveDirective} ${e.blockedURI}`);
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?seed=1&q=low');
  await expect(page).toHaveTitle('KOMETA');
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-sim-version', /^[1-9]\d*$/);
  await expect(page.locator('#game')).toBeVisible();
  await expect
    .poll(async () => Number(await app.getAttribute('data-distance')), { timeout: 15_000 })
    .toBeGreaterThan(20);
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  expect(errors).toEqual([]);
});

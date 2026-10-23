import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __cspViolations: string[];
  }
}

test('the web app boots against the workspace packages', async ({ page }) => {
  // Report-only violations (Trusted Types) fire this event too, so the container run proves the CSP holds.
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(`${e.disposition} ${e.effectiveDirective} ${e.blockedURI}`);
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page).toHaveTitle('KOMETA');
  await expect(page.locator('#app')).toHaveAttribute('data-sim-version', /^[1-9]\d*$/);
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  expect(errors).toEqual([]);
});

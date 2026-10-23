import { expect, test } from '@playwright/test';

// Runs only against real containers (CI `container` job): HOST_URL serves e2e/host, BASE_URL is the game,
// DISABLED_URL is the same image with KOMETA_MODE=off. Proves frame-ancestors admits the host (H2) and the
// kill switch reaches the host as game.error (O8, EMBEDDING §2).
const hostUrl = process.env['HOST_URL'];
const gameUrl = process.env['BASE_URL'];
const disabledUrl = process.env['DISABLED_URL'];

test.skip(!hostUrl || !gameUrl || !disabledUrl, 'needs HOST_URL, BASE_URL and DISABLED_URL');

test('the Iskendi host can frame the game', async ({ page }) => {
  await page.goto(`${hostUrl}/?game=${encodeURIComponent(`${gameUrl}/`)}`);
  await expect(page.frameLocator('#game').locator('#app')).toHaveText('KOMETA');
});

test('the kill switch tells the host the game is disabled', async ({ page }) => {
  await page.goto(`${hostUrl}/?game=${encodeURIComponent(`${disabledUrl}/`)}`);
  await expect(page.locator('body')).toHaveAttribute('data-last-message', '{"type":"game.error","code":"disabled"}');
});

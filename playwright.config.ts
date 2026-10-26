import { defineConfig, devices } from '@playwright/test';

// A container with a different preinstalled Chromium can point at it instead of downloading (see README).
const executablePath = process.env['PW_CHROMIUM_EXECUTABLE'];
const launchOptions = executablePath ? { executablePath } : {};
// CROSS_ENGINE=1 adds WebKit and Firefox for the determinism checks only (ARCHITECTURE §4.4; CI job cross-engine).
const crossEngine = process.env['CROSS_ENGINE']
  ? [
      { name: 'webkit', testMatch: /(determinism|replays)\.spec\.ts/, use: { ...devices['Desktop Safari'] } },
      { name: 'firefox', testMatch: /(determinism|replays)\.spec\.ts/, use: { ...devices['Desktop Firefox'] } },
    ]
  : [];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Software-rendered WebGL cases share the runner's CPU quota. The unchanged crash journey exceeded 120 s
  // with two workers but passed in 65 s alone; serialize cases while retaining every frame and assertion.
  workers: 1,
  timeout: 120_000,
  forbidOnly: Boolean(process.env['CI']),
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  // BASE_URL points the suite at a running build (e.g. the game container) instead of the dev server.
  use: { baseURL: process.env['BASE_URL'] ?? 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        launchOptions,
      },
    },
    ...crossEngine,
  ],
  webServer: process.env['BASE_URL']
    ? undefined
    : {
        command: 'pnpm --filter @kometa/web dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env['CI'],
        timeout: 60_000,
      },
});

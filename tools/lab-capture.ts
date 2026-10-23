import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Captures the D0 evidence from the design lab into docs/reviews/art-D0 (ART_DIRECTION §9).
// Usage: pnpm lab:capture [filter]   — PW_CHROMIUM_EXECUTABLE may point at a preinstalled Chromium.
const OUT = 'docs/reviews/art-D0';
const BASE = 'http://localhost:5174';
const filter = process.argv[2] ?? '';

type Shot = { name: string; path: string; selector?: string; wait?: number };

const shots: Shot[] = [];
for (const concept of ['A', 'B', 'C']) {
  for (const view of ['chase', 'rear34', 'side', 'top', 'front34']) {
    shots.push({ name: `D0-2-${concept}-${view}`, path: `/car.html?concept=${concept}&view=${view}` });
  }
}
for (const livery of ['factory', 'taxi', 'neon', 'courier']) {
  shots.push({ name: `D0-2-B-livery-${livery}`, path: `/car.html?concept=B&view=livery&livery=${livery}` });
}
for (const biome of ['ringroad', 'spalny']) {
  shots.push({ name: `D0-2-B-chase-${biome}`, path: `/car.html?concept=B&view=chase&livery=courier&biome=${biome}` });
}
shots.push({ name: 'D0-1-board', path: '/board.html', selector: 'main' });
shots.push({ name: 'D0-4-hud-390x844', path: '/hud.html?w=390&h=844', selector: '.frame' });
shots.push({ name: 'D0-4-hud-1440x900', path: '/hud.html?w=1440&h=900', selector: '.frame' });
shots.push({ name: 'D0-4-results-390x844', path: '/hud.html?w=390&h=844&screen=results', selector: '.frame' });
shots.push({ name: 'D0-4-results-1440x900', path: '/hud.html?w=1440&h=900&screen=results', selector: '.frame' });
shots.push({ name: 'D0-3-style-chase', path: '/style.html?capture=1', selector: '.render', wait: 4000 });
shots.push({ name: 'D0-3-style-night', path: '/style.html?capture=1&biome=spalny', selector: '.render', wait: 4000 });

const server = spawn('pnpm', ['--filter', '@kometa/lab', 'dev'], { stdio: 'ignore', detached: true });
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  mkdirSync(OUT, { recursive: true });
  const executablePath = process.env['PW_CHROMIUM_EXECUTABLE'];
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', (e) => console.error(`page error: ${e.message}`));
  for (const shot of shots.filter((s) => s.name.includes(filter))) {
    await page.goto(`${BASE}${shot.path}`);
    await page.waitForSelector('body[data-ready="true"]', { timeout: 120_000 });
    if (shot.wait) await page.waitForTimeout(shot.wait);
    await page
      .locator(shot.selector ?? 'body')
      .screenshot({ path: `${OUT}/${shot.name}.jpg`, type: 'jpeg', quality: 85 });
    console.log(`✓ ${shot.name}`);
  }
  await browser.close();
} finally {
  if (server.pid) process.kill(-server.pid);
}

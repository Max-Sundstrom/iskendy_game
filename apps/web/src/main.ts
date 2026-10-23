import './style.css';
import { SIM_VERSION, SimStatus } from '@kometa/sim';
import { createGameRenderer } from './engine/renderer';
import { createPerfMeter } from './engine/perf';
import { alpha, stepsForFrame, type Accumulator } from './game/loop';
import { advance, createSession } from './game/session';
import { createKeyboard } from './input/keyboard';

// Boot: one session, the fixed-step loop, the grey-box renderer. Screens and touch input arrive in P1-05.

const root = document.querySelector<HTMLElement>('#app');
const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (root && canvas) {
  root.dataset['simVersion'] = String(SIM_VERSION);
  const seedParam = Number(new URLSearchParams(location.search).get('seed'));
  const seed =
    Number.isInteger(seedParam) && seedParam > 0 ? seedParam : (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1);
  const session = createSession(seed);
  const gfx = createGameRenderer(canvas, session);
  const perf = createPerfMeter(gfx.info);
  const keyboard = createKeyboard(window);
  const acc: Accumulator = { carry: 0 };
  let last = performance.now();
  let paused = false;

  window.addEventListener('resize', () => gfx.resize());
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden; // scenario P1: auto-pause when the tab is hidden
    last = performance.now();
  });

  const frame = (now: number) => {
    const frameS = (now - last) / 1000;
    perf.frame(now - last);
    last = now;
    if (!paused) {
      const steps = stepsForFrame(acc, frameS);
      advance(session, steps, keyboard.held());
    }
    gfx.render(session, alpha(acc), frameS);
    root.dataset['distance'] = String(Math.floor(session.state.player.distanceM));
    root.dataset['status'] = session.state.status === SimStatus.crashed ? 'crashed' : 'running';
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

import './style.css';
import { Action, DEFAULT_TUNING, SIM_VERSION, SimStatus } from '@kometa/sim';
import { createGameRenderer } from './engine/renderer';
import { createPerfMeter } from './engine/perf';
import { alpha, stepsForFrame, type Accumulator } from './game/loop';
import { advance, createSession, type Session } from './game/session';
import { bindKeyboard, createControls } from './input/controls';
import { bindTouch } from './input/touch';
import { submitBest } from './platform/best';
import { stringsFor } from './platform/i18n';
import { newPromoCode } from './platform/promo';
import { createHud } from './ui/hud';
import { createResults } from './ui/results';

// Boot: session, fixed-step loop, renderer, input, HUD and results (P1-05). Menus, pause and the host bridge come later.

const root = document.querySelector<HTMLElement>('#app');
const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (root && canvas) {
  root.dataset['simVersion'] = String(SIM_VERSION);
  const query = new URLSearchParams(location.search);
  const t = stringsFor(query.get('lang') === 'en' ? 'en' : 'ru');
  const seedParam = Number(query.get('seed'));
  const fixedSeed = Number.isInteger(seedParam) && seedParam > 0 && seedParam < 2 ** 32 ? seedParam : undefined;
  let run = 0;
  const nextSeed = () =>
    fixedSeed !== undefined ? fixedSeed + run++ : (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1);

  let session: Session = createSession(nextSeed());
  const gfx = createGameRenderer(canvas, session);
  const perf = createPerfMeter(gfx.info);
  const touch = matchMedia('(pointer: coarse)').matches;
  const hud = createHud(root, t, touch);
  const results = createResults(root, t);
  const controls = createControls();
  let screen: 'playing' | 'results' = 'playing';
  const playing = () => screen === 'playing';
  bindKeyboard(window, controls, playing);
  bindTouch(canvas, controls, DEFAULT_TUNING.presentation.input, playing);
  const boost = hud.boostButton;
  boost.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    controls.hold(Action.boost, true);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const)
    boost.addEventListener(type, () => controls.hold(Action.boost, false));

  const acc: Accumulator = { carry: 0 };
  let last = performance.now();
  let paused = false;

  const retry = () => {
    session = createSession(nextSeed());
    controls.releaseAll();
    acc.carry = 0;
    results.hide();
    hud.show(true);
    screen = 'playing';
    root.dataset['screen'] = 'playing';
  };
  results.retry.addEventListener('click', retry);
  window.addEventListener('keydown', (e) => {
    if (screen === 'results' && (e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
      e.preventDefault();
      retry();
    }
  });

  const finish = () => {
    const s = session.state;
    const score = Math.floor(s.score.total);
    const newBest = submitBest(score, s.player.distanceM);
    // promoCode goes to the host in game.runEnded once the bridge exists (P5-09).
    results.show({ score, distanceM: s.player.distanceM, timeS: s.tick / 60, newBest, promoCode: newPromoCode() });
    hud.show(false);
    screen = 'results';
    root.dataset['screen'] = 'results';
  };

  window.addEventListener('resize', () => gfx.resize());
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden; // scenario P1: auto-pause when the tab is hidden
    controls.releaseAll();
    last = performance.now();
  });

  root.dataset['screen'] = 'playing';
  const frame = (now: number) => {
    const frameS = (now - last) / 1000;
    perf.frame(now - last);
    last = now;
    if (!paused && screen === 'playing') {
      const steps = stepsForFrame(acc, frameS);
      advance(session, steps, controls.held());
      if (steps > 0) controls.consume();
      if (session.state.status === SimStatus.crashed) finish();
    }
    const s = session.state;
    gfx.render(session, alpha(acc), frameS);
    hud.update({
      score: s.score.total,
      distanceM: s.player.distanceM,
      airLiters: s.player.airLiters,
      airCapacity: session.tuning.air.capacityL,
    });
    root.dataset['distance'] = String(Math.floor(s.player.distanceM));
    root.dataset['lane'] = String(s.player.lane);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

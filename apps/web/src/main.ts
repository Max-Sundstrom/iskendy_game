import './style.css';
import { Action, DEFAULT_TUNING, SIM_VERSION, SimStatus } from '@kometa/sim';
import { countdownDigit, INTRO_S, RETRY_START_S } from './engine/intro';
import { createGameRenderer } from './engine/renderer';
import { createPerfMeter } from './engine/perf';
import { alpha, stepsForFrame, type Accumulator } from './game/loop';
import { advance, createSession, type Session } from './game/session';
import { bindKeyboard, createControls } from './input/controls';
import { bindTouch } from './input/touch';
import { submitBest } from './platform/best';
import { stringsFor } from './platform/i18n';
import { storeReplay } from './platform/replays';
import { newPromoCode } from './platform/promo';
import { createHud } from './ui/hud';
import { createIntroOverlay } from './ui/intro';
import { createResults } from './ui/results';

// Boot: session, launch intro, fixed-step loop, renderer, input, HUD and results. Menus, pause and the host bridge
// come later. The intro is presentation only: the sim's tick 0 is the moment the car meets the road.

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
  const gfx = createGameRenderer(canvas, session, query.get('q') === 'low' ? 'low' : 'high');
  const perf = createPerfMeter(gfx.info);
  const touch = matchMedia('(pointer: coarse)').matches;
  const hud = createHud(root, t, touch);
  const results = createResults(root, t);
  const overlay = createIntroOverlay(root, t);
  const controls = createControls();
  // ?intro=0 skips the launch ramp (test pages and quick checks).
  const withIntro = query.get('intro') !== '0';
  let screen: 'intro' | 'playing' | 'results' = 'playing';
  let introT = 0;
  // Input is buffered from "1" on (GDD §12), so a swipe during the last second lands on the first step.
  const playing = () => screen === 'playing' || (screen === 'intro' && countdownDigit(introT) <= 1);
  bindKeyboard(window, controls, playing);
  bindTouch(canvas, controls, DEFAULT_TUNING.presentation.input, playing);
  const boost = hud.boostButton;
  boost.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    // Captured, so a thumb drifting off the 72 px button keeps boosting until it lifts.
    boost.setPointerCapture(e.pointerId);
    controls.hold(Action.boost, true);
  });
  for (const type of ['pointerup', 'pointercancel'] as const)
    boost.addEventListener(type, () => controls.hold(Action.boost, false));
  boost.addEventListener('contextmenu', (e) => e.preventDefault());

  const acc: Accumulator = { carry: 0 };
  let last = performance.now();
  let paused = false;

  const startIntro = (fromS: number, premise: boolean) => {
    if (!withIntro) {
      screen = 'playing';
      root.dataset['screen'] = 'playing';
      return;
    }
    introT = fromS;
    overlay.show(premise);
    screen = 'intro';
    root.dataset['screen'] = 'intro';
  };
  const retry = () => {
    session = createSession(nextSeed());
    gfx.reset();
    controls.releaseAll();
    acc.carry = 0;
    results.hide();
    hud.show(true);
    startIntro(RETRY_START_S, false);
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
    storeReplay(session.recorder.finish(s));
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

  startIntro(0, true);
  const frame = (now: number) => {
    // rAF timestamps can precede the performance.now() taken at boot, so the first delta may be negative.
    const frameS = Math.min(0.25, Math.max(0, (now - last) / 1000));
    perf.frame(now - last);
    last = now;
    if (screen === 'intro') {
      if (!paused) introT += frameS;
      if (countdownDigit(introT) > 1) controls.releaseAll();
      overlay.update(countdownDigit(introT));
      if (introT >= INTRO_S) {
        overlay.hide();
        acc.carry = 0;
        screen = 'playing';
        root.dataset['screen'] = 'playing';
      } else {
        gfx.renderIntro(session, introT, frameS);
        hud.update({
          score: 0,
          distanceM: 0,
          airLiters: session.state.player.airLiters,
          airCapacity: session.tuning.air.capacityL,
          boosting: false,
        });
        requestAnimationFrame(frame);
        return;
      }
    }
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
      boosting: s.player.boosting,
    });
    root.dataset['distance'] = String(Math.floor(s.player.distanceM));
    root.dataset['lane'] = String(s.player.lane);
    root.dataset['flip'] = s.player.flipTurns.toFixed(2); // e2e: the flip is visible in the sim state
    root.dataset['air'] = s.player.airborne ? '1' : '0';
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

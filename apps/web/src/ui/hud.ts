import type { Strings } from '../platform/i18n';
import { el } from './dom';

// Minimal HUD (P1-05, GDD §14): score odometer, distance, AIR bar. Values are written straight to DOM nodes once per
// frame and only when they change (invariant 9); no framework renders on the hot path.

export type HudValues = { score: number; distanceM: number; airLiters: number; airCapacity: number; boosting: boolean };

export type Hud = {
  root: HTMLElement;
  boostButton: HTMLElement;
  update(v: HudValues): void;
  show(visible: boolean): void;
};

const SEGMENTS = 12;
const groupDigits = (n: number) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function createHud(parent: HTMLElement, t: Strings, touch: boolean): Hud {
  const root = el('div', 'hud');
  const score = el('output', 'hud-score');
  score.setAttribute('aria-label', t.hud.score);
  const distance = el('output', 'hud-distance');
  const air = el('div', 'hud-air');
  const segs = Array.from({ length: SEGMENTS }, () => el('i'));
  const segWrap = el('div', 'hud-air-segments');
  segWrap.append(...segs);
  const litres = el('output', 'hud-air-litres');
  air.append(el('span', 'hud-air-label', t.hud.air), segWrap, litres);
  const boostButton = el('button', 'hud-boost', t.hud.boost);
  boostButton.type = 'button';
  boostButton.hidden = !touch;
  const hint = el('p', 'hud-hint', touch ? t.controls.touch : t.controls.keyboard);
  root.append(score, distance, air, boostButton, hint);
  parent.append(root);
  setTimeout(() => hint.classList.add('hud-hint-gone'), 10000); // ~6 s after the intro

  let last = { score: -1, distance: -1, air: -1, boosting: false };
  return {
    root,
    boostButton,
    show(visible) {
      root.hidden = !visible;
    },
    update(v) {
      const s = Math.floor(v.score);
      if (s !== last.score) score.textContent = groupDigits(s);
      const d = Math.floor(v.distanceM);
      if (d !== last.distance) distance.textContent = `${groupDigits(d)} ${t.hud.metres}`;
      const a = Math.round(v.airLiters);
      if (a !== last.air) {
        litres.textContent = `${a} ${t.hud.litres}`;
        const lit = Math.ceil((v.airLiters / v.airCapacity) * SEGMENTS);
        segs.forEach((seg, i) => seg.classList.toggle('empty', i >= lit));
        air.classList.toggle('low', v.airLiters / v.airCapacity < 0.15);
      }
      if (v.boosting !== last.boosting) boostButton.classList.toggle('on', v.boosting);
      last = { score: s, distance: d, air: a, boosting: v.boosting };
    },
  };
}

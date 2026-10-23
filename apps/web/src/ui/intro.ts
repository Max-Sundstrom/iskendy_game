import type { Strings } from '../platform/i18n';
import { el } from './dom';

// Intro overlay (GDD §1 img 14, §3): the big 3-2-1 over the launch ramp, then "Go!", and the premise toast at the
// bottom. Text nodes only; the digit is announced politely for screen readers.

export type IntroOverlay = { show(premise: boolean): void; update(digit: number): void; hide(): void };

export function createIntroOverlay(parent: HTMLElement, t: Strings): IntroOverlay {
  const root = el('div', 'intro');
  const count = el('output', 'intro-count');
  count.setAttribute('aria-live', 'polite');
  const toast = el('p', 'intro-toast', t.intro.premise);
  root.append(count, toast);
  root.hidden = true;
  parent.append(root);
  let shown = -1;
  let goTimer = 0;
  return {
    show(premise) {
      window.clearTimeout(goTimer);
      root.hidden = false;
      toast.hidden = !premise;
      shown = -1;
    },
    update(digit) {
      if (digit === shown) return;
      shown = digit;
      count.textContent = digit > 0 ? String(digit) : t.intro.go;
      count.classList.remove('pop');
      void count.offsetWidth; // restart the pop animation for each digit
      count.classList.add('pop');
    },
    hide() {
      count.textContent = t.intro.go;
      toast.hidden = true; // the controls hint takes its place
      goTimer = window.setTimeout(() => (root.hidden = true), 700);
    },
  };
}

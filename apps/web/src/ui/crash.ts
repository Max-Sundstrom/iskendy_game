import type { Strings } from '../platform/i18n';
import { el } from './dom';

/** A static accessible cue leaves the actual car visible during the brief crash response. */
export function createCrashCue(parent: HTMLElement, t: Strings): { show(visible: boolean): void } {
  const cue = el('p', 'crash-cue', t.crash.title);
  cue.setAttribute('role', 'status');
  cue.hidden = true;
  parent.append(cue);
  return {
    show: (visible) => {
      cue.hidden = !visible;
    },
  };
}

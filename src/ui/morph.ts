// Jaettu elementtisiirtymä (SPEC 16): napautettu kortti laajenee saumattomasti avautuvaksi
// paneeliksi (View Transitions API). Ilman tukea, liikettä vähennettäessä tai toisen paneelin
// ollessa auki paneeli avautuu tavalliseen tapaan.

import { flushSync } from 'react-dom';
import { prefersReducedMotion } from './motion';

let pending = false;

/** Sheet kysyy avautuessaan, avataanko se morfina (kerran). */
export function takeMorph(): boolean {
  const p = pending;
  pending = false;
  return p;
}

type VTDoc = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void>; skipTransition?: () => void } };

export function morphOpen(from: EventTarget | Element | null, open: () => void): void {
  const doc = document as VTDoc;
  const el = from instanceof HTMLElement ? from : null;
  if (!el || !doc.startViewTransition || prefersReducedMotion() || document.visibilityState !== 'visible' || document.querySelector('[role="dialog"]')) {
    open();
    return;
  }
  el.style.setProperty('view-transition-name', 'morph');
  document.documentElement.classList.add('morphing');
  let done = false;
  const run = (morph: boolean) => {
    if (done) return;
    done = true;
    el.style.removeProperty('view-transition-name');
    pending = morph;
    flushSync(open);
    pending = false;
  };
  try {
    const t = doc.startViewTransition(() => run(true));
    void t.finished.finally(() => document.documentElement.classList.remove('morphing'));
    // Jos selain ei piirrä (esim. ikkuna taustalla), paneeli avataan heti ilman morfia.
    window.setTimeout(() => {
      if (done) return;
      t.skipTransition?.();
      run(false);
      document.documentElement.classList.remove('morphing');
    }, 300);
  } catch {
    el.style.removeProperty('view-transition-name');
    document.documentElement.classList.remove('morphing');
    open();
  }
}

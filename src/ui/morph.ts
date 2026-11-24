// Kortista avautuva paneeli (SPEC 16). 24.11.2026 (käyttäjän havainto: päiväkortin rivin avaus tökki): aiempi
// View Transitions -morfi kuvasi koko sivun kahdesti ja laski kaikkien elementtien tyylit uudelleen, mikä jähmetti
// näkymän puhelimella 100–180 ms ennen liikettä. Nyt paneeli avautuu heti, ja PC:llä se kasvaa napautetun rivin
// kohdalta (transform-origin; liike näytönohjaimella, ei pääsäikeellä).

import { prefersReducedMotion } from './motion';

let origin: { x: number; y: number } | null = null;

/** Sheet kysyy avautuessaan napautuksen kohdan (kerran). */
export function takeMorphOrigin(): { x: number; y: number } | null {
  const o = origin;
  origin = null;
  return o;
}

export function morphOpen(from: EventTarget | Element | null, open: () => void): void {
  const el = from instanceof HTMLElement ? from : null;
  if (el && !prefersReducedMotion() && !document.querySelector('[role="dialog"]')) {
    const r = el.getBoundingClientRect();
    origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    // Jos paneeli ei avautunut (esim. sama kerta jo auki), kohta ei jää seuraavalle paneelille.
    requestAnimationFrame(() => (origin = null));
  }
  open();
}

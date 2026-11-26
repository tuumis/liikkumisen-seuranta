// Pienennetty sivupalkki (27.11.2026): kuvakepainikkeen nimi oikealla, kun hiiri on painikkeen päällä tai painike
// on valittu näppäimistöllä. Painikkeessa on oma aria-label; vihje on vain näkyvä toisto.

import type { ReactNode } from 'react';

/** Pienennetyn sivupalkin kuvakepainike (käytä yhdessä SideTip-vihjeen kanssa). */
export const SIDE_MINI_BTN =
  'press group relative flex size-11 items-center justify-center rounded-2xl text-[var(--side-ink-soft)] hover:bg-white/[0.06] hover:text-white';

export function SideTip({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-full top-1/2 z-30 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[var(--side-from)] px-2.5 py-1 text-xs font-semibold text-[var(--side-ink)] opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}

import { useState } from 'react';
import { enterDemo, exitDemo } from './demoMode';
import { IconSparkle } from '../ui/icons';
import { SideTip } from '../ui/SideTip';

/** Esimerkkitilan palkki näkymän yläreunassa: kertoo, että tiedot ovat keksittyjä, ja Poistu palaa omiin tietoihin. */
export function DemoBanner() {
  return (
    <div role="status" data-demo-banner className="mb-4 flex items-center gap-3 rounded-2xl bg-amber-50 py-2 pl-4 pr-2 text-sm text-amber-950 ring-1 ring-amber-200 lg:mb-6">
      <IconSparkle size="1.15rem" className="shrink-0 text-amber-700" />
      <span className="min-w-0 flex-1 leading-snug">
        <b>Esimerkkitila.</b> Tiedot ovat keksittyjä. Voit kokeilla kaikkea, omat tietosi eivät muutu.
      </span>
      <button type="button" onClick={exitDemo} className="press min-h-10 shrink-0 rounded-full bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-950">
        Poistu
      </button>
    </div>
  );
}

/** PC:n sivupalkki (24.11.2026): esimerkkitilan merkintä ja Poistu aina näkyvissä yläpalkin sijaan. */
/** Pienennetyssä palkissa merkki; painallus suurentaa palkin, jossa on Poistu esimerkistä. */
export function DemoSidebar({ mini = false, onExpand }: { mini?: boolean; onExpand?: () => void }) {
  if (mini)
    return (
      <button
        type="button"
        onClick={onExpand}
        className="press group relative flex size-11 items-center justify-center rounded-2xl bg-white/[0.06] text-[var(--hero-accent)] ring-1 ring-white/10 hover:bg-white/[0.1]"
        aria-label="Esimerkkitila: tiedot ovat keksittyjä. Suurenna valikko poistuaksesi."
      >
        <IconSparkle size="1.2rem" />
        <SideTip>Esimerkkitila</SideTip>
      </button>
    );
  return (
    <div role="status" className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--side-ink)]">
        <IconSparkle size="1.05rem" className="shrink-0 text-[var(--hero-accent)]" />
        Esimerkkitila
      </div>
      <p className="mt-1 text-xs leading-snug text-[var(--side-ink-soft)]">Tiedot ovat keksittyjä. Omat tietosi eivät muutu.</p>
      <button
        type="button"
        onClick={exitDemo}
        className="press mt-2.5 min-h-9 w-full rounded-xl bg-[var(--hero-accent)] px-3 text-sm font-bold text-[var(--side-from)] hover:brightness-105"
      >
        Poistu esimerkistä
      </button>
    </div>
  );
}

/** Esimerkkitilaan siirtyminen (aloitus ja Asetukset); painike näyttää valmistelun ajan tilan. */
export function useEnterDemo(): [busy: boolean, start: () => void] {
  const [busy, setBusy] = useState(false);
  return [
    busy,
    () => {
      setBusy(true);
      void enterDemo().catch(() => setBusy(false));
    },
  ];
}

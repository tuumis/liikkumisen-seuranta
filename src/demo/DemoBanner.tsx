import { useState } from 'react';
import { enterDemo, exitDemo } from './demoMode';
import { IconSparkle } from '../ui/icons';

/** Esimerkkitilan palkki näkymän yläreunassa: kertoo, että tiedot ovat keksittyjä, ja Poistu palaa omiin tietoihin. */
export function DemoBanner() {
  return (
    <div role="status" className="mb-4 flex items-center gap-3 rounded-2xl bg-amber-50 py-2 pl-4 pr-2 text-sm text-amber-950 ring-1 ring-amber-200 lg:mb-6">
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

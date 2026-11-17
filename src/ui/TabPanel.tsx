import { Activity, useLayoutEffect, useRef, type ReactNode } from 'react';
import Dexie from 'dexie';
import { hideUntilSettled } from './settle';

// Piilotetut välilehdet (17.11.2026): kerran avattu välilehti pysyy muistissa, mutta piilossa ollessaan sen
// live-kyselyt ja laskenta pysähtyvät (React Activity). Muuten jokainen tietokannan muutos laskisi uudelleen
// myös näkymättömät välilehdet (esim. raskaan Analyysin), mikä voi nykiä käyttöä.

/** Tietokannan muutosten laskuri: kertoo, muuttuiko jokin välilehden ollessa piilossa. */
let mutations = 0;
Dexie.on('storagemutated', () => {
  mutations += 1;
});

/**
 * Välilehden sisältö. Palatessa sisältö näkyy heti, jos mikään ei muuttunut. Jos profiili vaihtui tai
 * tietokanta muuttui piilossa olon aikana, vanhat luvut eivät välähdä: sisältö tuodaan näkyviin kerralla,
 * kun päivitetyt tiedot ovat valmiit (ui/settle).
 */
export function TabPanel({ active, contextKey, children }: { active: boolean; contextKey?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const hiddenAt = useRef<{ key?: string; mutations: number } | null>(null);
  const keyRef = useRef(contextKey);
  keyRef.current = contextKey;
  useLayoutEffect(() => {
    if (!active) {
      hiddenAt.current = { key: keyRef.current, mutations };
      return;
    }
    const h = hiddenAt.current;
    hiddenAt.current = null;
    if (!h || !ref.current || (h.key === keyRef.current && h.mutations === mutations)) return;
    return hideUntilSettled(ref.current);
  }, [active]);
  return (
    <div ref={ref} hidden={!active} className="settle">
      <Activity mode={active ? 'visible' : 'hidden'}>{children}</Activity>
    </div>
  );
}

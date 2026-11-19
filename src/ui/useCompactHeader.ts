// Puhelimen yläpalkki pienenee vieritettäessä (19.11.2026, puhelinkäytön läpikäynti kohta 8):
// alaspäin vieritettäessä sovelluksen nimirivi piiloutuu (profiilisirut jäävät), ylöspäin vieritettäessä
// ja sivun alussa palkki palaa täyteen kokoon. Pieni kynnys estää värinän pienissä liikkeissä.

import { useEffect, useState } from 'react';

const TOP = 80; // tätä ylempänä palkki on aina täysi
const DOWN = 24; // alaspäin näin paljon yhtäjaksoisesti: pienennä
const UP = 40; // ylöspäin näin paljon: palauta
const JUMP = 400; // yhden ruudun aikana tätä suurempi siirto ei muuta palkkia

export function useCompactHeader(): boolean {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let acc = 0;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        // Paneeli auki: sivu on lukittu (body kiinnitetty), vierityskohta ei ole todellinen.
        if (document.body.style.position === 'fixed') return;
        const y = window.scrollY;
        const d = y - lastY;
        lastY = y;
        if (y < TOP) {
          acc = 0;
          setCompact(false);
          return;
        }
        if (!d) return;
        // Iso hyppy kerralla on ohjelman tekemä siirto (esim. välilehden vaihto), ei käyttäjän vieritys.
        if (Math.abs(d) > JUMP) {
          acc = 0;
          return;
        }
        if (Math.sign(d) !== Math.sign(acc)) acc = 0;
        acc += d;
        if (acc > DOWN) setCompact(true);
        else if (acc < -UP) setCompact(false);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return compact;
}

// Liikkeen apurit: numerolaskuri ja "näkyvissä"-tila sisääntuloille. Kunnioittaa
// prefers-reduced-motion-asetusta (arvo näytetään heti).

import { useEffect, useRef, useState } from 'react';

export const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Laskee näytettävän luvun sulavasti edellisestä arvosta uuteen (oletus 900 ms). */
export function useCountUp(target: number, ms = 900): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const from = useRef(value);
  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(target)) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const v = a + (target - a) * easeOut(t);
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, ms]);
  return value;
}

/** true seuraavalla ruudunpäivityksellä: CSS-siirtymät käynnistyvät nollasta (esim. renkaat, palkit). */
export function useMounted(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return on;
}

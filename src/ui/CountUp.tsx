// Luku, joka laskee sulavasti edellisestä arvosta uuteen (24.11.2026). Kirjoittaa tekstin suoraan elementtiin
// joka ruudulla eikä piirrä ympäröivää korttia uudelleen (aiempi useCountUp piirsi koko viikon yhteenvedon
// 60–120 kertaa sekunnissa, mikä vei puhelimella pääsäikeen muulta liikkeeltä).

import { useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from './motion';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({ value, format, ms = 900 }: { value: number; format: (n: number) => string; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef<number | null>(null);
  const fmt = useRef(format);
  fmt.current = format;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const a = from.current ?? (prefersReducedMotion() ? value : 0);
    if (prefersReducedMotion() || !Number.isFinite(value) || a === value) {
      el.textContent = fmt.current(value);
      from.current = value;
      return;
    }
    el.textContent = fmt.current(a);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      el.textContent = fmt.current(a + (value - a) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
      el.textContent = fmt.current(value);
    };
  }, [value, ms]);
  return <span ref={ref} />;
}

// Selite: näkyy hiiren ollessa päällä (PC) ja avautuu napautuksella (puhelin). Sulkeutuu
// napautuksella muualle tai Esc-näppäimellä. Piirretään <body>-elementtiin (portaali, kiinteä sijainti),
// jotta kortin pyöristys tai overflow ei leikkaa sitä eikä se peri ympäristön tekstityyliä
// (esim. isot kirjaimet). Sijoittuu painikkeen alle, tai yläpuolelle, jos tila loppuu.

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const WIDTH = 256;
const GAP = 8;

export function InfoTip({ children, tip, className = '', align = 'right' }: { children: ReactNode; tip: ReactNode; className?: string; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const id = useId();
  const shown = open || hover;

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setOpen(false);
        return;
      }
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !tipRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  // Sijainti näkymän koordinaateissa; päivittyy vierityksessä ja koon muuttuessa.
  useLayoutEffect(() => {
    if (!shown) return setPos(null);
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const vw = document.documentElement.clientWidth;
      const h = tipRef.current?.offsetHeight ?? 0;
      let left = align === 'right' ? r.right - WIDTH : r.left;
      left = Math.max(GAP, Math.min(left, vw - WIDTH - GAP));
      let top = r.bottom + GAP;
      if (h && top + h > window.innerHeight - GAP && r.top - GAP - h > GAP) top = r.top - GAP - h;
      setPos({ left, top });
    };
    place();
    // toinen kierros, kun selitteen korkeus tunnetaan
    const raf = requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [shown, align]);

  return (
    <span ref={ref} className="relative inline-flex" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        className={`-my-2 inline-flex min-h-9 cursor-help items-center gap-1 rounded-lg py-2 decoration-slate-400 decoration-dotted underline-offset-4 hover:underline ${className}`}
        aria-describedby={shown ? id : undefined}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {children}
      </button>
      {shown &&
        createPortal(
          <span
            ref={tipRef}
            id={id}
            role="tooltip"
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: WIDTH }}
            className="anim-pop pointer-events-auto fixed z-[70] block rounded-2xl bg-[var(--toast-bg)] p-3 text-left text-xs font-medium normal-case leading-relaxed tracking-normal text-[#f6f5f0] shadow-xl ring-1 ring-white/10"
          >
            {tip}
          </span>,
          document.body,
        )}
    </span>
  );
}

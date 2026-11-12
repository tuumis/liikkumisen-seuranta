// Selite: näkyy hiiren ollessa päällä (PC) ja avautuu napautuksella (puhelin). Sulkeutuu
// napautuksella muualle tai Esc-näppäimellä.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export function InfoTip({ children, tip, className = '', align = 'right' }: { children: ReactNode; tip: ReactNode; className?: string; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  const shown = open || hover;
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
      {shown && (
        <span
          id={id}
          role="tooltip"
          className={`anim-pop absolute top-full z-30 mt-2 w-64 rounded-2xl bg-[var(--toast-bg)] p-3 text-left text-xs font-medium leading-relaxed text-[#f6f5f0] shadow-xl ring-1 ring-white/10 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {tip}
        </span>
      )}
    </span>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './icons';
import { takeMorph } from './morph';

// Taustan vierityksen lukitus, joka toimii myös iPhonessa (overflow: hidden ei siellä riitä):
// body kiinnitetään paikalleen nykyiseen vierityskohtaan ja palautetaan suljettaessa.
// Laskuri sallii sisäkkäiset paneelit (esim. kerran muokkaus suunnitelmapaneelin päällä).
let locks = 0;
let savedY = 0;
function lockScroll() {
  if (locks++ > 0) return;
  savedY = window.scrollY;
  const b = document.body.style;
  b.position = 'fixed';
  b.top = `-${savedY}px`;
  b.left = '0';
  b.right = '0';
  b.width = '100%';
  b.overflow = 'hidden';
}
function unlockScroll() {
  if (--locks > 0) return;
  locks = 0;
  const b = document.body.style;
  b.position = b.top = b.left = b.right = b.width = b.overflow = '';
  window.scrollTo(0, savedY);
}

/**
 * Alapaneeli (bottom sheet). Piirretään suoraan <body>-elementtiin (portaali), jotta se on aina
 * alapalkin ja muun sisällön päällä. Sulkeutuu taustan napautuksella ja Esc-näppäimellä.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  // Avautuu morfina napautetusta kortista (morphOpen); muuten tavallinen nousu.
  const wasOpen = useRef(false);
  const morph = useRef(false);
  if (open && !wasOpen.current) morph.current = takeMorph();
  if (!open) morph.current = false;
  wasOpen.current = open;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', onKey);
    panel.current?.focus({ preventScroll: true });
    lockScroll();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlockScroll();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6" role="presentation">
      <div className="anim-fade absolute inset-0 bg-[#1a2520]/45 backdrop-blur-[2px] dark:bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={morph.current ? { viewTransitionName: 'morph' } : undefined}
        className={`${morph.current ? '' : 'anim-sheet'} relative flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-[var(--surface)] shadow-xl focus:outline-none lg:rounded-[2rem]`}
      >
        {/* Otsikko pysyy paikallaan; vain sisältö vierii (ohut palkki pyöristettyjen kulmien sisällä). */}
        <div className="shrink-0 px-5 pt-3 lg:px-7 lg:pt-6">
          <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-300 lg:hidden" aria-hidden />
          <div className="flex items-center justify-between gap-2 pb-3">
            <h2 className="font-display text-xl font-semibold leading-tight text-slate-900">{title}</h2>
            <button type="button" onClick={onClose} className="press flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunk)] text-slate-600 hover:text-slate-900" aria-label="Sulje">
              <IconClose size="1.1rem" />
            </button>
          </div>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1 lg:px-7 lg:pb-7">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

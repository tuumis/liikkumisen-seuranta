import { useEffect, useLayoutEffect, useRef, type ReactNode, type TouchEvent } from 'react';
import { useBackClose } from './backClose';
import { createPortal } from 'react-dom';
import { IconClose } from './icons';
import { takeMorphOrigin } from './morph';

// Taustan vierityksen lukitus, joka toimii myös iPhonessa (overflow: hidden ei siellä riitä):
// body kiinnitetään paikalleen nykyiseen vierityskohtaan ja palautetaan suljettaessa.
// Laskuri sallii sisäkkäiset paneelit (esim. kerran muokkaus suunnitelmapaneelin päällä).
let locks = 0;
let savedY = 0;
/** Edellisen paneelin sulkemishetki: paneelista toiseen siirryttäessä tumma tausta ei häivy uudelleen esiin. */
let lastCloseAt = -Infinity;
export function lockScroll() {
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
export function unlockScroll() {
  if (--locks > 0) return;
  locks = 0;
  const b = document.body.style;
  b.position = b.top = b.left = b.right = b.width = b.overflow = '';
  window.scrollTo(0, savedY);
}

/**
 * Alapaneeli (bottom sheet). Piirretään suoraan <body>-elementtiin (portaali), jotta se on aina
 * alapalkin ja muun sisällön päällä. Sulkeutuu taustan napautuksella, Esc-näppäimellä, puhelimen
 * takaisin-eleellä ja vetämällä yläosasta (kahva ja otsikkorivi) alas (19.11.2026).
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  // Kortista avattuna (morphOpen) paneeli kasvaa PC:llä napautetun rivin kohdalta; muuten tavallinen nousu.
  const wasOpen = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  if (open && !wasOpen.current) origin.current = takeMorphOrigin();
  if (!open) origin.current = null;
  wasOpen.current = open;
  useBackClose(open, onClose);

  // Avausanimaatio käynnistyy vasta, kun paneeli on piirretty ensimmäisen kerran (19.11.2026, käyttäjän havainto:
  // avautuminen ja taustan himmennys töksähtivät). Raskaan sisällön rakentaminen ei näin vie animaation alkua.
  const scrim = useRef<HTMLDivElement>(null);
  // Sulkemishetki kirjataan asettelun vaiheessa, joten saman päivityksen aikana avautuva paneeli näkee sen.
  useLayoutEffect(() => {
    if (!open) return;
    return () => {
      lastCloseAt = performance.now();
    };
  }, [open]);
  const hold = useRef(false);
  const shownOnce = useRef(false);
  if (open && !shownOnce.current) {
    shownOnce.current = true;
    hold.current = true;
  }
  if (!open) shownOnce.current = hold.current = false;
  useLayoutEffect(() => {
    if (!open || !hold.current) return;
    // Paneelista toiseen (24.11.2026, käyttäjän havainto: ruutu välähtää): edellinen tausta katosi heti ja uusi
    // häivytettiin läpinäkyvästä, jolloin sivu näkyi hetken täysin kirkkaana. Nyt tausta pysyy tummana.
    if (performance.now() - lastCloseAt < 300) scrim.current?.classList.add('scrim-instant');
    const o = origin.current;
    if (o && panel.current) {
      const r = panel.current.getBoundingClientRect();
      const x = Math.min(r.width, Math.max(0, o.x - r.left));
      const y = Math.min(r.height, Math.max(0, o.y - r.top));
      panel.current.style.transformOrigin = `${Math.round(x)}px ${Math.round(y)}px`;
    }
    let r2 = 0;
    const release = () => {
      hold.current = false;
      panel.current?.classList.remove('anim-hold');
      scrim.current?.classList.remove('anim-hold');
    };
    const r1 = requestAnimationFrame(() => (r2 = requestAnimationFrame(release)));
    // Varmistus: jos ruutua ei piirretä (esim. välilehti taustalla), paneeli näytetään silti.
    const t = window.setTimeout(release, 400);
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      window.clearTimeout(t);
    };
  }, [open]);

  // Alas vetäminen yläosasta: paneeli seuraa sormea; riittävän pitkä tai nopea veto sulkee.
  const drag = useRef<{ y0: number; dy: number; lastY: number; lastT: number; v: number } | null>(null);
  const onDragStart = (e: TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const y = e.touches[0].clientY;
    drag.current = { y0: y, dy: 0, lastY: y, lastT: performance.now(), v: 0 };
    if (panel.current) {
      panel.current.style.transition = 'none';
      // Avausanimaatio pitää loppuarvonsa (index.css, fill both), joten se poistetaan, jotta veto voi siirtää paneelia.
      panel.current.style.animation = 'none';
    }
  };
  const onDragMove = (e: TouchEvent) => {
    const d = drag.current;
    const el = panel.current;
    if (!d || !el) return;
    const y = e.touches[0].clientY;
    const now = performance.now();
    d.v = (y - d.lastY) / Math.max(1, now - d.lastT);
    d.lastY = y;
    d.lastT = now;
    d.dy = Math.max(0, y - d.y0);
    el.style.transform = d.dy ? `translateY(${d.dy}px)` : '';
  };
  const onDragEnd = () => {
    const d = drag.current;
    const el = panel.current;
    drag.current = null;
    if (!d || !el) return;
    if (d.dy > 110 || (d.dy > 24 && d.v > 0.5)) {
      el.style.transition = 'transform 0.18s ease-in';
      el.style.transform = 'translateY(100%)';
      window.setTimeout(() => close.current(), 170);
    } else {
      el.style.transition = 'transform 0.22s var(--ease-out)';
      el.style.transform = '';
    }
  };

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
      <div ref={scrim} className={`scrim absolute inset-0 ${hold.current ? 'anim-hold' : ''}`} onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`anim-sheet ${origin.current ? 'from-origin' : ''} ${hold.current ? 'anim-hold' : ''} relative flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-[var(--surface)] shadow-xl focus:outline-none lg:rounded-[2rem]`}
      >
        {/* Otsikko pysyy paikallaan; vain sisältö vierii (ohut palkki pyöristettyjen kulmien sisällä). */}
        <div className="shrink-0 touch-none px-5 pt-3 lg:touch-auto lg:px-7 lg:pt-6" onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd} onTouchCancel={onDragEnd}>
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

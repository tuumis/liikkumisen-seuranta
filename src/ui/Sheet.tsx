import { useEffect, useLayoutEffect, useRef, type ReactNode, type TouchEvent } from 'react';
import { useBackClose } from './backClose';
import { createPortal } from 'react-dom';
import { IconClose } from './icons';
import { takeMorphOrigin } from './morph';
import { prefersReducedMotion } from './motion';

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
 * PC:llä (lg, 27.11.2026) sivupaneeli ruudun oikeassa reunassa koko korkeudelta: näkymä jää vasemmalle
 * näkyviin kevyemmän taustan alle.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  // Kortista avattu alkuperä (ui/morph.ts) kulutetaan, vaikka sivupaneeli (27.11.2026) ei sitä enää käytä:
  // muuten vanha alkuperä jäisi seuraavalle paneelille.
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) takeMorphOrigin();
  wasOpen.current = open;
  useBackClose(open, onClose);

  const scrim = useRef<HTMLDivElement>(null);
  // Sulkemishetki kirjataan asettelun vaiheessa, joten saman päivityksen aikana avautuva paneeli näkee sen.
  useLayoutEffect(() => {
    if (!open) return;
    return () => {
      lastCloseAt = performance.now();
    };
  }, [open]);

  // Avausanimaatio (24.11.2026, käyttäjän videot PC:ltä: paneeli välähti pois animaation lopussa ja jäi välillä
  // kokonaan näkymättömäksi tumman taustan alle). Aiempi CSS-animaatio pidettiin ensin pysäytettynä ja jätettiin
  // lopuksi voimaan; näytönohjaimen ja pääsäikeen tilat pääsivät eroamaan. Nyt animaatio käynnistetään
  // JavaScriptillä (Web Animations): se alkaa vasta, kun ensimmäinen ruutu on piirretty (raskas sisältö ei vie
  // alkua), pitää loppuarvon siihen asti, kun pääsäie ehtii mukaan, ja poistetaan sitten kokonaan. Paneeli ei
  // siis voi jäädä animaation alkutilaan, ja suljettaessa kesken animaation se perutaan.
  const anim = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const p = panel.current;
    const s = scrim.current;
    if (!open || !p || !s || typeof p.animate !== 'function' || prefersReducedMotion()) return;
    const desktop = window.matchMedia?.('(min-width: 1024px)').matches;
    // PC: sivupaneeli liukuu oikealta; puhelin: nousee alhaalta.
    const from = desktop ? 'translateX(40px)' : 'translateY(24px)';
    const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const list: Animation[] = [];
    const a = p.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }], { duration: 350, easing: ease, fill: 'forwards' });
    anim.current = a;
    list.push(a);
    // Paneelista toiseen (esim. kerran muokkaus suunnitelman päältä) tausta pysyy tummana: ei uutta häivytystä.
    if (performance.now() - lastCloseAt >= 300) list.push(s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: ease, fill: 'forwards' }));
    for (const x of list) x.finished.then(() => x.cancel(), () => undefined);
    // Varmistus: jos selain ei piirrä ruutuja (esim. ikkuna piilossa), animaatio ei käynnisty, ja paneeli jäisi
    // alkutilaan. Silloin se viedään loppuun, jolloin paneeli ja tausta näkyvät joka tapauksessa.
    const guard = window.setTimeout(() => {
      for (const x of list) if (x.playState !== 'finished' && x.playState !== 'idle') x.finish();
    }, 700);
    return () => {
      window.clearTimeout(guard);
      anim.current = null;
      for (const x of list) x.cancel();
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
      // Kesken oleva avausanimaatio perutaan, jotta veto voi siirtää paneelia.
      anim.current?.cancel();
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
    <div className="sheet-wrap fixed inset-0 z-50 flex items-end justify-center lg:items-stretch lg:justify-end lg:p-3" role="presentation">
      <div ref={scrim} className="scrim sheet-scrim absolute inset-0" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-[var(--surface)] shadow-xl focus:outline-none lg:max-h-none lg:rounded-[1.75rem]`}
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

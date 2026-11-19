// Pyyhkäisykuittaus (19.11.2026, puhelinkäytön läpikäynti kohta 7): suunnitelmarivin pyyhkäisy oikealle
// kuittaa tehdyksi, vasemmalle avaa "Ei tehty" -valinnan. Painikkeet (✓ / ✕) toimivat ennallaan; pyyhkäisy on
// lisäreitti kosketusnäytölle. Rivin oma pyyhkäisy ei vaihda päivää (tapahtuma ei kulje päiväkortille).

import { useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from 'react';

export interface SwipeAction {
  label: string;
  icon: ReactNode;
  tone: 'green' | 'red';
  run: () => void;
}

const TONE = {
  green: 'bg-green-700 text-white',
  red: 'bg-red-700 text-white',
};

export function SwipeRow({
  right,
  left,
  className = '',
  innerClassName = '',
  children,
}: {
  /** Pyyhkäisy oikealle. */
  right?: SwipeAction;
  /** Pyyhkäisy vasemmalle. */
  left?: SwipeAction;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLLIElement>(null);
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState(false);
  const gesture = useRef<{ x0: number; y0: number; dir: 'h' | 'v' | null; passed: boolean } | null>(null);
  const dragged = useRef(false);
  const active = !!(right || left);
  const threshold = () => Math.min(110, (root.current?.offsetWidth ?? 300) * 0.35);

  const onStart = (e: TouchEvent) => {
    if (!active) return;
    e.stopPropagation();
    gesture.current = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, dir: null, passed: false };
    dragged.current = false;
    setSettling(false);
  };
  const onMove = (e: TouchEvent) => {
    const g = gesture.current;
    if (!g) return;
    const x = e.touches[0].clientX - g.x0;
    const y = e.touches[0].clientY - g.y0;
    if (!g.dir) {
      if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
      g.dir = Math.abs(x) > Math.abs(y) ? 'h' : 'v';
    }
    if (g.dir !== 'h') return;
    e.stopPropagation();
    dragged.current = true;
    const v = (x > 0 && !right) || (x < 0 && !left) ? 0 : x;
    const passed = Math.abs(v) >= threshold();
    if (passed !== g.passed) {
      g.passed = passed;
      if (passed) navigator.vibrate?.(10);
    }
    setDx(v);
  };
  const onEnd = (e: TouchEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    e.stopPropagation();
    setSettling(true);
    const side = dx > 0 ? right : dx < 0 ? left : undefined;
    if (g.dir !== 'h' || !g.passed || !side) {
      setDx(0);
      return;
    }
    if (dx > 0) {
      // Kuittaus: rivi liukuu loppuun, sitten toiminto (rivi poistuu omalla animaatiollaan).
      setDx(root.current?.offsetWidth ?? 400);
      window.setTimeout(() => {
        side.run();
        window.setTimeout(() => setDx(0), 600);
      }, 170);
    } else {
      setDx(0);
      side.run();
    }
  };
  // Vedon jälkeen selain voi vielä lähettää napautuksen: se ei saa avata riviä.
  const onClickCapture = (e: MouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const side = dx > 0 ? right : dx < 0 ? left : undefined;
  const passed = Math.abs(dx) >= threshold();
  return (
    <li
      ref={root}
      className={`relative touch-pan-y ${dx ? 'overflow-hidden' : ''} ${className}`}
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
      onClickCapture={onClickCapture}
    >
      {side && (
        <div
          aria-hidden
          className={`absolute inset-y-0 flex items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-[inherit] text-sm font-semibold transition-opacity ${
            dx > 0 ? 'left-0 justify-start pl-4' : 'right-0 justify-end pr-4'
          } ${TONE[side.tone]} ${passed ? '' : 'opacity-70'}`}
          style={{ width: Math.abs(dx) }}
        >
          {side.icon}
          {side.label}
        </div>
      )}
      <div className={innerClassName} style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: settling ? 'transform 0.2s var(--ease-out)' : 'none' }}>
        {children}
      </div>
    </li>
  );
}

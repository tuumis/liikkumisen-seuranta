import { useRef, type PointerEvent, type MouseEvent } from 'react';

/**
 * Pitkä painallus (500 ms) kosketuksella tai hiirellä; työpöydällä myös
 * hiiren oikea painike. Liike yli 10 px peruu (vieritys). Palauttaa
 * elementille annettavat käsittelijät ja `consumed()`-tarkistuksen, jolla
 * tavallinen napautus ohitetaan heti pitkän painalluksen jälkeen.
 */
export function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };

  return {
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        if (e.button !== 0) return;
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          fired.current = true;
          start.current = null;
          navigator.vibrate?.(20);
          onLongPress();
        }, ms);
      },
      onPointerMove: (e: PointerEvent) => {
        const s = start.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e: MouseEvent) => {
        e.preventDefault();
        cancel();
        fired.current = true;
        onLongPress();
      },
    },
    /** true, jos viimeisin painallus laukaisi pitkän painalluksen (nollautuu luettaessa). */
    consumed: () => {
      const f = fired.current;
      fired.current = false;
      return f;
    },
  };
}

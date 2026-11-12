// Juuri luodut rivit (SPEC 16, kuittauksen palaute): rivi välähtää ja saa valintamerkin, kun se
// ilmestyy listaan kuittauksen tai pikalisäyksen jälkeen. Muistissa vain hetken; ei tallenneta.

import { useState } from 'react';
import { prefersReducedMotion } from './motion';

const fresh = new Map<string, number>();
const TTL = 2500;

export function markFresh(...ids: string[]): void {
  const now = Date.now();
  for (const id of ids) fresh.set(id, now);
}

/** true, jos rivi luotiin juuri (alle 2,5 s sitten). */
export function isFresh(id: string): boolean {
  const t = fresh.get(id);
  if (t === undefined) return false;
  if (Date.now() - t > TTL) {
    fresh.delete(id);
    return false;
  }
  return true;
}

/**
 * Kuittauksen palaute: suunnitelma painuu pois (240 ms) ennen kuin kuittaus tehdään ja kerta ilmestyy tilalle.
 * "Vähennä liikettä" → kuittaus heti.
 */
export function useConfirmFeedback<P extends { id: string }>(onConfirm: (p: P) => void) {
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set());
  const confirm = (p: P) => {
    if (prefersReducedMotion()) return onConfirm(p);
    navigator.vibrate?.(15);
    setLeaving((cur) => new Set(cur).add(p.id));
    window.setTimeout(() => {
      onConfirm(p);
      setLeaving((cur) => {
        const n = new Set(cur);
        n.delete(p.id);
        return n;
      });
    }, 240);
  };
  return { leaving, confirm };
}

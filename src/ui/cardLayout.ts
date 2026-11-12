// Muokattava korttinäkymä (Viikko, Analyysi): käyttäjä valitsee näkyvät kortit, järjestyksen ja PC:llä
// palstan. Laitekohtainen asetus (localStorage); uudet kortit tulevat myöhemmissä versioissa loppuun.

import { useState, useSyncExternalStore } from 'react';

export interface CardDef<Id extends string> {
  id: Id;
  title: string;
  text: string;
  /** Aina näkyvissä (esim. Viikon päivät); järjestystä voi silti muuttaa. */
  locked?: boolean;
  /** Oletuksena PC:n sivupalstassa. */
  side?: boolean;
}

export interface CardLayout<Id extends string> {
  order: Id[];
  hidden: Id[];
  /** PC:n sivupalstan kortit (vain näkymissä, joissa on palstat). */
  side: Id[];
}

export interface CardLayoutApi<Id extends string> {
  cards: CardDef<Id>[];
  layout: CardLayout<Id>;
  visible: Id[];
  toggle: (id: Id) => void;
  move: (id: Id, dir: -1 | 1) => void;
  setSide: (id: Id, side: boolean) => void;
  reset: () => void;
}

function defaults<Id extends string>(cards: CardDef<Id>[], hidden: Id[]): CardLayout<Id> {
  return { order: cards.map((c) => c.id), hidden, side: cards.filter((c) => c.side).map((c) => c.id) };
}

function read<Id extends string>(key: string, cards: CardDef<Id>[], hidden: Id[]): CardLayout<Id> {
  const def = defaults(cards, hidden);
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<CardLayout<Id>> | null;
    if (!v || !Array.isArray(v.order)) return def;
    const known = new Set(cards.map((c) => c.id));
    const order = v.order.filter((id) => known.has(id));
    const hiddenStored = (v.hidden ?? []).filter((id) => known.has(id));
    const side = Array.isArray(v.side) ? v.side.filter((id) => known.has(id)) : def.side;
    // Uudet kortit (myöhemmät versiot) edeltäjänsä perään; oletuspalsta ja -piilotus säilyvät myös vanhoilla asetuksilla.
    cards.forEach((c, i) => {
      if (order.includes(c.id)) return;
      const prev = i > 0 ? order.indexOf(cards[i - 1].id) : -1;
      order.splice(prev + 1, 0, c.id);
      if (hidden.includes(c.id)) hiddenStored.push(c.id);
      if (c.side && Array.isArray(v.side)) side.push(c.id);
    });
    return { order, hidden: hiddenStored, side };
  } catch {
    return def;
  }
}

export function useCardLayout<Id extends string>(key: string, cards: CardDef<Id>[], defaultHidden: Id[] = []): CardLayoutApi<Id> {
  const [layout, setLayout] = useState(() => read(key, cards, defaultHidden));
  const locked = new Set(cards.filter((c) => c.locked).map((c) => c.id));
  const save = (next: CardLayout<Id>) => {
    setLayout(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ei tallennusta */
    }
  };
  return {
    cards,
    layout,
    visible: layout.order.filter((id) => locked.has(id) || !layout.hidden.includes(id)),
    toggle: (id) => {
      if (locked.has(id)) return;
      save({ ...layout, hidden: layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id] });
    },
    move: (id, dir) => {
      const order = [...layout.order];
      const i = order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      save({ ...layout, order });
    },
    setSide: (id, side) => save({ ...layout, side: side ? [...layout.side.filter((x) => x !== id), id] : layout.side.filter((x) => x !== id) }),
    reset: () => save(defaults(cards, defaultHidden)),
  };
}

/** Mediakysely React-tilana (esim. PC-leveys), päivittyy ikkunan koon muuttuessa. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia?.(query);
      m?.addEventListener('change', cb);
      window.addEventListener('resize', cb);
      return () => {
        m?.removeEventListener('change', cb);
        window.removeEventListener('resize', cb);
      };
    },
    () => !!window.matchMedia?.(query).matches,
    () => false,
  );
}

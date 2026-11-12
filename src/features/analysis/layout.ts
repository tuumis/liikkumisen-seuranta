// Analyysin kortit: käyttäjä valitsee näkyvät kortit ja niiden järjestyksen (laitekohtainen).

import { useState } from 'react';

export type AnalysisCardId = 'goals' | 'daily' | 'gauge' | 'hours' | 'highlights' | 'football' | 'categories' | 'adherence' | 'quality';

export const ANALYSIS_CARDS: { id: AnalysisCardId; title: string; text: string }[] = [
  { id: 'goals', title: 'Tavoitteet', text: 'Suositusvertailu: reipas ja rasittava, rasittavat ja vahvistavat päivät' },
  { id: 'daily', title: 'Päivittäinen kaavio', text: 'Reipas ja rasittava liikunta päivittäin' },
  { id: 'gauge', title: 'Liikuntaa viikossa', text: 'Kokonaismäärä tunteina luokiteltuna (kouluikäiset)' },
  { id: 'hours', title: 'Viikon liikuntatunnit', text: 'Toteuma ja arvio koko viikolle, päivittäin ja kategorioittain' },
  { id: 'highlights', title: 'Kohokohdat', text: 'Kommentit ja yleisarvio suoritustasosta' },
  { id: 'football', title: 'Jalkapallo', text: 'Treenit, pelit, peliaika ja tulokset' },
  { id: 'categories', title: 'Jakauma kategorioittain', text: 'Mistä reipas ja rasittava liikunta kertyy' },
  { id: 'adherence', title: 'Suunnitelma vs. toteuma', text: 'Kuinka suunnitellut kerrat toteutuivat' },
  { id: 'quality', title: 'Datan laatu', text: 'Vertailtavat päivät, kattavuus ja arvion osuus' },
];

const DEFAULT: { order: AnalysisCardId[]; hidden: AnalysisCardId[] } = {
  order: ANALYSIS_CARDS.map((c) => c.id),
  hidden: ['quality'],
};
const KEY = 'analysisLayout';

function read(): typeof DEFAULT {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as typeof DEFAULT | null;
    if (!v || !Array.isArray(v.order)) return DEFAULT;
    const known = new Set(ANALYSIS_CARDS.map((c) => c.id));
    const order = v.order.filter((id) => known.has(id));
    // uudet kortit (myöhemmät versiot) loppuun
    for (const c of ANALYSIS_CARDS) if (!order.includes(c.id)) order.push(c.id);
    return { order, hidden: (v.hidden ?? []).filter((id) => known.has(id)) };
  } catch {
    return DEFAULT;
  }
}

export function useAnalysisLayout() {
  const [layout, setLayout] = useState(read);
  const save = (next: typeof DEFAULT) => {
    setLayout(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ei tallennusta */
    }
  };
  return {
    layout,
    toggle: (id: AnalysisCardId) => save({ ...layout, hidden: layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id] }),
    move: (id: AnalysisCardId, dir: -1 | 1) => {
      const order = [...layout.order];
      const i = order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      save({ ...layout, order });
    },
    reset: () => save(DEFAULT),
  };
}

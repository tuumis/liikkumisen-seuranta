// Tila ja sanoitus (SPEC 7.7). Kuvailevaa, ei arvostelevaa; ylärajaa ei näytetä.

import type { Measure, PeriodKind, Status } from '../domain/types';

const PERIOD_WORD: Record<PeriodKind, string> = {
  week: 'Tällä viikolla',
  month: 'Tässä kuussa',
  season: 'Tällä kaudella',
  year: 'Tänä vuonna',
};

/**
 * @param shortfallText puuttuvan määrän kuvaus near-tilassa, esim. "noin 8 min/pv".
 */
export function statusSentence(m: Measure, shortfallText: string, period: PeriodKind = 'week'): string {
  switch (m.status) {
    case 'met':
      return 'Suositus täyttyi';
    case 'near':
      return `Lähellä suositusta – puuttui ${shortfallText}`;
    case 'below':
      return `${PERIOD_WORD[period]} vähemmän kuin suositus`;
  }
}

/** "noin 8 min/pv" – pyöristetään ylöspäin kokonaisiin minuutteihin. */
export const aboutMinutes = (m: Measure, unit: string) => `noin ${Math.max(1, Math.ceil(m.shortfall - 1e-9))} ${unit}`;

export const STATUS_CLASS: Record<Status, string> = {
  met: 'bg-green-100 text-green-900',
  near: 'bg-amber-100 text-amber-900',
  below: 'bg-slate-100 text-slate-700',
};

/** Prosentti kokonaislukuna, esim. 0,234 → "23 %". */
export const percent = (x: number) => `${Math.round(x * 100)} %`;

/** Yksi desimaali, jos ei kokonaisluku: 63,33 → "63,3". */
export const num1 = (x: number) => (Number.isInteger(x) ? String(x) : (Math.round(x * 10) / 10).toString().replace('.', ','));

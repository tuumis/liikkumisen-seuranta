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
 * @param inProgress jakso on kesken (viimeinen päivä ei ole vielä alkanut): tila kertoo tahdin, ei
 *   täyttymistä – "Suositus täyttyi" vasta, kun jakson kaikki päivät ovat mukana (käyttäjän toive 17.11.2026).
 */
export function statusSentence(m: Measure, shortfallText: string, period: PeriodKind = 'week', inProgress = false): string {
  if (inProgress) return paceSentence(m, shortfallText);
  switch (m.status) {
    case 'met':
      return 'Suositus täyttyi';
    case 'near':
      return `Lähellä suositusta – puuttui ${shortfallText}`;
    case 'below':
      return `${PERIOD_WORD[period]} vähemmän kuin suositus`;
  }
}

/** Kesken olevan jakson tila: tahti suhteessa suositukseen. */
export function paceSentence(m: Measure, shortfallText: string): string {
  if (m.status === 'met') return 'Tahdissa suositukseen';
  if (m.status === 'near') return `Lähellä tahtia – puuttuu ${shortfallText}`;
  return 'Alle suosituksen tahdin';
}

/** Lyhyt tila merkkiin: valmis jakso "Suositus täyttyi", kesken oleva tahtina. */
export function statusShort(m: Measure, inProgress: boolean): string {
  if (inProgress) return m.status === 'met' ? 'Tahdissa' : m.status === 'near' ? 'Lähellä tahtia' : 'Alle tahdin';
  return m.status === 'met' ? 'Suositus täyttyi' : m.status === 'near' ? 'Lähellä' : 'Alle suosituksen';
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

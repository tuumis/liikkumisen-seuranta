// Aktiivisuuskartta (SPEC 16): vuoden päivät ruudukkona (sarakkeet = ISO-viikot, rivit = ma–su).
// Puhtaat apufunktiot: tasot mittarin mukaan, ruudukon rakenne, kuukausiotsikot ja pisin putki.

import { addDays, datesBetween, isoWeekday, parseISODate, startOfIsoWeek } from './dates';
import type { ISODate } from './types';

/** Mitä ruutu kuvaa: reipas+rasittava suhteessa päivän tavoitteeseen, kokonaisminuutit vai kertojen määrä. */
export type HeatMeasure = 'target' | 'minutes' | 'sessions';

/** Tasot 0–4: 0 = ei liikuntaa, 4 = eniten. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatDay {
  date: ISODate;
  /** Reipas + rasittava (min) valitulla arviotavalla. */
  mvpa: number;
  /** Kaikki liikunta (kevyt + reipas + rasittava, min). */
  total: number;
  /** Kirjatut kerrat (ei arkiliikunnan vahvistuksia). */
  sessions: number;
  /** Päivän tavoite (reipas + rasittava, min). */
  target: number;
}

/** Tason rajat näkyviin selitteeseen (tasot 1–4). */
export const LEVEL_LABELS: Record<HeatMeasure, [string, string, string, string]> = {
  target: ['alle 50 %', '50–99 %', 'tavoite', '150 %+'],
  minutes: ['1–30 min', '31–60 min', '61–90 min', 'yli 90 min'],
  sessions: ['1 kerta', '2 kertaa', '3 kertaa', '4+ kertaa'],
};

export function heatLevel(measure: HeatMeasure, d: Pick<HeatDay, 'mvpa' | 'total' | 'sessions' | 'target'>): HeatLevel {
  if (measure === 'sessions') return Math.min(4, Math.max(0, Math.floor(d.sessions))) as HeatLevel;
  if (measure === 'minutes') {
    const m = Math.round(d.total);
    return m <= 0 ? 0 : m <= 30 ? 1 : m <= 60 ? 2 : m <= 90 ? 3 : 4;
  }
  const m = Math.round(d.mvpa);
  if (m <= 0) return 0;
  const r = d.target > 0 ? m / d.target : 1;
  // Pieni toleranssi pyöristykselle (esim. 59,6 min ≈ 60 min).
  return r < 0.5 ? 1 : r < 1 - 1e-9 ? 2 : r < 1.5 - 1e-9 ? 3 : 4;
}

/** Onko päivällä mitään liikuntaa valitulla mittarilla. */
export const isActive = (measure: HeatMeasure, d: Pick<HeatDay, 'mvpa' | 'total' | 'sessions' | 'target'>) => heatLevel(measure, d) > 0;

/** Pisin peräkkäisten aktiivisten päivien putki; päivät järjestyksessä, väliin jäävät päivät katkaisevat putken. */
export function longestStreak(dates: readonly ISODate[], active: (d: ISODate) => boolean): number {
  let best = 0;
  let run = 0;
  let prev: ISODate | undefined;
  for (const d of dates) {
    if (!active(d)) {
      run = 0;
      prev = d;
      continue;
    }
    run = prev !== undefined && addDays(prev, 1) === d && run > 0 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface HeatColumn {
  /** Viikon maanantai. */
  weekStart: ISODate;
  /** Ma–su; null = jakson ulkopuolella. */
  days: (ISODate | null)[];
}

/** Ruudukon sarakkeet: jokainen jaksoon osuva ISO-viikko. */
export function heatColumns(start: ISODate, end: ISODate): HeatColumn[] {
  const cols: HeatColumn[] = [];
  for (let w = startOfIsoWeek(start); w <= end; w = addDays(w, 7)) {
    cols.push({ weekStart: w, days: Array.from({ length: 7 }, (_, i) => addDays(w, i)).map((d) => (d >= start && d <= end ? d : null)) });
  }
  return cols;
}

const MONTHS = ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'];

/** Kuukausiotsikot: sarake, jossa kuukauden 1. päivä on (tai jakson ensimmäinen sarake). */
export function monthLabels(cols: readonly HeatColumn[]): { col: number; label: string }[] {
  const out: { col: number; label: string }[] = [];
  cols.forEach((c, i) => {
    const firstOfMonth = c.days.find((d) => d !== null && parseISODate(d).day === 1);
    // Jakson alku kesken kuukautta: otsikko ensimmäiseen sarakkeeseen, jos kuukautta on vielä ainakin pari viikkoa.
    const start = i === 0 ? c.days.find((d) => d !== null && parseISODate(d).day <= 18) : undefined;
    const d = firstOfMonth ?? start;
    if (d) out.push({ col: i, label: MONTHS[parseISODate(d).month - 1] });
  });
  return out;
}

export interface HeatStats {
  /** Kaikki liikunta tunteina. */
  hours: number;
  activeDays: number;
  /** Tarkastellut päivät (seurannan alusta tähän päivään). */
  days: number;
  longestStreak: number;
  /** Päivät, joina reipas + rasittava ≥ päivän tavoite. */
  targetDays: number;
}

export function heatStats(days: readonly HeatDay[], measure: HeatMeasure): HeatStats {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const dates = days.map((d) => d.date);
  return {
    hours: days.reduce((a, d) => a + d.total, 0) / 60,
    activeDays: days.filter((d) => isActive(measure, d)).length,
    days: days.length,
    longestStreak: longestStreak(dates, (x) => isActive(measure, byDate.get(x)!)),
    targetDays: days.filter((d) => heatLevel('target', d) >= 3).length,
  };
}

/** Jakson päivät, joille lasketaan arvo: seurannan alusta tähän päivään (rajattuna jaksoon). */
export function heatRange(start: ISODate, end: ISODate, trackingStart: ISODate, today: ISODate): ISODate[] {
  const from = start > trackingStart ? start : trackingStart;
  const to = end < today ? end : today;
  return from <= to ? datesBetween(from, to) : [];
}

/** Viimeiset 12 kk: 52 täyttä viikkoa ja kuluva viikko tähän päivään asti. */
export function last12Months(today: ISODate): { start: ISODate; end: ISODate } {
  return { start: addDays(startOfIsoWeek(today), -52 * 7), end: addDays(today, 7 - isoWeekday(today)) };
}

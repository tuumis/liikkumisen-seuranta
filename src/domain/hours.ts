// Viikon liikuntatunnit: arvio ja toteuma rinnakkain, kestona (kellotunnit), kaikki teho.
// - Toteuma = kirjatut kerrat + perusarvio niille päiville ja kategorioille, joilta kirjaus puuttuu.
// - Ennuste ("Arvio koko viikolle", käyttäjän tarkentama 12.11.2026) = toteuma tähän päivään asti
//   + avoimet suunnitellut kerrat (tulevat ja kuittaamattomat) + perusarvio loppuviikolle.
//   Ohitettu ("Ei tehty") tai poistettu kerta putoaa pois, ylimääräinen kirjaus tulee mukaan.
// - Suunnitelma (expected) = viikkopohjan kerrat + perusarviot; vertailukohta, ei muutu toteuman mukaan.
// Molemmissa korvausperiaate: päivälle ja kategorialle joko kerrat tai perusarvio, ei molempia.
// Tämä on kestovertailu; suositusvertailu (reipas ja rasittava) on erillinen (osio 7),
// eikä suunnitelma koskaan näy liikuntamäärissä.

import { activeEstimate, addsToEstimate, isEstimateConfirmation, isEstimateValidOn, sessionCategory } from './aggregate';
import { datesBetween } from './dates';
import { estimateBaseMin } from './holidays';
import { computeSessionMinutes, mvpaOf } from './intensity';
import type { ActivityType, Category, DayFlag, Estimate, ISODate, Period, PlannedSession, Session, UUID } from './types';

export interface HoursSplit {
  /** Kerroista (arviossa suunnitelluista, toteumassa kirjatuista). */
  sessions: number;
  /** Perusarviosta. */
  estimate: number;
}

/**
 * Kategorian toteuman sisältö (17.11.2026, käyttäjän toive "mitä 8 h omaehtoinen sisältää"):
 * kirjatut kerrat lajeittain, vahvistettu arkiliikunta ja perusarvio arvioittain.
 */
export interface CategoryItem {
  key: string;
  /** Lajin tai arvion nimi. */
  label: string;
  /** session = kirjattu kerta, warmup = treenin verryttely, confirmed = vahvistettu arkiliikunta, estimate = perusarvio. */
  kind: 'session' | 'warmup' | 'confirmed' | 'estimate';
  /** Kertoja (kerrat) tai päiviä (arkiliikunta). */
  count: number;
  minutes: number;
  icon?: string;
}

export interface CategoryHours {
  category: Category;
  expected: HoursSplit;
  actual: HoursSplit;
  /** Ennuste koko viikolle (min). */
  forecast: number;
  /** Vahvistettu arkiliikunta (min), sisältyy actual.sessions-lukuun. */
  confirmed: number;
  /** Toteuman sisältö, suurin ensin (summa = actual.sessions + actual.estimate). */
  items: CategoryItem[];
}

export interface DayHours {
  date: ISODate;
  expectedMin: number;
  actualMin: number;
  actualLoggedMin: number;
  /** Ennuste: menneille toteuma + kuittaamattomat, tuleville avoimet suunnitelmat + perusarvio. */
  forecastMin: number;
  /** Päivän arkiliikunnan perusarvio (min): menneille mukana toteumassa, tuleville ennusteessa. */
  estimateMin: number;
  /** Kategoriat, joiden perusarvio on mukana estimateMin-luvussa. */
  estimateCategories: Category[];
  /**
   * Päivän arkiliikuntarivillä näytettävä arvio (min): kaikki kategoriat, joille ei ole kirjausta, myös
   * tulevina päivinä samaan kategoriaan suunnitellusta kerrasta huolimatta (sama kuin kuluvana päivänä).
   * Ennusteessa (forecastMin) avoin suunnitelma korvaa saman kategorian arvion, ettei sitä lasketa kahdesti.
   */
  pendingEstimateMin: number;
  pendingEstimateCategories: Category[];
  /** Päiväkohtaisesti vahvistettu arkiliikunta (min), sisältyy actualLoggedMin-lukuun. */
  confirmedMin: number;
  /** Avoimien suunnitelmien (ennusteessa mukana olevien) reipas ja rasittava osuus lajin tehoprofiilista (min). */
  openPlanMvpa: number;
  future: boolean;
  flagged: boolean;
  /** Lomapäivä (perusarvio viikonlopun arvoilla). */
  holiday: boolean;
}

export interface WeeklyHours {
  /** Minuutit; näyttö tunteina. */
  expectedMin: number;
  /** Arvio tähän päivään asti (kesken olevan viikon tahti). */
  expectedToDateMin: number;
  actualMin: number;
  expected: HoursSplit;
  actual: HoursSplit;
  /** Ennuste koko viikolle = toteutunut + avoimet suunnitelmat + perusarvio loppuviikolle (min). */
  forecastMin: number;
  forecast: { actual: number; openPlans: number; estimateAhead: number };
  byCategory: CategoryHours[];
  days: DayHours[];
}

const CATEGORY_ORDER: Category[] = ['hobby', 'school_pe', 'school_recess', 'daycare', 'commute', 'self_directed', 'family', 'other'];

export { ESTIMATE_ONLY_CATEGORIES, isEstimateConfirmation } from './aggregate';


export function weeklyHours(input: {
  period: Period;
  sessions: Session[];
  planned: PlannedSession[];
  estimates: Estimate[];
  flags: DayFlag[];
  types: Map<UUID, ActivityType>;
  today: ISODate;
  /** Lomapäivät: perusarvio viikonlopun arvoilla, lomalla ohitetut suunnitelmat eivät ole arviossa. */
  holidays?: ReadonlySet<ISODate>;
}): WeeklyHours {
  const { period, today } = input;
  const catOf = (typeId: UUID): Category => input.types.get(typeId)?.category ?? 'other';
  const flagged = new Set(input.flags.filter((f) => !f.deletedAt).map((f) => f.date));
  const acc = new Map<Category, CategoryHours>();
  const cat = (c: Category) => {
    let v = acc.get(c);
    if (!v) acc.set(c, (v = { category: c, expected: { sessions: 0, estimate: 0 }, actual: { sessions: 0, estimate: 0 }, forecast: 0, confirmed: 0, items: [] }));
    return v;
  };
  const items = new Map<Category, Map<string, CategoryItem>>();
  const addItem = (c: Category, it: Omit<CategoryItem, 'count' | 'minutes'>, minutes: number) => {
    const m = items.get(c) ?? items.set(c, new Map()).get(c)!;
    const cur = m.get(it.key) ?? m.set(it.key, { ...it, count: 0, minutes: 0 }).get(it.key)!;
    cur.count++;
    cur.minutes += minutes;
  };
  /** Vahvistuksen nimi: arvion nimi ilman ": N min" -päätettä. */
  const confirmedLabel = (s: Session) => (s.label ?? '').replace(/:\s*(\d+ min|ei tänä päivänä)$/i, '').trim() || 'Arkiliikunta';

  const days: DayHours[] = [];
  let expectedToDateMin = 0;
  const fc = { actual: 0, openPlans: 0, estimateAhead: 0 };
  for (const d of datesBetween(period.start, period.end)) {
    const future = d > today;
    const isFlagged = flagged.has(d);
    const holiday = input.holidays?.has(d) ?? false;
    const estimateDuration = (e: Estimate) => estimateBaseMin(e, d, holiday);
    const estimates = input.estimates.filter((e) => isEstimateValidOn(e, d));
    const estCats = [...new Set(estimates.map((e) => e.category))];

    // Arvio: suunnitellut kerrat (kaikki tilat: suunnitelma oli olemassa) + perusarvio muille kategorioille.
    const planByCat = new Map<Category, number>();
    // Kategoriat, joiden perusarvion suunnitelma/kirjaus korvaa (lajiharjoittelu tulee arvion päälle, 17.11.2026).
    const planReplaces = new Set<Category>();
    for (const p of input.planned) {
      if (p.deletedAt || p.date !== d || p.skipReason === 'holiday') continue;
      planByCat.set(catOf(p.activityTypeId), (planByCat.get(catOf(p.activityTypeId)) ?? 0) + p.durationMin);
      if (!addsToEstimate(p, input.types)) planReplaces.add(catOf(p.activityTypeId));
    }
    let expectedMin = 0;
    for (const [c, m] of planByCat) {
      cat(c).expected.sessions += m;
      expectedMin += m;
    }
    for (const c of estCats) {
      if (planReplaces.has(c)) continue;
      const m = estimateDuration(activeEstimate(estimates, c, d)!);
      if (!m) continue;
      cat(c).expected.estimate += m;
      expectedMin += m;
    }

    // Toteuma: kirjatut kerrat + perusarvio muille kategorioille (vain menneet/tämä päivä, ei sairas-/matkapäivinä).
    const logByCat = new Map<Category, number>();
    const logReplaces = new Set<Category>();
    for (const s of input.sessions) {
      if (s.deletedAt || s.date !== d) continue;
      const c = sessionCategory(s, input.types);
      logByCat.set(c, (logByCat.get(c) ?? 0) + s.durationMin);
      if (!addsToEstimate(s, input.types)) logReplaces.add(c);
      if (s.durationMin <= 0) continue;
      const t = input.types.get(s.activityTypeId);
      if (isEstimateConfirmation(s)) {
        cat(c).confirmed += s.durationMin;
        const label = confirmedLabel(s);
        addItem(c, { key: `c:${label.toLocaleLowerCase('fi')}`, label, kind: 'confirmed' }, s.durationMin);
      } else if (s.linkedTo) addItem(c, { key: `w:${s.activityTypeId}`, label: t?.name ?? 'Verryttely', kind: 'warmup', icon: t?.icon }, s.durationMin);
      else addItem(c, { key: `s:${s.activityTypeId}`, label: t?.name ?? 'Muu', kind: 'session', icon: t?.icon }, s.durationMin);
    }
    let actualMin = 0;
    let actualLoggedMin = 0;
    let estimateMin = 0;
    let confirmedMin = 0;
    const estimateCategories: Category[] = [];
    for (const s of input.sessions) if (!s.deletedAt && s.date === d && isEstimateConfirmation(s)) confirmedMin += s.durationMin;
    for (const [c, m] of logByCat) {
      cat(c).actual.sessions += m;
      actualMin += m;
      actualLoggedMin += m;
    }
    if (!future && !isFlagged) {
      for (const c of estCats) {
        if (logReplaces.has(c)) continue;
        const e = activeEstimate(estimates, c, d)!;
        const m = estimateDuration(e);
        if (!m) continue;
        cat(c).actual.estimate += m;
        actualMin += m;
        estimateMin += m;
        estimateCategories.push(c);
        addItem(c, { key: `e:${e.label.toLocaleLowerCase('fi')}`, label: e.label, kind: 'estimate' }, m);
      }
    }

    // Ennuste: avoimet suunnitelmat (ei kuitatut, ei ohitetut) kategorioittain; jos kategorialle on jo
    // kirjaus, kuittaamatonta suunnitelmaa ei lasketa toiseen kertaan.
    const openByCat = new Map<Category, number>();
    const openReplaces = new Set<Category>();
    let openPlanMvpa = 0;
    for (const p of input.planned) {
      if (p.deletedAt || p.date !== d || p.status !== 'open') continue;
      const c = catOf(p.activityTypeId);
      if (logByCat.has(c)) continue;
      openByCat.set(c, (openByCat.get(c) ?? 0) + p.durationMin);
      if (!addsToEstimate(p, input.types)) openReplaces.add(c);
      const type = input.types.get(p.activityTypeId);
      if (type) openPlanMvpa += mvpaOf(computeSessionMinutes(type, { durationMin: p.durationMin, effort: 0 }).minutes);
    }
    let forecastMin = 0;
    if (!future) {
      // menneet ja tämä päivä: toteuma + kuittaamattomat suunnitelmat (perusarvio väistyy niiden kategoriassa)
      for (const [c, m] of logByCat) cat(c).forecast += m;
      forecastMin += actualLoggedMin;
      fc.actual += actualLoggedMin;
      if (!isFlagged) {
        for (const c of estCats) {
          if (logReplaces.has(c) || openReplaces.has(c)) continue;
          const m = estimateDuration(activeEstimate(estimates, c, d)!);
          if (!m) continue;
          cat(c).forecast += m;
          forecastMin += m;
          fc.actual += m;
        }
      }
    } else if (!isFlagged) {
      for (const c of estCats) {
        if (openReplaces.has(c)) continue;
        const m = estimateDuration(activeEstimate(estimates, c, d)!);
        if (!m) continue;
        cat(c).forecast += m;
        forecastMin += m;
        fc.estimateAhead += m;
        estimateMin += m;
        estimateCategories.push(c);
      }
    }
    for (const [c, m] of openByCat) {
      cat(c).forecast += m;
      forecastMin += m;
      fc.openPlans += m;
    }

    // Arkiliikuntarivi: sama sääntö kaikille päiville (kirjaus korvaa arvion, suunnitelma ei).
    let pendingEstimateMin = 0;
    const pendingEstimateCategories: Category[] = [];
    if (!isFlagged) {
      for (const c of estCats) {
        if (logReplaces.has(c)) continue;
        const m = estimateDuration(activeEstimate(estimates, c, d)!);
        if (!m) continue;
        pendingEstimateMin += m;
        pendingEstimateCategories.push(c);
      }
    }

    if (!future) expectedToDateMin += expectedMin;
    days.push({
      date: d,
      expectedMin,
      actualMin,
      actualLoggedMin,
      forecastMin,
      estimateMin,
      estimateCategories,
      pendingEstimateMin,
      pendingEstimateCategories,
      confirmedMin,
      openPlanMvpa,
      future,
      flagged: isFlagged,
      holiday,
    });
  }

  const byCategory = CATEGORY_ORDER.filter((c) => acc.has(c)).map((c) => ({
    ...acc.get(c)!,
    items: [...(items.get(c)?.values() ?? [])].sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label, 'fi')),
  }));
  const sum = (f: (c: CategoryHours) => number) => byCategory.reduce((a, c) => a + f(c), 0);
  const expected = { sessions: sum((c) => c.expected.sessions), estimate: sum((c) => c.expected.estimate) };
  const actual = { sessions: sum((c) => c.actual.sessions), estimate: sum((c) => c.actual.estimate) };
  return {
    expectedMin: expected.sessions + expected.estimate,
    expectedToDateMin,
    actualMin: actual.sessions + actual.estimate,
    expected,
    actual,
    forecastMin: fc.actual + fc.openPlans + fc.estimateAhead,
    forecast: fc,
    byCategory,
    days,
  };
}

/** Minuutit tunteina yhdellä desimaalilla: 675 → "11,3 h". */
export function formatHours(min: number): string {
  return `${(Math.round((min / 60) * 10) / 10).toFixed(1).replace('.', ',')} h`;
}

// ---------- viikon liikuntamäärän luokat (käyttäjän määrittelemä taulukko, lisäys 16) ----------

export type HoursBandKey = 'below' | 'meets' | 'active' | 'very_active' | 'lots' | 'very_lots';

export interface HoursBand {
  key: HoursBandKey;
  /** Alaraja tunteina (mukaan lukien). */
  fromH: number;
  /** Yläraja tunteina (ei mukaan); viimeisellä ei ylärajaa. */
  toH?: number;
  label: string;
  range: string;
}

/**
 * Kokonaisliikunnan kesto viikossa (kirjatut + perusarvio, kellotunnit). Kouluikäisten
 * suositus 60 min/pv = 7 h/vk on "Suosituksen mukainen" -luokan alaraja. Luokat kuvaavat
 * määrää, eivät ole palkinto eikä tavoite ylittää ylintä luokkaa.
 */
export const HOURS_BANDS: readonly HoursBand[] = Object.freeze([
  { key: 'below', fromH: 0, toH: 7, label: 'Alle suosituksen', range: 'alle 7 h' },
  { key: 'meets', fromH: 7, toH: 10, label: 'Suosituksen mukainen', range: '7–10 h' },
  { key: 'active', fromH: 10, toH: 12, label: 'Aktiivinen', range: '10–12 h' },
  { key: 'very_active', fromH: 12, toH: 15, label: 'Erittäin aktiivinen', range: '12–15 h' },
  { key: 'lots', fromH: 15, toH: 20, label: 'Paljon liikuntaa', range: '15–20 h' },
  { key: 'very_lots', fromH: 20, label: 'Erittäin suuri liikuntamäärä', range: '20+ h' },
]);

/** Minuuttimäärän luokka; raja kuuluu ylempään luokkaan (7 h = Suosituksen mukainen). */
export function hoursBand(min: number): HoursBand {
  const h = Math.max(0, min) / 60;
  return HOURS_BANDS.find((b) => b.toH === undefined || h < b.toH)!;
}

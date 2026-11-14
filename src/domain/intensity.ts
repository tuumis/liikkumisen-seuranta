// Sovelluksen tehomalli (SPEC 5). Arvio, ei virallinen luku.

import type { ActivityType, Effort, IntensityMinutes, IntensityPreset, IntensityShares } from './types';

/**
 * Kirjauksessa valittavat tehon esiasetukset ("enimmäkseen …"). Sovelluksen omia arvioita,
 * eivät virallisia lukuja; loppuosuus on paikallaanoloa (tauot, ohjeet).
 */
export const INTENSITY_PRESETS: Readonly<Record<IntensityPreset, IntensityShares>> = Object.freeze({
  light: Object.freeze({ light: 0.75, moderate: 0.15, vigorous: 0 }),
  moderate: Object.freeze({ light: 0.2, moderate: 0.65, vigorous: 0.1 }),
  vigorous: Object.freeze({ light: 0.1, moderate: 0.35, vigorous: 0.5 }),
});

export const EFFORT_FACTOR: Readonly<Record<Effort, number>> = Object.freeze({
  [-1]: 0.75, // kevyempi
  0: 1, // tavallinen
  1: 1.25, // kovempi
});

/**
 * Math.round, mutta liukulukuvirhe (esim. 22.499999999999996) ei käännä
 * puolikasta alaspäin: tulo pyöristetään ensin 6 desimaaliin.
 */
export function roundMinutes(x: number): number {
  return Math.round(Math.round(x * 1e6) / 1e6);
}

/** Vaiheet 2–3: ponnistelukerroin ja rajaus. Palauttaa käytetyt osuudet l', m', v'. */
export function effectiveShares(shares: IntensityShares, effort: Effort): IntensityShares {
  const e = EFFORT_FACTOR[effort];
  let m = Math.max(0, shares.moderate) * e;
  let v = Math.max(0, shares.vigorous) * e;
  const mv = m + v;
  if (mv > 1) {
    m = m / mv;
    v = v / mv;
  }
  const light = Math.max(0, Math.min(Math.max(0, shares.light), 1 - m - v));
  return { light, moderate: m, vigorous: v };
}

/** Vaihe 4: minuutit osuuksista, pyöristys Math.round. */
export function minutesFromShares(base: number, shares: IntensityShares): IntensityMinutes {
  const b = Math.max(0, base);
  return {
    light: roundMinutes(b * shares.light),
    moderate: roundMinutes(b * shares.moderate),
    vigorous: roundMinutes(b * shares.vigorous),
  };
}

/** Peliaika-arvio: osuus peliajasta kentällä, kun pelattuja minuutteja ei ole kirjattu (käyttäjän vahvistama 12.11.2026). */
export const DEFAULT_PLAY_SHARE = 0.7;
/** Lämmittely ennen peliä (min), kun sitä ei ole annettu (yksi peli). */
export const DEFAULT_GAME_WARMUP_MIN = 15;
/** Lämmittelyn teho, jos jalkapallotreenin profiilia ei ole saatavilla (= treenin lähtöoletus). */
export const WARMUP_FALLBACK_SHARES: Readonly<IntensityShares> = Object.freeze({ light: 0.35, moderate: 0.3, vigorous: 0.15 });

export interface FootballParts {
  warmup: number;
  played: number;
  /** Vaihtopenkki ja tauot: ei kerrytä liikuntaa. */
  bench: number;
}

/**
 * Pelin ja turnauksen osat (SPEC 16): lämmittely, pelattu aika ja vaihtopenkki. Pelattu aika on
 * kirjattu tai arvioitu (kesto − lämmittely) × peliaika-arvio; lämmittely mahtuu aina kestoon.
 */
export function footballParts(input: { durationMin: number; playedMin?: number; warmupMin?: number; playShare?: number }): FootballParts {
  const d = Math.max(0, input.durationMin);
  let warmup = Math.min(d, Math.max(0, input.warmupMin ?? DEFAULT_GAME_WARMUP_MIN));
  const share = Math.min(1, Math.max(0, input.playShare ?? DEFAULT_PLAY_SHARE));
  const played = Math.min(d, Math.max(0, input.playedMin ?? roundMinutes((d - warmup) * share)));
  if (played + warmup > d) warmup = d - played;
  return { warmup, played, bench: d - warmup - played };
}

/** Vaihe 1 (muut lajit): laskentapohja on kesto; pelissä ja turnauksessa pelatut minuutit (ks. footballParts). */
export function sessionBase(
  type: Pick<ActivityType, 'usesPlayedMinutes'>,
  input: { durationMin: number; playedMin?: number },
): number {
  if (type.usesPlayedMinutes && input.playedMin !== undefined && input.playedMin !== null) {
    return input.playedMin;
  }
  return input.durationMin;
}

/**
 * Yhden kerran minuutit (SPEC 5, 7.11).
 * - Käsin syötetyt minuutit palautetaan sellaisinaan ilman snapshotia (intensitySource = 'manual').
 * - Muuten lasketaan lajin tehoprofiilista; snapshot on käytetty profiili (ennen ponnistelukerrointa).
 */
export function computeSessionMinutes(
  type: ActivityType,
  input: {
    durationMin: number;
    playedMin?: number;
    effort: Effort;
    manual?: IntensityMinutes;
    /** Peli ja turnaus: lämmittely (min), peliaika-arvio ja lämmittelyn teho (jalkapallotreenin profiili). */
    warmupMin?: number;
    playShare?: number;
    warmupShares?: IntensityShares;
  },
): { minutes: IntensityMinutes; snapshot?: IntensityShares } {
  if (input.manual) {
    const { light, moderate, vigorous } = input.manual;
    return { minutes: { light, moderate, vigorous } };
  }
  // Peli ja turnaus osina: pelattu aika pelin teholla (ponnistelu = taso), lämmittely treenin teholla, penkki 0.
  const minutes = type.usesPlayedMinutes
    ? (() => {
        const p = footballParts(input);
        return addMinutes(
          minutesFromShares(p.played, effectiveShares(type.shares, input.effort)),
          minutesFromShares(p.warmup, effectiveShares(input.warmupShares ?? WARMUP_FALLBACK_SHARES, 0)),
        );
      })()
    : minutesFromShares(sessionBase(type, input), effectiveShares(type.shares, input.effort));
  const { light, moderate, vigorous } = type.shares;
  return { minutes, snapshot: { light, moderate, vigorous } };
}

export function mvpaOf(m: IntensityMinutes): number {
  return m.moderate + m.vigorous;
}

export function totalOf(m: IntensityMinutes): number {
  return m.light + m.moderate + m.vigorous;
}

export function addMinutes(a: IntensityMinutes, b: IntensityMinutes): IntensityMinutes {
  return { light: a.light + b.light, moderate: a.moderate + b.moderate, vigorous: a.vigorous + b.vigorous };
}

export const ZERO_MINUTES: Readonly<IntensityMinutes> = Object.freeze({ light: 0, moderate: 0, vigorous: 0 });

/** Tarkistaa, että osuudet ovat 0–1 ja summa ≤ 1. */
export function isValidShares(s: IntensityShares): boolean {
  const vals = [s.light, s.moderate, s.vigorous];
  return vals.every((x) => Number.isFinite(x) && x >= 0 && x <= 1) && vals.reduce((a, b) => a + b, 0) <= 1 + 1e-9;
}

// ---------- osat (monta tekemistä yhdessä kerrassa, 14.11.2026) ----------

/** Voiko lajin kerran jakaa osiin: liikuntapuisto ja omat lajit, joille valinta on tehty. */
export function supportsParts(t: Pick<ActivityType, 'key' | 'multiActivity' | 'usesPlayedMinutes'> | undefined): boolean {
  return !!t && !t.usesPlayedMinutes && (t.key === 'activity_park' || !!t.multiActivity);
}

/**
 * Osien yhdistetty tehoprofiili koko kestolle: jokaisen osan lajin osuudet painotettuna osan kestolla,
 * jaettuna kerran kestolla. Osien ulkopuolinen aika on taukoja (0 %). Palauttaa undefined, jos osia ei ole.
 */
export function partsShares(
  parts: readonly { activityTypeId: string; durationMin: number }[] | undefined,
  types: ReadonlyMap<string, Pick<ActivityType, 'shares'>>,
  durationMin: number,
): IntensityShares | undefined {
  if (!parts?.length || durationMin <= 0) return undefined;
  const acc = { light: 0, moderate: 0, vigorous: 0 };
  let used = 0;
  for (const p of parts) {
    const t = types.get(p.activityTypeId);
    if (!t || p.durationMin <= 0) continue;
    used += p.durationMin;
    for (const k of ['light', 'moderate', 'vigorous'] as const) acc[k] += t.shares[k] * p.durationMin;
  }
  if (used <= 0) return undefined;
  const d = Math.max(durationMin, used);
  return { light: acc.light / d, moderate: acc.moderate / d, vigorous: acc.vigorous / d };
}

// Sovelluksen tehomalli (SPEC 5). Arvio, ei virallinen luku.

import type { ActivityType, Effort, IntensityMinutes, IntensityShares } from './types';

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

/** Vaihe 1: laskentapohja – pelatut minuutit pelissä ja turnauksessa, jos annettu. */
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
  input: { durationMin: number; playedMin?: number; effort: Effort; manual?: IntensityMinutes },
): { minutes: IntensityMinutes; snapshot?: IntensityShares } {
  if (input.manual) {
    const { light, moderate, vigorous } = input.manual;
    return { minutes: { light, moderate, vigorous } };
  }
  const base = sessionBase(type, input);
  const minutes = minutesFromShares(base, effectiveShares(type.shares, input.effort));
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

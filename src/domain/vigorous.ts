// Rasittavan päivän raja (SPEC 4: sovelluksen oma tulkinta, asetuksissa muokattava).
// Iän mukainen taulukko on käyttäjän oma tavoite; kiinteä raja on lähtöoletus 10 min.

import { ageInYears } from './groups';
import type { ISODate, Profile, Settings } from './types';

export interface VigorousThreshold {
  min: number;
  rule: Settings['vigorousDayRule'];
  /** Ikä, jonka mukaan raja valittiin (iän mukaisessa säännössä). */
  age?: number;
}

/**
 * Raja profiilille päivänä `on` (jakson viimeinen päivä, kuten suositusryhmässä).
 * Taulukon ulkopuoliset iät käyttävät lähintä riviä (alle 7 → 7 v, yli 17 → 17 v).
 */
export function vigorousDayThreshold(
  settings: Settings,
  profile: Pick<Profile, 'birthYear' | 'birthMonth'>,
  on: ISODate,
): VigorousThreshold {
  const table = settings.vigorousDayByAge ?? {};
  const ages = Object.keys(table)
    .map(Number)
    .filter((a) => Number.isFinite(a) && Number.isFinite(table[String(a)]))
    .sort((a, b) => a - b);
  if (settings.vigorousDayRule !== 'age' || ages.length === 0) return { min: settings.vigorousDayMin, rule: 'fixed' };
  const age = ageInYears(profile.birthYear, profile.birthMonth, on);
  const key = Math.min(Math.max(age, ages[0]), ages[ages.length - 1]);
  const exact = ages.includes(key) ? key : [...ages].reverse().find((a) => a <= key) ?? ages[0];
  return { min: table[String(exact)], rule: 'age', age };
}

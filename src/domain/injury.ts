// Loukkaantumisjakso (24.11.2026, käyttäjän valinta): jakso merkitään päivämerkinnöillä (DayFlag, syy 'injured')
// alkupäivästä arvioitua paluupäivää edeltävään päivään. Jakson päivät eivät ole mukana suositusvertailussa,
// ja jakson suunnitellut kerrat merkitään poissaoloksi (db/repositories applyInjurySkips).

import { addDays, diffDays } from './dates';
import type { DayFlag, ISODate } from './types';

/** Jakso: alkupäivä ja arvioitu paluupäivä (ensimmäinen tavallinen päivä, ei itse jaksoa). */
export interface InjuryRun {
  start: ISODate;
  returnDate: ISODate;
}

/** Pisin jakso kerralla (noin puoli vuotta); estää vahingossa valitun vuosien jakson. */
export const MAX_INJURY_DAYS = 180;

/** Jakson päivien määrä. */
export const injuryDays = (r: InjuryRun) => diffDays(r.start, r.returnDate);

/** Päivän `date` sisältävä yhtenäinen loukkaantumisjakso merkinnöistä, tai null. */
export function injuryRunAt(flags: DayFlag[], date: ISODate): InjuryRun | null {
  const injured = new Set(flags.filter((f) => !f.deletedAt && f.reason === 'injured').map((f) => f.date));
  if (!injured.has(date)) return null;
  let start = date;
  while (injured.has(addDays(start, -1))) start = addDays(start, -1);
  let end = date;
  while (injured.has(addDays(end, 1))) end = addDays(end, 1);
  return { start, returnDate: addDays(end, 1) };
}

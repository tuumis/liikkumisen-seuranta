// "Viime viikko lyhyesti" (SPEC 16): edellisen viikon tiivis kooste viikon ensimmäisellä avauksella.
// Puhtaat apufunktiot; luvut tulevat periodReport- ja footballPeriodSummary-koosteista.

import { addDays, startOfIsoWeek } from './dates';
import type { ISODate } from './types';

/** Edellisen ISO-viikon maanantai. */
export const previousWeekStart = (today: ISODate): ISODate => addDays(startOfIsoWeek(today), -7);

/**
 * Näytetäänkö kooste: viime viikolla on kirjauksia, viikko ei ole kokonaan ennen seurannan alkua,
 * eikä käyttäjä ole jo sulkenut tämän viikon koostetta tällä laitteella.
 */
export function shouldShowDigest(opts: { lastWeekStart: ISODate; trackingStart: ISODate; sessionCount: number; dismissedFor?: ISODate }): boolean {
  if (opts.dismissedFor === opts.lastWeekStart) return false;
  if (addDays(opts.lastWeekStart, 6) < opts.trackingStart) return false;
  return opts.sessionCount > 0;
}

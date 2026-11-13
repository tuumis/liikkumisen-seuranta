// "Viime viikko lyhyesti" (SPEC 16): edellisen viikon tiivis kooste viikon ensimmäisellä avauksella.
// Puhtaat apufunktiot; luvut tulevat periodReport- ja footballPeriodSummary-koosteista.

import { addDays, startOfIsoWeek } from './dates';
import type { FootballDetails, ISODate, Session, UUID } from './types';

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

/** Viikon tuorein kommentti: jalkapallon kommentti, turnauksen pelin kommentti tai kerran muistiinpano. */
export function latestComment(sessions: Session[], details: Map<UUID, FootballDetails>): { text: string; date: ISODate } | undefined {
  const live = sessions.filter((s) => !s.deletedAt).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  for (const s of live) {
    const d = details.get(s.id);
    const text = [d?.ratingNote, ...(d?.games ?? []).map((g) => g.note), s.note].find((t) => t?.trim());
    if (text) return { text: text.trim(), date: s.date };
  }
  return undefined;
}

/** Eri lajien määrä (arkiliikunnan vahvistukset eivät ole lajeja). */
export function distinctTypes(sessions: Session[]): number {
  return new Set(sessions.filter((s) => !s.deletedAt && !s.estimateConfirmed).map((s) => s.activityTypeId)).size;
}

// Suunnitelma vs. toteuma (SPEC 7.9). Ei koskaan vaikuta liikuntamääriin.

import type { AdherenceSummary, DurationPair, ISODate, PlannedSession, Session } from './types';

/**
 * @param today Tarvitaan kuittaamattomien laskentaan (open ja päivä < tänään).
 *   Lisäparametri SPECin rajapintaan, vahvistettu käyttäjän kanssa.
 */
export function planAdherence(planned: PlannedSession[], sessions: Session[], today: ISODate): AdherenceSummary {
  const live = planned.filter((p) => !p.deletedAt);
  const sessionById = new Map(sessions.filter((s) => !s.deletedAt).map((s) => [s.id, s]));
  const sessionByPlan = new Map(
    sessions.filter((s) => !s.deletedAt && s.plannedSessionId).map((s) => [s.plannedSessionId!, s]),
  );

  const skippedByReason: AdherenceSummary['skippedByReason'] = {
    sick: 0,
    injured: 0,
    cancelled: 0,
    holiday: 0,
    other_commitment: 0,
    other: 0,
    unspecified: 0,
  };
  let done = 0;
  let skipped = 0;
  let open = 0;
  let unconfirmed = 0;
  const pairs: DurationPair[] = [];

  for (const p of live) {
    if (p.status === 'done') {
      done++;
      const s = (p.sessionId && sessionById.get(p.sessionId)) || sessionByPlan.get(p.id);
      if (s) pairs.push({ plannedSessionId: p.id, sessionId: s.id, plannedMin: p.durationMin, actualMin: s.durationMin });
    } else if (p.status === 'skipped') {
      skipped++;
      skippedByReason[p.skipReason ?? 'unspecified']++;
    } else {
      open++;
      if (p.date < today) unconfirmed++;
    }
  }

  // Peruttu ja loma eivät ole poisjääntejä: ne eivät ole toteutumisasteen nimittäjässä.
  const denominator = done + skipped - skippedByReason.cancelled - skippedByReason.holiday;
  return {
    planned: live.length,
    done,
    skipped,
    skippedByReason,
    open,
    unconfirmed,
    adherenceRate: denominator > 0 ? done / denominator : null,
    pairs,
    plannedMinTotal: pairs.reduce((a, x) => a + x.plannedMin, 0),
    actualMinTotal: pairs.reduce((a, x) => a + x.actualMin, 0),
  };
}

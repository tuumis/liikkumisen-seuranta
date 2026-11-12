// Suunnitelmien kuittaus- ja ohitustoiminnot ilmoituksineen ja kumoamisineen.

import type { PlannedSession, Session, SkipReason } from '../../domain/types';
import { repo } from '../../db/repositories';
import { dayLabel } from '../../ui/format';
import { SKIP_REASON_LABEL } from '../../ui/labels';
import { markFresh } from '../../ui/fresh';
import { useToast } from '../../ui/Toast';
import { today } from '../../ui/today';

/**
 * @param onConfirmed kutsutaan, kun yksittäinen kuittaus loi kerran (esim. jalkapallon lisätietopaneeli).
 *   Läpikäyntilista ei anna tätä, jotta viikon kuittaus pysyy nopeana.
 */
export function usePlanActions(onOpenSession: (s: Session) => void, onConfirmed?: (s: Session) => void) {
  const toast = useToast();

  /** ✓ kuten suunniteltu (tai annetulla kestolla). Jo kuitattu → avataan olemassa oleva kerta muokattavaksi. */
  async function confirm(plan: PlannedSession, durationMin?: number) {
    try {
      const r = await repo.confirmPlanned(plan.id, today(), { durationMin });
      if (!r.created) {
        onOpenSession(r.session);
        return;
      }
      markFresh(r.session.id);
      toast(`Kuitattu: ${dayLabel(plan.date)} ${r.session.durationMin} min`, {
        label: 'Kumoa',
        run: () => repo.undoConfirm([r.session.id]),
      }, 'success');
      onConfirmed?.(r.session);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }

  /** ✗ ei tehty, valinnainen syy. */
  async function skip(plan: PlannedSession, reason?: SkipReason) {
    await repo.skipPlanned(plan.id, reason);
    toast(`Ei tehty: ${dayLabel(plan.date)}${reason ? ` (${SKIP_REASON_LABEL[reason].toLowerCase()})` : ''}`, {
      label: 'Kumoa',
      run: () => repo.reopenPlanned(plan.id),
    });
  }

  async function reopen(plan: PlannedSession) {
    await repo.reopenPlanned(plan.id);
  }

  /** "Merkitse loput tehdyiksi", kumottavissa. */
  async function confirmAll(plans: PlannedSession[]) {
    const created = await repo.confirmMany(
      plans.map((p) => p.id),
      today(),
    );
    markFresh(...created);
    toast(`Merkitty tehdyiksi: ${created.length}`, { label: 'Kumoa', run: () => repo.undoConfirm(created) });
  }

  return { confirm, skip, reopen, confirmAll };
}

// Yksittäisen suunnitelman toiminnot Viikko-näkymästä.

import { useEffect, useState } from 'react';
import type { ActivityType, PlannedSession, Session } from '../../domain/types';
import { Button, inputClass } from '../../ui/components';
import { dayLabel } from '../../ui/format';
import { SKIP_REASON_LABEL } from '../../ui/labels';
import { Sheet } from '../../ui/Sheet';
import { today as todayFn } from '../../ui/today';
import { SkipReasons } from '../review/SkipReasons';
import { usePlanActions } from '../review/usePlanActions';
import { durationSchema } from './sessionForm';

export function PlanSheet({
  plan,
  type,
  onClose,
  onOpenSession,
  onConfirmed,
}: {
  plan: PlannedSession | null;
  type?: ActivityType;
  onClose: () => void;
  onOpenSession: (s: Session) => void;
  onConfirmed?: (s: Session) => void;
}) {
  const actions = usePlanActions(onOpenSession, onConfirmed);
  const [duration, setDuration] = useState('');
  const [error, setError] = useState<string>();
  useEffect(() => {
    setDuration(plan ? String(plan.durationMin) : '');
    setError(undefined);
  }, [plan]);
  if (!plan) return null;
  const future = plan.date > todayFn();
  const run = (f: () => Promise<void>) => async () => {
    await f();
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={`${type?.icon ?? ''} ${type?.name ?? 'Suunnitelma'}`.trim()}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Suunniteltu {dayLabel(plan.date)}
          {plan.startTime && ` klo ${plan.startTime}`} · {plan.durationMin} min
          {plan.status === 'skipped' && (
            <>
              <br />
              <strong>Ei tehty</strong>
              {plan.skipReason && ` – ${SKIP_REASON_LABEL[plan.skipReason].toLowerCase()}`}
            </>
          )}
        </p>

        {future ? (
          <p className="text-xs text-slate-500">Tuleva kerta kuitataan tehdyksi sen päivänä tai myöhemmin. Peruuntumisen voi merkitä jo nyt.</p>
        ) : (
          <div className="space-y-2">
            <Button className="w-full" onClick={run(() => actions.confirm(plan))}>
              ✓ Tehty kuten suunniteltu
            </Button>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const d = durationSchema.safeParse(duration);
                if (!d.success) return setError(d.error.issues[0].message);
                void run(() => actions.confirm(plan, d.data))();
              }}
            >
              <input
                className={inputClass}
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                aria-label="Toteutunut kesto minuutteina"
              />
              <Button type="submit" variant="secondary" className="shrink-0">
                ✎ Kuittaa kestolla
              </Button>
            </form>
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        )}

        {plan.status === 'open' ? (
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">✗ Ei tehty – syy (valinnainen)</div>
            <SkipReasons onPick={(r) => void run(() => actions.skip(plan, r))()} />
          </div>
        ) : (
          <Button variant="secondary" className="w-full" onClick={run(() => actions.reopen(plan))}>
            Palauta avoimeksi
          </Button>
        )}
      </div>
    </Sheet>
  );
}

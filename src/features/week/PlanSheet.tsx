// Yksittäisen suunnitelman toiminnot Viikko-näkymästä: kuittaus (kuten suunniteltu tai muulla
// kestolla), tämän kerran muutos (kesto, kellonaika) myös etukäteen, ohitus syineen.

import { useEffect, useState } from 'react';
import type { ActivityType, PlannedSession, Session } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Field, inputClass } from '../../ui/components';
import { dayLabel } from '../../ui/format';
import { SKIP_REASON_LABEL } from '../../ui/labels';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { SkipReasons } from '../review/SkipReasons';
import { usePlanActions } from '../review/usePlanActions';
import { durationSchema } from './sessionForm';

/** Kestovaihtoehdot kuittaukseen: suunniteltu ja sitä lyhyemmät/pidemmät yleiset kestot. */
function durationChoices(planned: number): number[] {
  const base = [15, 30, 45, 60, 75, 90, 120, 150, 180];
  return [...new Set([planned, ...base.filter((m) => m !== planned && m <= Math.max(planned * 1.5, 60))])].sort((a, b) => b - a).slice(0, 8);
}

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
  const toast = useToast();
  const actions = usePlanActions(onOpenSession, onConfirmed);
  const [custom, setCustom] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setCustom('');
    setEditDuration(plan ? String(plan.durationMin) : '');
    setEditTime(plan?.startTime ?? '');
    setEditing(false);
    setError(undefined);
  }, [plan]);
  if (!plan) return null;
  const future = plan.date > todayFn();
  const run = (f: () => Promise<void>) => async () => {
    await f();
    onClose();
  };

  async function saveOccurrence() {
    const d = durationSchema.safeParse(editDuration);
    if (!d.success) return setError(d.error.issues[0].message);
    try {
      await repo.updatePlannedOccurrence(plan!.id, { durationMin: d.data, startTime: editTime || undefined });
      toast(`Suunnitelma muutettu: ${dayLabel(plan!.date)} ${d.data} min`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Sheet open onClose={onClose} title={`${type?.icon ?? ''} ${type?.name ?? 'Suunnitelma'}`.trim()}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Suunniteltu {dayLabel(plan.date)}
          {plan.startTime && ` klo ${plan.startTime}`} · <strong>{plan.durationMin} min</strong>
          {plan.overridden && <span className="text-slate-500"> (muutettu tälle kerralle)</span>}
          {plan.status === 'skipped' && (
            <>
              <br />
              <strong>Ei tehty</strong>
              {plan.skipReason && ` – ${SKIP_REASON_LABEL[plan.skipReason].toLowerCase()}`}
            </>
          )}
        </p>

        {!future && plan.status !== 'done' && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">✓ Tehty – kesto</div>
            <div className="grid grid-cols-4 gap-2">
              {durationChoices(plan.durationMin).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={run(() => actions.confirm(plan, m === plan.durationMin ? undefined : m))}
                  className={`min-h-12 rounded-xl text-base font-semibold ring-1 ${m === plan.durationMin ? 'bg-green-700 text-white ring-green-700' : 'bg-white text-slate-900 ring-slate-300 hover:bg-slate-50'}`}
                  aria-label={`Tehty ${m} min`}
                >
                  {m}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const d = durationSchema.safeParse(custom);
                if (!d.success) return setError(d.error.issues[0].message);
                void run(() => actions.confirm(plan, d.data))();
              }}
            >
              <input className={inputClass} inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="muu kesto (min)" aria-label="Toteutunut kesto minuutteina" />
              <Button type="submit" variant="secondary" className="shrink-0" disabled={!custom}>
                Kuittaa
              </Button>
            </form>
            <p className="text-xs text-slate-500">Vihreä = suunniteltu kesto. Suunnitelma säilyy ennallaan vertailua varten (esim. 120 suunniteltu → 60 toteutunut).</p>
          </div>
        )}

        {plan.status === 'open' && (
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            {!editing ? (
              <button type="button" className="w-full text-left text-sm font-medium text-green-800" onClick={() => setEditing(true)}>
                ✎ Muuta tätä suunnitelmaa (kesto, kellonaika)
              </button>
            ) : (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveOccurrence();
                }}
              >
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Suunniteltu kesto (min)">
                    <input className={inputClass} inputMode="numeric" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} />
                  </Field>
                  <Field label="Kellonaika">
                    <input type="time" className={inputClass} value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                  </Field>
                </div>
                <p className="text-xs text-slate-500">
                  Muutos koskee vain tätä kertaa{plan.templateItemId ? '; viikkopohja ja muut viikot pysyvät ennallaan' : ''}.
                </p>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    Tallenna suunnitelma
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Peruuta
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-700">{error}</p>}

        {plan.status === 'open' ? (
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">✗ Ei tehty – syy (valinnainen)</div>
            <SkipReasons onPick={(r) => void run(() => actions.skip(plan, r))()} />
            {future && <p className="mt-1 text-xs text-slate-500">Tuleva kerta kuitataan tehdyksi sen päivänä tai myöhemmin; peruuntumisen voi merkitä jo nyt.</p>}
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

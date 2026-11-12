// "Käy viikko läpi" (SPEC 12): kaikki kuittaamattomat (open, päivä < tänään).
// Rivillä ✓ kuten suunniteltu, ✗ ei tehty → valinnainen syy, ✎ muokkaa kestoa.

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ActivityType, PlannedSession, Profile, Session, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, inputClass } from '../../ui/components';
import { dayLabel } from '../../ui/format';
import { Sheet } from '../../ui/Sheet';
import { today } from '../../ui/today';
import { durationSchema } from '../week/sessionForm';
import { SkipReasons } from './SkipReasons';
import { usePlanActions } from './usePlanActions';

export function ReviewSheet({
  open,
  onClose,
  profile,
  types,
  onOpenSession,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  types: Map<UUID, ActivityType>;
  onOpenSession: (s: Session) => void;
}) {
  const plans = useLiveQuery(() => repo.unconfirmedPlans(profile.id, today()), [profile.id]);
  const actions = usePlanActions(onOpenSession);

  return (
    <Sheet open={open} onClose={onClose} title={`Käy viikko läpi · ${profile.name}`}>
      {plans?.length === 0 ? (
        <div className="space-y-3 py-2 text-center">
          <p className="text-sm text-slate-700">Kaikki menneet suunnitelmat on kuitattu.</p>
          <Button onClick={onClose}>Valmis</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-2">
            {plans?.map((p) => (
              <ReviewRow key={p.id} plan={p} type={types.get(p.activityTypeId)} actions={actions} />
            ))}
          </ul>
          {plans && plans.length > 1 && (
            <Button variant="secondary" className="w-full" onClick={() => actions.confirmAll(plans)}>
              Merkitse loput tehdyiksi ({plans.length})
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function ReviewRow({
  plan,
  type,
  actions,
}: {
  plan: PlannedSession;
  type?: ActivityType;
  actions: ReturnType<typeof usePlanActions>;
}) {
  const [mode, setMode] = useState<'idle' | 'skip' | 'edit'>('idle');
  const [duration, setDuration] = useState(String(plan.durationMin));
  const [error, setError] = useState<string>();

  return (
    <li className="card-sunk p-3">
      <div className="flex items-center gap-3">
        <span className="text-xl" aria-hidden>
          {type?.icon ?? '•'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">{type?.name ?? 'Laji'}</span>
          <span className="block text-xs text-slate-600">
            {dayLabel(plan.date)}
            {plan.startTime && ` klo ${plan.startTime}`} · {plan.durationMin} min
          </span>
        </span>
        {mode === 'idle' && (
          <div className="flex shrink-0 gap-1">
            <IconButton label="Tehty kuten suunniteltu" onClick={() => actions.confirm(plan)} tone="green">
              ✓
            </IconButton>
            <IconButton label="Ei tehty" onClick={() => setMode('skip')} tone="red">
              ✗
            </IconButton>
            <IconButton label="Muokkaa kestoa" onClick={() => setMode('edit')}>
              ✎
            </IconButton>
          </div>
        )}
      </div>
      {mode === 'skip' && (
        <div className="mt-2">
          <div className="mb-1 text-xs text-slate-600">Syy (valinnainen)</div>
          <SkipReasons onPick={(r) => actions.skip(plan, r)} onCancel={() => setMode('idle')} />
        </div>
      )}
      {mode === 'edit' && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const d = durationSchema.safeParse(duration);
            if (!d.success) return setError(d.error.issues[0].message);
            void actions.confirm(plan, d.data);
          }}
        >
          <input
            className={inputClass}
            inputMode="numeric"
            autoFocus
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            aria-label="Toteutunut kesto minuutteina"
          />
          <Button type="submit">Kuittaa</Button>
          <Button variant="ghost" onClick={() => setMode('idle')}>
            Peruuta
          </Button>
        </form>
      )}
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </li>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  tone = 'slate',
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: string;
  tone?: 'green' | 'red' | 'slate';
  disabled?: boolean;
}) {
  const tones = {
    green: 'bg-green-700 text-white shadow-[0_6px_14px_-6px_rgb(var(--accent-rgb)/0.7)] hover:bg-green-800',
    red: 'bg-[var(--surface-raised)] text-red-700 shadow-xs ring-1 ring-red-200 hover:bg-red-50',
    slate: 'bg-[var(--surface-raised)] text-slate-700 shadow-xs ring-1 ring-slate-200 hover:bg-slate-100',
  };
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`press flex size-10 items-center justify-center rounded-xl text-base font-bold disabled:opacity-30 disabled:shadow-none ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

// "Käy viikko läpi" (SPEC 12): kaikki kuittaamattomat (open, päivä < tänään, sekä tämän päivän jo päättyneet).
// Rivillä ✓ kuten suunniteltu, ✗ ei tehty → valinnainen syy, ✎ kuittaa tiedoilla (kesto, teho, lihas/luusto,
// treenin omatoiminen verryttely; 24.11.2026). Ilmoituksesta avattaessa päättyneen kerran lomake on valmiiksi auki.

import { TypeGlyph } from '../../ui/TypeGlyph';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ActivityType, PlannedSession, Profile, Session, UUID } from '../../domain/types';
import { Button } from '../../ui/components';
import { dayLabel } from '../../ui/format';
import { Sheet } from '../../ui/Sheet';
import { playSound } from '../../ui/sound';
import { today } from '../../ui/today';
import { SkipReasons } from './SkipReasons';
import { usePlanActions } from './usePlanActions';
import { loadUnconfirmed, useMinuteTick } from './unconfirmed';
import { IconCheck, IconClose, IconPencil } from '../../ui/icons';
import { SwipeRow } from '../../ui/SwipeRow';
import { ConfirmForm } from './ConfirmForm';

export function ReviewSheet({
  open,
  onClose,
  profile,
  types,
  onOpenSession,
  focusPlanId,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  types: Map<UUID, ActivityType>;
  onOpenSession: (s: Session) => void;
  /** Ilmoituksen kerta: ensimmäisenä ja kuittauslomake auki. */
  focusPlanId?: string;
}) {
  const minute = useMinuteTick();
  const plans = useLiveQuery(() => loadUnconfirmed(profile.id, today()), [profile.id, minute]);
  const actions = usePlanActions(onOpenSession);

  // Läpikäynti tyhjeni omasta toiminnasta (lista auki): "valmis"-ääni kuittausäänen perään.
  const count = plans?.length;
  const prevCount = useRef<number | undefined>(undefined);
  useEffect(() => {
    const prev = prevCount.current;
    prevCount.current = open ? count : undefined;
    if (open && prev !== undefined && prev > 0 && count === 0) playSound('allDone', 0.28);
  }, [open, count]);

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
            {plans &&
              [...plans.filter((p) => p.id === focusPlanId), ...plans.filter((p) => p.id !== focusPlanId)].map((p) => (
                <ReviewRow key={p.id} plan={p} type={types.get(p.activityTypeId)} actions={actions} focused={p.id === focusPlanId} />
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
  focused = false,
}: {
  plan: PlannedSession;
  type?: ActivityType;
  actions: ReturnType<typeof usePlanActions>;
  focused?: boolean;
}) {
  const [mode, setMode] = useState<'idle' | 'skip' | 'edit'>(focused ? 'edit' : 'idle');
  useEffect(() => {
    if (focused) setMode('edit');
  }, [focused]);

  // Pyyhkäisy (kosketus): oikealle = tehty, vasemmalle = ei tehty (syyn valinta); vain perustilassa.
  const idle = mode === 'idle';
  return (
    <SwipeRow
      className="card-sunk"
      innerClassName="p-3"
      right={idle ? { label: 'Tehty', icon: <IconCheck />, tone: 'green', run: () => void actions.confirm(plan) } : undefined}
      left={idle ? { label: 'Ei tehty', icon: <IconClose />, tone: 'red', run: () => setMode('skip') } : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl" aria-hidden>
          <TypeGlyph t={type} />
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
              <IconCheck />
            </IconButton>
            <IconButton label="Ei tehty" onClick={() => setMode('skip')} tone="red">
              <IconClose />
            </IconButton>
            <IconButton label="Kuittaa tiedoilla (kesto, teho, lihas/luusto, verryttely)" onClick={() => setMode('edit')}>
              <IconPencil />
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
        <div className="mt-3 border-t border-[var(--line)] pt-3">
          <ConfirmForm plan={plan} type={type} onConfirm={(d) => actions.confirm(plan, undefined, d)} onCancel={() => setMode('idle')} />
        </div>
      )}
    </SwipeRow>
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
  children: ReactNode;
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
      className={`press hit flex size-10 items-center justify-center rounded-xl text-base font-bold disabled:opacity-30 disabled:shadow-none ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

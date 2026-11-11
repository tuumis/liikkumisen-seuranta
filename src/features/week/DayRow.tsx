import type { ActivityType, DayFlag, DayTotals, FootballDetails, ISODate, PlannedSession, Session, UUID } from '../../domain/types';
import { OUTCOME_LABEL, outcomeOf } from '../../domain/football';
import { mvpaOf } from '../../domain/intensity';
import { dayLabel } from '../../ui/format';
import { SKIP_REASON_LABEL } from '../../ui/labels';
import { useLongPress } from '../../ui/useLongPress';
import { IconButton } from '../review/ReviewSheet';
import { FLAG_LABEL } from './DaySheet';

export function DayRow({
  date,
  isToday,
  isFuture,
  totals,
  sessions,
  plans,
  plannedById,
  footballDetails,
  onFootball,
  types,
  flag,
  barTarget,
  onOpenMenu,
  onEdit,
  onPlanOpen,
  onPlanConfirm,
}: {
  date: ISODate;
  isToday: boolean;
  isFuture: boolean;
  /** Päiväkooste (kirjattu + perusarvio); puuttuu latauksen ajan. */
  totals?: DayTotals;
  sessions: Session[];
  /** Päivän avoimet ja ohitetut suunnitelmat (kuitatut näkyvät kertoina). */
  plans: PlannedSession[];
  plannedById: Map<UUID, PlannedSession>;
  /** Jalkapallokertojen lisätiedot (puuttuva → "Lisää tiedot"). */
  footballDetails?: Map<UUID, FootballDetails>;
  onFootball: (s: Session) => void;
  types: Map<UUID, ActivityType>;
  flag?: DayFlag;
  barTarget: number;
  onOpenMenu: () => void;
  onEdit: (s: Session) => void;
  onPlanOpen: (p: PlannedSession) => void;
  onPlanConfirm: (p: PlannedSession) => void;
}) {
  const press = useLongPress(onOpenMenu);
  const estimated = sessions.some((s) => s.intensitySource === 'profile');
  const logged = totals?.mvpa ?? 0;
  const est = totals ? totals.mvpaCombined - totals.mvpa : 0;
  const loggedPct = Math.min(100, (logged / barTarget) * 100);
  const estPct = Math.min(100 - loggedPct, (est / barTarget) * 100);

  return (
    <li className={`rounded-2xl bg-white ring-1 ${isToday ? 'ring-2 ring-green-700' : 'ring-slate-200'} ${flag ? 'bg-slate-50' : ''}`}>
      <div {...press.handlers} className="no-callout flex select-none items-center gap-2 px-3 pb-1 pt-2">
        <div className={`w-16 shrink-0 text-sm font-semibold ${isFuture ? 'text-slate-400' : isToday ? 'text-green-800' : 'text-slate-900'}`}>
          {dayLabel(date)}
          {isToday && <span className="sr-only"> (tänään)</span>}
        </div>
        {flag && <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-800">{FLAG_LABEL[flag.reason]}</span>}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {totals && !isFuture && (logged > 0 || est > 0) && (
            <>
              <div className="flex h-2 w-12 shrink-0 gap-px overflow-hidden rounded-full bg-slate-100" aria-hidden>
                <div className="h-full bg-green-600" style={{ width: `${loggedPct}%` }} />
                <div className="h-full bg-green-300" style={{ width: `${estPct}%` }} />
              </div>
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-slate-700" title="Reipas ja rasittava liikkuminen (kirjattu + perusarvio)">
                {logged} min{est > 0 && <span className="text-slate-500">+{est}</span>}
                {(estimated || est > 0) && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-900">arvio</span>}
              </span>
            </>
          )}
          <button
            type="button"
            onClick={onOpenMenu}
            className="min-h-9 min-w-9 shrink-0 rounded-full text-lg leading-none text-slate-500 active:bg-slate-100"
            aria-label={`Päivän ${dayLabel(date)} toiminnot`}
          >
            ⋯
          </button>
        </div>
      </div>

      {sessions.length + plans.length > 0 ? (
        <ul className="px-2 pb-2">
          {sessions.map((s) => {
            const t = types.get(s.activityTypeId);
            const tags = [s.muscle && 'lihas', s.bone && 'luusto'].filter(Boolean).join(' · ');
            const plan = s.plannedSessionId ? plannedById.get(s.plannedSessionId) : undefined;
            const isFootball = t?.sport === 'football';
            const fd = isFootball ? footballDetails?.get(s.id) : undefined;
            const fbText = fd ? footballSummary(t?.footballKind, fd) : '';
            return (
              <li key={s.id} className="flex items-center gap-1">
                <button type="button" onClick={() => onEdit(s)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left active:bg-slate-50">
                  <span className="text-xl" aria-hidden>
                    {t?.icon ?? '•'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{t?.name ?? 'Tuntematon laji'}</span>
                    <span className="block truncate text-xs text-slate-600">
                      {s.durationMin} min
                      {plan && plan.durationMin !== s.durationMin && ` (suunn. ${plan.durationMin})`}
                      {s.playedMin !== undefined && ` · pelattu ${s.playedMin}`} · reipas+rasittava {s.intensitySource === 'profile' ? 'arviolta ' : ''}
                      {mvpaOf(s.minutes)} min{tags && ` · ${tags}`}
                      {s.note && ` · ${s.note}`}
                    </span>
                    {fbText && <span className="block truncate text-xs text-slate-700">{fbText}</span>}
                  </span>
                  <span className="text-slate-400" aria-hidden>
                    ✎
                  </span>
                </button>
                {isFootball && footballDetails && !fd && (
                  <button
                    type="button"
                    onClick={() => onFootball(s)}
                    className="min-h-9 shrink-0 rounded-full bg-amber-50 px-2 text-xs font-medium text-amber-900 ring-1 ring-amber-200 active:bg-amber-100"
                  >
                    + tiedot
                  </button>
                )}
              </li>
            );
          })}
          {plans.map((p) => {
            const t = types.get(p.activityTypeId);
            const skipped = p.status === 'skipped';
            return (
              <li key={p.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPlanOpen(p)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left opacity-60 active:bg-slate-50"
                >
                  <span className="text-xl grayscale" aria-hidden>
                    {t?.icon ?? '•'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium text-slate-700 ${skipped ? 'line-through' : ''}`}>{t?.name ?? 'Laji'}</span>
                    <span className="block truncate text-xs text-slate-600">
                      {skipped
                        ? `Ei tehty${p.skipReason ? ` · ${SKIP_REASON_LABEL[p.skipReason].toLowerCase()}` : ''}`
                        : `Suunniteltu${p.startTime ? ` klo ${p.startTime}` : ''} · ${p.durationMin} min`}
                    </span>
                  </span>
                </button>
                {!skipped && (
                  <div className="flex shrink-0 gap-1 pr-1">
                    <IconButton label="Tehty kuten suunniteltu" tone="green" disabled={isFuture} onClick={() => onPlanConfirm(p)}>
                      ✓
                    </IconButton>
                    <IconButton label="Ei tehty" tone="red" onClick={() => onPlanOpen(p)}>
                      ✗
                    </IconButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-3 pb-2 text-xs text-slate-400">{isFuture ? '' : 'Ei kirjauksia'}</div>
      )}
    </li>
  );
}

/** Lyhyt jalkapallorivi: tulos, turnaus, viihtyminen ja tagit. */
function footballSummary(kind: string | undefined, d: FootballDetails): string {
  const parts: string[] = [];
  if (kind === 'game' && d.goalsFor !== undefined && d.goalsAgainst !== undefined) {
    const o = outcomeOf(d.goalsFor, d.goalsAgainst)!;
    parts.push(`${d.goalsFor}–${d.goalsAgainst} ${OUTCOME_LABEL[o]}${d.opponent ? ` vs ${d.opponent}` : ''}`);
  } else if (kind === 'game' && d.opponent) parts.push(`vs ${d.opponent}`);
  if (kind === 'tournament') parts.push(`${d.eventName ?? 'Turnaus'} · ${d.games?.length ?? d.gamesCount ?? '?'} peliä`);
  if (d.attendance === 'partial') parts.push('osittain');
  if (d.enjoyment) parts.push(['', '🙁', '🙂', '😄'][d.enjoyment]);
  if (d.parentRating) parts.push('★'.repeat(d.parentRating));
  if (d.focusTags.length) parts.push(`${d.focusTags.length} tagia`);
  return parts.join(' · ');
}

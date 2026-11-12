import type { ActivityType, DayFlag, DayTotals, Fixture, FootballDetails, ISODate, PlannedSession, Session, UUID } from '../../domain/types';
import { LEVEL_LABEL, OUTCOME_LABEL, outcomeOf } from '../../domain/football';

/** "vs HJK · Elite · " tulevan pelin suunnitelmariville. */
function fixtureText(f?: Fixture): string {
  if (!f) return '';
  const parts = [f.opponent ? `vs ${f.opponent}` : f.eventName, f.level ? LEVEL_LABEL[f.level] : undefined, f.location].filter(Boolean);
  return parts.length ? `${parts.join(' · ')} · ` : '';
}
import { mvpaOf } from '../../domain/intensity';
import { dayLabel, formatDate } from '../../ui/format';
import { SKIP_REASON_LABEL } from '../../ui/labels';
import { useLongPress } from '../../ui/useLongPress';
import { IconButton } from '../review/ReviewSheet';
import { FLAG_LABEL } from './DaySheet';
import { TypeIcon } from './Dashboard';

export function DayRow({
  index = 0,
  date,
  isToday,
  isFuture,
  totals,
  sessions,
  plans,
  plannedById,
  fixtures,
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
  /** Järjestys porrastettua sisääntuloa varten. */
  index?: number;
  date: ISODate;
  isToday: boolean;
  isFuture: boolean;
  /** Päiväkooste (kirjattu + perusarvio); puuttuu latauksen ajan. */
  totals?: DayTotals;
  sessions: Session[];
  /** Päivän avoimet ja ohitetut suunnitelmat (kuitatut näkyvät kertoina). */
  plans: PlannedSession[];
  plannedById: Map<UUID, PlannedSession>;
  /** Tulevien pelien ja turnausten tiedot suunnitelmille (pelikalenteri). */
  fixtures?: Map<UUID, Fixture>;
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

  const dayNo = Number(date.slice(8, 10));
  const weekday = dayLabel(date).split(' ')[0];
  const full = formatDate(date, 'EEEE');
  const weekdayName = full.charAt(0).toUpperCase() + full.slice(1);

  return (
    <li
      className={`anim-rise overflow-hidden rounded-[1.5rem] ${
        isToday
          ? 'bg-[linear-gradient(160deg,var(--surface-sage),var(--surface))] shadow-md ring-2 ring-green-700/70'
          : flag
            ? 'bg-[var(--surface-sunk)]'
            : 'card'
      }`}
      style={{ ['--i' as string]: index + 3 }}
    >
      <div {...press.handlers} className="no-callout flex select-none items-center gap-3 px-4 pb-1.5 pt-3">
        <div className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-2xl leading-none ${isToday ? 'bg-green-700 text-white shadow-[0_6px_14px_-6px_rgb(36_76_59/0.7)]' : isFuture ? 'bg-[var(--surface-sunk)] text-slate-400' : 'bg-[var(--surface-sunk)] text-slate-800'}`}>
          <span className="text-[9.5px] font-bold uppercase tracking-wider opacity-80">{weekday}</span>
          <span className="stat text-[17px] font-semibold">{dayNo}</span>
        </div>
        <div className="min-w-0">
          <div className={`text-sm font-bold ${isToday ? 'text-green-800' : isFuture ? 'text-slate-500' : 'text-slate-900'}`}>
            {isToday ? 'Tänään' : weekdayName}
            {isToday && <span className="sr-only"> ({dayLabel(date)})</span>}
          </div>
          {flag && <span className="mt-0.5 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{FLAG_LABEL[flag.reason]}</span>}
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {totals && !isFuture && (logged > 0 || est > 0) && (
            <>
              <div className="flex h-2 w-14 shrink-0 gap-[2px] overflow-hidden rounded-full bg-[var(--viz-track)]" aria-hidden>
                <div className="anim-grow-x h-full rounded-full" style={{ width: `${loggedPct}%`, background: 'var(--viz-logged)' }} />
                {estPct > 0 && <div className="anim-grow-x h-full rounded-full" style={{ width: `${estPct}%`, background: 'var(--viz-estimate)' }} />}
              </div>
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-slate-700" title="Reipas ja rasittava liikkuminen (kirjattu + perusarvio)">
                <span className="stat text-[15px]">{logged}</span>
                {est > 0 && <span className="text-slate-500">+{est}</span>}
                <span className="font-medium text-slate-500">min</span>
                {(estimated || est > 0) && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-900">arvio</span>}
              </span>
            </>
          )}
          <button
            type="button"
            onClick={onOpenMenu}
            className="press flex size-9 shrink-0 items-center justify-center rounded-full text-lg leading-none text-slate-500 hover:bg-[var(--surface-sunk)]"
            aria-label={`Päivän ${dayLabel(date)} toiminnot`}
          >
            ⋯
          </button>
        </div>
      </div>

      {sessions.length + plans.length > 0 ? (
        <ul className="space-y-1 px-2 pb-2.5">
          {sessions.map((s) => {
            const t = types.get(s.activityTypeId);
            const tags = [s.muscle && 'lihas', s.bone && 'luusto'].filter(Boolean).join(' · ');
            const plan = s.plannedSessionId ? plannedById.get(s.plannedSessionId) : undefined;
            const isFootball = t?.sport === 'football';
            const fd = isFootball ? footballDetails?.get(s.id) : undefined;
            const fbText = fd ? footballSummary(t?.footballKind, fd) : '';
            return (
              <li key={s.id} className="flex items-center gap-1">
                <button type="button" onClick={() => onEdit(s)} className="press flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-[color-mix(in_oklab,var(--surface-sunk)_70%,transparent)]">
                  <TypeIcon t={t} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{t?.name ?? 'Tuntematon laji'}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {s.durationMin} min
                      {plan && plan.durationMin !== s.durationMin && ` (suunn. ${plan.durationMin})`}
                      {s.playedMin !== undefined && ` · pelattu ${s.playedMin}`} · reipas+rasittava {s.intensitySource === 'profile' ? '≈ ' : ''}
                      {mvpaOf(s.minutes)} min{tags && ` · ${tags}`}
                      {s.note && ` · ${s.note}`}
                    </span>
                    {fbText && <span className="block truncate text-xs font-medium text-slate-700">{fbText}</span>}
                  </span>
                </button>
                {isFootball && footballDetails && !fd && (
                  <button
                    type="button"
                    onClick={() => onFootball(s)}
                    className="press min-h-9 shrink-0 rounded-full bg-amber-100 px-3 text-xs font-bold text-amber-900 hover:bg-amber-200"
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
              <li key={p.id} className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-[color-mix(in_oklab,var(--surface)_60%,transparent)] pr-1">
                <button type="button" onClick={() => onPlanOpen(p)} className="press flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left">
                  <TypeIcon t={t} size="sm" muted />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-semibold text-slate-600 ${skipped ? 'line-through' : ''}`}>{t?.name ?? 'Laji'}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {skipped
                        ? `Ei tehty${p.skipReason ? ` · ${SKIP_REASON_LABEL[p.skipReason].toLowerCase()}` : ''}`
                        : fixtureText(fixtures?.get(p.id)) + `Suunniteltu${p.startTime ? ` klo ${p.startTime}` : ''} · ${p.durationMin} min`}
                    </span>
                  </span>
                </button>
                {!skipped && (
                  <div className="flex shrink-0 gap-1">
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
        <div className="px-4 pb-3 pl-[4.5rem] text-xs text-slate-400">{isFuture ? 'Ei suunnitelmia' : 'Ei kirjauksia'}</div>
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
  if (d.ratingNote) parts.push(`💬 ${d.ratingNote.split(/\r?\n/)[0].slice(0, 60)}`);
  return parts.join(' · ');
}

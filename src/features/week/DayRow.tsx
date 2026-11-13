import type { ActivityType, DayFlag, DayTotals, Fixture, FootballDetails, ISODate, PlannedSession, Session, UUID } from '../../domain/types';
import type { DayHours } from '../../domain/hours';
import { InfoTip } from '../../ui/InfoTip';
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
import { IconPlus, IconSun } from '../../ui/icons';
import { isFresh, useConfirmFeedback } from '../../ui/fresh';
import { morphOpen } from '../../ui/morph';
import { CATEGORY_LABEL } from '../../ui/labels';
import { isEstimateConfirmation } from '../../domain/hours';

export function DayRow({
  index = 0,
  date,
  isToday,
  isFuture,
  totals,
  hours,
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
  onAdd,
  onPlan,
  onEdit,
  onPlanOpen,
  onPlanConfirm,
  onEstimate,
}: {
  /** Järjestys porrastettua sisääntuloa varten. */
  index?: number;
  date: ISODate;
  isToday: boolean;
  isFuture: boolean;
  /** Päiväkooste (kirjattu + perusarvio); puuttuu latauksen ajan. */
  totals?: DayTotals;
  /** Päivän kokonaisliikunta kestona (kirjatut kerrat + perusarvio). */
  hours?: DayHours;
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
  /** Uusi kerta tälle päivälle; tulevalle päivälle "+" lisää suunnitellun kerran (`onPlan`). */
  onAdd?: () => void;
  onPlan?: () => void;
  onEdit: (s: Session) => void;
  onPlanOpen: (p: PlannedSession) => void;
  onPlanConfirm: (p: PlannedSession) => void;
  /** Avaa päivän arkiliikunnan tarkistuksen (vahvista / muuta / ei tänään). */
  onEstimate?: () => void;
}) {
  const press = useLongPress(onOpenMenu);
  const estimated = sessions.some((s) => s.intensitySource === 'profile');
  const logged = totals?.mvpa ?? 0;
  const est = totals ? totals.mvpaCombined - totals.mvpa : 0;
  const loggedPct = Math.min(100, (logged / barTarget) * 100);
  const estPct = Math.min(100 - loggedPct, (est / barTarget) * 100);

  const dayNo = Number(date.slice(8, 10));
  // Arkiliikunta näkyy jokaisella päivällä omana rivinään: arvio (ei sairas-/matkapäivinä) ja päiväkohtaisesti
  // vahvistetut. Tarkistus tehdään kyseisenä päivänä tai jälkikäteen; vahvistettu jää riville näkyviin.
  const confirmed = sessions.filter(isEstimateConfirmation);
  const listed = sessions.filter((s) => !isEstimateConfirmation(s));
  const pendingMin = hours && !flag ? hours.estimateMin : 0;
  const estimateRow =
    pendingMin > 0 || confirmed.length > 0
      ? {
          pendingMin,
          pendingCats: pendingMin > 0 ? hours!.estimateCategories : [],
          confirmed: confirmed.map((s) => ({ id: s.id, name: CATEGORY_LABEL[types.get(s.activityTypeId)?.category ?? 'other'], min: s.durationMin })),
        }
      : null;
  // Kuittauksen palaute: suunnitelma painuu pois ennen kuin kerta ilmestyy tilalle (välähdys + valintamerkki).
  const { leaving, confirm: confirmWithFeedback } = useConfirmFeedback(onPlanConfirm);
  const weekday = dayLabel(date).split(' ')[0];
  const full = formatDate(date, 'EEEE');
  const weekdayName = full.charAt(0).toUpperCase() + full.slice(1);

  return (
    <li
      className={`anim-rise relative rounded-[1.5rem] focus-within:z-10 hover:z-10 ${
        isToday
          ? 'bg-[linear-gradient(160deg,var(--surface-sage),var(--surface))] shadow-md ring-2 ring-green-700/70'
          : flag
            ? 'bg-[var(--surface-sunk)]'
            : 'card'
      }`}
      style={{ ['--i' as string]: index + 3 }}
    >
      <div {...press.handlers} className="no-callout flex select-none items-center gap-3 px-4 pb-1.5 pt-3">
        <div className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-2xl leading-none ${isToday ? 'bg-green-700 text-white shadow-[0_6px_14px_-6px_rgb(var(--accent-rgb)/0.7)]' : isFuture ? 'bg-[var(--surface-sunk)] text-slate-400' : 'bg-[var(--surface-sunk)] text-slate-800'}`}>
          <span className="text-[9.5px] font-bold uppercase tracking-wider opacity-80">{weekday}</span>
          <span className="stat text-[17px] font-semibold">{dayNo}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className={`${isToday ? '' : 'hidden sm:block'} truncate text-sm font-bold ${isToday ? 'text-green-800' : isFuture ? 'text-slate-500' : 'text-slate-900'}`}>
            {isToday ? 'Tänään' : weekdayName}
            {isToday && <span className="sr-only"> ({dayLabel(date)})</span>}
          </div>
          {flag && <span className="mt-0.5 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{FLAG_LABEL[flag.reason]}</span>}
          {hours?.holiday && !flag && (
            <span className="mt-0.5 inline-block rounded-full bg-[var(--surface-sunk)] px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200" title="Lomapäivä: arkiliikunta viikonlopun arvoilla">
              Loma
            </span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {totals && !isFuture && (logged > 0 || est > 0 || (hours?.actualMin ?? 0) > 0) && (
            <div className="flex flex-col items-end gap-1">
              {/* Kokonaismäärä (kaikki liikunta kestona) mittarin yläpuolella. */}
              {hours && hours.actualMin > 0 && (
                <InfoTip
                  className="whitespace-nowrap text-[13px] font-bold text-slate-900"
                  tip={
                    <>
                      <strong className="block text-[13px]">Liikuntaa yhteensä {hours.actualMin} min</strong>
                      Kaikki liikunta kestona: kevyt, reipas ja rasittava. {hours.actualLoggedMin} min kirjatuista kerroista
                      {hours.actualMin > hours.actualLoggedMin && `, ${hours.actualMin - hours.actualLoggedMin} min arkiliikunnan perusarviosta`}.
                    </>
                  }
                >
                  <span className="stat text-[15px]">{hours.actualMin}</span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    min{hours.actualMin > hours.actualLoggedMin ? `, josta arvio ${hours.actualMin - hours.actualLoggedMin}` : ' yhteensä'}
                  </span>
                </InfoTip>
              )}
              <div className="flex items-center gap-1.5">
              <div className="flex h-1.5 w-12 shrink-0 gap-[2px] overflow-hidden rounded-full bg-[var(--viz-track)]" aria-hidden>
                <div className="anim-grow-x h-full rounded-full" style={{ width: `${loggedPct}%`, background: 'var(--viz-logged)', transition: 'width 0.7s var(--ease-out)' }} />
                {estPct > 0 && <div className="anim-grow-x h-full rounded-full" style={{ width: `${estPct}%`, background: 'var(--viz-estimate)', transition: 'width 0.7s var(--ease-out)' }} />}
              </div>
              <InfoTip
                className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-slate-700"
                tip={
                  <>
                    <strong className="block text-[13px]">Reipas ja rasittava liikunta</strong>
                    {logged} min kirjatuista kerroista{estimated ? ' (arvio lajin tyypillisestä tehosta)' : ''}.
                    {est > 0 && (
                      <>
                        {' '}
                        <strong>+{est} min</strong> on arkiliikunnan perusarviota (esim. välitunnit, koulumatkat), joka lasketaan mukaan, kun päivälle ei ole kirjattu sen kategorian liikuntaa.
                      </>
                    )}
                  </>
                }
              >
                <span className="tabular-nums">{logged}</span>
                {est > 0 && <span className="text-slate-500">+{est}</span>}
                <span className="font-medium text-slate-500">reipas+</span>
                {(estimated || est > 0) && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-900">arvio</span>}
              </InfoTip>
              </div>
            </div>
          )}
          {(isFuture ? onPlan : onAdd) && (
            <button
              type="button"
              onClick={isFuture ? onPlan : onAdd}
              className="press relative flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-500 before:absolute before:-inset-1.5 hover:border-slate-400 hover:bg-[var(--surface-sunk)] hover:text-slate-900"
              aria-label={isFuture ? `Suunnittele kerta: ${dayLabel(date)}` : `Lisää kerta: ${dayLabel(date)}`}
              title={isFuture ? 'Suunnittele kerta tälle päivälle (kuitataan päivänä)' : 'Lisää kerta tälle päivälle'}
            >
              <IconPlus size="0.8rem" />
            </button>
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

      {listed.length + plans.length + (estimateRow ? 1 : 0) > 0 ? (
        <ul className="space-y-1 px-2 pb-2.5">
          {listed.map((s) => {
            const t = types.get(s.activityTypeId);
            const tags = [s.muscle && 'lihas', s.bone && 'luusto'].filter(Boolean).join(' · ');
            const plan = s.plannedSessionId ? plannedById.get(s.plannedSessionId) : undefined;
            const isFootball = t?.sport === 'football';
            const fd = isFootball ? footballDetails?.get(s.id) : undefined;
            const fbText = fd ? footballSummary(t?.footballKind, fd) : '';
            return (
              <li key={s.id} className={`flex items-center gap-1 rounded-2xl ${isFresh(s.id) ? 'row-fresh' : ''}`}>
                <button type="button" onClick={(e) => morphOpen(e.currentTarget.closest('li'), () => onEdit(s))} className="press flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-[color-mix(in_oklab,var(--surface-sunk)_70%,transparent)]">
                  <span className="relative shrink-0">
                    <TypeIcon t={t} size="sm" />
                    {isFresh(s.id) && (
                      <span className="fresh-check absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-green-700 text-white ring-2 ring-[var(--surface)]" aria-hidden>
                        <svg viewBox="0 0 16 16" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" pathLength={1} />
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {s.label ? (
                        <>
                          {s.label} <span className="font-medium text-slate-500">· {t?.name ?? 'Laji'}</span>
                        </>
                      ) : (
                        (t?.name ?? 'Tuntematon laji')
                      )}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {s.durationMin === 0 ? (
                        'Ei tänä päivänä (merkitty) – arkiliikuntaa ei lasketa'
                      ) : (
                        <>
                          {s.durationMin} min
                      {plan && plan.durationMin !== s.durationMin && ` (suunn. ${plan.durationMin})`}
                      {s.playedMin !== undefined && ` · pelattu ${s.playedMin}`} · {s.intensitySource === 'manual' ? 'reipas+rasittava' : 'arvio: reipas+rasittava'} {mvpaOf(s.minutes)} min
                      {tags && ` · ${tags}`}
                      {s.note && ` · ${s.note}`}
                    
                        </>
                      )}
                    </span>
                    {fbText && <span className="block truncate text-xs font-medium text-slate-700">{fbText}</span>}
                  </span>
                </button>
                {isFootball && footballDetails && !fd && (
                  <button
                    type="button"
                    onClick={() => onFootball(s)}
                    className="press min-h-9 shrink-0 rounded-full bg-amber-100 px-3 text-xs font-bold text-amber-900 hover:bg-amber-200 dark:hover:bg-amber-900"
                  >
                    + tiedot
                  </button>
                )}
              </li>
            );
          })}
          {estimateRow && (
            <li className="flex items-center gap-2 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 pr-1 dark:border-amber-800 dark:bg-amber-950/45">
              {(() => {
                const pending = estimateRow.pendingMin > 0;
                const parts = [
                  ...estimateRow.confirmed.map((c) => `${c.name.toLowerCase()} ${c.min > 0 ? `${c.min} min` : 'ei tänä päivänä'} ✓`),
                  ...(pending
                    ? [`${estimateRow.pendingCats.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(', ')} ${estimateRow.pendingMin} min${estimateRow.confirmed.length ? ' (arvio)' : ''}`]
                    : []),
                ];
                const body = (
                  <>
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-2xl ${pending ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'} ${isFuture ? 'opacity-70' : ''}`}
                      aria-hidden
                    >
                      <IconSun size="1.15rem" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${isFuture ? 'text-slate-600' : 'text-slate-800'}`}>
                        Arkiliikunta{' '}
                        {pending ? <span className="font-medium text-amber-800">(arvio)</span> : <span className="font-medium text-green-800">· vahvistettu</span>}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {parts.join(' · ')}
                        {isFuture && ' · tarkistetaan päivänä'}
                      </span>
                    </span>
                  </>
                );
                return isFuture ? (
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2">{body}</div>
                ) : (
                  <button type="button" onClick={onEstimate} className="press flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left">
                    {body}
                  </button>
                );
              })()}
              {!isFuture && (
                <button
                  type="button"
                  onClick={onEstimate}
                  className={`press min-h-9 shrink-0 rounded-full px-3 text-xs font-bold ${estimateRow.pendingMin > 0 ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:hover:bg-amber-900' : 'bg-[var(--surface-sunk)] text-slate-700 hover:bg-slate-200'}`}
                >
                  {estimateRow.pendingMin > 0 ? 'Tarkista' : 'Muuta'}
                </button>
              )}
            </li>
          )}
          {plans.map((p) => {
            const t = types.get(p.activityTypeId);
            const skipped = p.status === 'skipped';
            return (
              <li
                key={p.id}
                className={`flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-[color-mix(in_oklab,var(--surface)_60%,transparent)] pr-1 ${leaving.has(p.id) ? 'plan-leaving' : ''}`}
              >
                <button type="button" onClick={(e) => morphOpen(e.currentTarget.closest('li'), () => onPlanOpen(p))} className="press flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left">
                  <TypeIcon t={t} size="sm" muted />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-semibold text-slate-600 ${skipped ? 'line-through' : ''}`}>
                      {p.label ? `${p.label} · ${t?.name ?? 'Laji'}` : (t?.name ?? 'Laji')}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {skipped
                        ? `Ei tehty${p.skipReason ? ` · ${SKIP_REASON_LABEL[p.skipReason].toLowerCase()}` : ''}`
                        : fixtureText(fixtures?.get(p.id)) + `Suunniteltu${p.startTime ? ` klo ${p.startTime}` : ''} · ${p.durationMin} min`}
                    </span>
                  </span>
                </button>
                {!skipped && (
                  <div className="flex shrink-0 gap-1">
                    <IconButton label="Tehty kuten suunniteltu" tone="green" disabled={isFuture} onClick={() => confirmWithFeedback(p)}>
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

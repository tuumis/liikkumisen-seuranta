// Päivät taulukkona: tiivis vaihtoehto päiväkorteille. Yksi rivi per päivä: kerrat ja suunnitelmat
// pieninä nappeina, arkiliikunta katkoviivalla, päivän kokonaisminuutit ja reipas+rasittava.
// Samat toiminnot kuin korteissa: kerta → muokkaus, suunnitelma → paneeli, arkiliikunta → tarkistus,
// päivä → päivän toiminnot (lisää kerta, sairas- tai matkapäivä).

import type { DayHours } from '../../domain/hours';
import { isEstimateConfirmation } from '../../domain/hours';
import type { ActivityType, DayFlag, DayTotals, ISODate, PlannedSession, Session, UUID } from '../../domain/types';
import { dayLabel } from '../../ui/format';
import { FLAG_LABEL } from './DaySheet';

export interface DayTableRow {
  date: ISODate;
  isToday: boolean;
  isFuture: boolean;
  totals?: DayTotals;
  hours?: DayHours;
  sessions: Session[];
  plans: PlannedSession[];
  flag?: DayFlag;
}

/** Lyhyt nimi taulukkoon: tarkenne tai lajin nimen loppuosa ("Jalkapallo – treeni" → "Treeni"). */
function shortName(s: { label?: string }, t?: ActivityType): string {
  if (s.label) return s.label;
  const n = t?.name ?? 'Laji';
  const tail = n.includes(' – ') ? n.split(' – ').pop()! : n;
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}

const chip = 'press inline-flex max-w-full items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold leading-none';

export function DayTable({
  rows,
  types,
  onEdit,
  onPlanOpen,
  onEstimate,
  onOpenMenu,
}: {
  rows: DayTableRow[];
  types: Map<UUID, ActivityType>;
  onEdit: (s: Session) => void;
  onPlanOpen: (p: PlannedSession) => void;
  onEstimate: (date: ISODate) => void;
  onOpenMenu: (date: ISODate) => void;
}) {
  const sum = rows.reduce(
    (a, r) => {
      const listed = r.sessions.filter((s) => !isEstimateConfirmation(s));
      return {
        count: a.count + listed.length,
        total: a.total + (r.isFuture ? 0 : (r.hours?.actualMin ?? 0)),
        logged: a.logged + (r.totals?.mvpa ?? 0),
        est: a.est + (r.totals ? r.totals.mvpaCombined - r.totals.mvpa : 0),
      };
    },
    { count: 0, total: 0, logged: 0, est: 0 },
  );

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[4.25rem] sm:w-24" />
          <col />
          <col className="w-12 sm:w-16" />
          <col className="w-[4.25rem] sm:w-24" />
        </colgroup>
        <thead>
          <tr className="text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            <th scope="col" className="px-3 py-2.5 font-bold">
              Päivä
            </th>
            <th scope="col" className="px-1 py-2.5 font-bold">
              Kerrat
            </th>
            <th scope="col" className="px-1 py-2.5 text-right font-bold" title="Kaikki liikunta minuutteina (kevyt, reipas, rasittava)">
              Min
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-bold" title="Reipas ja rasittava liikunta minuutteina; + on arkiliikunnan arviota">
              Reipas+
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const listed = r.sessions.filter((s) => !isEstimateConfirmation(s));
            const confirmed = r.sessions.filter(isEstimateConfirmation);
            const pending = r.hours && !r.flag ? r.hours.estimateMin : 0;
            const confirmedMin = confirmed.reduce((a, s) => a + s.durationMin, 0);
            const logged = r.totals?.mvpa ?? 0;
            const est = r.totals ? r.totals.mvpaCombined - r.totals.mvpa : 0;
            const [wd, dm] = dayLabel(r.date).split(' ');
            return (
              <tr key={r.date} className={`border-t border-slate-200/70 align-top ${r.isToday ? 'bg-[var(--surface-sage)]' : ''} ${r.flag ? 'bg-[var(--surface-sunk)]' : ''}`}>
                <th scope="row" className="p-0 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => onOpenMenu(r.date)}
                    className="press flex w-full flex-col items-start px-3 py-2.5 text-left"
                    aria-label={`Päivän ${dayLabel(r.date)} toiminnot`}
                  >
                    <span className={`text-sm font-bold leading-tight ${r.isToday ? 'text-green-800' : r.isFuture ? 'text-slate-500' : 'text-slate-900'}`}>{wd}</span>
                    <span className="text-[11px] leading-tight text-slate-500">{r.isToday ? 'tänään' : dm}</span>
                  </button>
                </th>
                <td className="px-1 py-2">
                  <div className="flex flex-wrap gap-1">
                    {r.flag && <span className="rounded-lg bg-slate-200 px-1.5 py-1 text-xs font-semibold leading-none text-slate-700">{FLAG_LABEL[r.flag.reason]}</span>}
                    {listed.map((s) => {
                      const t = types.get(s.activityTypeId);
                      return (
                        <button key={s.id} type="button" onClick={() => onEdit(s)} className={`${chip} bg-[var(--surface-sage)] text-slate-800 hover:brightness-95`} title={`${t?.name ?? ''} ${s.durationMin} min`}>
                          <span aria-hidden>{t?.icon}</span>
                          <span className="truncate">{shortName(s, t)}</span>
                          <span className="tabular-nums text-slate-500">{s.durationMin}</span>
                        </button>
                      );
                    })}
                    {r.plans.map((p) => {
                      const t = types.get(p.activityTypeId);
                      const skipped = p.status === 'skipped';
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onPlanOpen(p)}
                          className={`${chip} border border-dashed border-slate-300 text-slate-500 ${skipped ? 'line-through opacity-70' : ''}`}
                          title={`Suunniteltu: ${t?.name ?? ''} ${p.durationMin} min${skipped ? ' (ei tehty)' : ''}`}
                        >
                          <span aria-hidden className="grayscale-[0.6]">
                            {t?.icon}
                          </span>
                          <span className="truncate">{shortName(p, t)}</span>
                          <span className="tabular-nums">{p.durationMin}</span>
                        </button>
                      );
                    })}
                    {(pending > 0 || confirmed.length > 0) && (
                      <button
                        type="button"
                        disabled={r.isFuture}
                        onClick={() => onEstimate(r.date)}
                        className={`${chip} border border-dashed border-amber-300 bg-amber-50/60 text-slate-700 disabled:cursor-default dark:border-amber-800 dark:bg-amber-950/45`}
                        title={r.isFuture ? 'Arkiliikunnan arvio – tarkistetaan päivänä' : 'Arkiliikunta: vahvista, muuta tai merkitse ei tänä päivänä'}
                      >
                        <span aria-hidden>☀️</span>
                        <span>Arki</span>
                        {confirmed.length > 0 && <span className="tabular-nums text-green-800">{confirmedMin > 0 ? confirmedMin : 'ei'} ✓</span>}
                        {pending > 0 && <span className="tabular-nums text-amber-800">{pending} arvio</span>}
                      </button>
                    )}
                    {listed.length + r.plans.length === 0 && pending === 0 && confirmed.length === 0 && !r.flag && <span className="px-1 py-1 text-xs text-slate-400">–</span>}
                  </div>
                </td>
                <td className="px-1 py-2.5 text-right">
                  {!r.isFuture && (r.hours?.actualMin ?? 0) > 0 ? (
                    <span className="stat text-[15px] text-slate-900">{r.hours!.actualMin}</span>
                  ) : (
                    <span className="text-slate-400">–</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-xs">
                  {!r.isFuture && (logged > 0 || est > 0) ? (
                    <span className="whitespace-nowrap">
                      <span className="font-semibold tabular-nums text-slate-800">{logged}</span>
                      {est > 0 && <span className="tabular-nums text-amber-800">+{est}</span>}
                    </span>
                  ) : (
                    <span className="text-slate-400">–</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 text-xs font-semibold text-slate-600">
            <th scope="row" className="px-3 py-2.5 text-left font-bold">
              Yht.
            </th>
            <td className="px-1 py-2.5">
              {sum.count} {sum.count === 1 ? 'kerta' : 'kertaa'}
            </td>
            <td className="px-1 py-2.5 text-right tabular-nums text-slate-900">{sum.total}</td>
            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
              <span className="text-slate-900">{sum.logged}</span>
              {sum.est > 0 && <span className="text-amber-800">+{sum.est}</span>}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

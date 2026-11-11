// Viikon liikuntatunnit: arvio (viikkopohja + perusarvio) ja toteuma (kirjatut + perusarvio) rinnakkain.
// Bullet-tyyli: arvio on taustarata, toteuma täyttö sen päällä. Kesto kellotunteina.

import type { PeriodReport } from '../../domain/report';
import { formatHours } from '../../domain/hours';
import { isoWeekday } from '../../domain/dates';
import { CATEGORY_LABEL } from '../../ui/labels';
import { dayLabel } from '../../ui/format';

// CSS-muuttujat (index.css) vaihtuvat vaalean ja tumman teeman mukana.
const C = {
  logged: 'var(--viz-logged)', // kirjattu (kategorinen paikka 1)
  estimate: 'var(--viz-estimate-soft)', // perusarvio (sama sävy, eri askel)
  track: 'var(--viz-track)',
  trackLine: 'var(--viz-track-line)',
  trackFill: 'var(--viz-track-fill)',
};
const WD = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];

const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

function Split({ sessions, estimate, sessionsLabel }: { sessions: number; estimate: number; sessionsLabel: string }) {
  return (
    <div className="mt-1 space-y-0.5 text-xs text-slate-600">
      <div className="flex justify-between gap-2">
        <span>{sessionsLabel}</span>
        <span className="tabular-nums">{formatHours(sessions)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>perusarvio</span>
        <span className="tabular-nums">{formatHours(estimate)}</span>
      </div>
    </div>
  );
}

export function HoursCard({ report, isCurrentWeek }: { report: PeriodReport; isCurrentWeek: boolean }) {
  const h = report.hours;
  const max = Math.max(h.expectedMin, h.actualMin, 1);
  const loggedW = (h.actual.sessions / max) * 100;
  const estW = (h.actual.estimate / max) * 100;
  const toDateX = (h.expectedToDateMin / max) * 100;
  const mvpa = report.days.reduce((a, d) => a + d.mvpaCombined, 0);
  const dayMax = Math.max(1, ...h.days.map((d) => Math.max(d.expectedMin, d.actualMin)));
  const catMax = Math.max(1, ...h.byCategory.map((c) => Math.max(c.expected.sessions + c.expected.estimate, c.actual.sessions + c.actual.estimate)));
  const empty = h.expectedMin === 0 && h.actualMin === 0;

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:p-5">
      <h2 className="text-base font-semibold text-slate-900">Viikon liikuntatunnit</h2>
      {empty ? (
        <p className="mt-2 text-sm text-slate-600">Ei vielä arviota eikä kirjauksia. Lisää viikkopohja ja perusarviot Asetuksissa, niin arvio näkyy tässä.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Toteuma</div>
              <div className="mt-0.5 text-3xl font-semibold tabular-nums text-slate-900">{formatHours(h.actualMin)}</div>
              <Split sessions={h.actual.sessions} estimate={h.actual.estimate} sessionsLabel="kirjattu" />
            </div>
            <div className="rounded-xl p-3 ring-1 ring-slate-200">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Arvio</div>
              <div className="mt-0.5 text-3xl font-semibold tabular-nums text-slate-500">{formatHours(h.expectedMin)}</div>
              <Split sessions={h.expected.sessions} estimate={h.expected.estimate} sessionsLabel="suunniteltu" />
            </div>
          </div>

          {/* Edistyminen: arvio taustana, toteuma täyttönä, merkki = arvio tähän mennessä. */}
          <div className="mt-4">
            <div className="relative h-3 rounded-full bg-slate-100" aria-hidden>
              <div className="absolute inset-y-0 left-0 rounded-full border border-dashed" style={{ width: `${(h.expectedMin / max) * 100}%`, borderColor: C.trackLine, background: C.track }} />
              <div className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden rounded-full" style={{ width: `${Math.min(100, loggedW + estW)}%` }}>
                {h.actual.sessions > 0 && <div className="h-full" style={{ width: `${(loggedW / (loggedW + estW)) * 100}%`, background: C.logged }} />}
                {h.actual.estimate > 0 && <div className="h-full flex-1" style={{ background: C.estimate }} />}
              </div>
              {isCurrentWeek && h.expectedToDateMin > 0 && h.expectedToDateMin < h.expectedMin && (
                <div className="absolute -inset-y-1 w-0.5 rounded bg-slate-700" style={{ left: `${toDateX}%` }} title="Arvio tähän mennessä" />
              )}
            </div>
            <p className="mt-2 text-sm text-slate-700">
              {h.expectedMin > 0 ? (
                <>
                  <strong className="tabular-nums">{pctOf(h.actualMin, h.expectedMin)} %</strong> viikon arviosta
                  {isCurrentWeek && h.expectedToDateMin < h.expectedMin && (
                    <span className="text-slate-500">
                      {' '}
                      · tähän mennessä arvio {formatHours(h.expectedToDateMin)} (toteuma {pctOf(h.actualMin, h.expectedToDateMin)} %)
                    </span>
                  )}
                </>
              ) : (
                'Viikolle ei ole arviota.'
              )}
            </p>
            {mvpa > 0 && <p className="text-xs text-slate-500">Toteumasta reipasta ja rasittavaa arviolta {formatHours(mvpa)} (tehomalli).</p>}
          </div>

          {/* Päivät: haalea pylväs = arvio, täytetty = toteuma. */}
          <div className="mt-4 grid grid-cols-7 gap-1.5" role="img" aria-label="Arvio ja toteuma päivittäin">
            {h.days.map((d) => {
              const eh = (d.expectedMin / dayMax) * 100;
              const lh = (d.actualLoggedMin / dayMax) * 100;
              const ah = ((d.actualMin - d.actualLoggedMin) / dayMax) * 100;
              return (
                <div key={d.date} className="flex flex-col items-center gap-1" title={`${dayLabel(d.date)}: toteuma ${formatHours(d.actualMin)}, arvio ${formatHours(d.expectedMin)}`}>
                  <div className="relative h-20 w-full max-w-7 border-b border-slate-300">
                    {d.expectedMin > 0 && <div className="absolute inset-x-0 bottom-0 rounded-md border border-dashed" style={{ height: `${eh}%`, borderColor: C.trackLine, background: C.trackFill }} />}
                    <div className="absolute inset-x-1 bottom-0 flex flex-col-reverse gap-px overflow-hidden rounded-t-[3px]" style={{ height: `${lh + ah}%` }}>
                      {lh > 0 && <div style={{ height: `${(lh / (lh + ah)) * 100}%`, background: C.logged }} />}
                      {ah > 0 && <div className="flex-1" style={{ background: C.estimate }} />}
                    </div>
                  </div>
                  <span className={`text-[11px] ${d.future ? 'text-slate-400' : 'text-slate-700'} ${d.flagged ? 'line-through' : ''}`}>{WD[isoWeekday(d.date) - 1]}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm" style={{ background: C.logged }} /> Kirjattu
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm" style={{ background: C.estimate }} /> Perusarvio
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm border border-dashed" style={{ borderColor: C.trackLine }} /> Arvio
            </span>
          </div>

          {h.byCategory.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              {h.byCategory.map((c) => {
                const exp = c.expected.sessions + c.expected.estimate;
                const act = c.actual.sessions + c.actual.estimate;
                return (
                  <li key={c.category}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-800">{CATEGORY_LABEL[c.category]}</span>
                      <span className="tabular-nums text-slate-600">
                        <strong className="font-semibold text-slate-900">{formatHours(act)}</strong> / {formatHours(exp)}
                      </span>
                    </div>
                    <div className="relative mt-1 h-2 rounded-full" style={{ background: C.track }} aria-hidden>
                      <div className="absolute inset-y-0 left-0 rounded-full border border-dashed" style={{ width: `${(exp / catMax) * 100}%`, borderColor: C.trackLine }} />
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(act / catMax) * 100}%`, background: c.actual.sessions >= c.actual.estimate ? C.logged : C.estimate }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-slate-500">
            Kesto kellotunteina. Arvio = viikkopohjan suunnitellut kerrat + perusarviot. Toteuma = kirjatut kerrat + perusarvio päiville, joilta kirjaus puuttuu{' '}
            {isCurrentWeek ? '(tähän päivään asti)' : ''}. Suunnitelmat eivät vaikuta suositusvertailuun.
          </p>
        </>
      )}
    </section>
  );
}

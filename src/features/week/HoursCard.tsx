// Viikon liikuntatunnit (kaikki liikunta kestona, myös kevyt).
// HoursCard: pääasia selkeästi – toteutunut ja arvio koko viikolle sekä yksi palkki, joka näyttää
// mistä toteuma koostuu (kerrat, arkiliikunta) ja mitä on vielä tulossa.
// HoursDetailCard: erittely päivittäin ja lajeittain omana korttinaan (valittavissa näkymään).

import type { PeriodReport } from '../../domain/report';
import { formatHours } from '../../domain/hours';
import { Collapse, CollapseToggle, useCollapsible } from '../../ui/Collapse';
import { isoWeekday } from '../../domain/dates';
import { CATEGORY_LABEL } from '../../ui/labels';
import { dayLabel } from '../../ui/format';
import { InfoTip } from '../../ui/InfoTip';

// CSS-muuttujat (index.css) vaihtuvat vaalean ja tumman teeman mukana.
const C = {
  logged: 'var(--viz-logged)', // kerrat
  arki: 'var(--viz-estimate)', // arkiliikunta (vahvistettu)
  estimate: 'var(--viz-estimate-soft)', // arkiliikunnan arvio (vinoviivoitus)
  track: 'var(--viz-track)',
  trackLine: 'var(--viz-track-line)',
  trackFill: 'var(--viz-track-fill)',
};
const WD = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];

const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Viikon osat: kerrat, arkiliikunta (vahvistettu + arvio), tulossa (suunnitellut + arkiliikunta). */
function weekParts(report: PeriodReport) {
  const h = report.hours;
  const confirmed = h.days.reduce((a, d) => a + d.confirmedMin, 0);
  const sessions = Math.max(0, h.actual.sessions - confirmed);
  const arkiEst = h.actual.estimate;
  const upcoming = Math.max(0, h.forecastMin - h.actualMin);
  const plansUp = Math.min(h.forecast.openPlans, upcoming);
  return { sessions, confirmed, arkiEst, arki: confirmed + arkiEst, upcoming, plansUp, arkiUp: upcoming - plansUp };
}

function HowCounted({ isCurrentWeek }: { isCurrentWeek: boolean }) {
  return (
    <InfoTip
      align="left"
      className="text-[11px] font-semibold text-slate-500"
      tip={
        <>
          <strong className="block text-[13px]">Miten tunnit lasketaan</strong>
          Kesto kellotunteina, kaikki liikunta (myös kevyt). Toteuma = kirjatut kerrat + arkiliikunta: vahvistettu tai perusarvio päiville, joilta saman kategorian kirjaus puuttuu
          {isCurrentWeek ? ' (tähän päivään asti)' : ''}. Arvio koko viikolle = toteuma + tulevat ja kuittaamattomat suunnitellut kerrat + arkiliikunnan arvio tuleville päiville. "Ei tehty" tai
          poistettu kerta putoaa pois. Suunnitelmat eivät vaikuta suositusvertailuun.
        </>
      }
    >
      Miten lasketaan?
    </InfoTip>
  );
}

function Legend({ items }: { items: { label: string; value?: number; bg: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-[3px] ${i.dashed ? 'border border-dashed' : ''}`} style={i.dashed ? { borderColor: C.trackLine, background: C.trackFill } : { background: i.bg }} aria-hidden />
          {i.label}
          {i.value !== undefined && <strong className="font-semibold tabular-nums text-slate-900">{formatHours(i.value)}</strong>}
        </span>
      ))}
    </div>
  );
}

export function HoursCard({ report, isCurrentWeek }: { report: PeriodReport; isCurrentWeek: boolean }) {
  const h = report.hours;
  const p = weekParts(report);
  const empty = h.forecastMin === 0 && h.actualMin === 0 && h.expectedMin === 0;
  const pastWeek = h.days.every((d) => !d.future);
  const total = Math.max(h.forecastMin, h.actualMin, 1);
  const w = (m: number) => `${(m / total) * 100}%`;
  const [open, toggle] = useCollapsible('hoursCard');

  return (
    <section className="card p-4 sm:p-5 lg:p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Kaikki liikunta kestona</div>
          <h2 className="font-display text-lg font-semibold text-slate-900">Viikon liikuntatunnit</h2>
        </div>
        <div className="flex items-center gap-2">
          {!open && !empty && (
            <span className="text-sm font-semibold tabular-nums text-slate-700">
              {formatHours(h.actualMin)}
              {!pastWeek && ` / ${formatHours(h.forecastMin)}`}
            </span>
          )}
          <CollapseToggle open={open} onToggle={toggle} label="Viikon liikuntatunnit" />
        </div>
      </div>
      <Collapse open={open}>
        {empty ? (
          <p className="mt-2 text-sm text-slate-600">Ei vielä arviota eikä kirjauksia. Lisää viikkopohja ja arkiliikunta Asetuksissa, niin arvio näkyy tässä.</p>
        ) : (
          <>
            {/* Pääluvut: toteutunut ja arvio koko viikolle. */}
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-500">{pastWeek ? 'Koko viikko' : 'Toteutunut'}</div>
                <div className="stat text-[2.5rem] font-semibold leading-none text-slate-900">{formatHours(h.actualMin)}</div>
              </div>
              {!pastWeek && (
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-500">Arvio koko viikolle</div>
                  <div className="stat text-[2.5rem] font-semibold leading-none text-slate-400">{formatHours(h.forecastMin)}</div>
                </div>
              )}
            </div>

            {/* Yksi palkki: toteuma osineen + tulossa katkoviivalla. */}
            <div className="mt-4 flex h-3.5 gap-[2px] overflow-hidden rounded-full" style={{ background: C.track }} role="img" aria-label={`Toteutunut ${formatHours(h.actualMin)}, arvio koko viikolle ${formatHours(h.forecastMin)}`}>
              {p.sessions > 0 && <div className="h-full" style={{ width: w(p.sessions), background: C.logged }} />}
              {p.confirmed > 0 && <div className="h-full" style={{ width: w(p.confirmed), background: C.arki }} />}
              {p.arkiEst > 0 && <div className="h-full" style={{ width: w(p.arkiEst), background: C.estimate }} />}
              {!pastWeek && p.upcoming > 0 && <div className="h-full flex-1 rounded-r-full border border-dashed" style={{ borderColor: C.trackLine, background: C.trackFill }} />}
            </div>

            <div className="mt-3">
              <Legend
                items={[
                  { label: 'Kerrat', value: p.sessions, bg: C.logged },
                  ...(p.arki > 0 ? [{ label: p.arkiEst > 0 && p.confirmed === 0 ? 'Arkiliikunta (arvio)' : 'Arkiliikunta', value: p.arki, bg: p.confirmed > 0 ? C.arki : C.estimate }] : []),
                  ...(!pastWeek && p.upcoming > 0 ? [{ label: 'Tulossa', value: p.upcoming, bg: '', dashed: true }] : []),
                ]}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
              {pastWeek ? (
                <span>Viikko on päättynyt.</span>
              ) : (
                <span>
                  <strong className="font-semibold tabular-nums text-slate-900">{pctOf(h.actualMin, h.forecastMin)} %</strong> arviosta toteutunut
                  {p.upcoming > 0 && (
                    <>
                      {' · tulossa '}
                      {[p.plansUp > 0 && `${formatHours(p.plansUp)} suunniteltua`, p.arkiUp > 0 && `${formatHours(p.arkiUp)} arkiliikuntaa`].filter(Boolean).join(' + ')}
                    </>
                  )}
                </span>
              )}
              <HowCounted isCurrentWeek={isCurrentWeek} />
            </div>
          </>
        )}
      </Collapse>
    </section>
  );
}

/** Erittely: tunnit päivittäin (toteuma ja arvio) ja lajeittain. */
export function HoursDetailCard({ report, isCurrentWeek }: { report: PeriodReport; isCurrentWeek: boolean }) {
  const h = report.hours;
  const [open, toggle] = useCollapsible('hoursDetail');
  const dayMax = Math.max(1, ...h.days.map((d) => Math.max(d.forecastMin, d.actualMin)));
  const catMax = Math.max(1, ...h.byCategory.map((c) => Math.max(c.forecast, c.actual.sessions + c.actual.estimate)));
  const mvpa = report.days.reduce((a, d) => a + d.mvpaCombined, 0);
  const anyArki = h.days.some((d) => d.confirmedMin > 0);
  const anyEst = h.days.some((d) => d.actualMin > d.actualLoggedMin);
  const empty = h.forecastMin === 0 && h.actualMin === 0;

  return (
    <section className="card p-4 sm:p-5 lg:p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Erittely</div>
          <h2 className="font-display text-lg font-semibold text-slate-900">Tunnit päivittäin ja lajeittain</h2>
        </div>
        <CollapseToggle open={open} onToggle={toggle} label="Tunnit päivittäin ja lajeittain" />
      </div>
      <Collapse open={open}>
        {empty ? (
          <p className="mt-2 text-sm text-slate-600">Ei vielä kirjauksia eikä arviota tälle viikolle.</p>
        ) : (
          <>
            {/* Päivät: katkoviiva = arvio päivälle, täyttö = toteuma osineen. */}
            <div className="mt-4 grid grid-cols-7 gap-1.5" role="img" aria-label="Toteuma ja arvio päivittäin">
              {h.days.map((d) => {
                const sess = Math.max(0, d.actualLoggedMin - d.confirmedMin);
                const est = d.actualMin - d.actualLoggedMin;
                const parts = [
                  { v: sess, c: C.logged },
                  { v: d.confirmedMin, c: C.arki },
                  { v: est, c: C.estimate },
                ].filter((x) => x.v > 0);
                return (
                  <div key={d.date} className="flex flex-col items-center gap-1" title={`${dayLabel(d.date)}: toteuma ${formatHours(d.actualMin)}, arvio ${formatHours(d.forecastMin)}`}>
                    <div className="relative h-24 w-full max-w-8 border-b border-slate-300">
                      {d.forecastMin > 0 && (
                        <div className="absolute inset-x-0 bottom-0 rounded-md border border-dashed" style={{ height: `${(d.forecastMin / dayMax) * 100}%`, borderColor: C.trackLine, background: C.trackFill }} />
                      )}
                      <div className="absolute inset-x-1 bottom-0 flex flex-col-reverse gap-px overflow-hidden rounded-t-[3px]" style={{ height: `${(d.actualMin / dayMax) * 100}%` }}>
                        {parts.map((x, k) => (
                          <div key={k} style={{ height: `${(x.v / Math.max(1, d.actualMin)) * 100}%`, background: x.c }} />
                        ))}
                      </div>
                    </div>
                    <span className={`text-[11px] ${d.future ? 'text-slate-400' : 'text-slate-700'} ${d.flagged ? 'line-through' : ''}`}>{WD[isoWeekday(d.date) - 1]}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-2">
              <Legend
                items={[
                  { label: 'Kerrat', bg: C.logged },
                  ...(anyArki ? [{ label: 'Arkiliikunta', bg: C.arki }] : []),
                  ...(anyEst ? [{ label: 'Arkiliikunta (arvio)', bg: C.estimate }] : []),
                  { label: 'Arvio päivälle', bg: '', dashed: true },
                ]}
              />
            </div>

            {h.byCategory.length > 0 && (
              <ul className="mt-4 space-y-2.5 border-t border-slate-100 pt-3">
                {h.byCategory.map((c) => {
                  const act = c.actual.sessions + c.actual.estimate;
                  return (
                    <li key={c.category}>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-800">{CATEGORY_LABEL[c.category]}</span>
                        <span className="tabular-nums text-slate-600">
                          <strong className="font-semibold text-slate-900">{formatHours(act)}</strong> / {formatHours(c.forecast)}
                        </span>
                      </div>
                      <div className="relative mt-1 h-2 rounded-full" style={{ background: C.track }} aria-hidden>
                        <div className="absolute inset-y-0 left-0 rounded-full border border-dashed" style={{ width: `${(c.forecast / catMax) * 100}%`, borderColor: C.trackLine }} />
                        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(act / catMax) * 100}%`, background: c.actual.sessions >= c.actual.estimate ? C.logged : C.estimate }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 space-y-0.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {h.expectedMin > 0 && (
                <p>
                  Viikkopohjan suunnitelma ja arkiliikunta: {formatHours(h.expectedMin)}
                  {isCurrentWeek && h.expectedToDateMin > 0 && h.expectedToDateMin < h.expectedMin && ` (tähän mennessä ${formatHours(h.expectedToDateMin)})`}.
                </p>
              )}
              {mvpa > 0 && <p>Toteumasta reipasta ja rasittavaa arviolta {formatHours(mvpa)} (tehomalli).</p>}
              <HowCounted isCurrentWeek={isCurrentWeek} />
            </div>
          </>
        )}
      </Collapse>
    </section>
  );
}

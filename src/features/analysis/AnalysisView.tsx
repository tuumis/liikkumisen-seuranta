// Analyysi-välilehti, viikkonäkymä (vaihe 4). Kuukausi, kausi ja vuosi tulevat vaiheessa 7.

import { useState } from 'react';
import { addDays, isoWeek, startOfIsoWeek, weekPeriod } from '../../domain/dates';
import { APP_INTERPRETATIONS, RECOMMENDATIONS, RECOMMENDATIONS_VERSION, VIGOROUS_DAY_BY_AGE_DEFAULT, type Rule } from '../../domain/recommendations';
import type { PeriodReport } from '../../domain/report';
import type { ISODate, Profile, SkipReason } from '../../domain/types';
import { Button, Card } from '../../ui/components';
import { formatDate } from '../../ui/format';
import { CATEGORY_LABEL, SKIP_REASON_LABEL } from '../../ui/labels';
import { percent } from '../../ui/statusText';
import { today as todayFn } from '../../ui/today';
import { DAY_BAR_TARGET } from '../week/WeekView';
import { DailyMvpaChart, SERIES } from './DailyMvpaChart';
import { GoalCard } from './GoalCard';
import { HoursCard } from '../week/HoursCard';
import { HoursGauge } from '../week/HoursGauge';
import { useReport } from './useReport';
import { FootballSection } from '../football/FootballSection';
import { GamesView } from '../football/GamesView';
import { HighlightsCard } from './HighlightsCard';
import { IconChevronLeft, IconChevronRight, IconSettings } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { ANALYSIS_CARDS, useAnalysisLayout } from './layout';

export function AnalysisView({ profile }: { profile?: Profile }) {
  const today = todayFn();
  const [weekStart, setWeekStart] = useState<ISODate>(() => startOfIsoWeek(today));
  const period = weekPeriod(weekStart);
  const report = useReport(profile, period);
  const wk = isoWeek(weekStart);
  const isCurrent = weekStart === startOfIsoWeek(today);
  const [games, setGames] = useState(false);
  const [editing, setEditing] = useState(false);
  const layoutApi = useAnalysisLayout();
  const visible = layoutApi.layout.order.filter((id) => !layoutApi.layout.hidden.includes(id));

  if (games && profile) return <GamesView profile={profile} onBack={() => setGames(false)} />;

  return (
    <div className="space-y-5">
      {/* Jakson valinta */}
      <div className="anim-fade flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-1 rounded-2xl bg-[var(--surface)] p-1 shadow-sm sm:flex-none">
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} className="press flex size-10 items-center justify-center rounded-xl text-slate-600 hover:bg-[var(--surface-sunk)]" aria-label="Edellinen viikko">
            <IconChevronLeft />
          </button>
          <div className="min-w-0 flex-1 px-2 text-center sm:w-56 sm:flex-none">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Viikko {wk.week}</div>
            <div className="truncate text-sm font-bold text-slate-900">
              {formatDate(period.start, 'd.M.')} – {formatDate(period.end, 'd.M.yyyy')}
            </div>
          </div>
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} className="press flex size-10 items-center justify-center rounded-xl text-slate-600 hover:bg-[var(--surface-sunk)]" aria-label="Seuraava viikko">
            <IconChevronRight />
          </button>
        </div>
        {!isCurrent && (
          <Button variant="secondary" onClick={() => setWeekStart(startOfIsoWeek(today))}>
            Tämä viikko
          </Button>
        )}
        <span className="ml-auto">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <IconSettings size="1rem" /> Muokkaa näkymää
          </Button>
        </span>
      </div>

      {!profile && <Card>Lisää profiili Asetukset-välilehdellä.</Card>}

      {profile && !report && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12" aria-busy="true" aria-label="Ladataan">
          <div className="space-y-5 lg:col-span-8">
            <div className="skeleton h-56 rounded-[1.75rem]" />
            <div className="skeleton h-72 rounded-[1.75rem]" />
          </div>
          <div className="space-y-5 lg:col-span-4">
            <div className="skeleton h-80 rounded-[1.75rem]" />
          </div>
        </div>
      )}

      {profile && report && (
        <>
          {/* Käyttäjän valitsemat kortit omassa järjestyksessään; palstat täyttyvät ylhäältä alas ilman aukkoja. */}
          <div className="columns-1 gap-5 lg:columns-2 lg:gap-6 2xl:columns-3">
            {visible.map((id) => {
              const card =
                id === 'goals' ? (
                  <Card title={`Tavoitteet · ${profile.name}`} eyebrow="Suositusvertailu">
                    <GoalCard report={report} variant="full" />
                  </Card>
                ) : id === 'daily' ? (
                  <Card title={report.group.group === 'early_years' ? 'Vauhdikas liikkuminen päivittäin' : 'Reipas ja rasittava päivittäin'} eyebrow="Päivittäin">
                    <DailyMvpaChart
                      days={report.allDays}
                      validDates={report.validDates}
                      target={DAY_BAR_TARGET[report.group.group]}
                      targetLabel={
                        report.group.group === 'adult'
                          ? `tahti ${Math.round(DAY_BAR_TARGET.adult)} min/pv (150 min/vko)`
                          : `suositus ${DAY_BAR_TARGET[report.group.group]} min/pv`
                      }
                    />
                  </Card>
                ) : id === 'gauge' ? (
                  report.group.group === 'school_age' ? <HoursGauge hours={report.hours} isCurrentWeek={isCurrent} /> : null
                ) : id === 'hours' ? (
                  <HoursCard report={report} isCurrentWeek={isCurrent} />
                ) : id === 'highlights' ? (
                  <HighlightsCard profile={profile} week={period} />
                ) : id === 'football' ? (
                  <FootballSection profileId={profile.id} week={period} onOpenGames={() => setGames(true)} />
                ) : id === 'categories' ? (
                  <CategoryCard report={report} />
                ) : id === 'adherence' ? (
                  <AdherenceCard report={report} />
                ) : (
                  <QualityCard report={report} />
                );
              return (
                <div key={id} className="anim-rise mb-5 break-inside-avoid empty:hidden lg:mb-6">
                  {card}
                </div>
              );
            })}
          </div>
          {visible.length === 0 && (
            <Card>
              <p className="text-sm text-slate-600">Kaikki kortit on piilotettu. Valitse näytettävät kortit painikkeesta "Muokkaa näkymää".</p>
            </Card>
          )}
          <EditLayoutSheet open={editing} onClose={() => setEditing(false)} api={layoutApi} />
        </>
      )}

      <Rationale />
    </div>
  );
}

function CategoryCard({ report }: { report: PeriodReport }) {
  const rows = report.byCategory;
  const max = Math.max(1, ...rows.map((r) => r.mvpa));
  return (
    <Card title="Jakauma kategorioittain">
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Ei liikkumista vertailtavilla päivillä.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-600">Reipas ja rasittava arviolta, min (kokonaisliikunta suluissa). Vertailtavilta päiviltä.</p>
          <ul className="space-y-2">
            {rows.map((r) => {
              const logged = r.logged.moderate + r.logged.vigorous;
              const est = r.estimate.moderate + r.estimate.vigorous;
              return (
                <li key={r.category}>
                  <div className="flex justify-between text-sm text-slate-800">
                    <span>{CATEGORY_LABEL[r.category]}</span>
                    <span className="tabular-nums">
                      {r.mvpa} <span className="text-slate-500">({r.total})</span>
                    </span>
                  </div>
                  <div className="mt-1 flex h-2.5 gap-0.5" aria-hidden>
                    {logged > 0 && <div className="h-full rounded-l-sm" style={{ width: `${(logged / max) * 100}%`, background: SERIES.logged, borderRadius: est > 0 ? '2px 0 0 2px' : '2px' }} />}
                    {est > 0 && <div className="h-full" style={{ width: `${(est / max) * 100}%`, background: SERIES.estimate, borderRadius: logged > 0 ? '0 2px 2px 0' : '2px' }} />}
                  </div>
                  {est > 0 && <div className="mt-0.5 text-xs text-slate-500">josta perusarviota {est} min</div>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

function QualityCard({ report }: { report: PeriodReport }) {
  const q = report.evaluation.quality;
  const ex = report.excluded;
  const out = [
    ex.flagged > 0 && `${ex.flagged} sairas-/matkapäivää`,
    ex.beforeTracking > 0 && `${ex.beforeTracking} ennen seurannan alkua (${formatDate(report.trackingStart, 'd.M.yyyy')})`,
    ex.future > 0 && `${ex.future} tulevaa`,
  ].filter(Boolean);
  return (
    <Card title="Datan laatu">
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-600">Vertailtavia päiviä</dt>
        <dd className="text-right tabular-nums text-slate-900">{report.evaluation.n}/7</dd>
        <dt className="text-slate-600">Kattavuus (päiviä, joilla kirjaus)</dt>
        <dd className="text-right tabular-nums text-slate-900">{report.evaluation.n ? percent(q.coverage) : '–'}</dd>
        <dt className="text-slate-600">Perusarvion osuus reippaasta ja rasittavasta</dt>
        <dd className="text-right tabular-nums text-slate-900">{report.evaluation.n ? percent(q.estimateShare) : '–'}</dd>
      </dl>
      {out.length > 0 && <p className="mt-2 text-xs text-slate-500">Pois vertailusta: {out.join(', ')}.</p>}
      {q.lowData && <p className="mt-2 text-sm text-slate-700">Liian vähän kirjauksia luotettavaan vertailuun.</p>}
      <p className="mt-2 text-xs text-slate-500">Reippaan ja rasittavan minuutit ovat tehomallin arvioita, eivät mittauksia.</p>
    </Card>
  );
}

function AdherenceCard({ report }: { report: PeriodReport }) {
  const a = report.adherence;
  if (a.planned === 0) return null;
  const reasons = (Object.keys(SKIP_REASON_LABEL) as SkipReason[]).filter((r) => a.skippedByReason[r] > 0);
  return (
    <Card title="Suunnitelma vs. toteuma">
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-600">Suunniteltuja</dt>
        <dd className="text-right tabular-nums">{a.planned}</dd>
        <dt className="text-slate-600">Tehty</dt>
        <dd className="text-right tabular-nums">{a.done}</dd>
        <dt className="text-slate-600">Ei tehty</dt>
        <dd className="text-right tabular-nums">{a.skipped}</dd>
        <dt className="text-slate-600">Kuittaamatta</dt>
        <dd className="text-right tabular-nums">{a.unconfirmed}</dd>
        <dt className="text-slate-600">Toteutumisaste (perutut pois)</dt>
        <dd className="text-right tabular-nums">{a.adherenceRate === null ? '–' : percent(a.adherenceRate)}</dd>
        {a.pairs.length > 0 && (
          <>
            <dt className="text-slate-600">Kesto suunniteltu → toteutunut</dt>
            <dd className="text-right tabular-nums">
              {a.plannedMinTotal} → {a.actualMinTotal} min
            </dd>
          </>
        )}
      </dl>
      {(reasons.length > 0 || a.skippedByReason.unspecified > 0) && (
        <p className="mt-2 text-xs text-slate-600">
          Syyt:{' '}
          {[...reasons.map((r) => `${SKIP_REASON_LABEL[r].toLowerCase()} ${a.skippedByReason[r]}`), a.skippedByReason.unspecified > 0 && `ei syytä ${a.skippedByReason.unspecified}`]
            .filter(Boolean)
            .join(', ')}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">Suunnitelmat eivät vaikuta liikuntamääriin.</p>
    </Card>
  );
}

function RuleRow({ rule }: { rule: Rule }) {
  return (
    <li className="py-2">
      <div className="text-sm text-slate-900">{rule.description}</div>
      <div className="text-xs text-slate-500">
        Lähde: {rule.source.title} (tarkistettu {rule.source.checked.split('-').reverse().join('.')})
      </div>
    </li>
  );
}

/** "Mihin luvut perustuvat" – suositukset, lähteet ja sovelluksen omat tulkinnat. */
function Rationale() {
  const [open, setOpen] = useState(false);
  const r = RECOMMENDATIONS;
  return (
    <Card
      title="Mihin luvut perustuvat"
      action={
        <Button variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Piilota' : 'Näytä'}
        </Button>
      }
    >
      {open && (
        <>
          <h3 className="mt-1 text-sm font-semibold text-slate-800">{r.early_years.label}</h3>
          <ul className="divide-y divide-slate-100">
            <RuleRow rule={r.early_years.totalMinPerDay} />
            <RuleRow rule={r.early_years.mvpaMinPerDay} />
          </ul>
          <h3 className="mt-3 text-sm font-semibold text-slate-800">{r.school_age.label}</h3>
          <ul className="divide-y divide-slate-100">
            <RuleRow rule={r.school_age.mvpaAvgMinPerDay} />
            <RuleRow rule={r.school_age.vigorousDaysPerWeek} />
            <RuleRow rule={r.school_age.muscleDaysPerWeek} />
            <RuleRow rule={r.school_age.boneDaysPerWeek} />
          </ul>
          <h3 className="mt-3 text-sm font-semibold text-slate-800">{r.adult.label}</h3>
          <ul className="divide-y divide-slate-100">
            <RuleRow rule={r.adult.weightedMinPerWeek} />
            <RuleRow rule={r.adult.muscleDaysPerWeek} />
          </ul>
          <h3 className="mt-3 text-sm font-semibold text-slate-800">Sovelluksen omat tulkinnat</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>
              Rasittava päivä: suositus ei anna päivälle minuuttirajaa. Raja on oma tavoite iän mukaan (esim. 7 v. 15 min, 10 v. {VIGOROUS_DAY_BY_AGE_DEFAULT['10']} min, 17 v. {VIGOROUS_DAY_BY_AGE_DEFAULT['17']} min) tai kiinteä (oletus {APP_INTERPRETATIONS.VIGOROUS_DAY_MIN} min); muokattavissa asetuksissa.
            </li>
            <li>Aikuisten "2 kertaa viikossa" lasketaan erillisinä päivinä.</li>
            <li>Tehoprofiilit (kuinka suuri osa treenistä on reipasta) ovat sovelluksen arvioita, eivät virallisia lukuja.</li>
            <li>Perusarvio täyttää kategorian vain päivinä, joille siinä ei ole kirjauksia, eikä se koskaan tuota rasittavaa eikä vahvistavaa päivää.</li>
            <li>Alle kouluikäisten jakson tila lasketaan täyttyneiden päivien osuudesta.</li>
            <li>Vertailussa ovat mukana päivät profiilin luonnista alkaen, ei tulevia eikä sairas- ja matkapäiviä.</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Laadullisia ohjeita (monipuolisuus, paikallaanolon tauottaminen, uni) ei mitata. Liikunnalle ei ole näyttöön perustuvaa ylärajaa, joten sitä ei näytetä. Suositusten versio{' '}
            {RECOMMENDATIONS_VERSION}.
          </p>
        </>
      )}
    </Card>
  );
}

/** Näkymän muokkaus: korttien näkyvyys ja järjestys. */
function EditLayoutSheet({ open, onClose, api }: { open: boolean; onClose: () => void; api: ReturnType<typeof useAnalysisLayout> }) {
  const { layout, toggle, move, reset } = api;
  return (
    <Sheet open={open} onClose={onClose} title="Muokkaa Analyysi-näkymää">
      <p className="mb-3 text-sm text-slate-600">Valitse näytettävät kortit ja niiden järjestys. PC:llä kortit asettuvat palstoihin ylhäältä alas tässä järjestyksessä.</p>
      <ul className="space-y-2">
        {layout.order.map((id, i) => {
          const c = ANALYSIS_CARDS.find((x) => x.id === id)!;
          const on = !layout.hidden.includes(id);
          return (
            <li key={id} className={`flex items-center gap-2 rounded-2xl p-2 pl-3 ${on ? 'card' : 'card-sunk opacity-70'}`}>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input type="checkbox" className="size-5 shrink-0 accent-green-700" checked={on} onChange={() => toggle(id)} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{c.title}</span>
                  <span className="block text-xs leading-snug text-slate-500">{c.text}</span>
                </span>
              </label>
              <div className="flex shrink-0 gap-1">
                <button type="button" disabled={i === 0} onClick={() => move(id, -1)} className="press flex size-9 items-center justify-center rounded-xl bg-[var(--surface-sunk)] text-slate-600 disabled:opacity-30" aria-label={`Siirrä ylös: ${c.title}`}>
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
                    <path d="m6 15 6-6 6 6" />
                  </svg>
                </button>
                <button type="button" disabled={i === layout.order.length - 1} onClick={() => move(id, 1)} className="press flex size-9 items-center justify-center rounded-xl bg-[var(--surface-sunk)] text-slate-600 disabled:opacity-30" aria-label={`Siirrä alas: ${c.title}`}>
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={onClose}>
          Valmis
        </Button>
        <Button variant="secondary" onClick={reset}>
          Palauta oletus
        </Button>
      </div>
    </Sheet>
  );
}

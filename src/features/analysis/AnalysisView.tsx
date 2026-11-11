// Analyysi-välilehti, viikkonäkymä (vaihe 4). Kuukausi, kausi ja vuosi tulevat vaiheessa 7.

import { useState } from 'react';
import { addDays, isoWeek, startOfIsoWeek, weekPeriod } from '../../domain/dates';
import { APP_INTERPRETATIONS, RECOMMENDATIONS, RECOMMENDATIONS_VERSION, type Rule } from '../../domain/recommendations';
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
import { useReport } from './useReport';
import { FootballSection } from '../football/FootballSection';
import { GamesView } from '../football/GamesView';

export function AnalysisView({ profile }: { profile?: Profile }) {
  const today = todayFn();
  const [weekStart, setWeekStart] = useState<ISODate>(() => startOfIsoWeek(today));
  const period = weekPeriod(weekStart);
  const report = useReport(profile, period);
  const wk = isoWeek(weekStart);
  const isCurrent = weekStart === startOfIsoWeek(today);
  const [games, setGames] = useState(false);

  if (games && profile) return <GamesView profile={profile} onBack={() => setGames(false)} />;

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      <Card className="lg:col-span-2">
        <div className="mb-2 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 text-sm" role="radiogroup" aria-label="Jakso">
          <span role="radio" aria-checked className="rounded-lg bg-white py-2 text-center font-medium text-slate-900 shadow-sm">
            Viikko
          </span>
          {['Kuukausi', 'Kausi', 'Vuosi'].map((l) => (
            <span key={l} role="radio" aria-checked={false} aria-disabled className="py-2 text-center text-slate-400" title="Tulossa vaiheessa 7">
              {l}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} className="min-h-11 min-w-11 rounded-full text-xl text-slate-700 active:bg-slate-100" aria-label="Edellinen viikko">
            ‹
          </button>
          <div className="flex-1 text-center">
            <div className="text-sm text-slate-600">Viikko {wk.week}</div>
            <div className="text-base font-semibold text-slate-900">
              {formatDate(period.start, 'd.M.')} – {formatDate(period.end, 'd.M.yyyy')}
            </div>
          </div>
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} className="min-h-11 min-w-11 rounded-full text-xl text-slate-700 active:bg-slate-100" aria-label="Seuraava viikko">
            ›
          </button>
        </div>
        {!isCurrent && (
          <div className="text-center">
            <Button variant="ghost" onClick={() => setWeekStart(startOfIsoWeek(today))}>
              Tämä viikko
            </Button>
          </div>
        )}
      </Card>

      {!profile && <Card>Lisää profiili Asetukset-välilehdellä.</Card>}

      {profile && report && (
        <>
          <Card title={`Tavoitteet · ${profile.name}`}>
            <GoalCard report={report} variant="full" />
          </Card>

          <HoursCard report={report} isCurrentWeek={isCurrent} />

          <Card title={report.group.group === 'early_years' ? 'Vauhdikas liikkuminen päivittäin' : 'Reipas ja rasittava päivittäin'}>
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

          <CategoryCard report={report} />
          <FootballSection profileId={profile.id} week={period} onOpenGames={() => setGames(true)} />
          <QualityCard report={report} />
          <AdherenceCard report={report} />
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
      className="lg:col-span-2"
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
            <li>Rasittava päivä: vähintään {APP_INTERPRETATIONS.VIGOROUS_DAY_MIN} min rasittavaa (oletus; muokattavissa asetuksissa). Suositus ei anna minuuttirajaa.</li>
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

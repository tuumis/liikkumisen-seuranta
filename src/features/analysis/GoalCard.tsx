// Tavoitekortti (SPEC 12): pääluku suositusryhmän mukaan, päivätavoitteet ja laatumerkintä.
// Jokaisessa vertailussa näkyvät "kirjattu" ja "kirjattu + perusarvio" sekä perusarvion osuus (SPEC 3).
// compact = Viikko-näkymän yläkortti; full = Analyysi-välilehti.

import { useLiveQuery } from 'dexie-react-hooks';
import { RECOMMENDATIONS } from '../../domain/recommendations';
import type { PeriodReport } from '../../domain/report';
import type { DualMeasure, Measure, Settings } from '../../domain/types';
import { repo } from '../../db/repositories';
import { DEFAULT_SETTINGS } from '../../domain/recommendations';
import { EstimateBadge, EmptyState } from '../../ui/components';
import { formatDate } from '../../ui/format';
import { GROUP_LABEL } from '../../ui/labels';
import { aboutMinutes, num1, percent, STATUS_CLASS, statusSentence } from '../../ui/statusText';

function StatusChip({ m, shortfall, kind }: { m: Measure; shortfall: string; kind: PeriodReport['period']['kind'] }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[m.status]}`}>{statusSentence(m, shortfall, kind)}</span>;
}

const pick = (d: DualMeasure, s: Settings) => (s.primaryView === 'logged' ? d.logged : d.combined);

export function GoalCard({ report, variant }: { report: PeriodReport; variant: 'compact' | 'full' }) {
  const settings = useLiveQuery(() => repo.getSettings(), []) ?? DEFAULT_SETTINGS;
  const { evaluation: ev, group, period } = report;
  const full = variant === 'full';
  const kind = period.kind;
  const q = ev.quality;
  const hasEstimate = report.days.some((d) => d.estimateAvailable);
  const primaryLabel = settings.primaryView === 'logged' ? 'kirjattu' : hasEstimate ? 'kirjattu + perusarvio' : 'kirjattu';

  const notes = (
    <>
      {group.changedOn && <p className="text-xs text-amber-800">Suositusryhmä vaihtui {formatDate(group.changedOn, 'd.M.yyyy')}</p>}
      {group.over64 && <p className="text-xs text-amber-800">65 vuotta täyttäneiden suositusta ei ole toteutettu; käytössä aikuisten suositus.</p>}
    </>
  );

  if (!ev.evaluable) {
    return (
      <div className="space-y-1 text-sm text-slate-600">
        <EmptyState art="chart" title="Ei vielä vertailtavia päiviä" compact>
          Vertailu suosituksiin näkyy, kun jaksolle on kirjattu liikuntaa.
        </EmptyState>
        {report.excluded.beforeTracking > 0 && <p className="text-xs">Seuranta alkoi {formatDate(report.trackingStart, 'd.M.yyyy')}.</p>}
        {notes}
      </div>
    );
  }

  // Lukujen rinnakkaisesitys: kirjattu · kirjattu + perusarvio · perusarvion osuus.
  const both = (d: DualMeasure, unit: string) =>
    hasEstimate ? (
      <p className="text-xs text-slate-600">
        kirjattu {num1(d.logged.actual)} · kirjattu + perusarvio {num1(d.combined.actual)} {unit} · perusarviota {percent(q.estimateShare)}
      </p>
    ) : (
      <p className="text-xs text-slate-600">kirjattu {num1(d.logged.actual)} {unit} · ei perusarvioita</p>
    );

  const partial = period.kind === 'week' && ev.n < 7 ? ` · ${ev.n}/7 pv mukana` : '';

  let body: React.ReactNode = null;
  if (ev.schoolAge) {
    const s = ev.schoolAge;
    const main = pick(s.mvpaAvg, settings);
    const r = RECOMMENDATIONS.school_age;
    body = (
      <>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm text-slate-700">Reipas ja rasittava ka.</span>
          <span className="text-xl font-semibold tabular-nums text-slate-900">
            {num1(main.actual)} / {r.mvpaAvgMinPerDay.value}
          </span>
          <span className="text-sm text-slate-700">min/pv</span>
          <EstimateBadge />
        </div>
        <StatusChip m={main} shortfall={aboutMinutes(main, 'min/pv')} kind={kind} />
        {both(s.mvpaAvg, 'min/pv')}
        <p className="text-sm text-slate-800">
          Rasittava (≥ {report.vigorousDay.min} min) {s.vigorousDays.actual}/{r.vigorousDaysPerWeek.value} · Lihas {s.muscleDays.actual}/{r.muscleDaysPerWeek.value} · Luusto {s.boneDays.actual}/
          {r.boneDaysPerWeek.value}
        </p>
        {full && (
          <ul className="space-y-1 text-xs text-slate-600">
            <li>
              Rasittavat päivät: vähintään {report.vigorousDay.min} min rasittavaa
              {report.vigorousDay.rule === 'age' ? ` (oma tavoite ${report.vigorousDay.age} v.)` : ' (kiinteä raja)'}, vain kirjatuista. Suositus ei anna päivälle minuuttirajaa.
            </li>
            <li>Lihaksia ja luustoa vahvistavat päivät: vain kirjatuista kerroista.</li>
            <li>
              Aktiivisia päiviä (≥ {r.mvpaAvgMinPerDay.value} min): kirjattu {s.activeDays.logged}/{ev.n}
              {hasEstimate && ` · kirjattu + perusarvio ${s.activeDays.combined}/${ev.n}`} (täydentävä tieto, ei tavoitetta)
            </li>
          </ul>
        )}
      </>
    );
  } else if (ev.earlyYears) {
    const e = ev.earlyYears;
    const main = pick(e.daysMet, settings);
    const r = RECOMMENDATIONS.early_years;
    const missing = main.target - main.actual;
    body = (
      <>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm text-slate-700">Päiväsuositus täyttyi</span>
          <span className="text-xl font-semibold tabular-nums text-slate-900">
            {main.actual}/{main.target}
          </span>
          <span className="text-sm text-slate-700">päivänä</span>
          <EstimateBadge />
        </div>
        <StatusChip m={main} shortfall={`${missing} ${missing === 1 ? 'päivä' : 'päivää'}`} kind={kind} />
        <p className="text-sm text-slate-800">
          Liikkumista ka. {num1(pick(e.totalAvg, settings).actual)} / {r.totalMinPerDay.value} min/pv · vauhdikasta ka. {num1(pick(e.mvpaAvg, settings).actual)} /{' '}
          {r.mvpaMinPerDay.value} min/pv
        </p>
        {both(e.mvpaAvg, 'min/pv vauhdikasta')}
        {full && (
          <p className="text-xs text-slate-600">
            Päivä täyttyy, kun liikkumista on vähintään {r.totalMinPerDay.value} min ja siitä vauhdikasta vähintään {r.mvpaMinPerDay.value} min. Kirjattu: {e.daysMet.logged.actual}/{ev.n}
            {hasEstimate && ` · kirjattu + perusarvio: ${e.daysMet.combined.actual}/${ev.n}`}.
          </p>
        )}
      </>
    );
  } else if (ev.adult) {
    const a = ev.adult;
    const main = pick(a.weighted, settings);
    const r = RECOMMENDATIONS.adult;
    const wholeWeek = period.kind === 'week' && ev.n === 7;
    body = (
      <>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm text-slate-700">Reipas + 2 × rasittava</span>
          <span className="text-xl font-semibold tabular-nums text-slate-900">
            {num1(main.actual)} / {num1(main.target)}
          </span>
          <span className="text-sm text-slate-700">min</span>
          <EstimateBadge />
        </div>
        {!wholeWeek && period.kind === 'week' && (
          <p className="text-xs text-slate-600">
            Tavoite tähän mennessä ({ev.n}/7 pv); koko viikolla {r.weightedMinPerWeek.value} min.
          </p>
        )}
        <StatusChip m={main} shortfall={aboutMinutes(main, 'min')} kind={kind} />
        {both(a.weighted, 'min')}
        <p className="text-sm text-slate-800">
          Lihaskunto ja liikehallinta {a.muscleDays.actual}/{r.muscleDaysPerWeek.value} päivää
        </p>
      </>
    );
  }

  return (
    <div className={`space-y-1.5 ${q.lowData ? 'opacity-50' : ''}`}>
      {full && (
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {GROUP_LABEL[group.group]}
          {partial} · pääluku: {primaryLabel}
        </p>
      )}
      {body}
      {!full && period.kind === 'week' && ev.n < 7 && (
        <p className="text-xs text-slate-500">
          Vertailussa {ev.n}/7 päivää
          {report.excluded.beforeTracking > 0 && ` · seuranta alkoi ${formatDate(report.trackingStart, 'd.M.')}`}
          {report.excluded.flagged > 0 && ` · ${report.excluded.flagged} sairas-/matkapäivää pois`}
        </p>
      )}
      {q.lowData && <p className="text-sm font-medium text-slate-700">Liian vähän kirjauksia luotettavaan vertailuun</p>}
      {notes}
    </div>
  );
}

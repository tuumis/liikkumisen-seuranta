import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { addDays, datesBetween, isoWeek, startOfIsoWeek, weekPeriod } from '../../domain/dates';
import { planAdherence } from '../../domain/adherence';
import { planningThroughForWeek } from '../../domain/planning';
import { RECOMMENDATIONS } from '../../domain/recommendations';
import type { ActivityType, DayFlag, ISODate, PlannedSession, Profile, RecommendationGroup, Session } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Card } from '../../ui/components';
import { formatDate } from '../../ui/format';
import { GoalCard } from '../analysis/GoalCard';
import { useReport } from '../analysis/useReport';
import { today as todayFn } from '../../ui/today';
import { QuickAdd } from '../quick-add/QuickAdd';
import { ReviewSheet } from '../review/ReviewSheet';
import { usePlanActions } from '../review/usePlanActions';
import { PlanSheet } from './PlanSheet';
import { BackupReminder, SyncBar } from '../sync/SyncBar';
import { FootballPanel } from '../football/FootballPanel';
import { DayRow } from './DayRow';
import { HoursCard } from './HoursCard';
import { DaySheet } from './DaySheet';
import { SessionEditor } from './SessionEditor';

/** Päivän MVPA-palkin täysi pituus (min) ryhmän päivätavoitteesta. */
export const DAY_BAR_TARGET: Record<RecommendationGroup, number> = {
  early_years: RECOMMENDATIONS.early_years.mvpaMinPerDay.value,
  school_age: RECOMMENDATIONS.school_age.mvpaAvgMinPerDay.value,
  adult: RECOMMENDATIONS.adult.weightedMinPerWeek.value / 7,
};

function UpdateBanner() {
  // Päivitysilmoitus näytetään vain Viikko-näkymässä (SPEC 10).
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-green-50 p-3 ring-1 ring-green-200">
      <span className="flex-1 text-sm text-green-900">Uusi versio saatavilla</span>
      <Button onClick={() => updateServiceWorker(true)}>Päivitä</Button>
      <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
        Myöhemmin
      </Button>
    </div>
  );
}

export function WeekView({ profile, onOpenSettings }: { profile?: Profile; onOpenSettings: () => void }) {
  const today = todayFn();
  const [weekStart, setWeekStart] = useState<ISODate>(() => startOfIsoWeek(today));
  const [quickAdd, setQuickAdd] = useState<{ date?: ISODate } | null>(null);
  const [editing, setEditing] = useState<Session | null>(null);
  const [dayMenu, setDayMenu] = useState<ISODate | null>(null);
  const [planOpen, setPlanOpen] = useState<PlannedSession | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [football, setFootball] = useState<Session | null>(null);
  // Jalkapallon lisätietopaneeli yksittäisen kirjauksen tai kuittauksen jälkeen (vahvistettu tulkinta).
  const openFootballIfAny = (s: Session) => {
    if (typeMap.get(s.activityTypeId)?.sport === 'football') setFootball(s);
  };
  const planActions = usePlanActions(setEditing, (s) => openFootballIfAny(s));

  const period = weekPeriod(weekStart);
  const dates = useMemo(() => datesBetween(period.start, period.end), [period.start, period.end]);
  const wk = isoWeek(weekStart);
  const isCurrent = weekStart === startOfIsoWeek(today);

  const types = useLiveQuery(() => repo.listActivityTypes({ includeArchived: true }), []);
  const typeMap = useMemo(() => new Map<string, ActivityType>((types ?? []).map((t) => [t.id, t])), [types]);
  const sessions = useLiveQuery(
    () => (profile ? repo.sessionsInRange(profile.id, period.start, period.end) : Promise.resolve([] as Session[])),
    [profile?.id, period.start, period.end],
  );
  const flags = useLiveQuery(
    () => (profile ? repo.dayFlagsInRange(profile.id, period.start, period.end) : Promise.resolve([] as DayFlag[])),
    [profile?.id, period.start, period.end],
  );
  const plans = useLiveQuery(
    () => (profile ? repo.plansInRange(profile.id, period.start, period.end) : Promise.resolve([] as PlannedSession[])),
    [profile?.id, period.start, period.end],
  );
  const fixtureEntries = useLiveQuery(
    () => (profile ? repo.listFixtures(profile.id, period.start, period.end) : Promise.resolve([])),
    [profile?.id, period.start, period.end],
  );
  const fixtureByPlan = useMemo(
    () => new Map((fixtureEntries ?? []).filter((e) => e.fixture).map((e) => [e.plan.id, e.fixture!])),
    [fixtureEntries],
  );
  const plannedById = useMemo(() => new Map((plans ?? []).map((p) => [p.id, p])), [plans]);
  const unconfirmed = useLiveQuery(
    () => (profile ? repo.unconfirmedPlans(profile.id, today) : Promise.resolve([] as PlannedSession[])),
    [profile?.id, today],
  );
  const adherence = planAdherence(plans ?? [], sessions ?? [], today);

  // Viikkonavigointi: suunnitelmat selattavan tulevan viikon loppuun (enintään +8 vko).
  useEffect(() => {
    if (profile) void repo.ensurePlanned(profile.id, planningThroughForWeek(today, weekStart), today);
  }, [profile?.id, weekStart, today]);

  const footballIds = (sessions ?? []).filter((s) => typeMap.get(s.activityTypeId)?.sport === 'football').map((s) => s.id).join(',');
  const footballDetails = useLiveQuery(
    () => (footballIds ? repo.footballDetailsFor(footballIds.split(',')) : Promise.resolve(new Map())),
    [footballIds],
  );

  const flagByDate = useMemo(() => new Map((flags ?? []).map((f) => [f.date, f])), [flags]);

  // Päiväkoosteet korvausperiaatteella (kirjaukset + perusarviot) ja suositusvertailu.
  const report = useReport(profile, period);
  const week = {
    count: (sessions ?? []).length,
    duration: (sessions ?? []).reduce((a, s) => a + s.durationMin, 0),
  };
  const info = report?.group;
  const go = (weeks: number) => setWeekStart((w) => addDays(w, weeks * 7));

  // Pyyhkäisy vaihtaa viikkoa.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY });
  const onTouchEnd = (e: TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) go(dx < 0 ? 1 : -1);
  };

  const summaryLines = profile && info && (
    <>
      <div className="pt-1 text-xs text-slate-600">
        Kirjattu {week.count} {week.count === 1 ? 'kerta' : 'kertaa'} · kesto yhteensä {week.duration} min
      </div>
      {adherence.planned > 0 && (
        <div className="text-xs text-slate-700">
          Suunniteltu {adherence.planned} · tehty {adherence.done} · ei tehty {adherence.skipped}
          {adherence.unconfirmed > 0 && ` · kuittaamatta ${adherence.unconfirmed}`}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-3 empty:hidden lg:col-span-12">
        <UpdateBanner />
        <SyncBar />
        <BackupReminder onOpenSettings={onOpenSettings} />
      </div>

      <div className="space-y-4 lg:col-span-7 xl:col-span-8">
      <Card>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(-1)} className="min-h-11 min-w-11 rounded-full text-xl text-slate-700 hover:bg-slate-100 active:bg-slate-100" aria-label="Edellinen viikko">
            ‹
          </button>
          <div className="flex-1 text-center lg:text-left">
            <div className="text-sm text-slate-600">Viikko {wk.week}</div>
            <div className="text-base font-semibold text-slate-900 lg:text-lg">
              {formatDate(period.start, 'd.M.')} – {formatDate(period.end, 'd.M.yyyy')}
            </div>
          </div>
          {!isCurrent && (
            <Button variant="ghost" className="hidden lg:inline-flex lg:items-center" onClick={() => setWeekStart(startOfIsoWeek(today))}>
              Tämä viikko
            </Button>
          )}
          {profile && (
            <Button className="hidden lg:inline-flex lg:items-center" onClick={() => setQuickAdd({})}>
              + Lisää kerta
            </Button>
          )}
          <button type="button" onClick={() => go(1)} className="min-h-11 min-w-11 rounded-full text-xl text-slate-700 hover:bg-slate-100 active:bg-slate-100" aria-label="Seuraava viikko">
            ›
          </button>
        </div>
        {!isCurrent && (
          <div className="mt-1 text-center lg:hidden">
            <Button variant="ghost" onClick={() => setWeekStart(startOfIsoWeek(today))}>
              Tämä viikko
            </Button>
          </div>
        )}
        {profile && info && (
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm lg:hidden">
            {report && <GoalCard report={report} variant="compact" />}
            {summaryLines}
          </div>
        )}
        {!profile && <p className="mt-3 text-sm text-slate-600">Lisää profiili Asetukset-välilehdellä.</p>}
      </Card>

      {profile && report && (
        <div className="lg:hidden">
          <HoursCard report={report} isCurrentWeek={isCurrent} />
        </div>
      )}

      {profile && (unconfirmed?.length ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl bg-amber-50 p-3 text-left ring-1 ring-amber-200 hover:bg-amber-100 active:bg-amber-100"
        >
          <span className="flex-1 text-sm text-amber-950">
            <strong>Käy viikko läpi</strong> · {unconfirmed!.length} {unconfirmed!.length === 1 ? 'kuittaamaton suunnitelma' : 'kuittaamatonta suunnitelmaa'}
          </span>
          <span className="text-amber-900" aria-hidden>
            ›
          </span>
        </button>
      )}

      {profile && (
        <>
          <ol className="space-y-2" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-label="Viikon päivät">
            {dates.map((d, i) => (
              <DayRow
                key={d}
                date={d}
                isToday={d === today}
                isFuture={d > today}
                totals={report?.allDays[i]}
                sessions={(sessions ?? []).filter((s) => s.date === d)}
                plans={(plans ?? []).filter((p) => p.date === d && p.status !== 'done')}
                plannedById={plannedById}
                fixtures={fixtureByPlan}
                footballDetails={footballDetails}
                onFootball={setFootball}
                onPlanOpen={setPlanOpen}
                onPlanConfirm={(p) => void planActions.confirm(p)}
                types={typeMap}
                flag={flagByDate.get(d)}
                barTarget={DAY_BAR_TARGET[info?.group ?? 'school_age']}
                onOpenMenu={() => setDayMenu(d)}
                onEdit={setEditing}
              />
            ))}
          </ol>
          <p className="text-center text-xs text-slate-500 lg:hidden">Pitkä painallus päivään: sairas- tai matkapäivä. Pyyhkäise vaihtaaksesi viikkoa.</p>
          <p className="hidden text-center text-xs text-slate-500 lg:block">Päivän ⋯ tai hiiren oikea painike: lisää kerta, sairas- tai matkapäivä.</p>
        </>
      )}
      </div>

      {profile && report && (
        <div className="hidden space-y-4 lg:sticky lg:top-8 lg:col-span-5 lg:block xl:col-span-4">
          <HoursCard report={report} isCurrentWeek={isCurrent} />
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Suositusvertailu</h2>
            <div className="space-y-1 text-sm">
              <GoalCard report={report} variant="compact" />
              {summaryLines}
            </div>
          </section>
        </div>
      )}

      {profile && (
        <>

          <button
            type="button"
            onClick={() => setQuickAdd({})}
            className="fixed bottom-20 right-4 z-20 flex size-14 items-center justify-center rounded-full bg-green-700 text-3xl text-white shadow-lg active:bg-green-800 sm:right-[max(1rem,calc(50%-17rem))] lg:hidden"
            aria-label="Lisää kerta"
          >
            +
          </button>

          <QuickAdd open={!!quickAdd} onClose={() => setQuickAdd(null)} profile={profile} initialDate={quickAdd?.date} onSaved={openFootballIfAny} />
          <PlanSheet
            plan={planOpen}
            type={planOpen ? typeMap.get(planOpen.activityTypeId) : undefined}
            onClose={() => setPlanOpen(null)}
            onOpenSession={setEditing}
            onConfirmed={openFootballIfAny}
          />
          <ReviewSheet open={reviewOpen} onClose={() => setReviewOpen(false)} profile={profile} types={typeMap} onOpenSession={setEditing} />
          {/* Viimeisenä, jotta muokkaus aukeaa muiden paneelien päälle (toinen kuittaus avaa kerran). */}
          <SessionEditor session={editing} onClose={() => setEditing(null)} onFootball={setFootball} />
          <FootballPanel
            session={football}
            type={football ? typeMap.get(football.activityTypeId) : undefined}
            onClose={() => setFootball(null)}
          />
          <DaySheet
            date={dayMenu}
            flag={dayMenu ? flagByDate.get(dayMenu) : undefined}
            profile={profile}
            onClose={() => setDayMenu(null)}
            onAdd={(date) => {
              setDayMenu(null);
              setQuickAdd({ date });
            }}
          />
        </>
      )}
    </div>
  );
}

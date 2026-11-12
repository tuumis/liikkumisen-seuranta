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
import { useReport } from '../analysis/useReport';
import { today as todayFn } from '../../ui/today';
import { QuickAdd } from '../quick-add/QuickAdd';
import { ReviewSheet } from '../review/ReviewSheet';
import { usePlanActions } from '../review/usePlanActions';
import { loadUnconfirmed, useMinuteTick } from '../review/unconfirmed';
import { subscribeWeekRequest } from '../desktop/settings';
import { PlanSheet } from './PlanSheet';
import { BackupReminder, SyncBar } from '../sync/SyncBar';
import { FootballPanel } from '../football/FootballPanel';
import { DayRow } from './DayRow';
import { DayTable, fmtUnit, type MinuteUnit } from './DayTable';
import { WeekDetails, WeekHero } from './WeekSummary';
import { DailyChart, RecentCard, RhythmCard, UpcomingCard } from './Dashboard';
import { useScrolling } from '../../ui/motion';
import { useViewMode } from '../../ui/theme';
import { IconCalendarClock, IconChevronLeft, IconChevronRight, IconPlus, IconSettings } from '../../ui/icons';
import { useMediaQuery } from '../../ui/cardLayout';
import { EditLayoutSheet } from '../../ui/EditLayoutSheet';
import { isEstimateConfirmation } from '../../domain/hours';
import { useWeekLayout, type WeekCardId } from './layout';
import { HoursGauge } from './HoursGauge';
import { HoursCard, HoursDetailCard } from './HoursCard';
import { GettingStarted } from './GettingStarted';
import type { SettingsSectionId } from '../settings/SettingsView';
import { DaySheet } from './DaySheet';
import { EstimateDaySheet } from './EstimateDaySheet';
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
    <div className="anim-rise flex items-center gap-3 rounded-[1.5rem] bg-green-100 p-3 pl-4 shadow-sm">
      <span className="flex-1 text-sm font-semibold text-green-900">Uusi versio saatavilla</span>
      <Button onClick={() => updateServiceWorker(true)}>Päivitä</Button>
      <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
        Myöhemmin
      </Button>
    </div>
  );
}

export function WeekView({ profile, onOpenSettings }: { profile?: Profile; onOpenSettings: (section?: SettingsSectionId) => void }) {
  const today = todayFn();
  const [weekStart, setWeekStart] = useState<ISODate>(() => startOfIsoWeek(today));
  const [quickAdd, setQuickAdd] = useState<{ date?: ISODate } | null>(null);
  const [editing, setEditing] = useState<Session | null>(null);
  const [dayMenu, setDayMenu] = useState<ISODate | null>(null);
  const [estimateDay, setEstimateDay] = useState<ISODate | null>(null);
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
  const minute = useMinuteTick();
  const unconfirmed = useLiveQuery(
    () => (profile ? loadUnconfirmed(profile.id, today) : Promise.resolve([] as PlannedSession[])),
    [profile?.id, today, minute],
  );
  // Ilmoituksen klikkaus (työpöytätila): kuluva viikko ja tarvittaessa "Käy viikko läpi".
  useEffect(
    () =>
      subscribeWeekRequest((review) => {
        setWeekStart(startOfIsoWeek(todayFn()));
        if (review) setReviewOpen(true);
      }),
    [],
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

  // Aloitusopas näytetään, kunnes profiililla on ensimmäinen kirjaus.
  const hasAnySessions = useLiveQuery(
    async () => (profile ? (await repo.sessionsInRange(profile.id, '0000-01-01', '9999-12-31')).length > 0 : true),
    [profile?.id],
  );

  const flagByDate = useMemo(() => new Map((flags ?? []).map((f) => [f.date, f])), [flags]);

  // Päiväkoosteet korvausperiaatteella (kirjaukset + perusarviot) ja suositusvertailu.
  const report = useReport(profile, period);
  const [viewMode] = useViewMode();
  const simple = viewMode === 'simple';
  // +-painike väistyy vierityksen ajaksi ja palaa, kun vieritys pysähtyy.
  const scrolling = useScrolling();
  // Liikuntamäärän luokat (7 h = 60 min/pv) koskevat kouluikäisiä.
  const showGauge = report?.group.group === 'school_age';
  // Muokattava näkymä (Kattava); yksinkertaisessa vain tilanne ja päivät.
  const layoutApi = useWeekLayout();
  const [editingLayout, setEditingLayout] = useState(false);
  const isLg = useMediaQuery('(min-width: 1024px)');
  const cardIds: WeekCardId[] = simple ? ['hero', 'days'] : layoutApi.visible;
  const sideIds: WeekCardId[] = isLg && !simple ? cardIds.filter((id) => layoutApi.layout.side.includes(id)) : [];
  // Päivät kahdessa sarakkeessa, kun pääpalsta on PC:llä koko levyinen.
  const wideDays = sideIds.length === 0;
  const [daysView, setDaysViewState] = useState<'cards' | 'table'>(() => {
    try {
      return localStorage.getItem('daysView') === 'table' ? 'table' : 'cards';
    } catch {
      return 'cards';
    }
  });
  const setDaysView = (v: 'cards' | 'table') => {
    setDaysViewState(v);
    try {
      localStorage.setItem('daysView', v);
    } catch {
      /* ei tallennusta */
    }
    // Taulukkoon vaihdettaessa tämän päivän rivi näkyviin.
    if (v === 'table') requestAnimationFrame(() => document.querySelector('[data-today-row]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };
  // Summien yksikkö (minuutit / tunnit), laitekohtainen.
  const [unit, setUnitState] = useState<MinuteUnit>(() => {
    try {
      return localStorage.getItem('minuteUnit') === 'h' ? 'h' : 'min';
    } catch {
      return 'min';
    }
  });
  const setUnit = (u: MinuteUnit) => {
    setUnitState(u);
    try {
      localStorage.setItem('minuteUnit', u);
    } catch {
      /* ei tallennusta */
    }
  };
  // Kerrat ilman arkiliikunnan vahvistuksia (ne näkyvät päivän arkiliikuntarivillä).
  const realSessions = (sessions ?? []).filter((s) => !isEstimateConfirmation(s));
  const week = {
    count: realSessions.length,
    duration: realSessions.reduce((a, s) => a + s.durationMin, 0),
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

  const reviewButton = profile && (unconfirmed?.length ?? 0) > 0 && (
    <button
      type="button"
      onClick={() => setReviewOpen(true)}
      className="press card-interactive anim-rise flex w-full items-center gap-3 rounded-[1.5rem] bg-amber-100 p-4 text-left shadow-sm"
      style={{ ['--i' as string]: 1 }}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/40 text-amber-900" aria-hidden>
        <IconCalendarClock size="1.25rem" />
      </span>
      <span className="flex-1 text-sm text-amber-950">
        <strong className="block font-display text-base">Käy viikko läpi</strong>
        {unconfirmed!.length} {unconfirmed!.length === 1 ? 'kuittaamaton suunnitelma' : 'kuittaamatonta suunnitelmaa'}
      </span>
      <IconChevronRight className="text-amber-900" />
    </button>
  );

  const weekSwitcher = (
    <div className="anim-fade flex items-center gap-2">
      <div className="flex flex-1 items-center gap-1 rounded-2xl bg-[var(--surface)] p-1 shadow-sm lg:flex-none">
        <button type="button" onClick={() => go(-1)} className="press flex size-10 items-center justify-center rounded-xl text-slate-600 hover:bg-[var(--surface-sunk)] hover:text-slate-900" aria-label="Edellinen viikko">
          <IconChevronLeft />
        </button>
        <div className="min-w-0 flex-1 px-2 text-center lg:w-56 lg:flex-none">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">Viikko {wk.week}</div>
          <div className="truncate text-sm font-bold text-slate-900">
            {formatDate(period.start, 'd.M.')} – {formatDate(period.end, 'd.M.yyyy')}
          </div>
        </div>
        <button type="button" onClick={() => go(1)} className="press flex size-10 items-center justify-center rounded-xl text-slate-600 hover:bg-[var(--surface-sunk)] hover:text-slate-900" aria-label="Seuraava viikko">
          <IconChevronRight />
        </button>
      </div>
      {!isCurrent && (
        <Button variant="secondary" onClick={() => setWeekStart(startOfIsoWeek(today))}>
          Tämä viikko
        </Button>
      )}
      {profile && !simple && (
        <Button variant="secondary" onClick={() => setEditingLayout(true)} aria-label="Muokkaa näkymää" className="shrink-0 lg:ml-auto">
          <IconSettings size="1.1rem" />
          <span className="hidden sm:inline">Muokkaa näkymää</span>
        </Button>
      )}
      {profile && (
        <span className={`hidden lg:block ${simple ? 'ml-auto' : ''}`}>
          <Button onClick={() => setQuickAdd({})}>
            <IconPlus size="1.1rem" /> Lisää kerta
          </Button>
        </span>
      )}
    </div>
  );

  const dayList = profile && (
    <section className="space-y-3" aria-labelledby="days-title">
      <div className="flex items-center gap-2 px-1">
        <div className="min-w-0 flex-1">
          <h2 id="days-title" className="font-display text-lg font-semibold leading-tight text-slate-900">
            Päivät
          </h2>
          <span className="block truncate text-xs text-slate-500">
            {week.count} {week.count === 1 ? 'kerta' : 'kertaa'} · {fmtUnit(week.duration, unit)} {unit}
            {adherence.planned > 0 && ` · suunniteltu ${adherence.planned}, tehty ${adherence.done}`}
          </span>
        </div>
        {/* Näkymän vaihto: kortit tai tiivis taulukko (laitekohtainen). */}
        <div className="flex shrink-0 rounded-xl bg-[var(--surface-sunk)] p-0.5 text-xs font-semibold" role="radiogroup" aria-label="Päivien näkymä">
          {(
            [
              ['cards', 'Kortit', 'M4 5h16v6H4zM4 14h16v5H4z'],
              ['table', 'Taulukko', 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14'],
            ] as const
          ).map(([v, l, d]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={daysView === v}
              onClick={() => setDaysView(v)}
              className={`press flex min-h-9 items-center gap-1.5 rounded-[0.6rem] px-2.5 ${daysView === v ? 'bg-[var(--surface-raised)] text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" aria-hidden>
                <path d={d} />
              </svg>
              {l}
            </button>
          ))}
        </div>
      </div>
      {daysView === 'table' ? (
        <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <DayTable
            rows={dates.map((d, i) => ({
              date: d,
              isToday: d === today,
              isFuture: d > today,
              totals: report?.allDays[i],
              hours: report?.hours.days[i],
              sessions: (sessions ?? []).filter((s) => s.date === d),
              plans: (plans ?? []).filter((p) => p.date === d && p.status !== 'done'),
              flag: flagByDate.get(d),
            }))}
            profileId={profile.id}
            group={info?.group ?? 'school_age'}
            vigorousMin={report?.vigorousDay.min ?? 10}
            barTarget={DAY_BAR_TARGET[info?.group ?? 'school_age']}
            types={typeMap}
            footballDetails={footballDetails}
            unit={unit}
            onUnit={setUnit}
            onAdd={(date) => setQuickAdd({ date })}
            onEdit={setEditing}
            onPlanOpen={setPlanOpen}
            onPlanConfirm={(p) => void planActions.confirm(p)}
            onEstimate={setEstimateDay}
            onOpenMenu={setDayMenu}
          />
        </div>
      ) : (
      <ol className={`space-y-2.5 2xl:grid 2xl:grid-cols-2 2xl:gap-3 2xl:space-y-0 ${wideDays ? 'lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0' : ''}`} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-label="Viikon päivät">
        {dates.map((d, i) => (
          <DayRow
            key={d}
            index={i}
            date={d}
            isToday={d === today}
            isFuture={d > today}
            totals={report?.allDays[i]}
            hours={report?.hours.days[i]}
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
            onEstimate={() => setEstimateDay(d)}
          />
        ))}
      </ol>
      )}
      {daysView === 'table' ? (
        <p className="text-center text-xs text-slate-500">Päivän nimestä: lisää kerta, sairas- tai matkapäivä. Kerrasta muokkaus, ☀️ Arki -napista arkiliikunnan tarkistus.</p>
      ) : (
        <>
          <p className="text-center text-xs text-slate-500 lg:hidden">Pitkä painallus päivään: sairas- tai matkapäivä. Pyyhkäise vaihtaaksesi viikkoa.</p>
          <p className="hidden text-center text-xs text-slate-500 lg:block">Päivän ⋯ tai hiiren oikea painike: lisää kerta, sairas- tai matkapäivä.</p>
        </>
      )}
    </section>
  );

  const chartTitle = info?.group === 'early_years' ? 'Vauhdikas liikkuminen' : 'Reipas ja rasittava';

  return (
    <div className="space-y-5">
      <div className="space-y-3 empty:hidden">
        <UpdateBanner />
        <SyncBar />
        <BackupReminder onOpenSettings={() => onOpenSettings('devices')} />
      </div>

      {weekSwitcher}
      {!profile && <Card>Lisää profiili Asetukset-välilehdellä.</Card>}

      {profile && hasAnySessions === false && <GettingStarted onAdd={() => setQuickAdd({})} onOpenSettings={onOpenSettings} />}

      {profile && report && (() => {
        // Käyttäjän valitsemat kortit järjestyksessään; PC:llä pää- ja sivupalstaan valinnan mukaan.
        const mainIds = cardIds.filter((id) => !sideIds.includes(id));
        const card = (id: WeekCardId) => {
          switch (id) {
            case 'hero':
              return <WeekHero report={report} profile={profile} isCurrentWeek={isCurrent} onAdd={() => setQuickAdd({})} />;
            case 'daily':
              return <DailyChart report={report} today={today} target={DAY_BAR_TARGET[info?.group ?? 'school_age']} title={chartTitle} />;
            case 'rhythm':
              return <RhythmCard report={report} today={today} />;
            case 'gauge':
              return showGauge ? <HoursGauge hours={report.hours} isCurrentWeek={isCurrent} /> : null;
            case 'hours':
              return <HoursCard report={report} isCurrentWeek={isCurrent} />;
            case 'hoursDetail':
              return <HoursDetailCard report={report} isCurrentWeek={isCurrent} />;
            case 'upcoming':
              return <UpcomingCard profile={profile} today={today} types={typeMap} onOpen={setPlanOpen} />;
            case 'days':
              return dayList;
            case 'recent':
              return <RecentCard profile={profile} today={today} types={typeMap} onOpen={setEditing} />;
            case 'details':
              return <WeekDetails report={report} isCurrentWeek={isCurrent} />;
          }
        };
        const render = (list: WeekCardId[], withReview: boolean) => {
          const out = [];
          if (withReview && !list.includes('hero') && reviewButton) out.push(<div key="review">{reviewButton}</div>);
          for (let k = 0; k < list.length; k++) {
            const id = list[k];
            // Kaavio ja rytmi rinnakkain hyvin leveällä näytöllä, kun ne ovat peräkkäin.
            if (id === 'daily' && list[k + 1] === 'rhythm') {
              out.push(
                <div key="daily-rhythm" className="grid grid-cols-1 gap-5 2xl:grid-cols-5">
                  <div className="2xl:col-span-3">{card('daily')}</div>
                  <div className="2xl:col-span-2">{card('rhythm')}</div>
                </div>,
              );
              k++;
              continue;
            }
            out.push(
              <div key={id} className="min-w-0 empty:hidden">
                {card(id)}
              </div>,
            );
            if (id === 'hero' && reviewButton) out.push(<div key="review">{reviewButton}</div>);
          }
          return out;
        };
        return (
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6">
            <div className={`min-w-0 space-y-5 ${sideIds.length ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'}`}>
              {render(mainIds, true)}
              {simple && (
                <p className="text-center text-xs text-slate-500">
                  Yksinkertainen näkymä. Kaaviot ja tarkemmat luvut saat näkyviin kohdasta Asetukset → Ulkoasu → Näkymä.
                </p>
              )}
            </div>
            {sideIds.length > 0 && (
              <aside className="min-w-0 space-y-5 lg:col-span-5 xl:col-span-4" aria-label="Viikon yhteenveto">
                {render(sideIds, false)}
              </aside>
            )}
          </div>
        );
      })()}

      {profile && (
        <>
          <button
            type="button"
            onClick={() => setQuickAdd({})}
            tabIndex={scrolling ? -1 : 0}
            className={`fixed bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.5rem)] right-5 z-20 flex size-16 items-center justify-center rounded-[1.4rem] bg-green-700 text-white shadow-[0_14px_30px_-10px_rgb(var(--accent-rgb)/0.8)] transition-[transform,opacity] duration-300 [transition-timing-function:var(--ease-out)] hover:bg-green-800 active:scale-95 sm:right-[max(1.25rem,calc(50%-19rem))] md:right-[max(1.25rem,calc(50%-21rem))] lg:hidden ${
              scrolling ? 'pointer-events-none translate-y-6 scale-90 opacity-0' : 'opacity-100'
            }`}
            aria-label="Lisää kerta"
          >
            <IconPlus size="1.75rem" strokeWidth={2.2} />
          </button>

          <EditLayoutSheet
            open={editingLayout}
            onClose={() => setEditingLayout(false)}
            title="Muokkaa Viikko-näkymää"
            intro="Valitse näytettävät kortit ja niiden järjestys. PC:llä voit lisäksi valita, onko kortti pää- vai sivupalstassa. Päivät ovat aina näkyvissä."
            api={layoutApi}
            columns
          />
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
          <EstimateDaySheet date={estimateDay} profile={profile} onClose={() => setEstimateDay(null)} />
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

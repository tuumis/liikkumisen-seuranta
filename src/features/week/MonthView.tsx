// Viikko-näkymän kuukausikalenteri (27.11.2026, käyttäjän valinta A): kaikki lajit, suunnitelmat, pelit ja
// kalenterimerkinnät kuukauden ruudukossa. Päivän valinta näyttää saman päiväkortin kuin viikolla (kuittaus,
// lisäys, merkinnät). Kuukautta vaihdetaan nuolilla tai puhelimella pyyhkäisemällä.

import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, maxDate } from '../../domain/dates';
import { addMonths, gridRange, monthGrid, monthKeyOf, type MonthKey } from '../../domain/monthCalendar';
import { monthItems, type MonthItem } from '../../domain/monthView';
import { farWeekPlanning, planningThroughForWeek } from '../../domain/planning';
import type { ActivityType, CalendarNote, DayFlag, Fixture, FootballDetails, ISODate, PlannedSession, Profile, Session, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Card } from '../../ui/components';
import { dayLabel } from '../../ui/format';
import { IconChevronLeft, IconChevronRight } from '../../ui/icons';
import { TypeGlyph } from '../../ui/TypeGlyph';
import { monthTitle } from '../games/MonthCalendar';
import { DayRow } from './DayRow';

const WEEKDAYS = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];
const hhmm = (t?: string) => t?.replace(/^0(\d)/, '$1').replace(':', '.');

/** Rivin tyyli: kirjattu (vihreä pinta), suunniteltu (katkoviiva), ei tehty (yliviivattu), merkintä (himmeä). */
function itemClass(i: MonthItem): string {
  if (i.kind === 'done') return 'bg-[var(--surface-sage)] text-slate-800';
  if (i.kind === 'open') return 'border border-dashed border-slate-300 text-slate-700';
  if (i.kind === 'skipped') return 'text-slate-400 line-through';
  return 'text-slate-500';
}

export interface MonthViewActions {
  onAdd: (date: ISODate) => void;
  onPlan: (date: ISODate) => void;
  onEdit: (s: Session) => void;
  onPlanOpen: (p: PlannedSession) => void;
  onPlanSkip: (p: PlannedSession) => void;
  onPlanConfirm: (p: PlannedSession) => void;
  onEstimate: (date: ISODate) => void;
  onOpenMenu: (date: ISODate) => void;
  onNoteOpen: (n: CalendarNote) => void;
  onFootball: (s: Session) => void;
  /** Siirtyy viikkonäkymään päivän viikolle. */
  onOpenWeek: (date: ISODate) => void;
}

export function MonthView({
  profile,
  today,
  month,
  onMonth,
  types,
  teamName,
  footballOn,
  actions,
  header,
}: {
  profile: Profile;
  today: ISODate;
  month: MonthKey;
  onMonth: (m: MonthKey) => void;
  types: Map<UUID, ActivityType>;
  teamName?: (x: { teamId?: UUID; templateItemId?: UUID }, planned?: boolean) => string | undefined;
  footballOn: boolean;
  actions: MonthViewActions;
  /** Viikko / Kuukausi -valinta ja muut painikkeet otsikkorivin oikeaan reunaan. */
  header?: ReactNode;
}) {
  const [selected, setSelected] = useState<ISODate | undefined>(() => (month === monthKeyOf(today) ? today : undefined));
  const range = gridRange(month);

  // Viikkorytmin kerrat selattavalle kuukaudelle kuten viikkoja selattaessa (yhtenäisesti enintään +8 vko, kauempana jakso).
  useEffect(() => {
    void (async () => {
      await repo.ensurePlanned(profile.id, planningThroughForWeek(today, range.to), today);
      if (farWeekPlanning(today, range.to)) await repo.ensurePlanned(profile.id, range.to, today, { from: maxDate(range.from, today) });
    })();
  }, [profile.id, range.from, range.to, today]);

  const data = useLiveQuery(async () => {
    const [sessions, plans, notes, fixtures, flags] = await Promise.all([
      repo.sessionsInRange(profile.id, range.from, range.to),
      repo.plansInRange(profile.id, range.from, range.to),
      repo.listCalendarNotes(profile.id, range.from, range.to),
      repo.listFixtures(profile.id, range.from, range.to),
      repo.dayFlagsInRange(profile.id, range.from, range.to),
    ]);
    const fbIds = footballOn ? sessions.filter((s) => types.get(s.activityTypeId)?.sport === 'football').map((s) => s.id) : [];
    const details = fbIds.length ? await repo.footballDetailsFor(fbIds) : new Map<UUID, FootballDetails>();
    return { from: range.from, sessions, plans, notes, fixtures, flags, details };
  }, [profile.id, range.from, range.to, footballOn, types]);

  // Edellinen valmis kuukausi näkyy, kunnes uusi on haettu (ruudukko ei välähdä tyhjänä).
  const last = useRef(data);
  if (data) last.current = data;
  const shownData = data ?? last.current;
  const shown = shownData && shownData.from !== range.from ? monthKeyOf(addDays(shownData.from, 14)) : month;
  const weeks = monthGrid(shown);

  const fixtureByPlan = useMemo(() => new Map((shownData?.fixtures ?? []).filter((e) => e.fixture).map((e) => [e.plan.id, e.fixture!] as [UUID, Fixture])), [shownData]);
  const items = useMemo(
    () => (shownData ? monthItems({ sessions: shownData.sessions, plans: shownData.plans, notes: shownData.notes, fixtures: fixtureByPlan, types }) : new Map<ISODate, MonthItem[]>()),
    [shownData, fixtureByPlan, types],
  );
  const flagByDate = useMemo(() => new Map((shownData?.flags ?? []).map((f) => [f.date, f] as [ISODate, DayFlag])), [shownData]);
  const plannedById = useMemo(() => new Map((shownData?.plans ?? []).map((p) => [p.id, p])), [shownData]);
  const fbDetails = shownData?.details;

  const current = month === monthKeyOf(today);
  const go = (n: number) => {
    const next = addMonths(month, n);
    onMonth(next);
    setSelected(next === monthKeyOf(today) ? today : undefined);
  };

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (ev: TouchEvent) => {
    const t = ev.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (ev: TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    const t = ev.changedTouches[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  const sel = selected && shownData ? selected : undefined;
  const selSessions = sel ? shownData!.sessions.filter((s) => s.date === sel) : [];
  const selPlans = sel ? shownData!.plans.filter((p) => p.date === sel && p.status !== 'done') : [];
  const selNotes = sel ? shownData!.notes.filter((n) => n.date === sel) : [];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 basis-full items-center gap-1 rounded-2xl bg-[var(--surface-sunk)] p-1 sm:basis-auto sm:flex-none">
            <button type="button" onClick={() => go(-1)} className="press flex size-10 items-center justify-center rounded-xl text-slate-600 hover:bg-[var(--surface-raised)] hover:text-slate-900" aria-label="Edellinen kuukausi">
              <IconChevronLeft />
            </button>
            <div className="min-w-0 flex-1 px-2 text-center font-display text-base font-semibold text-slate-900 sm:w-44 sm:flex-none" aria-live="polite">
              {monthTitle(month)}
            </div>
            <button type="button" onClick={() => go(1)} className="press flex size-10 items-center justify-center rounded-xl text-slate-600 hover:bg-[var(--surface-raised)] hover:text-slate-900" aria-label="Seuraava kuukausi">
              <IconChevronRight />
            </button>
          </div>
          {!current && (
            <Button variant="secondary" className="shrink-0 whitespace-nowrap" onClick={() => go(monthDiff(month, monthKeyOf(today)))}>
              Tämä kuukausi
            </Button>
          )}
          {header && <div className="ml-auto flex shrink-0 items-center gap-2">{header}</div>}
        </div>

        <div className="mt-3 select-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="grid grid-cols-[1.5rem_repeat(7,minmax(0,1fr))] gap-px text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-[2rem_repeat(7,minmax(0,1fr))]" aria-hidden>
            <div className="py-1">Vk</div>
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className={`overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200 transition-opacity ${data ? '' : 'opacity-60'}`} role="grid" aria-label={`${monthTitle(shown)} – kalenteri`}>
            {weeks.map((w) => (
              <div key={w.days[0]} role="row" className="grid grid-cols-[1.5rem_repeat(7,minmax(0,1fr))] gap-px sm:grid-cols-[2rem_repeat(7,minmax(0,1fr))] [&:not(:first-child)]:mt-px">
                <button
                  type="button"
                  role="rowheader"
                  onClick={() => actions.onOpenWeek(w.days[0])}
                  className="flex items-start justify-center bg-[var(--surface-sunk)] pt-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                  aria-label={`Avaa viikko ${w.week}`}
                  title={`Avaa viikko ${w.week}`}
                >
                  {w.week}
                </button>
                {w.days.map((d) => (
                  <DayCell
                    key={d}
                    date={d}
                    inMonth={monthKeyOf(d) === shown}
                    today={d === today}
                    selected={d === selected}
                    flagged={flagByDate.has(d)}
                    items={items.get(d) ?? []}
                    types={types}
                    onSelect={() => setSelected(d)}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-[var(--surface-sage)] ring-1 ring-slate-200" /> kirjattu
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm border border-dashed border-slate-400" /> suunniteltu
            </span>
            <span>📅 muu merkintä</span>
            <span className="sm:hidden">· pyyhkäise vaihtaaksesi kuukautta</span>
          </div>
        </div>
      </Card>

      {sel && (
        <div className="space-y-1.5">
          <ol aria-label="Valittu päivä">
            <DayRow
              key={sel}
              date={sel}
              isToday={sel === today}
              isFuture={sel > today}
              sessions={selSessions}
              plans={selPlans}
              plannedById={plannedById}
              fixtures={fixtureByPlan}
              footballDetails={footballOn ? fbDetails : undefined}
              teamName={teamName}
              onFootball={actions.onFootball}
              types={types}
              flag={flagByDate.get(sel)}
              barTarget={60}
              onOpenMenu={() => actions.onOpenMenu(sel)}
              onAdd={() => actions.onAdd(sel)}
              onPlan={() => actions.onPlan(sel)}
              onEdit={actions.onEdit}
              onPlanOpen={actions.onPlanOpen}
              onPlanSkip={actions.onPlanSkip}
              onPlanConfirm={actions.onPlanConfirm}
              onEstimate={() => actions.onEstimate(sel)}
              notes={selNotes}
              onNoteOpen={actions.onNoteOpen}
            />
          </ol>
          <div className="text-center">
            <button type="button" onClick={() => actions.onOpenWeek(sel)} className="press inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-green-800 hover:bg-[var(--surface-sunk)]">
              Avaa viikko ja päivän luvut <IconChevronRight size="1rem" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function monthDiff(from: MonthKey, to: MonthKey): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7));
}

function DayCell({
  date,
  inMonth,
  today,
  selected,
  flagged,
  items,
  types,
  onSelect,
}: {
  date: ISODate;
  inMonth: boolean;
  today: boolean;
  selected: boolean;
  flagged: boolean;
  items: MonthItem[];
  types: Map<UUID, ActivityType>;
  onSelect: () => void;
}) {
  const day = Number(date.slice(8, 10));
  const more = items.length - 3;
  const label = `${dayLabel(date)}${today ? ', tänään' : ''}${items.length ? `, ${items.map((i) => `${i.kind === 'note' ? 'merkintä ' : i.kind === 'open' ? 'suunniteltu ' : i.kind === 'skipped' ? 'ei tehty ' : ''}${i.title}${i.time ? ` ${hhmm(i.time)}` : ''}`).join(', ')}` : ''}`;
  const glyph = (i: MonthItem) => (i.kind === 'note' ? '📅' : <TypeGlyph t={i.typeId ? types.get(i.typeId) : undefined} />);
  return (
    <div role="gridcell" aria-selected={selected} className={`relative min-h-14 p-1 sm:min-h-24 sm:p-1.5 ${inMonth ? (flagged ? 'bg-[var(--surface-sunk)]' : 'bg-[var(--surface-raised)]') : 'bg-[var(--surface-sunk)]'} ${selected ? 'z-[1] outline-2 -outline-offset-2 outline-green-700' : ''}`}>
      <button type="button" onClick={onSelect} className="absolute inset-0 rounded-none hover:bg-green-50/40" aria-label={label} aria-pressed={selected} />
      <div className="pointer-events-none relative">
        <span className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${today ? 'bg-green-700 text-white' : inMonth ? 'text-slate-800' : 'text-slate-400'}`}>{day}</span>
      </div>
      {/* Puhelin: lajikuvakkeet; valittu päivä näyttää tiedot ruudukon alla. */}
      <div className="pointer-events-none relative mt-0.5 flex flex-wrap gap-0.5 text-[13px] leading-none sm:hidden" aria-hidden>
        {items.slice(0, 3).map((i) => (
          <span key={i.key} className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-md px-px ${itemClass(i)} ${i.kind === 'note' || i.kind === 'skipped' ? 'opacity-70' : ''}`}>
            {glyph(i)}
          </span>
        ))}
        {more > 0 && <span className="text-[10px] font-semibold text-slate-500">+{more}</span>}
      </div>
      {/* PC: rivit tekstinä. */}
      <div className="pointer-events-none relative mt-1 hidden space-y-0.5 sm:block" aria-hidden>
        {items.slice(0, 3).map((i) => (
          <div key={i.key} className={`truncate rounded-md px-1 py-0.5 text-[11px] font-medium leading-tight ${itemClass(i)}`}>
            <span>{glyph(i)}</span> {i.title}
            {i.time && <span className="font-normal opacity-75"> {hhmm(i.time)}</span>}
          </div>
        ))}
        {more > 0 && <div className="px-1 text-[11px] font-semibold text-slate-500">+{more} muuta</div>}
      </div>
    </div>
  );
}

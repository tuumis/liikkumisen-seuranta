// Jalkapallokalenterin kuukausinäkymä (18.11.2026): ma–su-ruudukko ISO-viikkonumeroin. PC:llä tapahtumat
// tekstinä ruuduissa, puhelimella merkkeinä; valitun päivän tapahtumat ja lisäyspainikkeet ruudukon alla.
// Kuukautta vaihdetaan nuolilla, "Tämä kuukausi" -painikkeella tai puhelimella pyyhkäisemällä.

import { useRef, useState, type TouchEvent } from 'react';
import { addDays } from '../../domain/dates';
import { HOME_AWAY_LABEL, OUTCOME_LABEL } from '../../domain/football';
import { addMonths, clockText, eventTitle, gridRange, teamNameFor, KIND_ICON, KIND_LABEL, monthGrid, monthKeyOf, type CalEvent, type MonthKey } from '../../domain/monthCalendar';
import type { ISODate, Profile, Session } from '../../domain/types';
import type { FixtureEntry } from '../../db/repositories';
import { Button, Card } from '../../ui/components';
import { ToggleChip } from '../../ui/controls';
import { dayLabel, formatDate } from '../../ui/format';
import { IconChevronLeft, IconChevronRight, IconPlus, IconReport } from '../../ui/icons';
import { useStoredFlag } from '../../ui/storedPref';
import type { FixtureKind } from './FixtureSheet';
import { useCalendarEvents } from './useCalendarEvents';
import { CalendarPrint } from './CalendarPrint';

const WEEKDAYS = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];

export const monthTitle = (m: MonthKey) => {
  const s = formatDate(`${m}-01`, 'LLLL yyyy');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Tapahtuman väri tilan mukaan (tuleva, tulos puuttuu, tulos, ei pelattu, treeni). */
export function chipClass(e: CalEvent): string {
  if (e.kind === 'training') return 'text-slate-500 ring-slate-200';
  if (e.state === 'skipped') return 'text-slate-400 line-through ring-slate-200';
  if (e.state === 'pending') return 'bg-amber-50 text-amber-900 ring-amber-200';
  if (e.state === 'played') {
    if (e.outcome === 'W') return 'bg-green-100 text-green-900 ring-green-200';
    if (e.outcome === 'L') return 'bg-red-50 text-red-900 ring-red-200';
    return 'bg-slate-100 text-slate-800 ring-slate-200';
  }
  return 'bg-green-50 text-green-900 ring-green-200';
}

const hhmm = clockText;

/** Ruudun lyhyt teksti: "10.00 PK-35", "2–1 V Ilves", "Treeni 17.30". */
function chipText(e: CalEvent): string {
  if (e.state === 'played') return [e.result, eventTitle(e, 'short')].filter(Boolean).join(' ');
  return [hhmm(e.time), eventTitle(e, 'short')].filter(Boolean).join(' ');
}

/** Valitun päivän rivin lisätiedot. */
function detailLine(e: CalEvent): string {
  const parts: (string | undefined | false)[] = [
    e.kind !== 'training' && KIND_LABEL[e.kind],
    e.time && `klo ${hhmm(e.time)}`,
    e.arrival && e.state !== 'played' && `paikalla ${hhmm(e.arrival)}`,
    e.durationMin !== undefined && e.kind === 'training' && `${e.durationMin} min`,
    e.series,
    e.homeAway && HOME_AWAY_LABEL[e.homeAway],
    e.location,
  ];
  return parts.filter(Boolean).join(' · ');
}

const STATE_NOTE: Partial<Record<CalEvent['state'], string>> = { pending: 'Tulos puuttuu', skipped: 'Ei pelattu' };

export function MonthCalendar({
  profile,
  today,
  onEdit,
  onAdd,
  onOpenSession,
}: {
  profile: Profile;
  today: ISODate;
  onEdit: (e: FixtureEntry) => void;
  onAdd: (kind: FixtureKind, date: ISODate) => void;
  onOpenSession: (s: Session) => void;
}) {
  const [month, setMonth] = useState<MonthKey>(monthKeyOf(today));
  const [selected, setSelected] = useState<ISODate | undefined>(today);
  const [trainings, setTrainings] = useStoredFlag('calendarTrainings', false);
  const [printing, setPrinting] = useState(false);
  const range = gridRange(month);
  const data = useCalendarEvents(profile.id, range.from, range.to, today, trainings);
  // Näytetään haetun välin kuukausi: uutta kuukautta ei piirretä tyhjänä ennen kuin sen tiedot ovat valmiit.
  const shown = data && data.from !== range.from ? monthKeyOf(addDays(data.from, 14)) : month;
  const weeks = monthGrid(shown);
  const current = month === monthKeyOf(today);

  const go = (n: number) => {
    const next = addMonths(month, n);
    setMonth(next);
    setSelected(next === monthKeyOf(today) ? today : undefined);
  };

  // Pyyhkäisy puhelimella: vaakasuuntainen liike vaihtaa kuukautta.
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

  const open = (e: CalEvent) => {
    if (e.sessionId) {
      const s = data?.sessions.get(e.sessionId);
      if (s) onOpenSession(s);
    } else if (e.planId && e.state !== 'skipped') {
      const entry = data?.fixtures.get(e.planId);
      if (entry) onEdit(entry);
    }
  };
  const clickable = (e: CalEvent) => !!e.sessionId || (!!e.planId && e.state !== 'skipped');

  const dayEvents = selected ? (data?.events.get(selected) ?? []) : [];

  return (
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
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ToggleChip on={trainings} onChange={setTrainings}>
            Treenit
          </ToggleChip>
          <Button variant="secondary" className="shrink-0" onClick={() => setPrinting(true)}>
            <IconReport size="1rem" /> Tulosta
          </Button>
        </div>
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
        <div className={`overflow-hidden rounded-2xl bg-slate-200 ring-1 ring-slate-200 transition-opacity ${data ? '' : 'opacity-60'}`} role="grid" aria-label={`${monthTitle(shown)} – pelikalenteri`}>
          {weeks.map((w) => (
            <div key={w.days[0]} role="row" className="grid grid-cols-[1.5rem_repeat(7,minmax(0,1fr))] gap-px sm:grid-cols-[2rem_repeat(7,minmax(0,1fr))] [&:not(:first-child)]:mt-px">
              <div role="rowheader" className="flex items-start justify-center bg-[var(--surface-sunk)] pt-1.5 text-[11px] font-semibold text-slate-500" aria-label={`Viikko ${w.week}`}>
                {w.week}
              </div>
              {w.days.map((d) => (
                <DayCell
                  key={d}
                  date={d}
                  inMonth={monthKeyOf(d) === shown}
                  today={d === today}
                  selected={d === selected}
                  events={data?.events.get(d) ?? []}
                  onSelect={() => setSelected(d)}
                  onOpen={open}
                  clickable={clickable}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>⚽ ottelu</span>
          <span>🏆 turnaus</span>
          <span>🤝 harjoituspeli</span>
          {trainings && <span>👟 treeni</span>}
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-amber-50 ring-1 ring-amber-200" /> tulos puuttuu
          </span>
          <span>⚠ tietoja puuttuu</span>
          <span className="sm:hidden">· pyyhkäise vaihtaaksesi kuukautta</span>
        </div>
      </div>

      {selected && (
        <section className="mt-4 border-t border-slate-100 pt-3" aria-label={`Valittu päivä ${dayLabel(selected)}`}>
          <h3 className="text-sm font-semibold text-slate-900">{formatDate(selected, 'cccc d.M.yyyy').replace(/^./, (c) => c.toUpperCase())}</h3>
          {dayEvents.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">Ei pelejä{trainings ? ' eikä treenejä' : ''} tälle päivälle.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {dayEvents.map((e) => {
                const body = (
                  <>
                    <span className="text-lg leading-none" aria-hidden>
                      {KIND_ICON[e.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={`truncate font-medium ${e.state === 'skipped' ? 'text-slate-500 line-through' : e.kind === 'training' ? 'text-slate-600' : 'text-slate-900'}`}>{eventTitle(e, 'full')}</span>
                        {e.result && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${chipClass(e)}`}>{e.result}</span>}
                        {STATE_NOTE[e.state] && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${chipClass(e)}`}>{STATE_NOTE[e.state]}</span>}
                        {e.infoMissing && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200" title={e.missingNote}>
                            ⚠ Tietoja puuttuu
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-slate-600">{detailLine(e)}</span>
                      {e.games && e.kind === 'tournament' && (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {e.games.map((g, i) => [hhmm(g.time), g.opponent ? teamNameFor(g.opponent, 'compact') : 'vastustaja ?', g.result].filter(Boolean).join(' ') + (i < e.games!.length - 1 ? ' · ' : ''))}
                        </span>
                      )}
                    </span>
                  </>
                );
                return (
                  <li key={e.key}>
                    {clickable(e) ? (
                      <button type="button" onClick={() => open(e)} className="press flex w-full items-start gap-2.5 rounded-xl p-2 text-left hover:bg-[var(--surface-sunk)]">
                        {body}
                      </button>
                    ) : (
                      <div className="flex items-start gap-2.5 p-2">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {selected >= today ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ['game', 'Peli'],
                  ['friendly', 'Harjoituspeli'],
                  ['tournament', 'Turnaus'],
                ] as const
              ).map(([kind, label]) => (
                <Button key={kind} variant={kind === 'game' ? 'soft' : 'secondary'} className="min-h-9 px-3" onClick={() => onAdd(kind, selected)}>
                  <IconPlus size="0.9rem" /> {label}
                </Button>
              ))}
            </div>
          ) : (
            dayEvents.length === 0 && <p className="mt-1 text-xs text-slate-500">Jo pelatun pelin kirjaat Viikko-näkymän +-painikkeella.</p>
          )}
        </section>
      )}

      {printing && <CalendarPrint profile={profile} today={today} startMonth={month} onClose={() => setPrinting(false)} />}
    </Card>
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
  events,
  onSelect,
  onOpen,
  clickable,
}: {
  date: ISODate;
  inMonth: boolean;
  today: boolean;
  selected: boolean;
  events: CalEvent[];
  onSelect: () => void;
  onOpen: (e: CalEvent) => void;
  clickable: (e: CalEvent) => boolean;
}) {
  const day = Number(date.slice(8, 10));
  const games = events.filter((e) => e.kind !== 'training').length;
  const label = `${dayLabel(date)}${today ? ', tänään' : ''}${events.length ? `, ${events.map((e) => `${eventTitle(e, 'full') === KIND_LABEL[e.kind] ? '' : `${KIND_LABEL[e.kind]} `}${eventTitle(e, 'full')}${e.result ? ` ${e.result}` : ''}`).join(', ')}` : ''}`;
  const more = events.length - 3;
  return (
    <div role="gridcell" aria-selected={selected} className={`relative min-h-14 p-1 sm:min-h-24 sm:p-1.5 ${inMonth ? 'bg-[var(--surface-raised)]' : 'bg-[var(--surface-sunk)]'} ${selected ? 'z-[1] outline-2 -outline-offset-2 outline-green-700' : ''}`}>
      <button type="button" onClick={onSelect} className="absolute inset-0 rounded-none hover:bg-green-50/40" aria-label={label} aria-pressed={selected} />
      <div className="pointer-events-none relative flex items-center justify-between">
        <span
          className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${today ? 'bg-green-700 text-white' : inMonth ? 'text-slate-800' : 'text-slate-400'}`}
        >
          {day}
        </span>
        {games > 0 && events.some((e) => e.infoMissing) && (
          <span className="text-[11px] text-amber-700" aria-hidden title="Tietoja puuttuu">
            ⚠
          </span>
        )}
      </div>

      {/* Puhelin: merkit (tulos kirjaimena); valittu päivä näyttää tiedot ruudukon alla. */}
      <div className="pointer-events-none relative mt-0.5 flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
        {events.slice(0, 3).map((e) => (
          <span key={e.key} className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-0.5 text-[10px] font-bold leading-none ring-1 ${chipClass(e)} ${e.kind === 'training' ? 'opacity-70' : ''}`}>
            {e.state === 'played' && e.outcome ? OUTCOME_LABEL[e.outcome] : KIND_ICON[e.kind]}
          </span>
        ))}
        {more > 0 && <span className="text-[10px] font-semibold text-slate-500">+{more}</span>}
      </div>

      {/* PC: tapahtumat tekstinä; painallus avaa muokkauksen tai kirjatun pelin tiedot. */}
      <div className="relative mt-1 hidden space-y-0.5 sm:block">
        {events.slice(0, 3).map((e) =>
          clickable(e) ? (
            <button
              key={e.key}
              type="button"
              onClick={() => onOpen(e)}
              title={`${KIND_LABEL[e.kind]}: ${eventTitle(e, 'full')}${e.result ? ` ${e.result}` : ''}${STATE_NOTE[e.state] ? ` – ${STATE_NOTE[e.state]}` : ''}`}
              className={`press block w-full truncate rounded-md px-1 py-0.5 text-left text-[11px] font-medium leading-tight ring-1 ${chipClass(e)}`}
            >
              <span aria-hidden>{KIND_ICON[e.kind]}</span> {e.infoMissing && '⚠ '}
              {chipText(e)}
            </button>
          ) : (
            <div key={e.key} className={`pointer-events-none truncate rounded-md px-1 py-0.5 text-[11px] leading-tight ring-1 ${chipClass(e)}`}>
              <span aria-hidden>{KIND_ICON[e.kind]}</span> {chipText(e)}
            </div>
          ),
        )}
        {more > 0 && <div className="pointer-events-none px-1 text-[11px] font-semibold text-slate-500">+{more} muuta</div>}
      </div>
    </div>
  );
}

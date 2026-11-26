// Jalkapallokalenterin kuukausinäkymä (18.11.2026): ma–su-ruudukko ISO-viikkonumeroin. PC:llä tapahtumat
// tekstinä ruuduissa, puhelimella merkkeinä; valitun päivän tapahtumat ja lisäyspainikkeet ruudukon alla.
// Kuukautta vaihdetaan nuolilla, "Tämä kuukausi" -painikkeella tai puhelimella pyyhkäisemällä.

import { useRef, useState, type TouchEvent } from 'react';
import { addDays } from '../../domain/dates';
import { HOME_AWAY_LABEL, OUTCOME_LABEL } from '../../domain/football';
import { addMonths, clashes, clockText, eventTitle, gridRange, isSubdued, teamNameFor, windowText, KIND_ICON, KIND_LABEL, monthGrid, monthKeyOf, type CalEvent, type MonthKey } from '../../domain/monthCalendar';
import { noteTimeText } from '../../domain/calendarNotes';
import { CalendarNoteSheet, type NoteDraft } from '../week/CalendarNoteSheet';
import type { ISODate, Profile, Session } from '../../domain/types';
import type { FixtureEntry } from '../../db/repositories';
import { Button, Card } from '../../ui/components';
import { ToggleChip } from '../../ui/controls';
import { dayLabel, formatDate } from '../../ui/format';
import { IconCalendarClock, IconChevronLeft, IconChevronRight, IconOverlap, IconPlus, IconWarning } from '../../ui/icons';
import { useStoredFlag } from '../../ui/storedPref';
import type { FixtureKind } from './FixtureSheet';
import { useCalendarEvents } from './useCalendarEvents';
import { useFootballProfiles } from '../football/useFootballEnabled';

const WEEKDAYS = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];

export const monthTitle = (m: MonthKey) => {
  const s = formatDate(`${m}-01`, 'LLLL yyyy');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Tapahtuman väri tilan mukaan (tuleva, tulos puuttuu, tulos, ei pelattu, treeni). */
export function chipClass(e: CalEvent): string {
  if (isSubdued(e)) return 'text-slate-500 ring-slate-200';
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
function detailLine(e: CalEvent, team?: string): string {
  if (e.kind === 'note') {
    const end = e.time && e.durationMin !== undefined ? endClock(e.time, e.durationMin) : undefined;
    return [KIND_LABEL.note, noteTimeText({ startTime: e.time, endTime: end }), e.location, e.family && 'Koko perhe'].filter(Boolean).join(' · ');
  }
  const parts: (string | undefined | false)[] = [
    e.kind !== 'training' && KIND_LABEL[e.kind],
    team,
    e.time && `klo ${hhmm(e.time)}`,
    e.arrival && e.state !== 'played' && `paikalla ${hhmm(e.arrival)}`,
    e.durationMin !== undefined && e.kind === 'training' && `${e.durationMin} min`,
    e.series,
    e.homeAway && HOME_AWAY_LABEL[e.homeAway],
    e.location,
  ];
  return parts.filter(Boolean).join(' · ');
}

/** Päättymisaika alusta ja kestosta ("14:30" + 45 → "15:15"). */
function endClock(start: string, min: number): string {
  const m = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) + min;
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const STATE_NOTE: Partial<Record<CalEvent['state'], string>> = { pending: 'Tulos puuttuu', skipped: 'Ei pelattu' };

export function MonthCalendar({
  profile,
  today,
  month,
  onMonth: setMonth,
  onEdit,
  onAdd,
  onOpenSession,
}: {
  profile: Profile;
  today: ISODate;
  month: MonthKey;
  onMonth: (m: MonthKey) => void;
  onEdit: (e: FixtureEntry) => void;
  onAdd: (kind: FixtureKind, date: ISODate) => void;
  onOpenSession: (s: Session) => void;
}) {
  const [selected, setSelected] = useState<ISODate | undefined>(() => (month === monthKeyOf(today) ? today : undefined));
  const [trainings, setTrainings] = useStoredFlag('calendarTrainings', false);
  // Kalenterimerkinnät (27.11.2026): oletuksena mukana; muokkaus samasta paneelista kuin Viikko-näkymässä.
  const [notesOn, setNotesOn] = useStoredFlag('calendarNotes', true);
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);
  // Perhekalenteri (19.11.2026): kaikkien jalkapalloprofiilien tapahtumat, jokaisella oma värinsä.
  const familyProfiles = useFootballProfiles();
  const canFamily = (familyProfiles?.length ?? 0) > 1;
  const [familyPref, setFamily] = useStoredFlag('calendarFamily', false);
  const family = familyPref && canFamily;
  const members = family ? familyProfiles! : [profile];
  const memberById = new Map(members.map((p) => [p.id, p]));
  const range = gridRange(month);
  const data = useCalendarEvents(
    members.map((p) => p.id),
    range.from,
    range.to,
    today,
    trainings,
    notesOn,
  );
  const own = (e: CalEvent) => !e.profileId || e.profileId === profile.id;
  // Treenin joukkue tai ryhmä (19.11.2026), myös yhdellä joukkueella (kuten Viikko-näkymässä).
  const trainingTeam = (e: CalEvent) => {
    const t = e.kind === 'training' && e.teamId ? data?.teams.get(e.teamId) : undefined;
    return t ? (t.kind === 'group' ? t.name : teamNameFor(t.name, 'compact')) : undefined;
  };
  const colorOf = (e: CalEvent) => (family && e.profileId ? memberById.get(e.profileId)?.color : undefined);
  // Päällekkäisyydet vain tästä päivästä eteenpäin (menneet eivät enää vaadi järjestelyjä).
  const clashOn = (d: ISODate) => (family && d >= today ? clashes(data?.events.get(d) ?? []) : []);
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
    if (e.kind === 'note') {
      const n = data?.notes.get(e.key);
      if (n) setNoteDraft({ note: n });
    } else if (e.sessionId) {
      const s = data?.sessions.get(e.sessionId);
      if (s) onOpenSession(s);
    } else if (e.planId && e.state !== 'skipped') {
      const entry = data?.fixtures.get(e.planId);
      if (entry) onEdit(entry);
    }
  };
  // Toisen lapsen tapahtumaa muokataan hänen profiilissaan.
  const clickable = (e: CalEvent) => own(e) && (e.kind === 'note' || !!e.sessionId || (!!e.planId && e.state !== 'skipped'));

  const dayEvents = selected ? (data?.events.get(selected) ?? []) : [];
  const dayClashes = selected ? clashOn(selected) : [];

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
        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
          <ToggleChip on={trainings} onChange={setTrainings}>
            Treenit
          </ToggleChip>
          <ToggleChip on={notesOn} onChange={setNotesOn}>
            Merkinnät
          </ToggleChip>
          {canFamily && (
            <ToggleChip on={familyPref} onChange={setFamily}>
              Koko perhe
            </ToggleChip>
          )}
        </div>
      </div>

      {/* Leveä kortti (27.11.2026): kalenteri ja valitun päivän tapahtumat rinnakkain. */}
      <div className="@container">
      <div className="@min-[64rem]:grid @min-[64rem]:grid-cols-[minmax(0,1fr)_19rem] @min-[64rem]:items-start @min-[64rem]:gap-6">
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
                  colorOf={colorOf}
                  clash={clashOn(d).length > 0}
                />
              ))}
            </div>
          ))}
        </div>
        {family && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-700" aria-label="Perheen värit">
            {members.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-full" style={{ background: p.color }} aria-hidden />
                {p.name}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>⚽ ottelu</span>
          <span>🏆 turnaus</span>
          <span>🤝 harjoituspeli</span>
          {trainings && <span>👟 treeni</span>}
          {notesOn && <span>📅 muu merkintä</span>}
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-amber-50 ring-1 ring-amber-200" /> tulos puuttuu
          </span>
          <span className="inline-flex items-center gap-1">
            <IconWarning size="0.8rem" className="text-amber-700" /> tietoja puuttuu
          </span>
          {family && (
            <span className="inline-flex items-center gap-1 font-semibold text-red-700">
              <IconOverlap size="0.85rem" /> päällekkäin
            </span>
          )}
          <span className="sm:hidden">· pyyhkäise vaihtaaksesi kuukautta</span>
        </div>
      </div>

      {!selected && <p className="mt-3 hidden pl-5 text-sm text-slate-500 @min-[64rem]:block">Valitse päivä kalenterista.</p>}
      {selected && (
        <section className="mt-4 border-t border-slate-100 pt-3 @min-[64rem]:mt-3 @min-[64rem]:border-l @min-[64rem]:border-t-0 @min-[64rem]:pl-5 @min-[64rem]:pt-1" aria-label={`Valittu päivä ${dayLabel(selected)}`}>
          <h3 className="text-sm font-semibold text-slate-900">{formatDate(selected, 'cccc d.M.yyyy').replace(/^./, (c) => c.toUpperCase())}</h3>
          {dayClashes.length > 0 && (
            <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 ring-1 ring-red-200" role="status">
              <div className="flex items-center gap-1.5 font-semibold">
                <IconOverlap size="1rem" /> Päällekkäin
              </div>
              <ul className="mt-0.5 space-y-0.5 text-xs">
                {dayClashes.map(([a, b]) => (
                  <li key={`${a.key}-${b.key}`}>
                    {memberById.get(a.profileId!)?.name}: {KIND_LABEL[a.kind].toLowerCase()} {windowText(a)} ja {memberById.get(b.profileId!)?.name}: {KIND_LABEL[b.kind].toLowerCase()} {windowText(b)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dayEvents.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">Ei pelejä{trainings ? ' eikä treenejä' : ''}{notesOn ? ' eikä merkintöjä' : ''} tälle päivälle.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {dayEvents.map((e) => {
                const body = (
                  <>
                    <span className="text-lg leading-none" aria-hidden>
                      {KIND_ICON[e.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      {family && e.profileId && (
                        <span className="mb-0.5 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                          <span className="size-2.5 rounded-full" style={{ background: colorOf(e) }} aria-hidden />
                          {memberById.get(e.profileId)?.name}
                        </span>
                      )}
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={`truncate font-medium ${e.state === 'skipped' ? 'text-slate-500 line-through' : isSubdued(e) ? 'text-slate-600' : 'text-slate-900'}`}>{eventTitle(e, 'full')}</span>
                        {e.result && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${chipClass(e)}`}>{e.result}</span>}
                        {STATE_NOTE[e.state] && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${chipClass(e)}`}>{STATE_NOTE[e.state]}</span>}
                        {e.infoMissing && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200" title={e.missingNote}>
                            <IconWarning size="0.8rem" /> Tietoja puuttuu
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-slate-600">{detailLine(e, trainingTeam(e))}</span>
                      {e.memo && <span className="block text-xs italic text-slate-500">{e.memo}</span>}
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
          {/* Muokkausvihje kerran listan alla (27.11.2026), ei nimirivillä, jossa se rivittyi kapeassa sarakkeessa. */}
          {family && dayEvents.some((e) => !own(e)) && <p className="mt-1 px-2 text-xs text-slate-500">Muiden perheenjäsenten tapahtumia muokataan heidän omassa profiilissaan.</p>}
          {selected >= today ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {family && <span className="text-xs font-semibold text-slate-600">Lisää ({profile.name}):</span>}
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
              <button
                type="button"
                onClick={() => setNoteDraft({ date: selected })}
                className="press inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-slate-600 hover:bg-[var(--surface-sunk)] hover:text-slate-900"
              >
                <IconCalendarClock size="0.95rem" /> Muu merkintä
              </button>
            </div>
          ) : (
            dayEvents.length === 0 && <p className="mt-1 text-xs text-slate-500">Jo pelatun pelin kirjaat Viikko-näkymän +-painikkeella.</p>
          )}
        </section>
      )}
      </div>
      </div>
      <CalendarNoteSheet profile={profile} draft={noteDraft} onClose={() => setNoteDraft(null)} />

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
  colorOf,
  clash,
}: {
  date: ISODate;
  inMonth: boolean;
  today: boolean;
  selected: boolean;
  events: CalEvent[];
  onSelect: () => void;
  onOpen: (e: CalEvent) => void;
  clickable: (e: CalEvent) => boolean;
  colorOf: (e: CalEvent) => string | undefined;
  clash: boolean;
}) {
  const day = Number(date.slice(8, 10));
  const games = events.filter((e) => !isSubdued(e)).length;
  const label = `${dayLabel(date)}${today ? ', tänään' : ''}${clash ? ', päällekkäisiä tapahtumia' : ''}${events.length ? `, ${events.map((e) => `${eventTitle(e, 'full') === KIND_LABEL[e.kind] ? '' : `${KIND_LABEL[e.kind]} `}${eventTitle(e, 'full')}${e.result ? ` ${e.result}` : ''}`).join(', ')}` : ''}`;
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
        <span className="flex items-center gap-0.5">
          {games > 0 && events.some((e) => e.infoMissing) && (
            <span className={`text-[11px] text-amber-700 ${clash ? 'hidden sm:inline' : ''}`} aria-hidden title="Tietoja puuttuu">
              <IconWarning size="0.75rem" />
            </span>
          )}
          {clash && (
            <span className="text-[11px] font-bold text-red-700" aria-hidden title="Päällekkäin">
              <IconOverlap size="0.8rem" strokeWidth={2.25} />
            </span>
          )}
        </span>
      </div>

      {/* Puhelin: merkit (tulos kirjaimena); valittu päivä näyttää tiedot ruudukon alla. */}
      <div className="pointer-events-none relative mt-0.5 flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
        {events.slice(0, 3).map((e) => (
          <span key={e.key} className={`relative flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-0.5 text-[10px] font-bold leading-none ring-1 ${chipClass(e)} ${isSubdued(e) ? 'opacity-70' : ''}`}>
            {e.state === 'played' && e.outcome ? OUTCOME_LABEL[e.outcome] : KIND_ICON[e.kind]}
            {colorOf(e) && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full ring-1 ring-[var(--surface-raised)]" style={{ background: colorOf(e) }} />}
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
              style={colorOf(e) ? { borderLeft: `3px solid ${colorOf(e)}` } : undefined}
            >
              <span aria-hidden>{KIND_ICON[e.kind]}</span>{' '}
              {e.infoMissing && <IconWarning size="0.7rem" className="mr-0.5 inline-block align-[-1px] text-amber-700" />}
              {chipText(e)}
            </button>
          ) : (
            <div key={e.key} className={`pointer-events-none truncate rounded-md px-1 py-0.5 text-[11px] leading-tight ring-1 ${chipClass(e)}`} style={colorOf(e) ? { borderLeft: `3px solid ${colorOf(e)}` } : undefined}>
              <span aria-hidden>{KIND_ICON[e.kind]}</span> {chipText(e)}
            </div>
          ),
        )}
        {more > 0 && <div className="pointer-events-none px-1 text-[11px] font-semibold text-slate-500">+{more} muuta</div>}
      </div>
    </div>
  );
}

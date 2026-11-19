// Pelikalenterin tuloste (18.11.2026): kuukausikalenteri (kuukausi per A4-vaakasivu) tai otteluohjelma
// (tiivis taulukko A4-pystysivulle). Sama tulostuspohja kuin raporteissa: window.print, ei kirjastoja eikä
// verkkoliikennettä; aina vaalea paperi kiintein värein. Otsikossa joukkueen nimi ja logo; lapsen nimi vain,
// jos käyttäjä valitsee sen.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useBackClose } from '../../ui/backClose';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo } from '../../db/repositories';
import { addDays } from '../../domain/dates';
import { HOME_AWAY_LABEL } from '../../domain/football';
import {
  clockText,
  eventsBetween,
  eventTitle,
  teamNameFor,
  firstOfMonth,
  KIND_ICON,
  lastOfMonth,
  monthGrid,
  monthKeyOf,
  type CalEvent,
  type MonthKey,
} from '../../domain/monthCalendar';
import type { ISODate, Profile, Team } from '../../domain/types';
import { Segmented, ToggleChip } from '../../ui/controls';
import { dayLabel, formatDate } from '../../ui/format';
import { readStoredJson, writeStoredJson } from '../../ui/storedPref';
import { logoFor, useClubLogos } from '../../ui/TeamLogo';
import { currentReportPalette, type ReportPalette } from '../analysis/reportPalette';
import { useCalendarEvents } from './useCalendarEvents';
import { memberLabeler, monthName, PeriodPicker, periodLabel, periodMonths, periodSelectClass, type Span } from './calendarShared';
import { useFootballProfiles } from '../football/useFootballEnabled';

type Format = 'month' | 'program';

interface PrintOpts {
  format: Format;
  span: Span;
  count: number;
  trainings: boolean;
  results: boolean;
  places: boolean;
  arrival: boolean;
  childName: boolean;
  /** Perhekalenteri: kaikki profiilit, joilla jalkapallo on käytössä (19.11.2026). */
  family: boolean;
}

const DEFAULT_OPTS: PrintOpts = { format: 'month', span: 'months', count: 1, trainings: false, results: true, places: true, arrival: true, childName: false, family: false };
const OPTS_KEY = 'calendarPrint';

const cleanOpts = (v: Partial<PrintOpts>): PrintOpts => ({
  format: v.format === 'program' ? 'program' : 'month',
  span: v.span === 'spring' || v.span === 'autumn' ? v.span : 'months',
  count: Math.max(1, Math.min(6, Math.round(Number(v.count) || 1))),
  trainings: !!v.trainings,
  results: v.results !== false,
  places: v.places !== false,
  arrival: v.arrival !== false,
  childName: !!v.childName,
  family: !!v.family,
});

const WD = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];
const hhmm = clockText;
export function CalendarPrint({ profile, today, startMonth, onClose }: { profile: Profile; today: ISODate; startMonth: MonthKey; onClose: () => void }) {
  useBackClose(true, onClose);
  const familyProfiles = useFootballProfiles();
  const canFamily = (familyProfiles?.length ?? 0) > 1;
  const [opts, setOptsState] = useState<PrintOpts>(() => readStoredJson(OPTS_KEY, DEFAULT_OPTS, cleanOpts));
  const set = (patch: Partial<PrintOpts>) =>
    setOptsState((o) => {
      const next = cleanOpts({ ...o, ...patch });
      writeStoredJson(OPTS_KEY, next);
      return next;
    });
  const [start, setStart] = useState<MonthKey>(startMonth);
  const [year, setYear] = useState(Number(startMonth.slice(0, 4)));
  const teams = useLiveQuery(() => repo.listTeams(profile.id), [profile.id]);
  const [teamId, setTeamId] = useState<string | undefined>();
  const activeTeams = useMemo(() => (teams ?? []).filter((t) => !t.archived), [teams]);
  // Oletus: ainoa joukkue; useammalla kaikki joukkueet.
  const team: Team | undefined = activeTeams.find((t) => t.id === (teamId ?? (activeTeams.length === 1 ? activeTeams[0].id : '')));
  const teamById = useMemo(() => new Map((teams ?? []).map((t) => [t.id, t])), [teams]);
  const logos = useClubLogos();
  const logo = team ? logoFor(logos, team.name) : undefined;
  const pal = useMemo(currentReportPalette, []);

  const family = opts.family && canFamily;
  const members = family ? familyProfiles! : [profile];
  const months = periodMonths(opts.span, start, opts.count, year);
  const from = firstOfMonth(months[0]);
  const to = lastOfMonth(months[months.length - 1]);
  const data = useCalendarEvents(
    members.map((p) => p.id),
    from,
    to,
    today,
    opts.trainings,
  );
  const ready = !!data && data.from === from && data.to === to;
  const labels = memberLabeler(members, data?.teams ?? new Map(), opts.childName);
  const visible = (e: CalEvent) => family || e.kind === 'training' || !team || !e.teamId || e.teamId === team.id;
  const eventsOn = (d: ISODate) => (ready ? (data.events.get(d) ?? []).filter(visible) : []);
  // Perheessä jokaisella rivillä lapsi tai joukkue; muuten joukkue, jos tulosteessa on useampi joukkue.
  const teamPrefix = (e: CalEvent) =>
    family ? labels.event(e) : !team && activeTeams.length > 1 && e.teamId ? teamNameFor(teamById.get(e.teamId)?.name ?? '', 'short') || undefined : undefined;
  const colorOf = (e: CalEvent) => (family ? labels.color(e.profileId) : undefined);

  useEffect(() => {
    document.body.classList.add('print-report-open');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('print-report-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Ilman valittua joukkuetta otsikossa "Kaikki joukkueet" (useampi joukkue) tai "Jalkapallo"; lapsen nimi vain valittaessa.
  const heading = family ? 'Perheen pelit' : (team?.name ?? (activeTeams.length > 1 ? 'Kaikki joukkueet' : 'Jalkapallo'));
  const who = opts.childName && !family ? `${heading} · ${profile.name}` : heading;
  const kicker = opts.format === 'month' ? 'Pelikalenteri' : 'Otteluohjelma';
  const period = periodLabel(opts.span, months);
  // Perheen selite: väri ja lapsi tai joukkue.
  const legend = family && (
    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[10px] font-semibold">
      {members.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
          {labels.profile(p.id)}
        </span>
      ))}
    </div>
  );

  const print = () => {
    const title = document.title;
    document.title = `${kicker} ${who} ${period}`.replace(/[\\/:*?"<>|]/g, '-');
    const restore = () => {
      document.title = title;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  const header = (sub: ReactNode) => (
    <header className="flex items-center gap-4 rounded-xl px-5 py-3 text-[#ffffff]" style={{ background: pal.header }}>
      {logo && !family && (
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#ffffff]">
          <img src={logo} alt="" className="size-[86%] object-contain" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: pal.headerKicker }}>
          {kicker}
        </div>
        <h1 className="truncate font-display text-[22px] font-semibold leading-tight">{who}</h1>
      </div>
      <div className="shrink-0 text-right">{sub}</div>
    </header>
  );

  return createPortal(
    <div className="print-report fixed inset-0 z-[80] overflow-y-auto bg-[#d9d6cc]/95 [color-scheme:light]" role="dialog" aria-modal="true" aria-label={`${kicker} – tulostus`}>
      <div className="print-hide sticky top-0 z-10 shadow-lg" style={{ background: pal.header }}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-[#ffffff]">
          <div className="min-w-0 flex-1 text-sm font-semibold">Tulosta pelikalenteri</div>
          <button type="button" onClick={print} disabled={!ready} className="press min-h-10 rounded-xl bg-[#ffffff] px-4 text-sm font-bold disabled:opacity-60" style={{ color: pal.header }}>
            Tulosta / tallenna PDF
          </button>
          <button type="button" onClick={onClose} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-[#ffffff]/90 ring-1 ring-[#ffffff]/30 hover:bg-[#ffffff]/10">
            Sulje
          </button>
        </div>
      </div>

      {/* Valinnat: sovelluksen omat säätimet vaalealla pohjalla. */}
      <div className="print-hide mx-auto mt-3 max-w-[210mm] px-4">
        <div className="space-y-3 rounded-2xl bg-[var(--surface-raised)] p-4 text-sm shadow-md">
          <Segmented<Format>
            label="Tulosteen muoto"
            value={opts.format}
            onChange={(format) => set({ format })}
            options={[
              { value: 'month', label: 'Kuukausikalenteri' },
              { value: 'program', label: 'Otteluohjelma' },
            ]}
          />
          <PeriodPicker
            today={today}
            span={opts.span}
            onSpan={(span) => set({ span })}
            start={start}
            onStart={setStart}
            count={opts.count}
            onCount={(count) => set({ count })}
            maxCount={6}
            year={year}
            onYear={setYear}
          />
          <div className="flex flex-wrap items-center gap-2">
            {!family && activeTeams.length > 1 && (
              <label className="flex items-center gap-2">
                <span className="text-slate-600">Joukkue</span>
                <select className={periodSelectClass} value={team?.id ?? ''} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">Kaikki joukkueet</option>
                  {activeTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tulosteen tiedot">
            <ToggleChip on={opts.results} onChange={(results) => set({ results })}>
              Tulokset
            </ToggleChip>
            <ToggleChip on={opts.places} onChange={(places) => set({ places })}>
              Paikat
            </ToggleChip>
            <ToggleChip on={opts.arrival} onChange={(arrival) => set({ arrival })}>
              Paikalla-ajat
            </ToggleChip>
            <ToggleChip on={opts.trainings} onChange={(trainings) => set({ trainings })}>
              Treenit
            </ToggleChip>
            {canFamily && (
              <ToggleChip on={opts.family} onChange={(f) => set({ family: f })}>
                Koko perhe
              </ToggleChip>
            )}
            <ToggleChip on={opts.childName} onChange={(childName) => set({ childName })}>
              {family ? 'Lasten nimet' : 'Lapsen nimi'}
            </ToggleChip>
          </div>
          <p className="text-xs text-slate-500">
            Valitse tulostusikkunassa kohteeksi ”Tallenna PDF-muodossa”, jos haluat tiedoston.{' '}
            {family && !opts.childName && 'Perheen tulosteessa lapset erottuvat väreistä ja joukkueista; nimet näkyvät vain valittaessa. '}
            {opts.format === 'month' ? 'Kuukausikalenteri tulostuu vaakasivuille, kuukausi per sivu.' : 'Otteluohjelma tulostuu pystysivulle.'}
          </p>
        </div>
      </div>

      {!ready ? (
        <p className="print-hide py-10 text-center text-sm text-[#33403a]">Ladataan…</p>
      ) : opts.format === 'month' ? (
        <div className="cal-scroll overflow-x-auto px-4 py-4">
          {months.map((m) => (
            <MonthPage
              key={m}
              month={m}
              pal={pal}
              header={
                <>
                  {header(<MonthTitle month={m} period={opts.span !== 'months' || months.length > 1 ? period : undefined} />)}
                  {legend}
                </>
              }
              eventsOn={eventsOn}
              opts={opts}
              teamPrefix={teamPrefix}
              colorOf={colorOf}
              today={today}
            />
          ))}
        </div>
      ) : (
        <article className="report-paper mx-auto my-4 max-w-[210mm] bg-[#ffffff] p-6 text-[11.5px] leading-snug shadow-xl print:p-0" style={{ color: pal.ink }}>
          {header(<div className="font-display text-[15px] font-semibold">{period}</div>)}
          {legend}
          <ProgramTable months={months} eventsOn={eventsOn} opts={opts} pal={pal} teamPrefix={teamPrefix} colorOf={colorOf} />
          {ready && months.every((m) => eventsBetween(data.events, firstOfMonth(m), lastOfMonth(m), opts.trainings).filter(visible).length === 0) && (
            <p className="py-8 text-center" style={{ color: pal.soft }}>
              Ei pelejä valitulla jaksolla.
            </p>
          )}
          <Footer pal={pal} today={today} />
        </article>
      )}
    </div>,
    document.body,
  );
}

function MonthTitle({ month, period }: { month: MonthKey; period?: string }) {
  return (
    <>
      <div className="font-display text-[20px] font-semibold leading-tight">{monthName(month)}</div>
      {period && <div className="text-[10.5px] text-[#ffffff]/75">{period}</div>}
    </>
  );
}

function Footer({ pal, today }: { pal: ReportPalette; today: ISODate }) {
  return (
    <div className="mt-2 flex justify-between text-[9px]" style={{ color: pal.soft }}>
      <span>⚽ ottelu · 🏆 turnaus · 🤝 harjoituspeli · 👟 treeni · ⚠ tietoja puuttuu</span>
      <span>Tulostettu {formatDate(today, 'd.M.yyyy')}</span>
    </div>
  );
}

type Opts = Pick<PrintOpts, 'results' | 'places' | 'arrival' | 'trainings'>;

/** Tapahtuman rivit kuukausiruudussa. */
function CellEvent({ e, opts, pal, teamPrefix, color }: { e: CalEvent; opts: Opts; pal: ReportPalette; teamPrefix: (e: CalEvent) => string | undefined; color?: string }) {
  const training = e.kind === 'training';
  const skipped = e.state === 'skipped';
  const prefix = teamPrefix(e);
  const details = [
    opts.arrival && e.arrival && e.state !== 'played' && `paikalla ${hhmm(e.arrival)}`,
    e.series,
    e.homeAway && HOME_AWAY_LABEL[e.homeAway],
    opts.places && e.location,
  ].filter(Boolean);
  return (
    <div
      className={`overflow-hidden rounded-[3px] px-1 py-px ${skipped ? 'line-through' : ''}`}
      style={{ background: training ? 'transparent' : pal.tint, color: training || skipped ? pal.soft : pal.ink, ...(color ? { borderLeft: `3px solid ${color}` } : {}) }}
    >
      <div className="truncate font-semibold">
        <span aria-hidden>{KIND_ICON[e.kind]}</span> {hhmm(e.time)} {prefix && `${prefix} – `}
        {eventTitle(e, 'short')}
        {e.infoMissing && ' ⚠'}
      </div>
      {!training && details.length > 0 && <div className="truncate text-[8px]">{details.join(' · ')}</div>}
      {opts.results && e.result && <div className="truncate text-[8.5px] font-bold">{e.result}</div>}
      {skipped && <div className="text-[8px]">ei pelattu</div>}
    </div>
  );
}

function MonthPage({
  month,
  pal,
  header,
  eventsOn,
  opts,
  teamPrefix,
  colorOf,
  today,
}: {
  month: MonthKey;
  today: ISODate;
  colorOf: (e: CalEvent) => string | undefined;
  pal: ReportPalette;
  header: ReactNode;
  eventsOn: (d: ISODate) => CalEvent[];
  opts: Opts;
  teamPrefix: (e: CalEvent) => string | undefined;
}) {
  const weeks = monthGrid(month);
  // A4 vaaka 10 mm marginaalein: 190 mm korkeutta; otsikolle, viikonpäiville ja alatunnisteelle noin 35 mm.
  const rowH = (150 / weeks.length).toFixed(1);
  return (
    <section className="cal-page cal-landscape report-paper mx-auto mb-6 box-content flex h-[188mm] w-[277mm] flex-col overflow-hidden bg-[#ffffff] p-[6mm] text-[9px] leading-tight shadow-xl print:p-0" style={{ color: pal.ink }}>
      {header}
      <table className="mt-2 w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[7mm]" />
          {WD.map((d) => (
            <col key={d} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="pb-1 text-[8px] font-semibold uppercase" style={{ color: pal.soft }}>
              Vk
            </th>
            {WD.map((d) => (
              <th key={d} className="pb-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: pal.soft }}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.days[0]} style={{ height: `${rowH}mm` }}>
              <td className="border text-center align-top text-[8px] font-semibold" style={{ borderColor: pal.line, color: pal.soft, paddingTop: '1.5mm' }}>
                {w.week}
              </td>
              {w.days.map((d) => {
                const inMonth = monthKeyOf(d) === month;
                const events = inMonth ? eventsOn(d) : [];
                return (
                  <td key={d} className="border p-[1mm] align-top" style={{ borderColor: pal.line, background: inMonth ? '#ffffff' : '#f6f5f1' }}>
                    <div className="flex h-full max-h-full flex-col gap-[0.6mm] overflow-hidden" style={{ maxHeight: `${Number(rowH) - 2}mm` }}>
                      <div className="text-[10px] font-bold" style={{ color: inMonth ? pal.ink : '#b4b8b2' }}>
                        {Number(d.slice(8, 10))}
                      </div>
                      {events.map((e) => (
                        <CellEvent key={e.key} e={e} opts={opts} pal={pal} teamPrefix={teamPrefix} color={colorOf(e)} />
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-auto">
        <Footer pal={pal} today={today} />
      </div>
    </section>
  );
}

function ProgramTable({
  months,
  eventsOn,
  opts,
  pal,
  teamPrefix,
  colorOf,
}: {
  months: MonthKey[];
  eventsOn: (d: ISODate) => CalEvent[];
  opts: Opts;
  pal: ReportPalette;
  teamPrefix: (e: CalEvent) => string | undefined;
  colorOf: (e: CalEvent) => string | undefined;
}) {
  const cols = 3 + (opts.arrival ? 1 : 0) + (opts.places ? 1 : 0) + (opts.results ? 1 : 0);
  const th = 'border-b-2 px-1.5 py-1 text-left text-[9.5px] font-bold uppercase tracking-wide';
  const td = 'border-b px-1.5 py-1 align-top';
  return (
    <table className="mt-3 w-full border-collapse tabular-nums">
      <thead>
        <tr style={{ borderColor: pal.header, color: pal.soft }}>
          <th className={`${th} w-[17mm]`} style={{ borderColor: pal.header }}>
            Päivä
          </th>
          <th className={`${th} w-[11mm]`} style={{ borderColor: pal.header }}>
            Klo
          </th>
          {opts.arrival && (
            <th className={`${th} w-[15mm]`} style={{ borderColor: pal.header }}>
              Paikalla
            </th>
          )}
          <th className={th} style={{ borderColor: pal.header }}>
            Peli
          </th>
          {opts.places && (
            <th className={`${th} w-[38mm]`} style={{ borderColor: pal.header }}>
              Paikka
            </th>
          )}
          {opts.results && (
            <th className={`${th} w-[16mm] text-right`} style={{ borderColor: pal.header }}>
              Tulos
            </th>
          )}
        </tr>
      </thead>
      {months.map((m) => {
        const list = eventsBetweenDays(m, eventsOn, opts.trainings);
        if (!list.length) return null;
        return (
          <tbody key={m} className="break-inside-auto">
            <tr>
              <td colSpan={cols} className="px-1.5 pb-1 pt-3 font-display text-[13px] font-semibold" style={{ color: pal.header }}>
                {monthName(m)}
              </td>
            </tr>
            {list.map((e) => {
              const training = e.kind === 'training';
              const skipped = e.state === 'skipped';
              const prefix = teamPrefix(e);
              const tags = [e.series, e.homeAway && HOME_AWAY_LABEL[e.homeAway], skipped && 'ei pelattu', e.infoMissing && '⚠ tietoja puuttuu'].filter(Boolean);
              const lines = e.kind === 'tournament' || (e.kind === 'friendly' && e.state === 'played' && (e.games?.length ?? 0) > 1) ? e.games : undefined;
              return [
                <tr key={e.key} className="break-inside-avoid" style={{ color: training || skipped ? pal.soft : pal.ink, borderColor: pal.line }}>
                  <td className={`${td} whitespace-nowrap font-semibold`} style={{ borderColor: pal.line, ...(colorOf(e) ? { boxShadow: `inset 3px 0 0 ${colorOf(e)}` } : {}) }}>
                    {dayLabel(e.date)}
                  </td>
                  <td className={td} style={{ borderColor: pal.line }}>
                    {hhmm(e.time)}
                  </td>
                  {opts.arrival && (
                    <td className={td} style={{ borderColor: pal.line }}>
                      {e.state !== 'played' ? hhmm(e.arrival) : ''}
                    </td>
                  )}
                  <td className={td} style={{ borderColor: pal.line }}>
                    <span className={skipped ? 'line-through' : ''}>
                      <span aria-hidden>{KIND_ICON[e.kind]}</span> <b className={training ? 'font-medium' : ''}>{prefix && `${prefix} – `}{lines && e.kind === 'friendly' ? 'Harjoituspeli' : eventTitle(e, 'compact')}</b>
                    </span>
                    {tags.length > 0 && <span style={{ color: pal.soft }}> · {tags.join(' · ')}</span>}
                    {lines && (
                      <div className="mt-0.5 text-[10px]" style={{ color: pal.soft }}>
                        {lines.map((g, i) => (
                          <div key={i}>
                            {i + 1}. {[hhmm(g.time), g.opponent ? teamNameFor(g.opponent, 'compact') : 'vastustaja ?', g.homeAway && HOME_AWAY_LABEL[g.homeAway], opts.places && g.location, opts.results && g.result].filter(Boolean).join(' · ')}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  {opts.places && (
                    <td className={td} style={{ borderColor: pal.line }}>
                      {e.location}
                    </td>
                  )}
                  {opts.results && (
                    <td className={`${td} text-right font-bold`} style={{ borderColor: pal.line }}>
                      {e.result ?? (e.state === 'pending' ? '–' : '')}
                    </td>
                  )}
                </tr>,
              ];
            })}
          </tbody>
        );
      })}
    </table>
  );
}

function eventsBetweenDays(m: MonthKey, eventsOn: (d: ISODate) => CalEvent[], trainings: boolean): CalEvent[] {
  const out: CalEvent[] = [];
  for (let d = firstOfMonth(m); d <= lastOfMonth(m); d = addDays(d, 1)) out.push(...eventsOn(d).filter((e) => trainings || e.kind !== 'training'));
  return out;
}

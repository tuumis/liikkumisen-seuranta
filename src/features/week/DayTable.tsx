// Päivät taulukkona: tiivis vaihtoehto päiväkorteille. Yksi rivi per päivä: kerrat ja suunnitelmat
// pieninä nappeina, arkiliikunta katkoviivalla, päivän kokonaisminuutit ja reipas+rasittava palkkeineen.
// Pikatoiminnot: + (kirjaa kerta päivälle), ✓ suunnitelmalle (tehty kuten suunniteltu) ja ✓
// arkiliikunnalle (vahvista arvio). Päivän alla suositusmerkit (rasittava, lihas, luusto).
// PC:llä valittavat lisäsarakkeet (tehot, jalkapallo, kommentit); summat minuutteina tai tunteina.

import { useEffect, useRef, useState } from 'react';
import { outcomeOf } from '../../domain/football';
import type { DayHours } from '../../domain/hours';
import { isEstimateConfirmation } from '../../domain/hours';
import type { ActivityType, Category, DayFlag, DayTotals, FootballDetails, ISODate, PlannedSession, RecommendationGroup, Session, UUID } from '../../domain/types';
import { dayLabel } from '../../ui/format';
import { IconBolt, IconBone, IconCheck, IconLeaf, IconPlus } from '../../ui/icons';
import { useToast } from '../../ui/Toast';
import { isFresh, useConfirmFeedback } from '../../ui/fresh';
import { morphOpen } from '../../ui/morph';
import { repo } from '../../db/repositories';
import { FLAG_LABEL } from './DaySheet';
import { confirmDayEstimates } from './EstimateDaySheet';

export interface DayTableRow {
  date: ISODate;
  isToday: boolean;
  isFuture: boolean;
  totals?: DayTotals;
  hours?: DayHours;
  sessions: Session[];
  plans: PlannedSession[];
  flag?: DayFlag;
}

type ExtraCol = 'split' | 'football' | 'note';
const EXTRA_COLS: { id: ExtraCol; label: string; text: string }[] = [
  { id: 'split', label: 'Kevyt, reipas, rasittava', text: 'Tehot erikseen minuutteina (kirjattu + arvio)' },
  { id: 'football', label: 'Jalkapallo', text: 'Tulos, peliaika ja pelaajan maalit' },
  { id: 'note', label: 'Kommentit', text: 'Kertojen muistiinpanot ja arviot' },
];

export type MinuteUnit = 'min' | 'h';
/** Minuutit valitussa yksikössä: 640 → "640" tai "10,7". */
export const fmtUnit = (m: number, unit: MinuteUnit) => (unit === 'h' ? (Math.round(m / 6) / 10).toFixed(1).replace('.', ',') : String(Math.round(m)));

function useStored<T extends string>(key: string, initial: T, valid: (v: string) => boolean): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s !== null && valid(s) ? (s as T) : initial;
    } catch {
      return initial;
    }
  });
  return [
    v,
    (n) => {
      setV(n);
      try {
        localStorage.setItem(key, n);
      } catch {
        /* ei tallennusta */
      }
    },
  ];
}

/** Lyhyt nimi taulukkoon: tarkenne tai lajin nimen loppuosa ("Jalkapallo – treeni" → "Treeni"). */
function shortName(s: { label?: string }, t?: ActivityType): string {
  if (s.label) return s.label;
  const n = t?.name ?? 'Laji';
  const tail = n.includes(' – ') ? n.split(' – ').pop()! : n;
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}

/** Jalkapallon tiivis yhteenveto: tulos tai turnauksen V-T-H, peliaika ja pelaajan maalit. */
function footballCell(s: Session, t: ActivityType | undefined, d: FootballDetails | undefined): string {
  const parts: string[] = [];
  if (t?.footballKind === 'game' && d) {
    const o = outcomeOf(d.goalsFor, d.goalsAgainst);
    if (o) parts.push(`${d.goalsFor}–${d.goalsAgainst} ${{ W: 'V', D: 'T', L: 'H' }[o]}`);
    if (d.opponent) parts.push(d.opponent);
  }
  if (t?.footballKind === 'tournament' && d) {
    const games = d.games ?? [];
    const res = games.map((g) => outcomeOf(g.goalsFor, g.goalsAgainst)).filter(Boolean);
    parts.push(res.length ? `${res.filter((r) => r === 'W').length}–${res.filter((r) => r === 'D').length}–${res.filter((r) => r === 'L').length}` : `${games.length || d.gamesCount || '?'} peliä`);
  }
  if (s.playedMin !== undefined) parts.push(`pelasi ${s.playedMin} min`);
  if (d?.playerGoals) parts.push(`⚽ ${d.playerGoals}`);
  return parts.join(' · ');
}

const chip = 'press inline-flex max-w-full items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold leading-none';
const tick = 'press flex size-6 shrink-0 items-center justify-center rounded-lg text-green-800 ring-1 ring-green-700/25 hover:bg-green-100';

export function DayTable({
  rows,
  profileId,
  group,
  vigorousMin,
  barTarget,
  types,
  footballDetails,
  unit,
  onUnit,
  onAdd,
  onEdit,
  onPlanOpen,
  onPlanConfirm,
  onEstimate,
  onOpenMenu,
}: {
  rows: DayTableRow[];
  profileId: UUID;
  group: RecommendationGroup;
  vigorousMin: number;
  barTarget: number;
  types: Map<UUID, ActivityType>;
  footballDetails?: Map<UUID, FootballDetails>;
  unit: MinuteUnit;
  onUnit: (u: MinuteUnit) => void;
  onAdd: (date: ISODate) => void;
  onEdit: (s: Session) => void;
  onPlanOpen: (p: PlannedSession) => void;
  onPlanConfirm: (p: PlannedSession) => void;
  onEstimate: (date: ISODate) => void;
  onOpenMenu: (date: ISODate) => void;
}) {
  const toast = useToast();
  const [colsRaw, setColsRaw] = useStored<string>('dayTableCols', '', () => true);
  // Jalkapallosarake vain, kun jalkapallo on käytössä (lisätiedot annettu).
  const cols = new Set((colsRaw.split(',').filter(Boolean) as ExtraCol[]).filter((c) => c !== 'football' || footballDetails));
  const toggleCol = (c: ExtraCol) => {
    const n = new Set(cols);
    if (n.has(c)) n.delete(c);
    else n.add(c);
    setColsRaw([...n].join(','));
  };
  const [colMenu, setColMenu] = useState(false);
  const { leaving, confirm: confirmWithFeedback } = useConfirmFeedback(onPlanConfirm);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!colMenu) return;
    const onDown = (e: PointerEvent) => !menuRef.current?.contains(e.target as Node) && setColMenu(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setColMenu(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [colMenu]);

  // Suositusmerkit ryhmän mukaan (kuten Viikon rytmi).
  const marks = [
    ...(group === 'school_age' ? [{ key: 'vig', label: `Rasittava päivä (≥ ${vigorousMin} min)`, short: 'R', Icon: IconBolt, on: (t?: DayTotals) => (t?.logged.vigorous ?? 0) >= vigorousMin, target: 3 }] : []),
    ...(group !== 'early_years' ? [{ key: 'mus', label: 'Lihaksia vahvistava', short: 'L', Icon: IconLeaf, on: (t?: DayTotals) => !!t?.muscle, target: group === 'adult' ? 2 : 3 }] : []),
    ...(group === 'school_age' ? [{ key: 'bone', label: 'Luustoa vahvistava', short: 'Lu', Icon: IconBone, on: (t?: DayTotals) => !!t?.bone, target: 3 }] : []),
  ];

  const extra = 'hidden lg:table-cell';
  const sum = rows.reduce(
    (a, r) => {
      const listed = r.sessions.filter((s) => !isEstimateConfirmation(s));
      const c = r.totals?.combined;
      return {
        count: a.count + listed.length,
        total: a.total + (r.isFuture ? 0 : (r.hours?.actualMin ?? 0)),
        forecast: a.forecast + (r.hours?.forecastMin ?? 0),
        logged: a.logged + (r.totals?.mvpa ?? 0),
        est: a.est + (r.totals ? r.totals.mvpaCombined - r.totals.mvpa : 0),
        light: a.light + (c?.light ?? 0),
        moderate: a.moderate + (c?.moderate ?? 0),
        vigorous: a.vigorous + (c?.vigorous ?? 0),
      };
    },
    { count: 0, total: 0, forecast: 0, logged: 0, est: 0, light: 0, moderate: 0, vigorous: 0 },
  );
  const hasFuture = rows.some((r) => r.isFuture);

  async function quickEstimate(date: ISODate, categories: Category[]) {
    const ids = await confirmDayEstimates(profileId, date, categories);
    if (!ids.length) return toast('Arkiliikunnalle ei löydy lajia – tarkista Asetukset → Arkiliikunta');
    toast(`Arkiliikunta vahvistettu · ${dayLabel(date)}`, { label: 'Kumoa', run: () => Promise.all(ids.map((id) => repo.deleteSession(id))).then(() => {}) }, 'success');
  }

  return (
    <div className="card p-0">
      {/* Työkalurivi: yksikkö ja (PC) lisäsarakkeet. */}
      <div className="flex items-center gap-2 border-b border-slate-200/70 px-3 py-2">
        <span className="text-[11px] font-semibold text-slate-500">Summat</span>
        <div className="flex rounded-lg bg-[var(--surface-sunk)] p-0.5 text-[11px] font-semibold" role="radiogroup" aria-label="Summien yksikkö">
          {(['min', 'h'] as const).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              onClick={() => onUnit(u)}
              className={`press rounded-md px-2 py-1 ${unit === u ? 'bg-[var(--surface-raised)] text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {u === 'min' ? 'minuutteina' : 'tunteina'}
            </button>
          ))}
        </div>
        <div ref={menuRef} className="relative ml-auto hidden lg:block">
          <button
            type="button"
            onClick={() => setColMenu((o) => !o)}
            aria-expanded={colMenu}
            className="press flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-[var(--surface-sunk)]"
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
              <path d="M4 5h16v14H4zM9.5 5v14M14.5 5v14" />
            </svg>
            Sarakkeet{cols.size > 0 && ` (${cols.size})`}
          </button>
          {colMenu && (
            <div className="absolute right-0 top-full z-30 mt-1.5 w-72 rounded-2xl bg-[var(--surface-raised)] p-2 shadow-xl ring-1 ring-slate-200">
              <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold text-slate-500">Lisäsarakkeet (PC)</p>
              {EXTRA_COLS.filter((c) => c.id !== 'football' || footballDetails).map((c) => (
                <label key={c.id} className="flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-2 hover:bg-[var(--surface-sunk)]">
                  <input type="checkbox" className="mt-0.5 size-4 accent-green-700" checked={cols.has(c.id)} onChange={() => toggleCol(c.id)} />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{c.label}</span>
                    <span className="block text-xs text-slate-500">{c.text}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lisäsarakkeilla taulukolle vähimmäisleveys (PC); kapeassa palstassa se vierii sivuttain. */}
      <div className="scroll-thin overflow-x-auto rounded-b-[inherit]">
        <table
          className="w-full table-fixed border-collapse text-sm lg:min-w-[var(--tmin)]"
          style={{ ['--tmin' as string]: `${(6 + 16 + 4 + 6 + (cols.has('split') ? 10.5 : 0) + (cols.has('football') ? 11 : 0) + (cols.has('note') ? 12 : 0)) * 16}px` }}
        >
          <colgroup>
            <col className="w-[4.5rem] sm:w-24" />
            <col />
            {cols.has('split') && (
              <>
                <col className="hidden w-14 lg:table-column" />
                <col className="hidden w-14 lg:table-column" />
                <col className="hidden w-14 lg:table-column" />
              </>
            )}
            {cols.has('football') && <col className="hidden w-44 lg:table-column" />}
            {cols.has('note') && <col className="hidden w-48 lg:table-column" />}
            <col className="w-12 sm:w-16" />
            <col className="w-[4.5rem] sm:w-24" />
          </colgroup>
          <thead>
            <tr className="text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
              <th scope="col" className="px-3 py-2.5 font-bold">
                Päivä
              </th>
              <th scope="col" className="px-1 py-2.5 font-bold">
                Kerrat
              </th>
              {cols.has('split') && (
                <>
                  <th scope="col" className={`${extra} px-1 py-2.5 text-right font-bold`} title="Kevyt liikunta (min)">
                    Kevyt
                  </th>
                  <th scope="col" className={`${extra} px-1 py-2.5 text-right font-bold`} title="Reipas liikunta (min)">
                    Reipas
                  </th>
                  <th scope="col" className={`${extra} px-1 py-2.5 text-right font-bold`} title="Rasittava liikunta (min)">
                    Rasitt.
                  </th>
                </>
              )}
              {cols.has('football') && (
                <th scope="col" className={`${extra} px-2 py-2.5 font-bold`}>
                  Jalkapallo
                </th>
              )}
              {cols.has('note') && (
                <th scope="col" className={`${extra} px-2 py-2.5 font-bold`}>
                  Kommentit
                </th>
              )}
              <th scope="col" className="px-1 py-2.5 text-right font-bold" title="Kaikki liikunta (kevyt, reipas, rasittava); tulevilla päivillä ennuste">
                {unit === 'h' ? 'h' : 'Min'}
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-bold" title="Reipas ja rasittava liikunta minuutteina; + on arkiliikunnan arviota. Palkki: päivän tavoite.">
                Reipas+
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const listed = r.sessions.filter((s) => !isEstimateConfirmation(s));
              const confirmed = r.sessions.filter(isEstimateConfirmation);
              const pending = r.hours && !r.flag ? r.hours.estimateMin : 0;
              const confirmedMin = confirmed.reduce((a, s) => a + s.durationMin, 0);
              const logged = r.totals?.mvpa ?? 0;
              const est = r.totals ? r.totals.mvpaCombined - r.totals.mvpa : 0;
              const loggedPct = Math.min(100, (logged / barTarget) * 100);
              const estPct = Math.min(100 - loggedPct, (est / barTarget) * 100);
              const c = r.totals?.combined;
              const [wd, dm] = dayLabel(r.date).split(' ');
              const notes = r.sessions
                .flatMap((s) => [s.note && !isEstimateConfirmation(s) ? s.note : '', footballDetails?.get(s.id)?.ratingNote ?? ''])
                .filter(Boolean)
                .map((n) => n.split(/\r?\n/)[0]);
              const football = listed.filter((s) => types.get(s.activityTypeId)?.sport === 'football');
              return (
                <tr
                  key={r.date}
                  data-today-row={r.isToday || undefined}
                  className={`border-t border-slate-200/70 align-top ${r.isToday ? 'bg-[var(--surface-sage)]' : ''} ${r.flag ? 'bg-[var(--surface-sunk)] text-slate-500 [&_td]:opacity-60' : ''}`}
                >
                  <th scope="row" className="p-0 text-left font-normal">
                    <button type="button" onClick={() => onOpenMenu(r.date)} className="press flex w-full flex-col items-start px-3 py-2.5 text-left" aria-label={`Päivän ${dayLabel(r.date)} toiminnot`}>
                      <span className={`text-sm font-bold leading-tight ${r.isToday ? 'text-green-800' : r.isFuture || r.flag ? 'text-slate-500' : 'text-slate-900'}`}>{wd}</span>
                      <span className="text-[11px] leading-tight text-slate-500">{r.isToday ? 'tänään' : dm}</span>
                      {!r.isFuture && marks.some((m) => m.on(r.totals)) && (
                        <span className="mt-1 flex gap-0.5">
                          {marks
                            .filter((m) => m.on(r.totals))
                            .map((m) => (
                              <span key={m.key} title={m.label} className="flex size-[18px] items-center justify-center rounded-md bg-green-700 text-white">
                                <m.Icon size="0.7rem" />
                                <span className="sr-only">{m.label}</span>
                              </span>
                            ))}
                        </span>
                      )}
                    </button>
                  </th>
                  <td className="px-1 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {r.flag && <span className="rounded-lg bg-slate-200 px-1.5 py-1 text-xs font-semibold leading-none text-slate-700">{FLAG_LABEL[r.flag.reason]}</span>}
                      {listed.map((s) => {
                        const t = types.get(s.activityTypeId);
                        return (
                          <button key={s.id} type="button" onClick={(e) => morphOpen(e.currentTarget, () => onEdit(s))} className={`${chip} bg-[var(--surface-sage)] text-slate-800 hover:brightness-95 ${isFresh(s.id) ? 'row-fresh' : ''}`} title={`${t?.name ?? ''} ${s.durationMin} min`}>
                            {isFresh(s.id) ? (
                              <span className="fresh-check flex size-4 items-center justify-center rounded-full bg-green-700 text-white" aria-hidden>
                                <svg viewBox="0 0 16 16" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3.5 8.5 6.5 11.5 12.5 4.5" pathLength={1} />
                                </svg>
                              </span>
                            ) : (
                              <span aria-hidden>{t?.icon}</span>
                            )}
                            <span className="truncate">{shortName(s, t)}</span>
                            <span className="tabular-nums text-slate-500">{s.durationMin}</span>
                          </button>
                        );
                      })}
                      {r.plans.map((p) => {
                        const t = types.get(p.activityTypeId);
                        const skipped = p.status === 'skipped';
                        return (
                          <span key={p.id} className={`inline-flex max-w-full items-center gap-0.5 ${leaving.has(p.id) ? 'plan-leaving' : ''}`}>
                            <button
                              type="button"
                              onClick={(e) => morphOpen(e.currentTarget, () => onPlanOpen(p))}
                              className={`${chip} border border-dashed border-slate-300 text-slate-500 ${skipped ? 'line-through opacity-70' : ''}`}
                              title={`Suunniteltu: ${t?.name ?? ''} ${p.durationMin} min${skipped ? ' (ei tehty)' : ''}`}
                            >
                              <span aria-hidden className="grayscale-[0.6]">
                                {t?.icon}
                              </span>
                              <span className="truncate">{shortName(p, t)}</span>
                              <span className="tabular-nums">{p.durationMin}</span>
                            </button>
                            {!skipped && !r.isFuture && (
                              <button type="button" onClick={() => confirmWithFeedback(p)} className={tick} aria-label={`Tehty kuten suunniteltu: ${t?.name ?? ''}`} title="Tehty kuten suunniteltu">
                                <IconCheck size="0.85rem" />
                              </button>
                            )}
                          </span>
                        );
                      })}
                      {(pending > 0 || confirmed.length > 0) && (
                        <span className="inline-flex max-w-full items-center gap-0.5">
                          <button
                            type="button"
                            disabled={r.isFuture}
                            onClick={() => onEstimate(r.date)}
                            className={`${chip} border border-dashed border-amber-300 bg-amber-50/60 text-slate-700 disabled:cursor-default dark:border-amber-800 dark:bg-amber-950/45`}
                            title={r.isFuture ? 'Arkiliikunnan arvio – tarkistetaan päivänä' : 'Arkiliikunta: vahvista, muuta tai merkitse ei tänä päivänä'}
                          >
                            <span aria-hidden>☀️</span>
                            <span>Arki</span>
                            {confirmed.length > 0 && <span className="tabular-nums text-green-800">{confirmedMin > 0 ? confirmedMin : 'ei'} ✓</span>}
                            {pending > 0 && <span className="tabular-nums text-amber-800">{pending} arvio</span>}
                          </button>
                          {pending > 0 && !r.isFuture && r.hours && (
                            <button type="button" onClick={() => void quickEstimate(r.date, r.hours!.estimateCategories)} className={tick} aria-label={`Vahvista arkiliikunta ${pending} min`} title="Vahvista arvio sellaisenaan">
                              <IconCheck size="0.85rem" />
                            </button>
                          )}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onAdd(r.date)}
                        className="press flex size-6 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-500 hover:bg-[var(--surface-sunk)] hover:text-slate-800"
                        aria-label={`Lisää kerta: ${dayLabel(r.date)}`}
                        title="Lisää kerta tälle päivälle"
                      >
                        <IconPlus size="0.85rem" />
                      </button>
                    </div>
                  </td>
                  {cols.has('split') &&
                    (['light', 'moderate', 'vigorous'] as const).map((k) => (
                      <td key={k} className={`${extra} px-1 py-2.5 text-right text-xs tabular-nums text-slate-700`}>
                        {!r.isFuture && c && c[k] > 0 ? Math.round(c[k]) : <span className="text-slate-400">–</span>}
                      </td>
                    ))}
                  {cols.has('football') && (
                    <td className={`${extra} px-2 py-2.5 text-xs text-slate-700`}>
                      {football.some((s) => footballCell(s, types.get(s.activityTypeId), footballDetails?.get(s.id))) ? (
                        football.map((s) => {
                          const txt = footballCell(s, types.get(s.activityTypeId), footballDetails?.get(s.id));
                          return txt ? (
                            <div key={s.id} className="truncate" title={txt}>
                              <span aria-hidden>{types.get(s.activityTypeId)?.icon} </span>
                              {txt}
                            </div>
                          ) : null;
                        })
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                  )}
                  {cols.has('note') && (
                    <td className={`${extra} px-2 py-2.5 text-xs text-slate-600`}>
                      {notes.length ? (
                        notes.map((n, i) => (
                          <div key={i} className="truncate" title={n}>
                            💬 {n}
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                  )}
                  <td className="px-1 py-2.5 text-right">
                    {!r.isFuture && (r.hours?.actualMin ?? 0) > 0 ? (
                      <span className="stat text-[15px] text-slate-900">{fmtUnit(r.hours!.actualMin, unit)}</span>
                    ) : r.isFuture && !r.flag && (r.hours?.forecastMin ?? 0) > 0 ? (
                      <span className="text-xs tabular-nums text-slate-400" title="Ennuste: suunnitellut kerrat ja arkiliikunnan arvio">
                        ~{fmtUnit(r.hours!.forecastMin, unit)}
                      </span>
                    ) : (
                      <span className="text-slate-400">–</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs">
                    {!r.isFuture && (logged > 0 || est > 0) ? (
                      <>
                        <span className="whitespace-nowrap">
                          <span className="font-semibold tabular-nums text-slate-800">{logged}</span>
                          {est > 0 && <span className="tabular-nums text-amber-800">+{est}</span>}
                        </span>
                        <div className="ml-auto mt-1 flex h-1.5 w-full max-w-16 gap-[2px] overflow-hidden rounded-full bg-[var(--viz-track)]" title={`Päivän tavoite ${barTarget} min`} aria-hidden>
                          <div className="h-full rounded-full" style={{ width: `${loggedPct}%`, background: 'var(--viz-logged)' }} />
                          {estPct > 0 && <div className="h-full rounded-full" style={{ width: `${estPct}%`, background: 'var(--viz-estimate)' }} />}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 align-top text-xs font-semibold text-slate-600">
              <th scope="row" className="px-3 py-2.5 text-left font-bold">
                Yht.
              </th>
              <td className="px-1 py-2.5">
                <span className="block">
                  {sum.count} {sum.count === 1 ? 'kerta' : 'kertaa'}
                </span>
                {marks.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 font-medium">
                    {marks.map((m) => {
                      const n = rows.filter((r) => !r.isFuture && m.on(r.totals)).length;
                      return (
                        <span key={m.key} className={`inline-flex items-center gap-0.5 ${n >= m.target ? 'text-green-800' : ''}`} title={`${m.label}: ${n}/${m.target} päivää`}>
                          <m.Icon size="0.75rem" /> {n}/{m.target}
                        </span>
                      );
                    })}
                  </span>
                )}
              </td>
              {cols.has('split') &&
                (['light', 'moderate', 'vigorous'] as const).map((k) => (
                  <td key={k} className={`${extra} px-1 py-2.5 text-right tabular-nums text-slate-900`}>
                    {fmtUnit(sum[k], unit)}
                  </td>
                ))}
              {cols.has('football') && <td className={extra} />}
              {cols.has('note') && <td className={extra} />}
              <td className="px-1 py-2.5 text-right tabular-nums text-slate-900">
                {fmtUnit(sum.total, unit)}
                {hasFuture && sum.forecast > sum.total && (
                  <span className="block font-medium text-slate-400" title="Ennuste koko viikolle">
                    ~{fmtUnit(sum.forecast, unit)}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                <span className="text-slate-900">{fmtUnit(sum.logged, unit)}</span>
                {sum.est > 0 && <span className="text-amber-800">+{fmtUnit(sum.est, unit)}</span>}
                {unit === 'h' && <span className="text-slate-500"> h</span>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

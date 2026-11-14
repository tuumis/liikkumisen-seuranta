// Viikkoraportti tulostettavaksi tai PDF:ksi (SPEC 16, 14.11.2026): viikon tapahtumat päivittäin
// taulukkona, yhteenveto kokonaistunneista sekä reippaan ja rasittavan tunneista. Sama tulostuspohja
// kuin jaksoraportissa (window.print, ei kirjastoja eikä verkkoliikennettä; index.css @media print).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, isoWeek, isoWeekday, weekPeriod } from '../../domain/dates';
import { DAY_TARGET } from '../../domain/dayTarget';
import { formatHours } from '../../domain/hours';
import type { ActivityType, ISODate, Profile, RecommendationGroup } from '../../domain/types';
import { weekReport, type WeekReport as WeekReportData, type WeekReportDay } from '../../domain/weekReport';
import { repo } from '../../db/repositories';
import { useFootballEnabled } from '../football/useFootballEnabled';
import { FLAG_LABEL } from '../week/DaySheet';
import { formatDate } from '../../ui/format';
import { Button } from '../../ui/components';
import { IconReport } from '../../ui/icons';
import { today as todayFn } from '../../ui/today';
import { useReport } from './useReport';

const INK = '#26342e';
const SOFT = '#5a645d';
const LINE = '#e5e2d8';
/** Tehot yhdellä sävyllä vaaleasta tummaan (kevyt → rasittava). */
const C_LIGHT = '#cfe3d4';
const C_MOD = '#3f9a6e';
const C_VIG = '#14532d';
const WEEKDAYS = ['Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai', 'Sunnuntai'];
const WD_SHORT = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'];

const mins = (x: number) => String(Math.round(x));

function useWeekReport(profile: Profile, weekStart: ISODate): { data: WeekReportData; group: RecommendationGroup } | undefined {
  const period = useMemo(() => weekPeriod(weekStart), [weekStart]);
  const report = useReport(profile, period);
  const footballOn = useFootballEnabled(profile);
  const extra = useLiveQuery(async () => {
    const [sessions, flags, typesList] = await Promise.all([
      repo.sessionsInRange(profile.id, period.start, period.end),
      repo.dayFlagsInRange(profile.id, period.start, period.end),
      repo.listActivityTypes({ includeArchived: true }),
    ]);
    const types = new Map<string, ActivityType>(typesList.map((t) => [t.id, t]));
    const live = sessions.filter((s) => !s.deletedAt);
    const fb = footballOn ? live.filter((s) => types.get(s.activityTypeId)?.sport === 'football') : [];
    const details = fb.length ? await repo.footballDetailsFor(fb.map((s) => s.id)) : undefined;
    return { sessions: live, flags, types, details };
  }, [profile.id, period.start, period.end, footballOn]);
  return useMemo(() => {
    if (!report || !extra) return undefined;
    const group = report.group.group;
    return { group, data: weekReport({ totals: report.allDays, hours: report.hours.days, ...extra, group }) };
  }, [report, extra]);
}

function targetText(group: RecommendationGroup): string {
  if (group === 'early_years') return 'vähintään 3 h liikettä, josta 1 h vauhdikasta';
  if (group === 'adult') return `reipas + rasittava ${Math.round(DAY_TARGET.adult)} min/pv (150 min/vko)`;
  return `reipas + rasittava vähintään ${DAY_TARGET[group]} min`;
}

export function WeekReport({ profile, weekStart, onClose }: { profile: Profile; weekStart: ISODate; onClose: () => void }) {
  const cur = useWeekReport(profile, weekStart);
  const prev = useWeekReport(profile, addDays(weekStart, -7));
  const period = weekPeriod(weekStart);
  const wk = isoWeek(weekStart);
  const today = todayFn();
  const unfinished = period.end >= today;
  const created = formatDate(today, 'd.M.yyyy');

  useEffect(() => {
    document.body.classList.add('print-report-open');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('print-report-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const print = () => {
    // Tiedostonimi PDF-tallennukseen sivun otsikosta; palautetaan tulostuksen jälkeen.
    const title = document.title;
    document.title = `Viikkoraportti ${profile.name} vko ${wk.week}-${wk.year}`;
    const restore = () => {
      document.title = title;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  const s = cur?.data.summary;
  const group = cur?.group ?? 'school_age';
  const ps = prev?.data.summary;
  const hasPrev = !!ps && ps.evaluatedDays > 0;

  return createPortal(
    <div className="print-report fixed inset-0 z-[80] overflow-y-auto bg-[#d9d6cc]/95" role="dialog" aria-modal="true" aria-label={`Viikkoraportti, viikko ${wk.week}`}>
      <div className="print-hide sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-[#26342e] px-4 py-3 text-white shadow-lg">
        <div className="min-w-0 flex-1 text-sm font-semibold">Viikkoraportti · viikko {wk.week}</div>
        <button type="button" onClick={print} disabled={!cur} className="press min-h-10 rounded-xl bg-white px-4 text-sm font-bold text-[#26342e] disabled:opacity-60">
          Tulosta / tallenna PDF
        </button>
        <button type="button" onClick={onClose} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-white/90 ring-1 ring-white/30 hover:bg-white/10">
          Sulje
        </button>
      </div>
      <p className="print-hide mx-auto max-w-[210mm] px-4 pt-3 text-xs text-[#33403a]">
        Valitse tulostusikkunassa kohteeksi ”Tallenna PDF-muodossa”, jos haluat tiedoston. Raportti muodostetaan tällä laitteella.
      </p>

      <article className="report-paper mx-auto my-4 max-w-[210mm] bg-white text-[12.5px] leading-snug text-[#26342e] shadow-xl">
        <header className="flex flex-wrap items-end gap-x-6 gap-y-2 rounded-none bg-[#26342e] px-6 py-5 text-white sm:px-9 print:rounded-xl print:px-6">
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#9fd3b4]">Viikkoraportti · liikkumisen seuranta</div>
            <h1 className="font-display text-[26px] font-semibold leading-tight">
              {profile.name} · viikko {wk.week}
            </h1>
            <div className="text-xs text-white/75">
              {formatDate(period.start, 'd.M.')}–{formatDate(period.end, 'd.M.yyyy')} · laadittu {created}
            </div>
          </div>
          {s && (
            <div className="text-right">
              <div className="font-display text-[34px] font-semibold leading-none tabular-nums">{formatHours(s.totalMin)}</div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">liikuntaa</div>
            </div>
          )}
        </header>

        <div className="px-6 pb-6 sm:px-9 print:px-1">
          {unfinished && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">Viikko on vielä kesken: luvut ovat tähän päivään asti.</p>
          )}
          {!cur || !s ? (
            <p className="py-10 text-center text-[#5a645d]">Ladataan…</p>
          ) : (
            <>
              <section className="mt-5 grid grid-cols-2 gap-2.5 break-inside-avoid sm:grid-cols-4">
                <Tile label="Liikuntaa yhteensä" value={formatHours(s.totalMin)} sub={`kirjatut ${formatHours(s.sessionsMin)} · arki ${formatHours(s.arkiMin)}`} />
                <Tile
                  label="Reipas + rasittava"
                  value={formatHours(s.mvpa)}
                  sub={s.evaluatedDays ? `keskim. ${Math.round(s.mvpa / Math.max(1, s.evaluatedDays))} min/pv` : undefined}
                  accent={C_MOD}
                />
                <Tile label="Josta rasittavaa" value={formatHours(s.vigorous)} sub={`${Math.round(s.vigorous)} min`} accent={C_VIG} />
                <Tile label="Päivätavoite" value={`${s.goalDays}/${s.evaluatedDays}`} sub={`päivää · ${s.sessionCount} ${s.sessionCount === 1 ? 'kerta' : 'kertaa'}`} />
              </section>

              <Section title="Reipas ja rasittava päivittäin" aside={<Legend />}>
                <DayChart days={cur.data.days} target={group === 'early_years' ? 60 : DAY_TARGET[group]} />
                <IntensityBar light={s.light} moderate={s.moderate} vigorous={s.vigorous} />
              </Section>

              <Section title="Viikon tapahtumat" breakable>
                <EventTable days={cur.data.days} total={s} />
                <p className="mt-1.5 text-[10.5px] text-[#5a645d]">
                  ✓ päivän tavoite täyttyi ({targetText(group)}). Arkiliikunta = vanhemman perusarvio tai päivän vahvistus (esim. välitunnit, koulumatkat).
                </p>
              </Section>

              <div className="grid gap-x-8 sm:grid-cols-2">
                <Section title="Lajit">
                  {s.byType.length ? (
                    <table className="w-full border-collapse tabular-nums">
                      <tbody>
                        {s.byType.slice(0, 8).map((t) => (
                          <tr key={t.typeId} className="border-t border-[#e5e2d8]">
                            <td className="py-1 pr-2">{t.name}</td>
                            <td className="w-1/3 py-1 pr-2">
                              <div className="h-2 rounded-sm bg-[#efede6]">
                                <div className="h-2 rounded-sm" style={{ width: `${(t.durationMin / Math.max(1, s.byType[0].durationMin)) * 100}%`, background: C_MOD }} />
                              </div>
                            </td>
                            <td className="py-1 pr-2 text-right text-[#5a645d]">{t.count} krt</td>
                            <td className="py-1 text-right font-semibold">{formatHours(t.durationMin)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-[#5a645d]">Ei kirjattuja kertoja.</p>
                  )}
                  {(s.muscleDays > 0 || s.boneDays > 0) && (
                    <p className="mt-1.5 text-[11px] text-[#5a645d]">
                      Lihaskuntoa {s.muscleDays} pv · luustoa vahvistavaa {s.boneDays} pv
                    </p>
                  )}
                </Section>
                <Section title="Vertailu edelliseen viikkoon">
                  {hasPrev ? (
                    <table className="w-full border-collapse tabular-nums">
                      <thead>
                        <tr className="text-left text-[10.5px] text-[#5a645d]">
                          <th className="py-1 font-semibold" />
                          <th className="py-1 text-right font-semibold">vko {wk.week}</th>
                          <th className="py-1 text-right font-semibold">vko {isoWeek(addDays(weekStart, -7)).week}</th>
                          <th className="py-1 text-right font-semibold">muutos</th>
                        </tr>
                      </thead>
                      <tbody>
                        <Compare label="Liikuntaa" a={s.totalMin} b={ps!.totalMin} fmt={formatHours} />
                        <Compare label="Reipas + rasittava" a={s.mvpa} b={ps!.mvpa} fmt={formatHours} />
                        <Compare label="Rasittava" a={s.vigorous} b={ps!.vigorous} fmt={formatHours} />
                        <Compare label="Kertoja" a={s.sessionCount} b={ps!.sessionCount} fmt={String} />
                        <Compare label="Tavoitepäiviä" a={s.goalDays} b={ps!.goalDays} fmt={String} />
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-[#5a645d]">Edelliseltä viikolta ei ole vertailtavia päiviä.</p>
                  )}
                </Section>
              </div>
            </>
          )}

          <footer className="mt-6 border-t border-[#e5e2d8] pt-2 text-[10px] leading-snug text-[#5a645d]">
            Kesto on liikuttu aika. Reippaan ja rasittavan minuutit ovat lajien tyypillisistä tehoista laskettuja arvioita, ja arkiliikunta on vanhemman perusarvio.
            Sairas- ja matkapäivät eivät ole mukana tavoitteissa. Luvut kertovat kirjatun liikunnan määrästä, eivät kunnosta eivätkä terveydestä. Vertailu:
            UKK-instituutin liikkumissuositukset.
          </footer>
        </div>
      </article>
    </div>,
    document.body,
  );
}

function Section({ title, aside, breakable, children }: { title: string; aside?: ReactNode; breakable?: boolean; children: ReactNode }) {
  return (
    <section className={`report-section mt-6 ${breakable ? '' : 'break-inside-avoid'}`}>
      <div className="mb-2 flex flex-wrap items-end gap-x-4 gap-y-1 border-b border-[#e5e2d8] pb-1">
        <h2 className="flex-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#434f48]">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[#e5e2d8] px-3 py-2.5" style={accent ? { borderTop: `4px solid ${accent}` } : { borderTop: `4px solid ${LINE}` }}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#5a645d]">{label}</div>
      <div className="font-display text-[24px] font-semibold leading-tight tabular-nums">{value}</div>
      {sub && <div className="text-[10.5px] leading-tight text-[#5a645d]">{sub}</div>}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex gap-3 text-[10.5px] text-[#5a645d]">
      {(
        [
          ['Kevyt', C_LIGHT],
          ['Reipas', C_MOD],
          ['Rasittava', C_VIG],
        ] as const
      ).map(([l, c]) => (
        <span key={l} className="inline-flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-[3px]" style={{ background: c }} />
          {l}
        </span>
      ))}
    </div>
  );
}

/** Päivän reipas (ylempi) ja rasittava (alempi) pinottuna, tavoiteviiva katkoviivana. */
function DayChart({ days, target }: { days: WeekReportDay[]; target: number }) {
  const W = 700;
  const H = 222;
  const top = 26;
  const base = 160;
  const max = Math.max(target * 1.3, ...days.map((d) => d.mvpa)) * 1.08;
  const y = (v: number) => base - (v / max) * (base - top);
  const gutter = 64; // tavoitteen merkintä oikeassa reunassa
  const col = (W - gutter) / 7;
  const bw = 46;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Reipas ja rasittava liikunta päivittäin">
      <line x1={0} x2={W - gutter + 8} y1={base} y2={base} stroke="#c9c5b8" strokeWidth={1} />
      <line x1={0} x2={W - gutter + 8} y1={y(target)} y2={y(target)} stroke={INK} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.7} />
      <text x={W} y={y(target) - 3} textAnchor="end" fontSize={11} fill={SOFT}>
        tavoite
      </text>
      <text x={W} y={y(target) + 11} textAnchor="end" fontSize={11} fontWeight={700} fill={INK}>
        {Math.round(target)} min
      </text>
      {days.map((d, i) => {
        const cx = col * i + col / 2;
        const wd = isoWeekday(d.date) - 1;
        const vigH = base - y(d.vigorous);
        const modH = base - y(d.moderate);
        const gap = d.vigorous > 0 && d.moderate > 0 ? 2 : 0;
        return (
          <g key={d.date}>
            <title>{`${WEEKDAYS[wd]}: reipas ${mins(d.moderate)} min, rasittava ${mins(d.vigorous)} min`}</title>
            {d.flag ? (
              <text x={cx} y={base - 10} textAnchor="middle" fontSize={11} fill={SOFT}>
                {FLAG_LABEL[d.flag]}
              </text>
            ) : d.future ? (
              <text x={cx} y={base - 10} textAnchor="middle" fontSize={11} fill="#a3a89f">
                tulossa
              </text>
            ) : (
              <>
                {vigH > 0 && <Bar x={cx - bw / 2} y={base - vigH} w={bw} h={vigH} fill={C_VIG} round={modH <= 0} />}
                {modH > 0 && <Bar x={cx - bw / 2} y={base - vigH - gap - modH} w={bw} h={modH} fill={C_MOD} round />}
                <text x={cx} y={base - vigH - gap - modH - 7} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK} stroke="#fff" strokeWidth={4} paintOrder="stroke">
                  {mins(d.mvpa)}
                </text>
              </>
            )}
            <text x={cx} y={base + 18} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>
              {WD_SHORT[wd]} {formatDate(d.date, 'd.M.')}
            </text>
            <text x={cx} y={base + 34} textAnchor="middle" fontSize={11} fill={SOFT}>
              {d.future ? '' : formatHours(d.durationMin)}
            </text>
            {d.goalMet && (
              <g transform={`translate(${cx}, ${base + 47})`}>
                <circle r={7} fill={C_MOD} />
                <path d="M-3 0.2 -0.9 2.4 3.2 -2.2" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Pylväs, jonka yläpää pyöristetty (perusta suora). */
function Bar({ x, y, w, h, fill, round }: { x: number; y: number; w: number; h: number; fill: string; round?: boolean }) {
  const r = round ? Math.min(4, h) : 0;
  return <path d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`} fill={fill} />;
}

function IntensityBar({ light, moderate, vigorous }: { light: number; moderate: number; vigorous: number }) {
  const total = light + moderate + vigorous;
  if (total <= 0) return null;
  const parts = [
    ['Kevyt', light, C_LIGHT, INK],
    ['Reipas', moderate, C_MOD, '#fff'],
    ['Rasittava', vigorous, C_VIG, '#fff'],
  ] as const;
  return (
    <div className="mt-3">
      <div className="mb-1 text-[10.5px] font-semibold text-[#5a645d]">Viikon tehojakauma</div>
      <div className="flex h-6 gap-[2px] overflow-hidden rounded-md">
        {parts.map(([l, v, bg, fg]) =>
          v > 0 ? (
            <div key={l} className="flex min-w-0 items-center justify-center text-[10.5px] font-bold" style={{ width: `${(v / total) * 100}%`, background: bg, color: fg }}>
              {v / total >= 0.12 ? `${Math.round((v / total) * 100)} %` : ''}
            </div>
          ) : null,
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 text-[11px] tabular-nums">
        {parts.map(([l, v]) => (
          <span key={l}>
            {l} <strong>{formatHours(v)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function EventTable({ days, total }: { days: WeekReportDay[]; total: WeekReportData['summary'] }) {
  const num = 'px-2 py-1 text-right tabular-nums';
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-[#5a645d]">
          <th className="w-12 px-2 py-1 font-semibold">Klo</th>
          <th className="px-2 py-1 font-semibold">Tapahtuma</th>
          <th className={`${num} w-16 font-semibold`}>Kesto</th>
          <th className={`${num} w-24 font-semibold`}>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block size-2 rounded-[2px]" style={{ background: C_MOD }} />
              Reipas+ras.
            </span>
          </th>
          <th className={`${num} w-20 font-semibold`}>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block size-2 rounded-[2px]" style={{ background: C_VIG }} />
              Rasittava
            </span>
          </th>
        </tr>
      </thead>
      {days.map((d) => {
        const wd = isoWeekday(d.date) - 1;
        return (
          <tbody key={d.date} className="break-inside-avoid">
            <tr className="bg-[#f1efe7]" style={{ borderTop: `2px solid #fff` }}>
              <th scope="rowgroup" colSpan={2} className="rounded-l-md px-2 py-1.5 text-left">
                <span className="font-bold">{WEEKDAYS[wd]}</span> <span className="font-normal text-[#5a645d]">{formatDate(d.date, 'd.M.')}</span>
                {d.flag && <span className="ml-2 rounded bg-[#dcd8cc] px-1.5 py-0.5 text-[10px] font-semibold">{FLAG_LABEL[d.flag]}</span>}
                {d.goalMet && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: C_MOD }}>
                    ✓ tavoite
                  </span>
                )}
              </th>
              <td className={`${num} font-bold`}>{d.future ? '' : `${mins(d.durationMin)} min`}</td>
              <td className={`${num} font-bold`}>{d.future ? '' : mins(d.mvpa)}</td>
              <td className={`${num} rounded-r-md font-bold`}>{d.future ? '' : mins(d.vigorous)}</td>
            </tr>
            {d.entries.map((e) => (
              <tr key={e.id} className="border-b border-[#efede6]">
                <td className="px-2 py-1 align-top tabular-nums text-[#5a645d]">{e.time ?? ''}</td>
                <td className="px-2 py-1 align-top">
                  <span className="font-semibold">{e.name}</span>
                  {e.detail && <span className="text-[#5a645d]"> · {e.detail}</span>}
                  {e.muscle && <Tag>lihas</Tag>}
                  {e.bone && <Tag>luusto</Tag>}
                </td>
                <td className={num}>{e.durationMin} min</td>
                <td className={num}>{mins(e.mvpa)}</td>
                <td className={num}>{mins(e.vigorous)}</td>
              </tr>
            ))}
            {d.arki && (
              <tr className="border-b border-[#efede6] text-[#4a554e]">
                <td className="px-2 py-1" />
                <td className="px-2 py-1 italic">
                  Arkiliikunta <span className="not-italic text-[#5a645d]">· {d.arki.confirmed ? 'vahvistettu' : 'perusarvio'}</span>
                </td>
                <td className={num}>{d.arki.durationMin} min</td>
                <td className={num}>{mins(d.arki.mvpa)}</td>
                <td className={num}>{mins(d.arki.vigorous)}</td>
              </tr>
            )}
            {!d.future && !d.entries.length && !d.arki && (
              <tr className="border-b border-[#efede6] text-[#8a918a]">
                <td className="px-2 py-1" />
                <td colSpan={4} className="px-2 py-1 italic">
                  Ei kirjauksia
                </td>
              </tr>
            )}
          </tbody>
        );
      })}
      <tfoot className="break-inside-avoid">
        <tr className="text-white" style={{ background: INK }}>
          <th colSpan={2} className="rounded-l-md px-2 py-2 text-left text-[12.5px] font-bold">
            Viikko yhteensä
            <span className="ml-2 text-[11px] font-normal text-white/75">
              {total.sessionCount} {total.sessionCount === 1 ? 'kerta' : 'kertaa'} · tavoite {total.goalDays}/{total.evaluatedDays} päivänä
            </span>
          </th>
          <td className={`${num} py-2 font-bold`}>{formatHours(total.totalMin)}</td>
          <td className={`${num} py-2 font-bold`}>{formatHours(total.mvpa)}</td>
          <td className={`${num} rounded-r-md py-2 font-bold`}>{formatHours(total.vigorous)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="ml-1.5 rounded border border-[#c9c5b8] px-1 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[#5a645d]">{children}</span>;
}

function Compare({ label, a, b, fmt }: { label: string; a: number; b: number; fmt: (x: number) => string }) {
  const diff = Math.round(a) - Math.round(b);
  const isHours = fmt === formatHours;
  const d = isHours ? Math.round(((a - b) / 60) * 10) / 10 : diff;
  const txt = d === 0 ? '±0' : `${d > 0 ? '+' : '−'}${isHours ? `${Math.abs(d).toFixed(1).replace('.', ',')} h` : Math.abs(d)}`;
  return (
    <tr className="border-t border-[#e5e2d8]">
      <td className="py-1">{label}</td>
      <td className="py-1 text-right font-semibold">{fmt(a)}</td>
      <td className="py-1 text-right text-[#5a645d]">{fmt(b)}</td>
      <td className={`py-1 text-right text-[11px] font-semibold ${d > 0 ? 'text-[#127a4e]' : 'text-[#5a645d]'}`}>{txt}</td>
    </tr>
  );
}

/** Viikkoraportin avaus. `fullOnly`: näkyy vain täydelle (päättyneelle) viikolle. */
export function WeekReportButton({ profile, weekStart, fullOnly = false, compact = false }: { profile: Profile; weekStart: ISODate; fullOnly?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const today = todayFn();
  const period = weekPeriod(weekStart);
  if (period.start > today || (fullOnly && period.end >= today)) return null;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} aria-label="Viikkoraportti (PDF)" className="shrink-0">
        <IconReport size="1.1rem" />
        <span className={compact ? 'hidden sm:inline' : ''}>Viikkoraportti</span>
      </Button>
      {open && <WeekReport profile={profile} weekStart={weekStart} onClose={() => setOpen(false)} />}
    </>
  );
}

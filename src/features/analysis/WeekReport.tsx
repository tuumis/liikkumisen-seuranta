// Viikkoraportti tulostettavaksi tai PDF:ksi (SPEC 16, 14.11.2026): viikon tapahtumat päivittäin
// taulukkona, yhteenveto kokonaistunneista sekä reippaan ja rasittavan tunneista. Sama tulostuspohja
// kuin jaksoraportissa (window.print, ei kirjastoja eikä verkkoliikennettä; index.css @media print).
// Aina vaalea paperi myös tummassa teemassa; värit kuten sovelluksen kaavioissa (reportPalette.ts).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useBackClose } from '../../ui/backClose';
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
import { currentReportPalette, type ReportPalette } from './reportPalette';
import { useReport } from './useReport';

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
  if (group === 'adult') return `reipas + 2 × rasittava ${Math.round(DAY_TARGET.adult)} min/pv (150 min/vko)`;
  return `reipas + rasittava vähintään ${DAY_TARGET[group]} min`;
}

export function WeekReport({ profile, weekStart, onClose }: { profile: Profile; weekStart: ISODate; onClose: () => void }) {
  useBackClose(true, onClose);
  const cur = useWeekReport(profile, weekStart);
  const prev = useWeekReport(profile, addDays(weekStart, -7));
  const period = weekPeriod(weekStart);
  const wk = isoWeek(weekStart);
  const today = todayFn();
  const unfinished = period.end >= today;
  const created = formatDate(today, 'd.M.yyyy');
  const pal = useMemo(currentReportPalette, []);

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
  const loggedMvpa = cur ? cur.data.days.reduce((a, d) => a + d.entries.reduce((b, e) => b + e.mvpa, 0), 0) : 0;

  // Tyylit kiinteinä väreinä (ei Tailwindin teemaväriluokkia, jotka tumma tila muuttaa).
  return createPortal(
    <div className="print-report fixed inset-0 z-[80] overflow-y-auto bg-[#d9d6cc]/95 [color-scheme:light]" role="dialog" aria-modal="true" aria-label={`Viikkoraportti, viikko ${wk.week}`}>
      <div className="print-hide sticky top-0 z-10 flex flex-wrap items-center gap-2 px-4 py-3 text-[#ffffff] shadow-lg" style={{ background: pal.header }}>
        <div className="min-w-0 flex-1 text-sm font-semibold">Viikkoraportti · viikko {wk.week}</div>
        <button type="button" onClick={print} disabled={!cur} className="press min-h-10 rounded-xl bg-[#ffffff] px-4 text-sm font-bold disabled:opacity-60" style={{ color: pal.header }}>
          Tulosta / tallenna PDF
        </button>
        <button type="button" onClick={onClose} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-[#ffffff]/90 ring-1 ring-[#ffffff]/30 hover:bg-[#ffffff]/10">
          Sulje
        </button>
      </div>
      <p className="print-hide mx-auto max-w-[210mm] px-4 pt-3 text-xs text-[#33403a]">
        Valitse tulostusikkunassa kohteeksi ”Tallenna PDF-muodossa”, jos haluat tiedoston. Raportti muodostetaan tällä laitteella.
      </p>

      <article className="report-paper mx-auto my-4 max-w-[210mm] bg-[#ffffff] text-[12.5px] leading-snug shadow-xl" style={{ color: pal.ink }}>
        <header className="flex flex-wrap items-end gap-x-6 gap-y-2 px-6 py-5 text-[#ffffff] sm:px-9 print:rounded-xl print:px-6" style={{ background: pal.header }}>
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.2em]" style={{ color: pal.headerKicker }}>
              Viikkoraportti · liikkumisen seuranta
            </div>
            <h1 className="font-display text-[26px] font-semibold leading-tight">
              {profile.name} · viikko {wk.week}
            </h1>
            <div className="text-xs text-[#ffffff]/75">
              {formatDate(period.start, 'd.M.')}–{formatDate(period.end, 'd.M.yyyy')} · laadittu {created}
            </div>
          </div>
          {s && (
            <div className="text-right">
              <div className="font-display text-[34px] font-semibold leading-none tabular-nums">{formatHours(s.totalMin)}</div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#ffffff]/70">liikuntaa</div>
            </div>
          )}
        </header>

        <div className="px-6 pb-6 sm:px-9 print:px-1">
          {unfinished && <p className="mt-4 rounded-lg bg-[#fbf3e6] px-3 py-2 text-xs text-[#6a4526] ring-1 ring-[#ecd3ad]">Viikko on vielä kesken: luvut ovat tähän päivään asti.</p>}
          {!cur || !s ? (
            <p className="py-10 text-center" style={{ color: pal.soft }}>
              Ladataan…
            </p>
          ) : (
            <>
              <section className="mt-5 grid grid-cols-2 gap-2.5 break-inside-avoid sm:grid-cols-4">
                <Tile pal={pal} label="Liikuntaa yhteensä" value={formatHours(s.totalMin)} sub={`kirjatut ${formatHours(s.sessionsMin)} · arki ${formatHours(s.arkiMin)}`} accent={pal.header} />
                <Tile
                  pal={pal}
                  label="Reipas + rasittava"
                  value={formatHours(s.mvpa)}
                  sub={`kirjatut ${formatHours(loggedMvpa)} · arki ${formatHours(Math.max(0, s.mvpa - loggedMvpa))}`}
                  accent={pal.logged}
                />
                <Tile pal={pal} label="Josta rasittavaa" value={formatHours(s.vigorous)} sub={`${Math.round(s.vigorous)} min`} accent={pal.vigorous} />
                <Tile
                  pal={pal}
                  label="Päivätavoite"
                  value={`${s.goalDays}/${s.evaluatedDays}`}
                  sub={s.evaluatedDays ? `päivää · keskim. ${Math.round(s.mvpa / Math.max(1, s.evaluatedDays))} min/pv` : 'päivää'}
                  accent={pal.estimate}
                />
              </section>

              <Section pal={pal} title="Reipas ja rasittava päivittäin" aside={<Legend pal={pal} items={[['Kirjatut kerrat', pal.logged], ['Arkiliikunta', pal.estimate]]} />}>
                <DayChart pal={pal} days={cur.data.days} target={DAY_TARGET[group]} />
                <IntensityBar pal={pal} light={s.light} moderate={s.moderate} vigorous={s.vigorous} totalMin={s.totalMin} />
              </Section>

              <Section pal={pal} title="Viikon tapahtumat" breakable>
                <EventTable pal={pal} days={cur.data.days} total={s} />
                <p className="mt-1.5 text-[10.5px]" style={{ color: pal.soft }}>
                  ✓ päivän tavoite täyttyi ({targetText(group)}). Arkiliikunta = vanhemman perusarvio tai päivän vahvistus (esim. välitunnit, koulumatkat, päiväkoti).
                </p>
              </Section>

              <div className="grid gap-x-8 sm:grid-cols-2">
                <Section pal={pal} title="Lajit">
                  {s.byType.length ? (
                    <table className="w-full border-collapse tabular-nums">
                      <tbody>
                        {s.byType.slice(0, 8).map((t) => (
                          <tr key={t.typeId} style={{ borderTop: `1px solid ${pal.line}` }}>
                            <td className="py-1 pr-2">{t.name}</td>
                            <td className="w-1/3 py-1 pr-2">
                              <div className="h-2 rounded-sm bg-[#efede6]">
                                <div className="h-2 rounded-sm" style={{ width: `${(t.durationMin / Math.max(1, s.byType[0].durationMin)) * 100}%`, background: pal.logged }} />
                              </div>
                            </td>
                            <td className="py-1 pr-2 text-right" style={{ color: pal.soft }}>
                              {t.count} krt
                            </td>
                            <td className="py-1 text-right font-semibold">{formatHours(t.durationMin)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: pal.soft }}>Ei kirjattuja kertoja.</p>
                  )}
                  {(s.muscleDays > 0 || s.boneDays > 0) && (
                    <p className="mt-1.5 text-[11px]" style={{ color: pal.soft }}>
                      Lihaskuntoa {s.muscleDays} pv · luustoa vahvistavaa {s.boneDays} pv
                    </p>
                  )}
                </Section>
                <Section pal={pal} title="Vertailu edelliseen viikkoon">
                  {hasPrev ? (
                    <table className="w-full border-collapse tabular-nums">
                      <thead>
                        <tr className="text-left text-[10.5px]" style={{ color: pal.soft }}>
                          <th className="py-1 font-semibold" />
                          <th className="py-1 text-right font-semibold">vko {wk.week}</th>
                          <th className="py-1 text-right font-semibold">vko {isoWeek(addDays(weekStart, -7)).week}</th>
                          <th className="py-1 text-right font-semibold">muutos</th>
                        </tr>
                      </thead>
                      <tbody>
                        <Compare pal={pal} label="Liikuntaa" a={s.totalMin} b={ps!.totalMin} hours />
                        <Compare pal={pal} label="Reipas + rasittava" a={s.mvpa} b={ps!.mvpa} hours />
                        <Compare pal={pal} label="Rasittava" a={s.vigorous} b={ps!.vigorous} hours />
                        <Compare pal={pal} label="Kertoja" a={s.sessionCount} b={ps!.sessionCount} />
                        <Compare pal={pal} label="Tavoitepäiviä" a={s.goalDays} b={ps!.goalDays} />
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: pal.soft }}>Edelliseltä viikolta ei ole vertailtavia päiviä.</p>
                  )}
                </Section>
              </div>
            </>
          )}

          <footer className="mt-6 pt-2 text-[10px] leading-snug" style={{ borderTop: `1px solid ${pal.line}`, color: pal.soft }}>
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

function Section({ pal, title, aside, breakable, children }: { pal: ReportPalette; title: string; aside?: ReactNode; breakable?: boolean; children: ReactNode }) {
  return (
    <section className={`report-section mt-6 ${breakable ? '' : 'break-inside-avoid'}`}>
      <div className="mb-2 flex flex-wrap items-end gap-x-4 gap-y-1 pb-1" style={{ borderBottom: `1px solid ${pal.line}` }}>
        <h2 className="flex-1 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: pal.header }}>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Tile({ pal, label, value, sub, accent }: { pal: ReportPalette; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ border: `1px solid ${pal.line}`, borderTop: `4px solid ${accent}` }}>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: pal.soft }}>
        {label}
      </div>
      <div className="font-display text-[24px] font-semibold leading-tight tabular-nums">{value}</div>
      {sub && (
        <div className="text-[10.5px] leading-tight" style={{ color: pal.soft }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Legend({ pal, items }: { pal: ReportPalette; items: [string, string][] }) {
  return (
    <div className="flex gap-3 text-[10.5px]" style={{ color: pal.soft }}>
      {items.map(([l, c]) => (
        <span key={l} className="inline-flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-[3px]" style={{ background: c }} />
          {l}
        </span>
      ))}
    </div>
  );
}

/** Päivän reipas ja rasittava: kirjatut kerrat (teeman väri) ja arkiliikunta (oranssi; arvio viivoitettuna) pinottuna. */
function DayChart({ pal, days, target }: { pal: ReportPalette; days: WeekReportDay[]; target: number }) {
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
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Reipas ja rasittava liikunta päivittäin: kirjatut kerrat ja arkiliikunta">
      <defs>
        <pattern id="wr-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill={pal.estimate} opacity="0.35" />
          <rect width="3" height="6" fill={pal.estimate} />
        </pattern>
      </defs>
      <line x1={0} x2={W - gutter + 8} y1={base} y2={base} stroke="#c9c5b8" strokeWidth={1} />
      <line x1={0} x2={W - gutter + 8} y1={y(target)} y2={y(target)} stroke={pal.ink} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.7} />
      <text x={W} y={y(target) - 3} textAnchor="end" fontSize={11} fill={pal.soft}>
        tavoite
      </text>
      <text x={W} y={y(target) + 11} textAnchor="end" fontSize={11} fontWeight={700} fill={pal.ink}>
        {Math.round(target)} min
      </text>
      {days.map((d, i) => {
        const cx = col * i + col / 2;
        const wd = isoWeekday(d.date) - 1;
        const logged = d.entries.reduce((a, e) => a + e.mvpa, 0);
        const est = Math.max(0, d.mvpa - logged);
        const logH = base - y(logged);
        const estH = base - y(est);
        const gap = logged > 0 && est > 0 ? 2 : 0;
        return (
          <g key={d.date}>
            <title>{`${WEEKDAYS[wd]}: kirjatut ${mins(logged)} min, arkiliikunta ${mins(est)} min (reipas + rasittava)`}</title>
            {d.flag ? (
              <text x={cx} y={base - 10} textAnchor="middle" fontSize={11} fill={pal.soft}>
                {FLAG_LABEL[d.flag]}
              </text>
            ) : d.future ? (
              <text x={cx} y={base - 10} textAnchor="middle" fontSize={11} fill="#a3a89f">
                tulossa
              </text>
            ) : (
              <>
                {logH > 0 && <Bar x={cx - bw / 2} y={base - logH} w={bw} h={logH} fill={pal.logged} round={estH <= 0} />}
                {estH > 0 && <Bar x={cx - bw / 2} y={base - logH - gap - estH} w={bw} h={estH} fill={d.arki?.confirmed ? pal.estimate : 'url(#wr-hatch)'} round />}
                <text x={cx} y={base - logH - gap - estH - 7} textAnchor="middle" fontSize={13} fontWeight={700} fill={pal.ink} stroke="#fff" strokeWidth={4} paintOrder="stroke">
                  {mins(d.mvpa)}
                </text>
              </>
            )}
            <text x={cx} y={base + 18} textAnchor="middle" fontSize={12} fontWeight={700} fill={pal.ink}>
              {WD_SHORT[wd]} {formatDate(d.date, 'd.M.')}
            </text>
            <text x={cx} y={base + 34} textAnchor="middle" fontSize={11} fill={pal.soft}>
              {d.future ? '' : formatHours(d.durationMin)}
            </text>
            {d.goalMet && (
              <g transform={`translate(${cx}, ${base + 47})`}>
                <circle r={7} fill={pal.logged} />
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

/**
 * Viikon tehojakauma koko kestosta (17.11.2026): tehoprofiilin ulkopuolinen osa (tauot, ohjeet, paikallaanolo)
 * näkyy omana osanaan, joten osat summautuvat raportin Yhteensä-lukuun.
 */
function IntensityBar({ pal, light, moderate, vigorous, totalMin }: { pal: ReportPalette; light: number; moderate: number; vigorous: number; totalMin: number }) {
  const rest = Math.max(0, totalMin - light - moderate - vigorous);
  const total = light + moderate + vigorous + rest;
  if (total <= 0) return null;
  const parts = [
    ['Kevyt', light, pal.light, pal.ink],
    ['Reipas', moderate, pal.moderate, '#fff'],
    ['Rasittava', vigorous, pal.vigorous, '#fff'],
    ['Tauot ja paikallaanolo', rest, pal.line, pal.ink],
  ] as const;
  return (
    <div className="mt-3">
      <div className="mb-1 flex flex-wrap items-end gap-x-4 gap-y-1">
        <span className="flex-1 text-[10.5px] font-semibold" style={{ color: pal.soft }}>
          Viikon tehojakauma
        </span>
        <Legend pal={pal} items={parts.map(([l, , c]) => [l, c])} />
      </div>
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

function EventTable({ pal, days, total }: { pal: ReportPalette; days: WeekReportDay[]; total: WeekReportData['summary'] }) {
  const num = 'px-2 py-1 text-right tabular-nums';
  const rowLine = { borderBottom: '1px solid #efede6' };
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-[0.08em]" style={{ color: pal.soft }}>
          <th className="w-12 px-2 py-1 font-semibold">Klo</th>
          <th className="px-2 py-1 font-semibold">Tapahtuma</th>
          <th className={`${num} w-16 font-semibold`}>Kesto</th>
          <th className={`${num} w-24 font-semibold`}>Reipas+ras.</th>
          <th className={`${num} w-20 font-semibold`}>Rasittava</th>
        </tr>
      </thead>
      {days.map((d) => {
        const wd = isoWeekday(d.date) - 1;
        return (
          <tbody key={d.date} className="break-inside-avoid">
            <tr style={{ background: pal.tint, borderTop: '2px solid #fff' }}>
              <th scope="rowgroup" colSpan={2} className="rounded-l-md px-2 py-1.5 text-left">
                <span className="font-bold">{WEEKDAYS[wd]}</span>{' '}
                <span className="font-normal" style={{ color: pal.soft }}>
                  {formatDate(d.date, 'd.M.')}
                </span>
                {d.flag && <span className="ml-2 rounded bg-[#dcd8cc] px-1.5 py-0.5 text-[10px] font-semibold">{FLAG_LABEL[d.flag]}</span>}
                {d.goalMet && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-[#ffffff]" style={{ background: pal.logged }}>
                    ✓ tavoite
                  </span>
                )}
              </th>
              <td className={`${num} font-bold`}>{d.future ? '' : `${mins(d.durationMin)} min`}</td>
              <td className={`${num} font-bold`}>{d.future ? '' : mins(d.mvpa)}</td>
              <td className={`${num} rounded-r-md font-bold`}>{d.future ? '' : mins(d.vigorous)}</td>
            </tr>
            {d.entries.map((e) => (
              <tr key={e.id} style={rowLine}>
                <td className="px-2 py-1 align-top tabular-nums" style={{ color: pal.soft }}>
                  {e.time ?? ''}
                </td>
                <td className="px-2 py-1 align-top">
                  <span className="mr-1.5 inline-block size-2 rounded-[2px] align-middle" style={{ background: pal.logged }} aria-hidden />
                  <span className="font-semibold">{e.name}</span>
                  {e.detail && <span style={{ color: pal.soft }}> · {e.detail}</span>}
                  {e.muscle && <Tag>lihas</Tag>}
                  {e.bone && <Tag>luusto</Tag>}
                </td>
                <td className={num}>{e.durationMin} min</td>
                <td className={num}>{mins(e.mvpa)}</td>
                <td className={num}>{mins(e.vigorous)}</td>
              </tr>
            ))}
            {d.arki && (
              <tr style={{ ...rowLine, color: '#4a554e' }}>
                <td className="px-2 py-1" />
                <td className="px-2 py-1">
                  <span className="mr-1.5 inline-block size-2 rounded-[2px] align-middle" style={{ background: pal.estimate }} aria-hidden />
                  <span className="italic">Arkiliikunta</span> <span style={{ color: pal.soft }}>· {d.arki.confirmed ? 'vahvistettu' : 'perusarvio'}</span>
                </td>
                <td className={num}>{d.arki.durationMin} min</td>
                <td className={num}>{mins(d.arki.mvpa)}</td>
                <td className={num}>{mins(d.arki.vigorous)}</td>
              </tr>
            )}
            {!d.future && !d.entries.length && !d.arki && (
              <tr style={{ ...rowLine, color: '#8a918a' }}>
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
        <tr className="text-[#ffffff]" style={{ background: pal.header }}>
          <th colSpan={2} className="rounded-l-md px-2 py-2 text-left text-[12.5px] font-bold">
            Viikko yhteensä
            <span className="ml-2 text-[11px] font-normal text-[#ffffff]/75">
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

function Compare({ pal, label, a, b, hours = false }: { pal: ReportPalette; label: string; a: number; b: number; hours?: boolean }) {
  const fmt = hours ? formatHours : (x: number) => String(Math.round(x));
  const d = hours ? Math.round(((a - b) / 60) * 10) / 10 : Math.round(a) - Math.round(b);
  const txt = d === 0 ? '±0' : `${d > 0 ? '+' : '−'}${hours ? `${Math.abs(d).toFixed(1).replace('.', ',')} h` : Math.abs(d)}`;
  return (
    <tr style={{ borderTop: `1px solid ${pal.line}` }}>
      <td className="py-1">{label}</td>
      <td className="py-1 text-right font-semibold">{fmt(a)}</td>
      <td className="py-1 text-right" style={{ color: pal.soft }}>
        {fmt(b)}
      </td>
      <td className="py-1 text-right text-[11px] font-semibold" style={{ color: d > 0 ? pal.logged : pal.soft }}>
        {txt}
      </td>
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

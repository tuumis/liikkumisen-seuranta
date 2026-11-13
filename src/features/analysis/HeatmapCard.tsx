// Aktiivisuuskartta (SPEC 16): vuoden päivät ruudukkona (GitHub-tyylinen). Mittari, arvion mukaan
// ottaminen ja jakso valitaan kortissa; kartan voi suurentaa koko näytölle.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo } from '../../db/repositories';
import { dayTotals, isEstimateConfirmation, trackingStart } from '../../domain/aggregate';
import { parseISODate, toISODate } from '../../domain/dates';
import { DAY_TARGET } from '../../domain/dayTarget';
import { recommendationGroup } from '../../domain/groups';
import { heatColumns, heatLevel, heatRange, heatStats, last12Months, LEVEL_LABELS, monthLabels, type HeatDay, type HeatLevel, type HeatMeasure } from '../../domain/heatmap';
import { holidayDates } from '../../domain/holidays';
import type { ActivityType, DayFlagReason, ISODate, Profile, Session } from '../../domain/types';
import { Card } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { formatDate } from '../../ui/format';
import { IconClose, IconExpand } from '../../ui/icons';
import { lockScroll, unlockScroll } from '../../ui/Sheet';
import { today as todayFn } from '../../ui/today';
import { FLAG_LABEL } from '../week/DaySheet';

type PeriodKey = '12' | `${number}`;

interface Prefs {
  measure: HeatMeasure;
  estimates: boolean;
}

const PREFS_KEY = 'heatmapPrefs';

function readPrefs(): Prefs {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null;
    return { measure: v?.measure === 'minutes' || v?.measure === 'sessions' ? v.measure : 'target', estimates: v?.estimates === true };
  } catch {
    return { measure: 'target', estimates: false };
  }
}

/** Tasojen värit: teeman yksisävyinen asteikko (vaaleasta tummaan, oma sävynsä tummassa teemassa). */
const LEVEL_FILL: Record<HeatLevel, string> = {
  0: 'var(--viz-track)',
  1: 'var(--band-3)',
  2: 'var(--band-4)',
  3: 'var(--band-5)',
  4: 'var(--band-6)',
};

const MEASURES: { value: HeatMeasure; label: string }[] = [
  { value: 'target', label: 'Tavoite' },
  { value: 'minutes', label: 'Minuutit' },
  { value: 'sessions', label: 'Kerrat' },
];

const MEASURE_TEXT: Record<HeatMeasure, string> = {
  target: 'Reipas ja rasittava liikunta suhteessa päivän suositukseen.',
  minutes: 'Kaikki liikunta minuutteina (kevyt, reipas ja rasittava).',
  sessions: 'Kirjattujen liikuntakertojen määrä päivässä.',
};

interface HeatData {
  days: HeatDay[];
  flags: Map<ISODate, DayFlagReason>;
  holidays: Set<ISODate>;
}

function useHeatData(profile: Profile, start: ISODate, end: ISODate, withEstimates: boolean): HeatData | undefined {
  const today = todayFn();
  const pid = profile.id;
  const raw = useLiveQuery(async () => {
    const [sessions, estimates, flags, types, settings] = await Promise.all([
      repo.sessionsInRange(pid, start, end),
      repo.listEstimates(pid),
      repo.dayFlagsInRange(pid, start, end),
      repo.listActivityTypes({ includeArchived: true }),
      repo.getSettings(),
    ]);
    return { sessions, estimates, flags, types, holidays: settings.holidays };
  }, [pid, start, end]);

  return useMemo(() => {
    if (!raw) return undefined;
    const types = new Map<string, ActivityType>(raw.types.map((t) => [t.id, t]));
    const holidays = holidayDates(raw.holidays, pid, start, end);
    const byDate = new Map<ISODate, Session[]>();
    for (const s of raw.sessions) {
      if (s.deletedAt) continue;
      // Vain kirjatut: arkiliikunnan päiväkohtainen vahvistus on arvion vahvistus, ei kirjattu kerta.
      if (!withEstimates && isEstimateConfirmation(s)) continue;
      const list = byDate.get(s.date);
      if (list) list.push(s);
      else byDate.set(s.date, [s]);
    }
    const estimates = withEstimates ? raw.estimates.filter((e) => !e.deletedAt) : [];
    const days = heatRange(start, end, trackingStart(profile), today).map((date): HeatDay => {
      const list = byDate.get(date) ?? [];
      const t = dayTotals(date, list, estimates, types, holidays.has(date));
      return {
        date,
        mvpa: withEstimates ? t.mvpaCombined : t.mvpa,
        total: withEstimates ? t.totalCombined : t.total,
        sessions: list.filter((s) => !isEstimateConfirmation(s)).length,
        target: DAY_TARGET[recommendationGroup(profile, date)],
      };
    });
    const flags = new Map<ISODate, DayFlagReason>(raw.flags.filter((f) => !f.deletedAt).map((f) => [f.date, f.reason]));
    return { days, flags, holidays };
  }, [raw, withEstimates, profile, pid, start, end, today]);
}

export function HeatmapCard({ profile }: { profile: Profile }) {
  const today = todayFn();
  const [prefs, setPrefsState] = useState<Prefs>(readPrefs);
  const setPrefs = (p: Partial<Prefs>) => {
    const next = { ...prefs, ...p };
    setPrefsState(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ei tallennusta */
    }
  };
  const [periodKey, setPeriodKey] = useState<PeriodKey>('12');
  const [large, setLarge] = useState(false);

  const thisYear = parseISODate(today).year;
  const firstYear = Math.max(parseISODate(trackingStart(profile)).year, thisYear - 4);
  const years = Array.from({ length: Math.max(0, thisYear - firstYear + 1) }, (_, i) => thisYear - i);
  const range = periodKey === '12' ? last12Months(today) : { start: toISODate(Number(periodKey), 1, 1), end: toISODate(Number(periodKey), 12, 31) };
  const withEstimates = prefs.measure !== 'sessions' && prefs.estimates;
  const data = useHeatData(profile, range.start, range.end, withEstimates);

  const controls = (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
      <Segmented<PeriodKey>
        label="Kartan jakso"
        value={periodKey}
        onChange={setPeriodKey}
        options={[{ value: '12', label: '12 kk' }, ...years.map((y) => ({ value: String(y) as PeriodKey, label: String(y) }))]}
      />
      <Segmented<HeatMeasure> label="Mittari" value={prefs.measure} onChange={(measure) => setPrefs({ measure })} options={MEASURES} />
      {prefs.measure === 'sessions' ? (
        <p className="flex min-h-12 items-center text-xs leading-snug text-slate-500 sm:col-span-2 xl:col-span-1">Kerrat lasketaan aina kirjauksista; arkiliikunnan arvio ei ole kerta.</p>
      ) : (
        <Segmented<'logged' | 'all'>
          label="Arkiliikunnan arvio"
          value={prefs.estimates ? 'all' : 'logged'}
          onChange={(v) => setPrefs({ estimates: v === 'all' })}
          options={[
            { value: 'logged', label: 'Vain kirjatut' },
            { value: 'all', label: 'Arvio mukana' },
          ]}
        />
      )}
    </div>
  );

  const body = (big: boolean) => (
    <div className="space-y-4">
      {controls}
      <p className="text-xs text-slate-500">{MEASURE_TEXT[prefs.measure]}</p>
      {data ? (
        <HeatBody key={`${range.start}:${big}`} data={data} start={range.start} end={range.end} measure={prefs.measure} big={big} />
      ) : (
        <div className="skeleton h-48 rounded-2xl" aria-busy="true" aria-label="Ladataan" />
      )}
    </div>
  );

  return (
    <>
      <Card
        title="Aktiivisuuskartta"
        eyebrow={periodKey === '12' ? 'Viimeiset 12 kuukautta' : `Vuosi ${periodKey}`}
        action={
          <button
            type="button"
            onClick={() => setLarge(true)}
            className="press inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--surface-sunk)] px-3.5 text-sm font-semibold text-slate-700 hover:text-slate-900"
            aria-label="Suurenna kartta koko näytölle"
          >
            <IconExpand size="1rem" /> <span className="hidden sm:inline">Suurenna</span>
          </button>
        }
      >
        {body(false)}
      </Card>
      {large && (
        <FullScreen title={`Aktiivisuuskartta · ${profile.name}`} onClose={() => setLarge(false)}>
          {body(true)}
        </FullScreen>
      )}
    </>
  );
}

function FullScreen({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const close = useRef(onClose);
  close.current = onClose;
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', onKey);
    lockScroll();
    panel.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      unlockScroll();
    };
  }, []);
  return createPortal(
    <div ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="anim-fade fixed inset-0 z-50 overflow-y-auto bg-[var(--surface)] focus:outline-none">
      <div className="mx-auto w-full max-w-[1900px] px-4 py-4 sm:px-8 sm:py-6 lg:px-12 lg:py-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold text-slate-900 lg:text-3xl">{title}</h2>
          <button type="button" onClick={onClose} className="press flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunk)] text-slate-600 hover:text-slate-900" aria-label="Sulje">
            <IconClose size="1.15rem" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// Ruudukon mitat viewBox-yksiköissä; SVG skaalautuu kortin levyiseksi.
const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;
const LABEL_W = 24;
const HEAD_H = 16;
const ROW_LABELS: Record<number, string> = { 0: 'Ma', 2: 'Ke', 4: 'Pe', 6: 'Su' };

function HeatBody({ data, start, end, measure, big }: { data: HeatData; start: ISODate; end: ISODate; measure: HeatMeasure; big: boolean }) {
  const cols = useMemo(() => heatColumns(start, end), [start, end]);
  const months = useMemo(() => monthLabels(cols), [cols]);
  const byDate = useMemo(() => new Map(data.days.map((d) => [d.date, d])), [data.days]);
  const stats = useMemo(() => heatStats(data.days, measure), [data.days, measure]);
  const [focus, setFocus] = useState<ISODate>();
  const scroller = useRef<HTMLDivElement>(null);
  const grid = useRef<SVGSVGElement>(null);
  const width = cols.length * STEP;
  const height = HEAD_H + 7 * STEP;
  // Viikonpäivien otsikot omana SVG:nään vierityksen ulkopuolella samassa mittakaavassa kuin ruudukko.
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const measure = () => setScale(el.getBoundingClientRect().width / width || 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  // Kapealla näytöllä kartta vierii vaakasuunnassa: näytetään oletuksena uusimmat viikot.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [start, end, big]);

  const levels = useMemo(() => {
    const m = new Map<ISODate, HeatLevel>();
    for (const d of data.days) m.set(d.date, heatLevel(measure, d));
    return m;
  }, [data.days, measure]);

  const pct = (d: HeatDay) => (d.target > 0 ? Math.round((Math.round(d.mvpa) / d.target) * 100) : 0);
  const detail = (date: ISODate) => {
    const d = byDate.get(date);
    const extras = [data.flags.has(date) ? FLAG_LABEL[data.flags.get(date)!] : '', data.holidays.has(date) ? 'loma' : ''].filter(Boolean);
    const when = formatDate(date, 'EEEEEE d.M.yyyy');
    if (!d) return `${when} · ${date > todayFn() ? 'tulossa' : 'ennen seurannan alkua'}`;
    const parts = [
      `${when}`,
      `reipas ja rasittava ${Math.round(d.mvpa)} min (${pct(d)} % suosituksesta)`,
      `kaikki liikunta ${Math.round(d.total)} min`,
      d.sessions === 1 ? '1 kerta' : `${d.sessions} kertaa`,
      ...extras,
    ];
    return parts.join(' · ');
  };

  return (
    <div className="space-y-4">
      <div className="flex">
        <svg viewBox={`0 0 ${LABEL_W} ${height}`} width={LABEL_W * scale} height={height * scale} className="shrink-0 select-none" aria-hidden>
          {Object.entries(ROW_LABELS).map(([row, label]) => (
            <text key={row} x={0} y={HEAD_H + Number(row) * STEP + CELL - 2.5} fontSize={8.5} fill="var(--ink-muted)">
              {label}
            </text>
          ))}
        </svg>
      <div ref={scroller} className="scroll-thin min-w-0 flex-1 overflow-x-auto pb-1">
        <svg
          ref={grid}
          viewBox={`0 0 ${width} ${height}`}
          className="block w-full select-none"
          style={{ minWidth: big ? Math.round(width * 1.45) : Math.round(width * 1.1) }}
          role="img"
          aria-label={`Aktiivisuuskartta: ${stats.activeDays} aktiivista päivää ${stats.days} päivästä, pisin putki ${stats.longestStreak} päivää.`}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setFocus(undefined)}
        >
          {months.map((m) => (
            <text key={m.col} x={m.col * STEP} y={10} fontSize={9} fill="var(--ink-muted)">
              {m.label}
            </text>
          ))}
          {cols.map((c, ci) =>
            c.days.map((date, ri) => {
              if (!date) return null;
              const lvl = levels.get(date);
              const x = ci * STEP;
              const y = HEAD_H + ri * STEP;
              const on = focus === date;
              return (
                <rect
                  key={date}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx={2.5}
                  fill={lvl === undefined ? 'var(--viz-track)' : LEVEL_FILL[lvl]}
                  opacity={lvl === undefined ? 0.4 : 1}
                  stroke={on ? 'var(--ink)' : data.flags.has(date) && lvl !== undefined ? 'var(--viz-estimate)' : 'none'}
                  strokeWidth={on ? 1.6 : 1.1}
                  onPointerEnter={() => setFocus(date)}
                  onClick={() => setFocus(date)}
                  className="cursor-pointer"
                />
              );
            }),
          )}
        </svg>
      </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="min-h-5 text-sm text-slate-700" aria-live="polite">
          {focus ? detail(focus) : <span className="text-slate-500">Osoita tai napauta päivää nähdäksesi sen tiedot.</span>}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="mr-1">Vähemmän</span>
          {([0, 1, 2, 3, 4] as HeatLevel[]).map((l) => (
            <span
              key={l}
              className="size-3.5 rounded-[4px]"
              style={{ background: LEVEL_FILL[l] }}
              title={l === 0 ? 'ei liikuntaa' : LEVEL_LABELS[measure][l - 1]}
            />
          ))}
          <span className="ml-1">Enemmän</span>
        </div>
      </div>
      <p className="-mt-2 text-right text-[11px] text-slate-500">Asteikko: {['ei liikuntaa', ...LEVEL_LABELS[measure]].join(' · ')}</p>

      <div className={`grid grid-cols-2 gap-3 ${big ? 'lg:grid-cols-4 lg:gap-5' : 'sm:grid-cols-4'}`}>
        <Stat label="Liikuntaa yhteensä" value={`${formatHours(stats.hours)} h`} sub="kaikki teholuokat" big={big} />
        <Stat label="Aktiivisia päiviä" value={String(stats.activeDays)} sub={`/ ${stats.days} päivää`} big={big} />
        <Stat label="Pisin putki" value={`${stats.longestStreak} pv`} sub="peräkkäin" big={big} />
        <Stat label="Suositus täyttyi" value={`${stats.targetDays} pv`} sub="reipas ja rasittava" big={big} />
      </div>
    </div>
  );
}

function formatHours(h: number) {
  return h >= 100 ? String(Math.round(h)) : h.toLocaleString('fi-FI', { maximumFractionDigits: 1 });
}

function Stat({ label, value, sub, big }: { label: string; value: string; sub: string; big: boolean }) {
  return (
    <div className="rounded-2xl bg-[var(--surface-sunk)] p-3.5 sm:p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`mt-1 font-display font-semibold tabular-nums text-slate-900 ${big ? 'text-3xl lg:text-4xl' : 'text-2xl'}`}>{value}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}

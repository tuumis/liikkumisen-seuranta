// Pitkän aikavälin analytiikka (SPEC 9, vaihe 7): kuukausi, kausi ja vuosi. Kehitys kuukausittain
// (kuukaudella viikoittain), vertailu edelliseen samanlaiseen jaksoon, ohjatun osuus, monipuolisuus,
// lajit, viikkotavoitteiden toteutuminen ja datan laatu trendin rinnalla. Ei ennätyksiä eikä putkia.

import { useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, BarChart, CartesianGrid, Rectangle, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type BarShapeProps } from 'recharts';
import { longTermSummary, nextPeriod, periodName, periodOf, previousPeriod, type LongKind, type LongTermSummary, type TrendBucket } from '../../domain/longTerm';
import type { ActivityType, Context, Period, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Card, EmptyState } from '../../ui/components';
import { formatDate } from '../../ui/format';
import { MOVEMENT_GROUP_LABEL } from '../../ui/labels';
import { IconChevronLeft, IconChevronRight } from '../../ui/icons';
import { cssVar, useIsDark, useThemeVersion } from '../../ui/theme';
import { today as todayFn } from '../../ui/today';
import { DAY_BAR_TARGET } from '../week/WeekView';
import { SERIES } from './DailyMvpaChart';
import { useReport } from './useReport';
import { SeasonReport } from './SeasonReport';

const KIND_TEXT: Record<LongKind, { this: string; prev: string; bucket: string }> = {
  month: { this: 'Tämä kuukausi', prev: 'Edellinen kuukausi', bucket: 'viikoittain' },
  season: { this: 'Tämä kausi', prev: 'Edellinen kausi', bucket: 'kuukausittain' },
  year: { this: 'Tämä vuosi', prev: 'Edellinen vuosi', bucket: 'kuukausittain' },
};

const CONTEXT_TEXT: Record<Context, string> = { organized: 'Ohjattu (harrastus, koululiikunta)', self_directed: 'Omaehtoinen (välitunnit, leikki, perhe)', everyday: 'Arki (koulumatkat, muu)' };

const pct = (x: number | null | undefined) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)} %`);
const min = (x: number | null | undefined) => (x === null || x === undefined ? '–' : `${Math.round(x)} min/pv`);

function useSummary(profile: Profile, period: Period): LongTermSummary | undefined {
  const report = useReport(profile, period);
  const data = useLiveQuery(async () => {
    const [sessions, types, settings] = await Promise.all([
      repo.sessionsInRange(profile.id, period.start, period.end),
      repo.listActivityTypes({ includeArchived: true }),
      repo.getSettings(),
    ]);
    return { sessions, types: new Map<string, ActivityType>(types.map((t) => [t.id, t])), settings };
  }, [profile.id, period.start, period.end]);
  return useMemo(() => (report && data ? longTermSummary(report, data.sessions, data.types, data.settings) : undefined), [report, data]);
}

export function LongTermView({ profile, kind }: { profile: Profile; kind: LongKind }) {
  const today = todayFn();
  const [anchor, setAnchor] = useState(today);
  const period = periodOf(kind, anchor);
  const prev = previousPeriod(period);
  const isCurrent = period.start <= today && today <= period.end;
  const s = useSummary(profile, period);
  const p = useSummary(profile, prev);
  const texts = KIND_TEXT[kind];
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="anim-fade flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-1 rounded-2xl bg-[var(--surface)] p-1 shadow-sm sm:flex-none">
          <button type="button" onClick={() => setAnchor(prev.start)} className="press flex size-10 items-center justify-center rounded-xl text-slate-600 hover:bg-[var(--surface-sunk)]" aria-label="Edellinen jakso">
            <IconChevronLeft />
          </button>
          <div className="min-w-0 flex-1 px-2 text-center sm:w-56 sm:flex-none">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">{periodName(period)}</div>
            <div className="truncate text-sm font-bold text-slate-900">
              {formatDate(period.start, 'd.M.')} – {formatDate(period.end, 'd.M.yyyy')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAnchor(nextPeriod(period).start)}
            disabled={period.end >= today}
            className="press flex size-10 items-center justify-center rounded-xl text-slate-600 hover:bg-[var(--surface-sunk)] disabled:opacity-35"
            aria-label="Seuraava jakso"
          >
            <IconChevronRight />
          </button>
        </div>
        {!isCurrent && (
          <Button variant="secondary" onClick={() => setAnchor(today)}>
            {texts.this}
          </Button>
        )}
        {s && s.validDays > 0 && (
          <span className="ml-auto">
            <Button variant="secondary" onClick={() => setReportOpen(true)}>
              Raportti (PDF)
            </Button>
          </span>
        )}
      </div>
      {reportOpen && s && <SeasonReport profile={profile} s={s} p={p} onClose={() => setReportOpen(false)} />}

      {!s && <div className="skeleton h-72 rounded-[1.75rem]" aria-busy="true" aria-label="Ladataan" />}
      {s && s.validDays === 0 && (
        <Card>
          <EmptyState title="Ei vertailtavia päiviä">Jaksolla ei ole seurannan päiviä. Valitse aiempi tai myöhempi jakso.</EmptyState>
        </Card>
      )}
      {s && s.validDays > 0 && (
        <div className="columns-1 gap-5 lg:columns-2 lg:gap-6">
          <Block>
            <Card title={`Reipas ja rasittava ${texts.bucket}`} eyebrow={`Kehitys · ${profile.name}`}>
              <TrendChart buckets={s.buckets} target={DAY_BAR_TARGET[s.group]} group={s.group} />
            </Card>
          </Block>
          <Block>
            <Card title={`Vertailu: ${periodName(period)} ja ${periodName(prev)}`} eyebrow={texts.prev}>
              <CompareTable s={s} p={p} />
            </Card>
          </Block>
          <Block>
            <Card title="Ohjattu ja omaehtoinen" eyebrow="Mistä reipas ja rasittava kertyy">
              <ContextBars s={s} p={p} prevName={periodName(prev)} />
            </Card>
          </Block>
          <Block>
            <Card title="Monipuolisuus ja lajit" eyebrow="Kirjatut kerrat">
              <Variety s={s} />
            </Card>
          </Block>
          <Block>
            <Card title="Suositusten toteutuminen viikoittain" eyebrow="Viikkotavoitteet">
              <WeeklyGoals s={s} />
            </Card>
          </Block>
          <Block>
            <Card title="Datan laatu" eyebrow="Luotettavuus">
              <Quality s={s} p={p} prevName={periodName(prev)} />
            </Card>
          </Block>
        </div>
      )}
    </div>
  );
}

const Block = ({ children }: { children: ReactNode }) => <div className="anim-rise mb-5 break-inside-avoid lg:mb-6">{children}</div>;

// ---------- kehityskaavio ----------

interface Row extends TrendBucket {
  logged: number;
  estimate: number;
  faded: boolean;
}

function palette() {
  return {
    logged: cssVar('--viz-logged', '#127a4e'),
    estimate: 'url(#lt-hatch)',
    arki: cssVar('--viz-estimate', '#c4823f'),
    grid: cssVar('--line', '#e5e2d8'),
    axis: cssVar('--ink-muted', '#7a827b'),
    ref: cssVar('--ink-soft', '#4a5750'),
    cursor: cssVar('--surface-sunk', '#efede6'),
  };
}
let P = palette();

function shape(which: 'logged' | 'estimate') {
  return function Shape(props: BarShapeProps) {
    const { x, y, width, height, payload } = props as BarShapeProps & { payload: Row };
    if (!height || height <= 0) return <g />;
    const above = which === 'logged' && payload.estimate > 0;
    const gap = above ? 2 : 0;
    return (
      <Rectangle
        x={x}
        y={Number(y) + gap}
        width={width}
        height={Math.max(0, Number(height) - gap)}
        radius={above ? 0 : [4, 4, 0, 0]}
        fill={P[which]}
        fillOpacity={payload.faded ? 0.35 : 1}
      />
    );
  };
}
const LoggedShape = shape('logged');
const EstimateShape = shape('estimate');

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-xl bg-[var(--surface-raised)] px-3 py-2 text-xs text-slate-800 shadow-lg ring-1 ring-slate-200">
      <div className="font-semibold">
        {formatDate(r.start, 'd.M.')}–{formatDate(r.end, 'd.M.yyyy')}
      </div>
      {r.validDays ? (
        <>
          <div className="mt-1 flex items-center gap-2">
            <span className="size-2 rounded-sm" style={{ background: SERIES.logged }} /> kirjattu {Math.round(r.mvpaLogged)} min/pv
          </div>
          {r.estimate > 0 && (
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-sm" style={{ background: SERIES.estimate }} /> arkiliikunnan arvio {r.estimate} min/pv
            </div>
          )}
          <div className="mt-1 text-slate-600">
            {r.validDays} pv vertailussa · kattavuus {pct(r.coverage)}
          </div>
          {r.faded && <div className="text-slate-500">alle puolella päivistä kirjauksia</div>}
        </>
      ) : (
        <div className="mt-1 text-slate-500">ei vertailtavia päiviä</div>
      )}
    </div>
  );
}

function TrendChart({ buckets, target, group }: { buckets: TrendBucket[]; target: number; group: LongTermSummary['group'] }) {
  const [table, setTable] = useState(false);
  useIsDark();
  useThemeVersion();
  P = palette();
  const rows: Row[] = buckets.map((b) => {
    const logged = Math.round(b.mvpaLogged);
    return { ...b, logged, estimate: Math.max(0, Math.round(b.mvpaCombined) - logged), faded: b.validDays > 0 && b.coverage < 0.5 };
  });
  const max = Math.max(target, ...rows.map((r) => r.logged + r.estimate));
  const targetLabel = group === 'adult' ? `tahti ${Math.round(target)} min/pv (150 min/vko)` : `suositus ${target} min/pv`;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: SERIES.logged }} aria-hidden /> Kirjattu
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: SERIES.estimate }} aria-hidden /> Arkiliikunnan arvio
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-px w-4 bg-slate-700" aria-hidden /> {targetLabel}
        </span>
      </div>
      {table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 font-medium">Jakso</th>
              <th className="py-1 text-right font-medium">Kirjattu</th>
              <th className="py-1 text-right font-medium">+ arvio</th>
              <th className="py-1 text-right font-medium">Päiviä</th>
              <th className="py-1 text-right font-medium">Kattavuus</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.key} className={`border-t border-slate-100 ${r.validDays ? '' : 'text-slate-400'}`}>
                <td className="py-1">{r.label}</td>
                <td className="py-1 text-right">{r.validDays ? r.logged : '–'}</td>
                <td className="py-1 text-right">{r.validDays ? r.logged + r.estimate : '–'}</td>
                <td className="py-1 text-right">{r.validDays}</td>
                <td className="py-1 text-right">{r.validDays ? pct(r.coverage) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="h-56 w-full" role="img" aria-label={`Reipas ja rasittava keskimäärin, ${targetLabel}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="22%">
              <defs>
                <pattern id="lt-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="5" height="5" fill={P.arki} fillOpacity={0.32} />
                  <rect width="2.5" height="5" fill={P.arki} />
                </pattern>
              </defs>
              <CartesianGrid vertical={false} stroke={P.grid} strokeWidth={1} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: P.axis }} tickLine={false} axisLine={{ stroke: P.grid }} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: P.axis }} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, Math.ceil(max / 15) * 15]} />
              <Tooltip content={<TrendTooltip />} cursor={{ fill: P.cursor }} />
              <Bar dataKey="logged" stackId="m" maxBarSize={36} shape={LoggedShape} isAnimationActive={false} />
              <Bar dataKey="estimate" stackId="m" maxBarSize={36} shape={EstimateShape} isAnimationActive={false} />
              <ReferenceLine y={target} stroke={P.ref} strokeWidth={1} ifOverflow="extendDomain" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">Keskiarvo vertailtavista päivistä. Haalea palkki: alle puolella päivistä kirjauksia.</span>
        <button type="button" className="min-h-9 shrink-0 rounded-lg px-2 text-xs font-medium text-green-800 active:bg-green-50" onClick={() => setTable(!table)}>
          {table ? 'Kaavio' : 'Taulukko'}
        </button>
      </div>
    </div>
  );
}

// ---------- vertailu ----------

function delta(a: number | null | undefined, b: number | null | undefined, unit: 'min' | 'pct' | 'n'): string {
  if (a === null || a === undefined || b === null || b === undefined) return '';
  const d = unit === 'pct' ? Math.round(a * 100) - Math.round(b * 100) : Math.round(a) - Math.round(b);
  if (d === 0) return 'ennallaan';
  const sign = d > 0 ? '+' : '−';
  return `${sign}${Math.abs(d)}${unit === 'pct' ? ' %-yks.' : unit === 'min' ? ' min/pv' : ''}`;
}

function CompareTable({ s, p }: { s: LongTermSummary; p?: LongTermSummary }) {
  const has = p && p.validDays > 0;
  const count = (x: LongTermSummary) => x.byType.reduce((a, t) => a + t.count, 0);
  const rows: [string, string, string, string][] = [
    ['Reipas ja rasittava (kirjattu + arvio)', min(s.mvpa?.combined), has ? min(p.mvpa?.combined) : '–', has ? delta(s.mvpa?.combined, p.mvpa?.combined, 'min') : ''],
    ['… josta kirjattu', min(s.mvpa?.logged), has ? min(p.mvpa?.logged) : '–', has ? delta(s.mvpa?.logged, p.mvpa?.logged, 'min') : ''],
    ['Kaikki liikunta (kevyt mukaan)', min(s.total?.combined), has ? min(p.total?.combined) : '–', has ? delta(s.total?.combined, p.total?.combined, 'min') : ''],
    ['Rasittavan osuus (kirjattu)', pct(s.vigorousShare), has ? pct(p.vigorousShare) : '–', has ? delta(s.vigorousShare, p.vigorousShare, 'pct') : ''],
    ['Ohjatun osuus (kirjattu)', pct(s.context?.organized), has ? pct(p.context?.organized) : '–', has ? delta(s.context?.organized, p.context?.organized, 'pct') : ''],
    ['Kirjattuja kertoja', String(count(s)), has ? String(count(p)) : '–', has ? delta(count(s), count(p), 'n') : ''],
    ['Liikuntaryhmiä', String(s.variety.groups.length), has ? String(p.variety.groups.length) : '–', has ? delta(s.variety.groups.length, p.variety.groups.length, 'n') : ''],
    ['Kattavuus', pct(s.quality.coverage), has ? pct(p.quality.coverage) : '–', has ? delta(s.quality.coverage, p.quality.coverage, 'pct') : ''],
  ];
  return (
    <div>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="px-1 py-1 font-medium" />
              <th className="px-1 py-1 text-right font-medium">Nyt</th>
              <th className="px-1 py-1 text-right font-medium">Edellinen</th>
              <th className="px-1 py-1 text-right font-medium">Muutos</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map(([label, a, b, d]) => (
              <tr key={label} className="border-t border-slate-100 align-top">
                <td className="px-1 py-1.5 text-slate-700">{label}</td>
                <td className="whitespace-nowrap px-1 py-1.5 text-right font-semibold text-slate-900">{a}</td>
                <td className="whitespace-nowrap px-1 py-1.5 text-right text-slate-600">{b}</td>
                <td className="whitespace-nowrap px-1 py-1.5 text-right text-xs text-slate-600">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {has
          ? 'Muutos voi johtua myös kirjaustavasta (esim. kattavuus muuttui): katso datan laatu rinnalla.'
          : 'Edelliseltä jaksolta ei ole vertailtavia päiviä.'}
      </p>
    </div>
  );
}

// ---------- ohjattu / omaehtoinen / arki ----------

function ContextBars({ s, p, prevName }: { s: LongTermSummary; p?: LongTermSummary; prevName: string }) {
  if (!s.context) return <p className="text-sm text-slate-600">Ei kirjattua reipasta tai rasittavaa liikuntaa jaksolla.</p>;
  const keys: Context[] = ['organized', 'self_directed', 'everyday'];
  return (
    <div>
      <ul className="space-y-2.5">
        {keys.map((k) => (
          <li key={k}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-slate-700">{CONTEXT_TEXT[k]}</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900">{pct(s.context![k])}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--viz-track)]">
              <div className="h-full rounded-full bg-[var(--viz-logged)]" style={{ width: `${Math.round(s.context![k] * 100)}%` }} />
            </div>
            {p?.context && <div className="mt-0.5 text-[11px] tabular-nums text-slate-500">{prevName}: {pct(p.context[k])}</div>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">Osuudet kirjatusta reippaasta ja rasittavasta liikunnasta; arkiliikunnan arvio ei ole mukana.</p>
    </div>
  );
}

// ---------- monipuolisuus ja lajit ----------

function Variety({ s }: { s: LongTermSummary }) {
  const top = s.byType.slice(0, 8);
  const maxMin = Math.max(1, ...top.map((t) => t.minutes));
  return (
    <div>
      <div className="text-sm text-slate-700">
        <span className="font-semibold text-slate-900">{s.variety.groups.length}</span> liikuntaryhmää ·{' '}
        <span className="font-semibold text-slate-900">{s.variety.types}</span> {s.variety.types === 1 ? 'laji' : 'lajia'}
      </div>
      {s.variety.groups.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.variety.groups.map((g) => (
            <span key={g} className="rounded-full bg-[var(--surface-sunk)] px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {MOVEMENT_GROUP_LABEL[g]}
            </span>
          ))}
        </div>
      )}
      {top.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {top.map((t) => (
            <li key={t.typeId}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-slate-700">
                  {t.icon} {t.name}
                </span>
                <span className="shrink-0 tabular-nums text-slate-600">
                  {t.count} {t.count === 1 ? 'kerta' : 'kertaa'} · <span className="font-semibold text-slate-900">{(t.minutes / 60).toFixed(1).replace('.', ',')} h</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--viz-track)]">
                <div className="h-full rounded-full bg-[var(--viz-logged)]" style={{ width: `${Math.max(2, Math.round((t.minutes / maxMin) * 100))}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-600">Ei kirjattuja kertoja jaksolla.</p>
      )}
      {s.byType.length > top.length && <p className="mt-2 text-xs text-slate-500">+ {s.byType.length - top.length} muuta lajia</p>}
    </div>
  );
}

// ---------- viikkotavoitteet ----------

function WeeklyGoals({ s }: { s: LongTermSummary }) {
  const { evaluated, goals } = s.weeks;
  if (!evaluated) return <p className="text-sm text-slate-600">Ei viikkoja, joilla vähintään 4 vertailtavaa päivää.</p>;
  return (
    <div>
      <ul className="space-y-2.5">
        {goals.map((g) => (
          <li key={g.key}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-slate-700">{g.label}</span>
              <span className="shrink-0 tabular-nums text-slate-900">
                <span className="font-semibold">{g.met}</span>/{evaluated} viikkoa
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--viz-track)]">
              <div className="h-full rounded-full bg-[var(--viz-logged)]" style={{ width: `${Math.round((g.met / evaluated) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Mukana viikot, joilla vähintään 4 vertailtavaa päivää. Reipas ja rasittava kirjattu + arvio; päivätavoitteet vain kirjauksista.
      </p>
    </div>
  );
}

// ---------- datan laatu ----------

function Quality({ s, p, prevName }: { s: LongTermSummary; p?: LongTermSummary; prevName: string }) {
  const low = s.quality.coverage < 0.5;
  return (
    <div className="text-sm text-slate-700">
      <dl className="grid grid-cols-3 gap-2">
        {(
          [
            ['Vertailtavia päiviä', String(s.validDays)],
            ['Kattavuus', pct(s.quality.coverage)],
            ['Arvion osuus', pct(s.quality.estimateShare)],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-[var(--surface-sunk)] px-3 py-2">
            <dt className="text-[11px] font-semibold leading-tight text-slate-500">{l}</dt>
            <dd className="stat text-base font-semibold tabular-nums text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
      {p && p.validDays > 0 && (
        <p className="mt-2 text-xs text-slate-600">
          {prevName}: {p.validDays} pv, kattavuus {pct(p.quality.coverage)}, arvion osuus {pct(p.quality.estimateShare)}.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        {low ? 'Alle puolella päivistä on kirjauksia: luvut ovat suuntaa antavia. ' : ''}
        Minuutit ovat tehomallin arvioita. Luvuista voi päätellä kirjatun liikunnan määrän ja jakauman muutoksia, ei kuntoa, terveyttä eikä vertailua muihin lapsiin.
      </p>
    </div>
  );
}

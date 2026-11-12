// Päivittäinen reipas ja rasittava (MVPA) viikolle: kirjattu + perusarvio pinottuna, suositusviiva.
// Paletti: kategoriset paikat 1–2 (validoitu: CVD ΔE 24,7, kontrasti ≥ 3:1 vaalealla pinnalla).

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Rectangle, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type BarShapeProps } from 'recharts';
import type { DayTotals } from '../../domain/types';
import { dayLabel } from '../../ui/format';
import { cssVar, useIsDark, useThemeVersion } from '../../ui/theme';

/** Div-elementeille (CSS-muuttujat vaihtuvat teeman mukana). */
export const SERIES = { logged: 'var(--viz-logged)', arki: 'var(--viz-estimate)', estimate: 'var(--viz-estimate-soft)' } as const;
/** SVG-kaaviolle värit design systemin tokeneista (validoitu paletti, teeman ja väriteeman mukaan). */
function palette() {
  return {
    logged: cssVar('--viz-logged', '#127a4e'),
    arki: cssVar('--viz-estimate', '#c4823f'),
    // vahvistamaton arvio: sama sävy vinoviivoituksena (SVG-kuvio, ks. <defs>)
    estimate: 'url(#estimate-hatch)',
    grid: cssVar('--line', '#e5e2d8'),
    axis: cssVar('--ink-muted', '#7a827b'),
    ref: cssVar('--ink-soft', '#4a5750'),
    cursor: cssVar('--surface-sunk', '#efede6'),
  };
}
let P = palette();

interface Row {
  label: string;
  date: string;
  logged: number;
  /** Päiväkohtaisesti vahvistettu arkiliikunta. */
  arki: number;
  /** Arkiliikunnan perusarvio (vahvistamaton). */
  estimate: number;
  valid: boolean;
}

const ORDER = ['logged', 'arki', 'estimate'] as const;

/** Pinottu palkki: 2 px pinnan värinen rako segmenttien välissä, 4 px pyöristys vain ylimmässä päässä. */
function segment(which: (typeof ORDER)[number]) {
  return function Shape(props: BarShapeProps) {
    const { x, y, width, height, payload } = props as BarShapeProps & { payload: Row };
    if (!height || height <= 0) return <g />;
    const above = ORDER.slice(ORDER.indexOf(which) + 1).some((k) => payload[k] > 0);
    const isTop = !above;
    const gap = above ? 2 : 0;
    return (
      <Rectangle
        x={x}
        y={Number(y) + gap}
        width={width}
        height={Math.max(0, Number(height) - gap)}
        radius={isTop ? [4, 4, 0, 0] : 0}
        fill={P[which]}
        fillOpacity={payload.valid ? 1 : 0.35}
      />
    );
  };
}
const LoggedShape = segment('logged');
const ArkiShape = segment('arki');
const EstimateShape = segment('estimate');

function TooltipBox({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-xl bg-[var(--surface-raised)] px-3 py-2 text-xs text-slate-800 shadow-lg ring-1 ring-slate-200">
      <div className="font-semibold">{r.label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="size-2 rounded-sm" style={{ background: SERIES.logged }} /> kerrat {r.logged} min
      </div>
      {r.arki > 0 && (
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-sm" style={{ background: SERIES.arki }} /> arkiliikunta {r.arki} min
        </div>
      )}
      {r.estimate > 0 && (
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-sm" style={{ background: SERIES.estimate }} /> arkiliikunta, arvio {r.estimate} min
        </div>
      )}
      <div className="mt-1 text-slate-600">yhteensä arviolta {r.logged + r.arki + r.estimate} min</div>
      {!r.valid && <div className="text-slate-500">ei mukana vertailussa</div>}
    </div>
  );
}

export function DailyMvpaChart({
  days,
  validDates,
  target,
  targetLabel,
}: {
  days: DayTotals[];
  validDates: string[];
  target: number;
  targetLabel: string;
}) {
  const [table, setTable] = useState(false);
  useIsDark();
  useThemeVersion();
  P = palette();
  const valid = new Set(validDates);
  const rows: Row[] = days.map((d) => ({
    label: dayLabel(d.date),
    date: d.date,
    logged: d.mvpa - d.confirmedMvpa,
    arki: d.confirmedMvpa,
    estimate: d.mvpaCombined - d.mvpa, // myös tuleville päiville: arkiliikunnan arvio (vinoviivoitus)
    valid: valid.has(d.date),
  }));
  const max = Math.max(target, ...rows.map((r) => r.logged + r.arki + r.estimate));
  const anyArki = rows.some((r) => r.arki > 0);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: SERIES.logged }} aria-hidden /> Kerrat
        </span>
        {anyArki && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: SERIES.arki }} aria-hidden /> Arkiliikunta
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: SERIES.estimate }} aria-hidden /> Arkiliikunta (arvio)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-px w-4 bg-slate-700" aria-hidden /> {targetLabel}
        </span>
      </div>
      {table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 font-medium">Päivä</th>
              <th className="py-1 text-right font-medium">Kerrat</th>
              <th className="py-1 text-right font-medium">Arkiliikunta</th>
              <th className="py-1 text-right font-medium">Arvio</th>
              <th className="py-1 text-right font-medium">Yhteensä</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.date} className={`border-t border-slate-100 ${r.valid ? '' : 'text-slate-400'}`}>
                <td className="py-1">{r.label}</td>
                <td className="py-1 text-right">{r.logged}</td>
                <td className="py-1 text-right">{r.arki}</td>
                <td className="py-1 text-right">{r.estimate}</td>
                <td className="py-1 text-right">{r.logged + r.arki + r.estimate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="h-52 w-full" role="img" aria-label={`Päivittäinen reipas ja rasittava liikkuminen, ${targetLabel}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="25%">
              <defs>
                <pattern id="estimate-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="5" height="5" fill={P.arki} fillOpacity={0.32} />
                  <rect width="2.5" height="5" fill={P.arki} />
                </pattern>
              </defs>
              <CartesianGrid vertical={false} stroke={P.grid} strokeWidth={1} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: P.axis }} tickLine={false} axisLine={{ stroke: P.grid }} interval={0} tickFormatter={(v: string) => v.split(' ')[0]} />
              <YAxis tick={{ fontSize: 11, fill: P.axis }} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, Math.ceil(max / 15) * 15]} />
              <Tooltip content={<TooltipBox />} cursor={{ fill: P.cursor }} />
              <Bar dataKey="logged" stackId="mvpa" maxBarSize={24} shape={LoggedShape} isAnimationActive={false} />
              <Bar dataKey="arki" stackId="mvpa" maxBarSize={24} shape={ArkiShape} isAnimationActive={false} />
              <Bar dataKey="estimate" stackId="mvpa" maxBarSize={24} shape={EstimateShape} isAnimationActive={false} />
              <ReferenceLine y={target} stroke={P.ref} strokeWidth={1} ifOverflow="extendDomain" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">Minuutit ovat tehomallin arvioita. Haalea palkki: päivä ei ole mukana vertailussa.</span>
        <button type="button" className="min-h-9 shrink-0 rounded-lg px-2 text-xs font-medium text-green-800 active:bg-green-50" onClick={() => setTable(!table)}>
          {table ? 'Kaavio' : 'Taulukko'}
        </button>
      </div>
    </div>
  );
}

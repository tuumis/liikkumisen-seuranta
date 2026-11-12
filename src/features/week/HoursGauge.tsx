// Viikon liikuntamäärä mittarina (lisäys 16): kokonaiskesto tunteina luokiteltuna käyttäjän
// taulukon mukaan (alle 7 h … 20+ h). Osoitin = toteuma, katkoviiva = viikon arvio.
// Luokat kuvaavat määrää; suositusvertailu (reipas ja rasittava) on erikseen.

import { formatHours, hoursBand, HOURS_BANDS, type WeeklyHours } from '../../domain/hours';

/** Mittarin asteikko 0–25 h; ylin luokka (20+) piirretään 20–25 h väliin. */
const SCALE_H = 25;
const xOf = (min: number) => Math.min(100, Math.max(0, (min / 60 / SCALE_H) * 100));
const bandColor = (i: number) => `var(--band-${i + 1})`;

export function HoursGauge({ hours, isCurrentWeek, className = '' }: { hours: WeeklyHours; isCurrentWeek: boolean; className?: string }) {
  const actual = hoursBand(hours.actualMin);
  const showExpected = hours.expectedMin > 0;
  const expected = hoursBand(hours.expectedMin);
  const actualIdx = HOURS_BANDS.indexOf(actual);
  const expectedIdx = HOURS_BANDS.indexOf(expected);
  const x = xOf(hours.actualMin);

  return (
    <section className={`@container card p-4 sm:p-5 lg:p-6 ${className}`} aria-labelledby="hours-gauge-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="hours-gauge-title" className="text-base font-semibold text-slate-900">
          Liikuntaa viikossa
        </h2>
        <span className="text-xs text-slate-500">kokonaiskesto</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-4xl font-semibold tracking-tight tabular-nums text-slate-900">{formatHours(hours.actualMin)}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-900">
          <span className="size-2.5 rounded-full ring-1 ring-slate-300" style={{ background: bandColor(actualIdx) }} aria-hidden />
          {actual.label}
        </span>
      </div>
      {showExpected && (
        <p className="mt-1 text-sm text-slate-600">
          {isCurrentWeek ? 'Koko viikon arvio' : 'Viikon arvio oli'} <strong className="tabular-nums text-slate-900">{formatHours(hours.expectedMin)}</strong> · {expected.label}
        </p>
      )}

      {/* Mittari: luokat yhtenä palkkina, osoitin toteuman kohdalla. */}
      <div className="relative mt-7" role="img" aria-label={`Toteuma ${formatHours(hours.actualMin)}: ${actual.label}${showExpected ? `. Viikon arvio ${formatHours(hours.expectedMin)}: ${expected.label}` : ''}.`}>
        <div className="flex h-4 gap-0.5">
          {HOURS_BANDS.map((b, i) => (
            <div
              key={b.key}
              className={`h-full ${i === 0 ? 'rounded-l-full' : ''} ${i === HOURS_BANDS.length - 1 ? 'rounded-r-full' : ''} ${i === actualIdx ? '' : 'opacity-70'}`}
              style={{ flexGrow: (b.toH ?? SCALE_H) - b.fromH, flexBasis: 0, background: bandColor(i) }}
              title={`${b.range}: ${b.label}`}
            />
          ))}
        </div>
        {showExpected && (
          <div className="absolute -top-1.5 h-7 border-l-2 border-dashed border-slate-500" style={{ left: `${xOf(hours.expectedMin)}%` }} title={`Viikon arvio ${formatHours(hours.expectedMin)}`} />
        )}
        <div className="absolute -top-6 flex -translate-x-1/2 flex-col items-center" style={{ left: `${x}%` }}>
          <span className="rounded bg-slate-900 px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums dark:bg-slate-800 dark:text-slate-50">{formatHours(hours.actualMin)}</span>
          <span className="h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-slate-900 dark:border-t-slate-800" aria-hidden />
        </div>
        <div className="absolute top-0 h-4 w-1 -translate-x-1/2 rounded-full bg-slate-900 ring-2 ring-white dark:bg-slate-900 dark:ring-[var(--surface)]" style={{ left: `${x}%` }} aria-hidden />
        {/* Asteikko: luokkien rajat. */}
        <div className="relative mt-1 h-4 text-[10px] tabular-nums text-slate-500" aria-hidden>
          {HOURS_BANDS.map((b) => (
            <span key={b.key} className="absolute -translate-x-1/2" style={{ left: `${(b.fromH / SCALE_H) * 100}%` }}>
              {b.fromH === 0 ? '' : b.fromH}
            </span>
          ))}
          <span className="absolute right-0">h</span>
        </div>
      </div>

      {/* Luokat taulukkona; nykyinen korostettuna. */}
      <ul className="mt-2 grid grid-cols-1 gap-1 @md:grid-cols-2">
        {HOURS_BANDS.map((b, i) => {
          const on = i === actualIdx;
          return (
            <li key={b.key} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${on ? 'bg-slate-100 font-semibold text-slate-900 ring-1 ring-slate-300' : 'text-slate-600'}`} aria-current={on || undefined}>
              <span className="size-3 shrink-0 rounded-sm" style={{ background: bandColor(i) }} aria-hidden />
              <span className="w-14 shrink-0 tabular-nums text-xs text-slate-500">{b.range}</span>
              <span className="min-w-0 flex-1 truncate">{b.label}</span>
              {showExpected && i === expectedIdx && <span className="shrink-0 rounded-full border border-dashed border-slate-400 px-1.5 text-[10px] font-medium text-slate-500">arvio</span>}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] text-slate-500">
        Kesto kellotunteina: kirjatut kerrat + arkiliikunnan arvio{isCurrentWeek ? ' tähän päivään asti' : ''}. Luokitus on sovelluksen arvio kokonaismäärästä; kouluikäisten suositus 60 min päivässä = 7 h viikossa.
        Reippaan ja rasittavan liikunnan vertailu näkyy erikseen.
      </p>
    </section>
  );
}

// Pure ISO date helpers. Dates are local calendar days stored as 'YYYY-MM-DD'
// strings (SPEC 6). Arithmetic is done on UTC epoch days, so time zones and
// daylight saving time can never shift a date. Date objects are only used
// transiently inside these functions, never stored.

import type { ISODate, Period, Timestamp, Weekday, YearMonth } from './types';

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (n: number) => String(n).padStart(2, '0');

export function isISODate(s: string): boolean {
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return toISODate(y, mo, d) === s;
}

export function toISODate(year: number, month: number, day: number): ISODate {
  const dt = new Date(Date.UTC(year, month - 1, day));
  return `${String(dt.getUTCFullYear()).padStart(4, '0')}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function parseISODate(d: ISODate): { year: number; month: number; day: number } {
  const m = ISO_RE.exec(d);
  if (!m) throw new Error(`Invalid ISODate: ${d}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function epochDay(d: ISODate): number {
  const { year, month, day } = parseISODate(d);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

function fromEpochDay(n: number): ISODate {
  const dt = new Date(n * DAY_MS);
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromEpochDay(epochDay(d) + n);
}

/** Number of days from a to b (b − a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return epochDay(b) - epochDay(a);
}

export function maxDate(a: ISODate, b?: ISODate): ISODate {
  return b !== undefined && b > a ? b : a;
}

export function minDate(a: ISODate, b?: ISODate): ISODate {
  return b !== undefined && b < a ? b : a;
}

/** ISO weekday, 1 = maanantai … 7 = sunnuntai. */
export function isoWeekday(d: ISODate): Weekday {
  const { year, month, day } = parseISODate(d);
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = su
  return (((js + 6) % 7) + 1) as Weekday;
}

export function isWeekend(d: ISODate): boolean {
  return isoWeekday(d) >= 6;
}

/** All dates from `from` to `to`, both inclusive. Empty when from > to. */
export function datesBetween(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const a = epochDay(from);
  const b = epochDay(to);
  for (let n = a; n <= b; n++) out.push(fromEpochDay(n));
  return out;
}

export function startOfIsoWeek(d: ISODate): ISODate {
  return addDays(d, 1 - isoWeekday(d));
}

export function endOfIsoWeek(d: ISODate): ISODate {
  return addDays(d, 7 - isoWeekday(d));
}

/** ISO week number and ISO week-year. */
export function isoWeek(d: ISODate): { year: number; week: number } {
  const thursday = addDays(d, 4 - isoWeekday(d));
  const year = parseISODate(thursday).year;
  const jan1 = toISODate(year, 1, 1);
  return { year, week: Math.floor(diffDays(jan1, thursday) / 7) + 1 };
}

export function firstDayOf(ym: YearMonth): ISODate {
  return toISODate(ym.year, ym.month, 1);
}

export function lastDayOfMonth(year: number, month: number): ISODate {
  return addDays(toISODate(year, month + 1, 1), -1);
}

export function weekPeriod(d: ISODate): Period {
  return { kind: 'week', start: startOfIsoWeek(d), end: endOfIsoWeek(d) };
}

export function monthPeriod(d: ISODate): Period {
  const { year, month } = parseISODate(d);
  return { kind: 'month', start: toISODate(year, month, 1), end: lastDayOfMonth(year, month) };
}

/** Oletuskaudet (SPEC 9): kevät tammi–touko, kesä kesä–elo, syksy syys–joulu. */
export function seasonPeriod(d: ISODate): Period {
  const { year, month } = parseISODate(d);
  const [startMonth, endMonth] = month <= 5 ? [1, 5] : month <= 8 ? [6, 8] : [9, 12];
  return { kind: 'season', start: toISODate(year, startMonth, 1), end: lastDayOfMonth(year, endMonth) };
}

export function yearPeriod(d: ISODate): Period {
  const { year } = parseISODate(d);
  return { kind: 'year', start: toISODate(year, 1, 1), end: toISODate(year, 12, 31) };
}

/** Local calendar date of a JS Date (in the runtime's time zone). */
export function localDateOf(date: Date): ISODate {
  return toISODate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Local calendar date of a UTC timestamp (e.g. Profile.createdAt). */
export function timestampToLocalDate(ts: Timestamp): ISODate {
  return localDateOf(new Date(ts));
}

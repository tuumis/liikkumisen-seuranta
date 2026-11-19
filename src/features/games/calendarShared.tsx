// Pelikalenterin tulosteen ja kalenteriviennin yhteiset osat (19.11.2026): jakson valinta ja
// perhekalenterin tunnisteet (lapsen nimi vain valittaessa, muuten joukkue).

import { addMonths, firstOfMonth, monthKeyOf, monthsFrom, seasonMonths, SEASON_LABEL, teamNameFor, type CalEvent, type MonthKey, type Season } from '../../domain/monthCalendar';
import type { ISODate, Profile, Team, UUID } from '../../domain/types';
import { Segmented } from '../../ui/controls';
import { formatDate } from '../../ui/format';

export type Span = 'months' | Season;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const monthName = (m: MonthKey) => cap(formatDate(firstOfMonth(m), 'LLLL yyyy'));

export function periodMonths(span: Span, start: MonthKey, count: number, year: number): MonthKey[] {
  return span === 'months' ? monthsFrom(start, count) : seasonMonths(year, span);
}

/** Jakson nimi: "Syyskausi 2026", "Marraskuu 2026" tai "Marraskuu 2026 – tammikuu 2027". */
export function periodLabel(span: Span, months: MonthKey[]): string {
  const year = months[0].slice(0, 4);
  if (span !== 'months') return `${SEASON_LABEL[span]} ${year}`;
  if (months.length === 1) return monthName(months[0]);
  return `${monthName(months[0])} – ${formatDate(firstOfMonth(months[months.length - 1]), 'LLLL yyyy')}`;
}

const selectClass = 'min-h-10 rounded-xl bg-[var(--surface-sunk)] px-2 ring-1 ring-slate-200';

/** Jakso: kuukaudet (alku + määrä) tai kevät- / syyskausi valittuna vuonna. */
export function PeriodPicker({
  today,
  span,
  onSpan,
  start,
  onStart,
  count,
  onCount,
  maxCount,
  year,
  onYear,
}: {
  today: ISODate;
  span: Span;
  onSpan: (v: Span) => void;
  start: MonthKey;
  onStart: (v: MonthKey) => void;
  count: number;
  onCount: (v: number) => void;
  maxCount: number;
  year: number;
  onYear: (v: number) => void;
}) {
  const monthOptions = Array.from({ length: 19 }, (_, i) => addMonths(monthKeyOf(today), i - 6));
  const thisYear = Number(today.slice(0, 4));
  return (
    <>
      <Segmented<Span>
        label="Jakso"
        value={span}
        onChange={onSpan}
        options={[
          { value: 'months', label: 'Kuukaudet' },
          { value: 'spring', label: 'Kevätkausi' },
          { value: 'autumn', label: 'Syyskausi' },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        {span === 'months' ? (
          <>
            <label className="flex items-center gap-2">
              <span className="text-slate-600">Alkaen</span>
              <select className={selectClass} value={start} onChange={(e) => onStart(e.target.value)}>
                {(monthOptions.includes(start) ? monthOptions : [start, ...monthOptions]).map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-slate-600">Kuukausia</span>
              <select className={selectClass} value={count} onChange={(e) => onCount(Number(e.target.value))}>
                {Array.from({ length: maxCount }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <label className="flex items-center gap-2">
            <span className="text-slate-600">Vuosi</span>
            <select className={selectClass} value={year} onChange={(e) => onYear(Number(e.target.value))}>
              {[thisYear - 1, thisYear, thisYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">{span === 'spring' ? 'tammi–kesäkuu' : 'heinä–joulukuu'}</span>
          </label>
        )}
      </div>
    </>
  );
}

export { selectClass as periodSelectClass };

/**
 * Perheen jäsenen tunniste tulosteeseen ja kalenteriin: lapsen nimi, jos se valitaan, muuten joukkue
 * (lyhyesti, esim. "FC Testi Sininen"); ilman joukkuetta "Pelaaja 1", "Pelaaja 2"…
 */
export function memberLabeler(profiles: Profile[], teams: ReadonlyMap<UUID, Team>, childName: boolean) {
  const own = new Map<UUID, Team[]>();
  // Lapsen tunnisteeksi vain joukkueet (treeniryhmä ei kuvaa lasta).
  for (const t of teams.values()) if (!t.archived && t.kind !== 'group') own.set(t.profileId, [...(own.get(t.profileId) ?? []), t]);
  const profileLabel = (p: Profile, i: number) => {
    if (childName) return p.name;
    const list = own.get(p.id) ?? [];
    return list.length ? list.map((t) => teamNameFor(t.name, 'short')).join(', ') : `Pelaaja ${i + 1}`;
  };
  const byId = new Map(profiles.map((p, i) => [p.id, { p, i }]));
  return {
    profile: (id: UUID | undefined) => {
      const x = id ? byId.get(id) : undefined;
      return x ? profileLabel(x.p, x.i) : undefined;
    },
    event: (e: CalEvent) => {
      const x = e.profileId ? byId.get(e.profileId) : undefined;
      if (!x) return undefined;
      if (childName) return x.p.name;
      const t = e.teamId ? teams.get(e.teamId) : undefined;
      return t && t.kind !== 'group' ? teamNameFor(t.name, 'short') : profileLabel(x.p, x.i);
    },
    color: (id: UUID | undefined) => (id ? byId.get(id)?.p.color : undefined),
  };
}

// Koko perheen viikko (27.11.2026, käyttäjän hyväksymä esimerkki): PC:n Päivät-kortissa päivät riveinä ja profiilit
// sarakkeina. Eri lasten samaan aikaan osuvat menot korostetaan rivillä. Valitun profiilin rivin painallus avaa sen
// kuten päivälistassa; toisen profiilin rivi vaihtaa profiilin (muokkaus aina omassa profiilissa).

import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { maxDate } from '../../domain/dates';
import { farWeekPlanning, planningThroughForWeek } from '../../domain/planning';
import { familyClashes, itemWindowText, monthItemDetail, monthItems, type MonthItem } from '../../domain/monthView';
import { teamNameResolver } from '../../domain/teamName';
import type { ActivityType, Fixture, ISODate, Profile, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Avatar } from '../../ui/Avatar';
import { formatDate } from '../../ui/format';
import { IconOverlap } from '../../ui/icons';
import { TypeGlyph } from '../../ui/TypeGlyph';
import { itemClass, stateBadge } from './MonthView';

export function FamilyWeek({
  profiles,
  selectedId,
  dates,
  today,
  types,
  onItem,
}: {
  profiles: Profile[];
  selectedId: UUID;
  /** Viikon seitsemän päivää. */
  dates: ISODate[];
  today: ISODate;
  types: ReadonlyMap<UUID, ActivityType>;
  /** Rivin painallus: profiili (puuttuu koko perheen merkinnältä) ja rivi. */
  onItem: (profileId: UUID | undefined, item: MonthItem) => void;
}) {
  const from = dates[0];
  const to = dates[dates.length - 1];
  const ids = profiles.map((p) => p.id).join(',');

  // Viikkorytmin kerrat kaikille kuten valitulle (yhtenäisesti enintään +8 vko, kauempana jakso).
  useEffect(() => {
    void (async () => {
      for (const id of ids.split(',').filter(Boolean)) {
        await repo.ensurePlanned(id, planningThroughForWeek(today, from), today);
        if (farWeekPlanning(today, from)) await repo.ensurePlanned(id, to, today, { from: maxDate(from, today) });
      }
    })();
  }, [ids, from, to, today]);

  const data = useLiveQuery(
    async () =>
      Promise.all(
        ids
          .split(',')
          .filter(Boolean)
          .map(async (id) => {
            const [sessions, plans, notes, fixtures, teams, templateItems] = await Promise.all([
              repo.sessionsInRange(id, from, to),
              repo.plansInRange(id, from, to),
              repo.listCalendarNotes(id, from, to),
              repo.listFixtures(id, from, to),
              repo.listTeams(id, { includeArchived: true, groups: true }),
              repo.listTemplateItems(id),
            ]);
            const items = monthItems({
              sessions,
              plans,
              notes,
              fixtures: new Map(fixtures.filter((e) => e.fixture).map((e) => [e.plan.id, e.fixture!] as [UUID, Fixture])),
              types,
              profileId: id,
            });
            return { id, items, team: teamNameResolver(teams, templateItems) };
          }),
      ),
    [ids, from, to, types],
  );

  const byProfile = useMemo(() => new Map((data ?? []).map((d) => [d.id, d])), [data]);
  // Koko perheen merkinnät kerran päivän kohdalla (ne ovat jokaisen profiilin listalla).
  const familyNotes = (d: ISODate) => {
    const seen = new Map<string, MonthItem>();
    for (const p of data ?? []) for (const i of p.items.get(d) ?? []) if (i.family) seen.set(i.key, i);
    return [...seen.values()];
  };
  const own = (pid: UUID, d: ISODate) => (byProfile.get(pid)?.items.get(d) ?? []).filter((i) => !i.family);
  const nameOf = new Map(profiles.map((p) => [p.id, p.name]));
  const cols = { gridTemplateColumns: `4.75rem repeat(${profiles.length}, minmax(0, 1fr))` };

  if (!data) return <div className="skeleton h-80 rounded-[1.75rem]" aria-busy="true" aria-label="Ladataan" />;

  return (
    <div className="card overflow-hidden p-0" role="table" aria-label="Koko perheen viikko">
      <div className="grid border-b border-[var(--line)] bg-[var(--surface-sunk)]" style={cols} role="row">
        <div role="columnheader" className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Päivä
        </div>
        {profiles.map((p) => {
          // Päivät, joille on kirjattu kerta (tähän päivään asti).
          const days = dates.filter((d) => d <= today && own(p.id, d).some((i) => i.kind === 'done')).length;
          const past = dates.filter((d) => d <= today).length;
          return (
            <div key={p.id} role="columnheader" className={`flex min-w-0 items-center gap-2 border-l border-[var(--line)] px-3 py-2 ${p.id === selectedId ? 'bg-[var(--surface-sage)]' : ''}`}>
              <Avatar name={p.name} photo={p.photo} color={p.color} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">{p.name}</span>
                <span className="block truncate text-[11px] text-slate-500">{past ? `kirjattu ${days}/${past} pv` : 'viikko alkamatta'}</span>
              </span>
            </div>
          );
        })}
      </div>
      {dates.map((d) => {
        const all = profiles.flatMap((p) => own(p.id, d));
        const clash = familyClashes(all);
        const notes = familyNotes(d);
        const isToday = d === today;
        return (
          <div key={d} role="row" className={`border-b border-[var(--line)] last:border-b-0 ${clash.length ? 'bg-amber-50/70' : ''}`}>
            <div className="grid" style={cols}>
              <div role="rowheader" className="px-3 py-2.5">
                <span className={`block text-sm font-semibold ${isToday ? 'text-green-800' : 'text-slate-900'}`}>{formatDate(d, 'EEEEEE d.M.')}</span>
                {isToday && <span className="block text-[11px] font-semibold text-green-800">tänään</span>}
                {notes.map((n) => (
                  <button key={n.key} type="button" onClick={() => onItem(undefined, n)} className="press mt-1 block w-full truncate rounded-md text-left text-[11px] text-slate-500 hover:text-slate-800" title={monthItemDetail(n)}>
                    📅 {n.title}
                  </button>
                ))}
              </div>
              {profiles.map((p) => {
                const list = own(p.id, d);
                const team = byProfile.get(p.id)?.team;
                const mine = p.id === selectedId;
                return (
                  <div key={p.id} role="cell" className={`min-w-0 space-y-1 border-l border-[var(--line)] p-1.5 ${mine ? 'bg-[color-mix(in_oklab,var(--surface-sage)_45%,transparent)]' : ''}`}>
                    {list.length === 0 && <span className="block px-1.5 py-1 text-xs text-slate-400">–</span>}
                    {list.map((i) => {
                      const badge = stateBadge(i, d, today);
                      const inClash = clash.some(([a, b]) => a.key === i.key || b.key === i.key);
                      return (
                        <button
                          key={i.key}
                          type="button"
                          onClick={() => onItem(p.id, i)}
                          title={mine ? 'Avaa' : `Vaihda profiiliin ${p.name}`}
                          className={`press block w-full rounded-lg px-2 py-1.5 text-left hover:brightness-[0.97] ${itemClass(i)} ${inClash ? 'ring-1 ring-amber-400' : ''}`}
                          style={{ borderLeft: `3px solid ${p.color ?? 'var(--line)'}` }}
                        >
                          <span className="flex min-w-0 items-center gap-1 text-[13px] font-medium leading-snug">
                            <span className="shrink-0">{i.kind === 'note' ? '📅' : <TypeGlyph t={i.typeId ? types.get(i.typeId) : undefined} />}</span>
                            <span className="min-w-0 line-clamp-2">{i.title}</span>
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-600">
                            <span className="min-w-0">{monthItemDetail(i, team?.(i, i.kind === 'open'))}</span>
                            {badge && <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ring-1 ${badge.cls}`}>{badge.text}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {clash.length > 0 && (
              <p className="flex items-start gap-1.5 px-3 pb-2 text-xs text-amber-900" role="note">
                <IconOverlap size="0.9rem" className="mt-px shrink-0" />
                <span>
                  Päällekkäin:{' '}
                  {clash
                    .map(([a, b]) => `${nameOf.get(a.profileId!)} ${itemWindowText(a)} ja ${nameOf.get(b.profileId!)} ${itemWindowText(b)}`)
                    .join('; ')}
                </span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

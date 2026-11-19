// Treenin joukkue, vaihe 2 (19.11.2026): treenit ja pelit joukkueittain ja treeniryhmittäin Jalkapallo-sivun
// Joukkueet-näkymässä. Näkyy, kun omia joukkueita ja ryhmiä on vähintään kaksi. Joukkueet ja ryhmät erikseen.

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { seasonPeriod, yearPeriod } from '../../domain/dates';
import { seasonKey } from '../../domain/football';
import { displayTeamName } from '../../domain/opponent';
import { teamBreakdown, type TeamBreakdownRow, type TeamTotals } from '../../domain/teamBreakdown';
import type { Period, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Card } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { num1 } from '../../ui/statusText';
import { today as todayFn } from '../../ui/today';
import { useFootball } from './useFootball';

type Range = 'season' | 'year' | 'all';

/** Treeniaika lyhyesti: alle tunti minuutteina, muuten tunteina yhdellä desimaalilla. */
export const trainingTime = (min: number) => (min < 60 ? `${min} min` : `${num1(Math.round(min / 6) / 10)} h`);

export function TeamBreakdownCard({ profile }: { profile: Profile }) {
  const today = todayFn();
  const [range, setRange] = useState<Range>('season');
  const data = useFootball(profile.id);
  const teams = useLiveQuery(() => repo.listTeams(profile.id, { includeArchived: true, groups: true }), [profile.id]);
  const period: Period = range === 'season' ? seasonPeriod(today) : range === 'year' ? yearPeriod(today) : { kind: 'year', start: '0000-01-01', end: '9999-12-31' };
  const sum = useMemo(() => (data && teams ? teamBreakdown(data, period, teams) : undefined), [data, teams, period.start, period.end]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!sum?.show) return null;
  const rangeText = range === 'season' ? seasonKey(today) : range === 'year' ? `vuosi ${today.slice(0, 4)}` : 'koko historia';
  const un = sum.unassigned;
  return (
    <Card title="Joukkueittain" eyebrow={rangeText}>
      <div className="space-y-4">
        <Segmented<Range>
          label="Aikaväli"
          value={range}
          onChange={setRange}
          options={[
            { value: 'season', label: 'Kausi' },
            { value: 'year', label: 'Vuosi' },
            { value: 'all', label: 'Kaikki' },
          ]}
        />
        {sum.teams.length > 0 && (
          <section aria-label="Joukkueet">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Joukkueet</h3>
            <ul className="space-y-2">
              {sum.teams.map((r) => (
                <Row key={r.team.id} r={r} name={profile.name} />
              ))}
            </ul>
          </section>
        )}
        {sum.groups.length > 0 && (
          <section aria-label="Treeniryhmät">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Treeniryhmät</h3>
            <ul className="space-y-2">
              {sum.groups.map((r) => (
                <Row key={r.team.id} r={r} name={profile.name} />
              ))}
            </ul>
          </section>
        )}
        {(un.training.count > 0 || un.games.games > 0) && (
          <p className="text-xs text-slate-500">
            Ilman joukkuetta:{' '}
            {[un.training.count > 0 && `${un.training.count} ${un.training.count === 1 ? 'treeni' : 'treeniä'}`, un.games.games > 0 && `${un.games.games} ${un.games.games === 1 ? 'peli' : 'peliä'}`]
              .filter(Boolean)
              .join(' ja ')}
            . Treenin joukkueen voi valita sen lisätiedoista tai alla kohdasta Merkitse aiemmat treenit.
          </p>
        )}
      </div>
    </Card>
  );
}

function Row({ r, name }: { r: TeamBreakdownRow; name: string }) {
  return (
    <li className={`rounded-xl bg-[var(--surface-sunk)] px-3 py-2.5 ring-1 ring-inset ring-[var(--line)] ${r.team.archived ? 'opacity-70' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-slate-900">{displayTeamName(r.team.name)}</span>
        {r.team.archived && <span className="shrink-0 text-xs text-slate-500">arkistoitu</span>}
      </div>
      <Stats t={r} group={r.group} name={name} />
    </li>
  );
}

function Stats({ t, group, name }: { t: TeamTotals; group: boolean; name: string }) {
  const g = t.games;
  const res = g.wins + g.draws + g.losses;
  const items: [string, string][] = [
    ['Treenit', String(t.training.count)],
    ['Treeniaika', trainingTime(t.training.minutes)],
  ];
  if (!group) {
    items.push(['Pelit', String(g.games)]);
    if (res) {
      items.push(['V–T–H', `${g.wins}–${g.draws}–${g.losses}`]);
      items.push(['Maalit', `${g.goalsFor}–${g.goalsAgainst}`]);
    }
    if (g.playerGoalsGames > 0) items.push([`${name || 'Pelaaja'} ⚽`, String(g.playerGoals)]);
  }
  return (
    <dl className="mt-1.5 grid grid-cols-3 gap-x-3 gap-y-1.5 sm:grid-cols-6">
      {items.map(([l, v]) => (
        <div key={l} className="min-w-0">
          <dt className="truncate text-[11px] font-medium text-slate-500">{l}</dt>
          <dd className="text-sm font-semibold tabular-nums text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

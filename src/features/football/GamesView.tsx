// Pelit ja tulokset (SPEC 8): kaikki pelit yhdessä näkymässä, suodatus ja yhteenvedot samasta listasta.
// Ei sarjataulukoita eikä lapsen henkilökohtaisia pisteitä.

import { useMemo, useState } from 'react';
import {
  gameRows,
  gamesCsv,
  LEVEL_LABEL,
  normalizeName,
  OUTCOME_LABEL,
  POSITION_LABEL,
  preferredName,
  seasonKey,
  summarizeBy,
  summarizeByPosition,
  summarizeGames,
  type GameRow,
  type GroupedSummary,
} from '../../domain/football';
import type { Profile } from '../../domain/types';
import { Button, Card, inputClass } from '../../ui/components';
import { dayLabel } from '../../ui/format';
import { num1 } from '../../ui/statusText';
import { goalsLabel } from '../../ui/labels';
import { resultLine } from './FootballSection';
import { useFootball } from './useFootball';

const ALL = '';

export function GamesView({ profile, onBack }: { profile: Profile; onBack?: () => void }) {
  const data = useFootball(profile.id);
  const [season, setSeason] = useState(ALL);
  const [year, setYear] = useState(ALL);
  const [team, setTeam] = useState(ALL);
  const [opponent, setOpponent] = useState(ALL);

  const all = useMemo(() => (data ? gameRows(data.sessions, data.details, data.types) : []), [data]);
  const options = useMemo(() => {
    const uniq = (xs: (string | undefined)[]): [string, string][] => {
      const m = new Map<string, string[]>();
      for (const x of xs) if (x) m.set(normalizeName(x), [...(m.get(normalizeName(x)) ?? []), x]);
      return [...m.entries()].map(([k, v]): [string, string] => [k, preferredName(v)]).sort((a, b) => a[1].localeCompare(b[1], 'fi'));
    };
    return {
      seasons: [...new Set(all.map((r) => seasonKey(r.date)))].reverse(),
      years: [...new Set(all.map((r) => r.date.slice(0, 4)))].reverse(),
      teams: uniq(all.map((r) => r.team)),
      opponents: uniq(all.map((r) => r.opponent)),
    };
  }, [all]);

  const rows = all.filter(
    (r) =>
      (season === ALL || seasonKey(r.date) === season) &&
      (year === ALL || r.date.startsWith(year)) &&
      (team === ALL || normalizeName(r.team) === team) &&
      (opponent === ALL || normalizeName(r.opponent) === opponent),
  );
  const total = summarizeGames(rows);
  const byTeam = summarizeBy(rows, (r) => r.team);
  const byOpponent = summarizeBy(rows, (r) => r.opponent);
  const byEvent = summarizeBy(
    rows.filter((r) => r.kind === 'tournament'),
    (r) => r.eventName ?? 'Nimetön turnaus',
  );
  const bySeason = summarizeBy(rows, (r) => seasonKey(r.date));
  const byLevel = summarizeBy(rows, (r) => (r.level ? LEVEL_LABEL[r.level] : undefined));
  const byYear = summarizeBy(rows, (r) => r.date.slice(0, 4));
  const byFormat = summarizeBy(rows, (r) => r.format).sort((a, b) => parseInt(a.label) - parseInt(b.label));
  const byPosition = summarizeByPosition(rows);

  function exportCsv() {
    const blob = new Blob([gamesCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pelit-${profile.name.replace(/[^\p{L}\p{N}_-]+/gu, '_')}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Ryhmitellään listaa varten: turnauksen pelit turnauksen nimen alle.
  const groups: { key: string; title?: string; rows: GameRow[] }[] = [];
  for (const r of [...rows].reverse()) {
    const key = r.kind === 'tournament' ? `t:${r.sessionId}` : `g:${r.sessionId}`;
    const last = groups.at(-1);
    if (last && last.key === key) last.rows.push(r);
    else groups.push({ key, title: r.kind === 'tournament' ? `${r.eventName ?? 'Turnaus'} · ${dayLabel(r.date)}` : undefined, rows: [r] });
  }
  for (const g of groups) g.rows.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  const select = (label: string, value: string, set: (v: string) => void, opts: [string, string][]) => (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select className={inputClass} value={value} onChange={(e) => set(e.target.value)}>
        <option value={ALL}>Kaikki</option>
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      {onBack && (
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onBack} className="px-2">
            ‹ Analyysi
          </Button>
          <h2 className="font-display text-lg font-semibold text-slate-900">Pelit ja tulokset · {profile.name}</h2>
        </div>
      )}

      <div className="space-y-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6 lg:space-y-0">
      <Card className="lg:col-span-12">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {select('Kausi', season, setSeason, options.seasons.map((s) => [s, s]))}
          {select('Vuosi', year, setYear, options.years.map((y) => [y, y]))}
          {select('Oma joukkue', team, setTeam, options.teams)}
          {select('Vastustaja', opponent, setOpponent, options.opponents)}
        </div>
      </Card>

      <div className="space-y-4 lg:col-span-5 xl:col-span-4">
      <Card title="Kokonaisuus">
        <SummaryBlock s={total} name={profile.name} />
      </Card>
      {byLevel.length > 0 && <GroupCard title="Taso (Elite · Kilpa · Haaste)" groups={byLevel} />}
      {byFormat.length > 0 && <GroupCard title="Pelimuoto" groups={byFormat} />}
      {byPosition.length > 0 && <GroupCard title="Pelipaikka" groups={byPosition} />}
      </div>

      <div className="space-y-4 lg:col-span-7 xl:col-span-8">
      <Card title={`Pelit (${total.games})`} action={rows.length > 0 ? <Button variant="ghost" onClick={exportCsv}>Vie CSV</Button> : undefined}>
        {groups.length === 0 && <p className="text-sm text-slate-500">Ei pelejä valinnoilla.</p>}
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.key}>
              {g.title && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">🏆 {g.title}</div>}
              <ul className={g.title ? 'border-l-2 border-slate-200 pl-2' : ''}>
                {g.rows.map((r) => (
                  <GameLine key={`${r.sessionId}:${r.index ?? 0}`} r={r} showDate={!g.title} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {rows.length > 0 && <p className="mt-2 text-xs text-slate-500">CSV: yksi rivi per peli, puolipiste-erotin; avautuu suomenkielisessä Excelissä. Tiedosto sisältää lapsen tietoja.</p>}
      </Card>

      <div className="space-y-4 xl:grid xl:grid-cols-2 xl:items-start xl:gap-4 xl:space-y-0">
      {byTeam.length > 1 && <GroupCard title="Oma joukkue" groups={byTeam} />}
      {byOpponent.length > 0 && <GroupCard title="Vastustajat" groups={byOpponent} />}
      {byEvent.length > 0 && <GroupCard title="Turnaukset" groups={byEvent} />}
      {(bySeason.length > 1 || byYear.length > 1) && (
        <Card title="Kaudet ja vuodet">
          <div className="grid gap-3 sm:grid-cols-2">
            <GroupList groups={bySeason} />
            {byYear.length > 1 && <GroupList groups={byYear} />}
          </div>
        </Card>
      )}
      </div>
      </div>
      </div>
      <p className="text-center text-xs text-slate-500">Tulokset ovat joukkueen tuloksia eivätkä vaikuta lapsen arvioihin tai muihin mittareihin.</p>
    </div>
  );
}

function GameLine({ r, showDate }: { r: GameRow; showDate: boolean }) {
  const res = r.outcome ? `${r.goalsFor}–${r.goalsAgainst}` : r.games > 1 ? `${r.games} peliä` : 'ei tulosta';
  return (
    <li className="flex items-center gap-2 border-b border-slate-100 py-2 last:border-0">
      <span className="w-14 shrink-0 text-xs text-slate-600">{showDate ? dayLabel(r.date) : `Peli ${r.index ?? ''}`}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-slate-900">
          {r.team ?? 'Oma joukkue'} – {r.opponent ?? 'vastustaja ?'}
        </span>
        {(r.playedMin !== undefined || r.time || r.format || r.positions || r.playerGoals) && (
          <span className="block text-xs text-slate-500">
            {[
              r.time && `klo ${r.time}`,
              r.format,
              r.positions?.map((p) => POSITION_LABEL[p].toLowerCase()).join(', '),
              r.playedMin !== undefined && `pelattu ${r.playedMin} min`,
              r.playerGoals ? `⚽ ${r.playerGoals} ${r.playerGoals === 1 ? 'maali' : 'maalia'}` : undefined,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
        {r.note && <span className="block text-xs italic text-slate-600">“{r.note}”</span>}
      </span>
      <span className={`shrink-0 text-sm tabular-nums ${r.outcome ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{res}</span>
      {r.outcome && <span className="w-6 shrink-0 rounded bg-slate-100 text-center text-xs font-semibold text-slate-700">{OUTCOME_LABEL[r.outcome]}</span>}
    </li>
  );
}

function SummaryBlock({ s, name }: { s: ReturnType<typeof summarizeGames>; name: string }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
      <dt className="text-slate-600">Pelit</dt>
      <dd className="text-right tabular-nums">{s.games}</dd>
      <dt className="text-slate-600">Voitot–tasapelit–häviöt</dt>
      <dd className="text-right tabular-nums">
        {s.wins}–{s.draws}–{s.losses}
      </dd>
      <dt className="text-slate-600">Maalit (tehdyt–päästetyt)</dt>
      <dd className="text-right tabular-nums">
        {s.goalsFor}–{s.goalsAgainst} ({s.goalDiff > 0 ? '+' : s.goalDiff < 0 ? '−' : '±'}
        {Math.abs(s.goalDiff)})
      </dd>
      {s.noResult > 0 && (
        <>
          <dt className="text-slate-600">Ei tulosta</dt>
          <dd className="text-right tabular-nums">{s.noResult}</dd>
        </>
      )}
      {s.playerGoalsGames > 0 && (
        <>
          <dt className="text-slate-600">{goalsLabel(name)} ⚽</dt>
          <dd className="text-right tabular-nums">
            {s.playerGoals}
            <span className="text-slate-500"> ({s.playerGoalsGames} pelissä)</span>
          </dd>
        </>
      )}
      <dt className="text-slate-600">Peliaika</dt>
      <dd className="text-right tabular-nums">
        {s.playedMinTotal} min{s.playedMinAvg !== null && ` · ka. ${num1(Math.round(s.playedMinAvg * 10) / 10)}/peli`}
      </dd>
    </dl>
  );
}

function GroupList({ groups }: { groups: GroupedSummary[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {groups.map((g) => (
        <li key={g.key} className="py-2">
          <div className="text-sm font-medium text-slate-900">{g.label}</div>
          <div className="text-xs text-slate-600">{resultLine(g.summary)}</div>
        </li>
      ))}
    </ul>
  );
}

function GroupCard({ title, groups }: { title: string; groups: GroupedSummary[] }) {
  return (
    <Card title={title}>
      <GroupList groups={groups} />
    </Card>
  );
}

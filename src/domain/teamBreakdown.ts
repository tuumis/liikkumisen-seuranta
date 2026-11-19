// Treenin joukkue, vaihe 2 (19.11.2026): treenit ja pelit omittain joukkueittain ja treeniryhmittäin.
// Treenit tulevat kerran joukkueesta (Session.teamId), pelit pelin lisätiedoista (joukkue tai sen nimi).
// Joukkueet ja treeniryhmät pidetään erillään. Puhtaita funktioita.

import { gameRows, isClubTraining, isTrainingSelf, normalizeName, summarizeGames, type FootballInput, type GameRow, type GameSummary } from './football';
import { parseTeamName, clubKey, displayTeamName } from './opponent';
import type { Period, Team, UUID } from './types';

export interface TeamTotals {
  training: { count: number; minutes: number };
  games: GameSummary;
}

export interface TeamBreakdownRow extends TeamTotals {
  team: Team;
  group: boolean;
}

export interface TeamBreakdown {
  /** Joukkueet (pelit ja treenit), eniten toimintaa ensin. */
  teams: TeamBreakdownRow[];
  /** Treeniryhmät (vain treenit). */
  groups: TeamBreakdownRow[];
  /** Treenit ja pelit, joita ei ole merkitty millekään omalle joukkueelle tai ryhmälle. */
  unassigned: TeamTotals;
  /** Merkitsemättömien seuran treenien päivät, uusin ensin (omatoimiset eivät ole mukana). */
  unassignedDates: string[];
  /** Näytetäänkö erittely: vähintään kaksi joukkuetta tai ryhmää, joilla on toimintaa tai jotka ovat käytössä. */
  show: boolean;
}

/** Pelirivin oma joukkue: tallennettu joukkue, muuten saman niminen oma joukkue (vanhat pelit). */
export function gameTeamId(r: Pick<GameRow, 'teamId' | 'team'>, teams: Team[]): UUID | undefined {
  const squads = teams.filter((t) => t.kind !== 'group');
  if (r.teamId && squads.some((t) => t.id === r.teamId)) return r.teamId;
  const key = normalizeName(r.team);
  if (!key) return undefined;
  return squads.find((t) => normalizeName(t.name) === key)?.id;
}

const activity = (r: TeamTotals) => r.training.count + r.games.games;

export function teamBreakdown(input: FootballInput, period: Period, teams: Team[]): TeamBreakdown {
  const within = (d: string) => d >= period.start && d <= period.end;
  const sessions = input.sessions.filter((s) => !s.deletedAt && within(s.date));
  const known = new Set(teams.map((t) => t.id));
  const trainingBy = new Map<UUID | '', { count: number; minutes: number }>();
  const unassignedDates: string[] = [];
  for (const s of sessions) {
    // Vain seuran treenit: omatoiminen jalkapallo (lajityyppi 'training', omaehtoinen) ei kuulu joukkueelle.
    if (isTrainingSelf(s) || !isClubTraining(input.types.get(s.activityTypeId))) continue;
    const key = s.teamId && known.has(s.teamId) ? s.teamId : '';
    if (!key) unassignedDates.push(s.date);
    const t = trainingBy.get(key) ?? { count: 0, minutes: 0 };
    t.count++;
    t.minutes += s.durationMin;
    trainingBy.set(key, t);
  }
  const rowsBy = new Map<UUID | '', GameRow[]>();
  for (const r of gameRows(sessions, input.details, input.types)) {
    const key = gameTeamId(r, teams) ?? '';
    rowsBy.set(key, [...(rowsBy.get(key) ?? []), r]);
  }
  const totals = (key: UUID | ''): TeamTotals => ({
    training: trainingBy.get(key) ?? { count: 0, minutes: 0 },
    games: summarizeGames(rowsBy.get(key) ?? []),
  });
  const rows = teams
    .map((team) => ({ team, group: team.kind === 'group', ...totals(team.id) }))
    // Arkistoitu näkyy vain, jos sillä on jaksolla toimintaa.
    .filter((r) => !r.team.archived || activity(r) > 0)
    .sort((a, b) => activity(b) - activity(a) || a.team.name.localeCompare(b.team.name, 'fi'));
  const squads = rows.filter((r) => !r.group);
  const groups = rows.filter((r) => r.group);
  return { teams: squads, groups, unassigned: totals(''), unassignedDates: unassignedDates.sort().reverse(), show: rows.length >= 2 };
}

/**
 * Lyhyt nimi viikkonäkymään: treeniryhmä omalla nimellään; joukkue ryhmä ja ikäluokka ("Sininen 2016"), kun
 * kaikki omat joukkueet ovat samaa seuraa, muuten seura, ryhmä ja ikäluokka.
 */
export function shortTeamName(team: Team, teams: Team[]): string {
  if (team.kind === 'group') return team.name;
  const p = parseTeamName(team.name);
  const clubs = new Set(teams.filter((t) => t.kind !== 'group').map((t) => clubKey(parseTeamName(t.name).club)));
  const squad = [p.group, p.age].filter(Boolean).join(' ');
  if (squad && clubs.size <= 1) return squad;
  return [p.club, p.group, p.age].filter(Boolean).join(' ') || displayTeamName(team.name);
}

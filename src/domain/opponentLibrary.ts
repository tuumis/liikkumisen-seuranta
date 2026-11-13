// Joukkuekirjasto (SPEC 16): vastustajat koottuna automaattisesti pelatuista peleistä ja
// pelikalenterista. Seura → ryhmät ja ikäluokat → pelit tuloksineen ja kommentteineen.

import { summarizeGames, type GameRow, type GameSummary } from './football';
import { clubKey, parseTeamName, squadKey, type TeamParts } from './opponent';
import type { ISODate } from './types';

export interface UpcomingGame {
  date: ISODate;
  opponent: string;
  eventName?: string;
}

export interface SquadEntry {
  key: string;
  parts: TeamParts;
  /** Pelatut pelit uusin ensin. */
  rows: GameRow[];
  upcoming: UpcomingGame[];
  summary: GameSummary;
}

export interface ClubEntry {
  key: string;
  /** Yleisin kirjoitusasu. */
  name: string;
  squads: SquadEntry[];
  summary: GameSummary;
  upcoming: number;
  /** Viimeisin pelipäivä (järjestys). */
  lastDate?: ISODate;
}

export function buildOpponentLibrary(rows: GameRow[], upcoming: UpcomingGame[]): ClubEntry[] {
  const clubs = new Map<string, { names: Map<string, number>; squads: Map<string, { parts: TeamParts; rows: GameRow[]; upcoming: UpcomingGame[] }> }>();
  const squadOf = (text: string) => {
    const parts = parseTeamName(text);
    if (!parts.club) return undefined;
    const ck = clubKey(parts.club);
    const club = clubs.get(ck) ?? clubs.set(ck, { names: new Map(), squads: new Map() }).get(ck)!;
    club.names.set(parts.club, (club.names.get(parts.club) ?? 0) + 1);
    const sk = squadKey(parts);
    return club.squads.get(sk) ?? club.squads.set(sk, { parts, rows: [], upcoming: [] }).get(sk)!;
  };
  for (const r of rows) if (r.opponent) squadOf(r.opponent)?.rows.push(r);
  for (const u of upcoming) squadOf(u.opponent)?.upcoming.push(u);

  const out: ClubEntry[] = [];
  for (const [key, c] of clubs) {
    const name = [...c.names].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fi'))[0][0];
    const squads: SquadEntry[] = [...c.squads]
      .map(([k, s]) => ({
        key: k,
        parts: { ...s.parts, club: name },
        rows: [...s.rows].sort((a, b) => b.date.localeCompare(a.date) || (b.index ?? 0) - (a.index ?? 0)),
        upcoming: [...s.upcoming].sort((a, b) => a.date.localeCompare(b.date)),
        summary: summarizeGames(s.rows),
      }))
      .sort((a, b) => (a.parts.group ?? '').localeCompare(b.parts.group ?? '', 'fi') || (a.parts.age ?? '').localeCompare(b.parts.age ?? '', 'fi'));
    const all = squads.flatMap((s) => s.rows);
    out.push({
      key,
      name,
      squads,
      summary: summarizeGames(all),
      upcoming: squads.reduce((a, s) => a + s.upcoming.length, 0),
      lastDate: all.map((r) => r.date).sort().at(-1),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'fi'));
}

// ---------- vastustajan historia (pelikalenteri) ----------

export interface OpponentHistory {
  /** Seuran nimi annetusta vastustajasta. */
  club: string;
  /** Saman ryhmän pelit uusin ensin: seura ja ryhmä samat, ikäluokka sama tai toisesta puuttuu. */
  squad: GameRow[];
  /** Saman seuran muiden ryhmien pelit uusin ensin. */
  others: GameRow[];
  squadSummary: GameSummary;
  othersSummary: GameSummary;
}

const low = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('fi');

/** Aiemmat kohtaamiset vastustajan kanssa; undefined, jos vastustajalla ei ole seuran nimeä. */
export function opponentHistory(rows: GameRow[], opponent: string | undefined): OpponentHistory | undefined {
  const want = parseTeamName(opponent);
  if (!want.club) return undefined;
  const ck = clubKey(want.club);
  const squad: GameRow[] = [];
  const others: GameRow[] = [];
  for (const r of rows) {
    const p = parseTeamName(r.opponent);
    if (!p.club || clubKey(p.club) !== ck) continue;
    const sameGroup = low(p.group) === low(want.group);
    const sameAge = !p.age || !want.age || low(p.age) === low(want.age);
    (sameGroup && sameAge ? squad : others).push(r);
  }
  const newest = (a: GameRow, b: GameRow) => b.date.localeCompare(a.date) || (b.index ?? 0) - (a.index ?? 0);
  squad.sort(newest);
  others.sort(newest);
  return { club: want.club, squad, others, squadSummary: summarizeGames(squad), othersSummary: summarizeGames(others) };
}

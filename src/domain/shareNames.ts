// Jakokuvien joukkuenimet (17.11.2026, käyttäjän toive): ennakko- ja tuloskuvassa voi valita, näytetäänkö
// ryhmä ja ikäluokka ("HJK · Musta · 2016") vai pelkkä seura ("HJK"), erikseen omalle joukkueelle ja
// vastustajille. Tallennettu nimi ei muutu; valinta koskee vain piirrettävää kuvaa.

import { clubKey, formatTeamName, parseTeamName } from './opponent';

export interface TeamDetailPrefs {
  /** Oman joukkueen ryhmä ja ikäluokka näkyvissä. */
  team: boolean;
  /** Vastustajien ryhmä ja ikäluokka näkyvissä. */
  opponents: boolean;
}

export const SHOW_ALL_DETAILS: TeamDetailPrefs = { team: true, opponents: true };

/** Onko nimessä ryhmä tai ikäluokka (eli onko piilotettavaa). */
export function hasTeamDetails(name: string | undefined): boolean {
  const p = parseTeamName(name);
  return !!(p.club && (p.group || p.age));
}

/**
 * Kortin nimet valintojen mukaan. Piilotettaessa jää seura; jos kuvassa on toinen joukkue samasta seurasta
 * (esim. HJK · Valkoinen vastaan HJK · Musta), ryhmä jätetään erottamaan ne ja vain ikäluokka piilotetaan.
 */
export function applyTeamDetails<C extends { team?: string; games: { opponent?: string }[] }>(card: C, prefs: TeamDetailPrefs): C {
  if (prefs.team && prefs.opponents) return card;
  const all = [card.team, ...card.games.map((g) => g.opponent)];
  const short = (name: string | undefined): string | undefined => {
    if (!name || !hasTeamDetails(name)) return name;
    const p = parseTeamName(name);
    const key = clubKey(p.club);
    const clash = all.some((other) => other && clubKey(other) !== clubKey(name) && clubKey(parseTeamName(other).club) === key);
    return clash && p.group ? formatTeamName({ club: p.club, group: p.group }) : p.club;
  };
  return {
    ...card,
    team: prefs.team ? card.team : short(card.team),
    games: card.games.map((g) => (prefs.opponents || !g.opponent ? g : { ...g, opponent: short(g.opponent) })),
  };
}

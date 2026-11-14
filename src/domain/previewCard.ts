// Otteluennakko (SPEC 16, 14.11.2026): tulevan pelin tai turnauksen tiedot jaettavaksi kuvaksi
// samalla tyylillä kuin tuloskuva. Puhdas funktio kalenterin tapahtumasta; piirto features/share/drawPreview.

import { LEVEL_LABEL } from './football';
import { gameDaySchedule, tournamentStart } from './tournamentTime';
import type { Fixture, GameFormat, HHmm, ISODate, PlannedSession } from './types';

export interface PreviewGame {
  opponent?: string;
  time?: HHmm;
  location?: string;
}

export interface PreviewCard {
  kind: 'game' | 'tournament';
  date: ISODate;
  eventName?: string;
  level?: string;
  format?: GameFormat;
  team?: string;
  /** Pelin alku (ottelu) tai ensimmäisen pelin alku (turnaus). */
  kickoff?: HHmm;
  /** Paikalla (30 min ennen, vähintään lämmittelyn verran). */
  arrival?: HHmm;
  location?: string;
  /** Ottelu: yksi rivi; turnaus: otteluohjelma kellonajan mukaan (ajattomat lopussa). */
  games: PreviewGame[];
}

const clean = (s: string | undefined) => s?.replace(/\s+/g, ' ').trim() || undefined;

export function previewCard(plan: Pick<PlannedSession, 'activityTypeId' | 'date' | 'startTime'>, fixture: Fixture | undefined, team?: { name: string; format?: GameFormat }): PreviewCard {
  const tournament = plan.activityTypeId === 't:football_tournament';
  const f = fixture;
  const base = {
    date: plan.date,
    ...(clean(f?.eventName) && tournament ? { eventName: clean(f?.eventName) } : {}),
    ...(f?.level ? { level: LEVEL_LABEL[f.level] } : {}),
    ...((f?.format ?? team?.format) ? { format: f?.format ?? team?.format } : {}),
    ...(clean(team?.name) ? { team: clean(team?.name) } : {}),
    ...(clean(f?.location) ? { location: clean(f?.location) } : {}),
  };
  if (!tournament) {
    const kickoff = plan.startTime;
    return {
      kind: 'game',
      ...base,
      ...(kickoff ? { kickoff, arrival: gameDaySchedule(kickoff, f?.warmupMin).arrival } : {}),
      games: [{ ...(clean(f?.opponent) ? { opponent: clean(f?.opponent) } : {}), ...(kickoff ? { time: kickoff } : {}) }],
    };
  }
  const scheduled = (f?.games ?? []).map((g) => ({
    ...(clean(g.opponent) ? { opponent: clean(g.opponent) } : {}),
    ...(g.time ? { time: g.time } : {}),
    ...(clean(g.location) ? { location: clean(g.location) } : {}),
  }));
  // Järjestys kellonajan mukaan; ajattomat säilyttävät järjestyksensä lopussa.
  const games = scheduled
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (a.g.time && b.g.time ? a.g.time.localeCompare(b.g.time) : a.g.time ? -1 : b.g.time ? 1 : a.i - b.i))
    .map((x) => x.g);
  const timed = games.find((g) => g.time)?.time;
  const arrival = timed ? tournamentStart(f?.games ?? [], f?.warmupMin) : plan.startTime;
  // Paikka: tapahtuman paikka tai, jos kaikki pelit ovat samassa paikassa, se.
  const places = new Set(games.map((g) => g.location).filter(Boolean));
  const location = base.location ?? (places.size === 1 ? [...places][0] : undefined);
  return {
    kind: 'tournament',
    ...base,
    ...(location ? { location } : {}),
    ...(timed ? { kickoff: timed } : {}),
    ...(arrival ? { arrival } : {}),
    // Yhteinen paikka näytetään kerran; pelirivillä vain poikkeava paikka.
    games: games.length ? games.map(({ location: l, ...g }) => (l && l !== location ? { ...g, location: l } : g)) : Array.from({ length: Math.min(12, Math.max(0, f?.gamesCount ?? 0)) }, () => ({})),
  };
}

/** Kuvan yläotsikko: "Otteluennakko · Elite · 8v8". */
export function previewKicker(card: PreviewCard): string {
  return [card.kind === 'tournament' ? 'Turnausennakko' : 'Otteluennakko', card.level, card.format].filter(Boolean).join(' · ');
}

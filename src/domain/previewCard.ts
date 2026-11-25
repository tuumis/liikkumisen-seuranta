// Otteluennakko (SPEC 16, 14.11.2026): tulevan pelin tai turnauksen tiedot jaettavaksi kuvaksi
// samalla tyylillä kuin tuloskuva. Puhdas funktio kalenterin tapahtumasta; piirto features/share/drawPreview.

import { LEVEL_LABEL } from './football';
import { gameDaySchedule, tournamentStart } from './tournamentTime';
import type { Fixture, GameFormat, HHmm, HomeAway, ISODate, PlannedSession } from './types';

export interface PreviewGame {
  opponent?: string;
  time?: HHmm;
  location?: string;
  /** Koti- vai vieraspeli oman joukkueen kannalta (18.11.2026). */
  homeAway?: HomeAway;
  /** Seuran sisäinen peli (25.11.2026): kuvassa vain valittaessa (withoutInternal). */
  internal?: true;
}

export interface PreviewCard {
  /** 'friendly' = harjoituspeli (17.11.2026): vastustajat 1…n, alku ja loppu. */
  kind: 'game' | 'tournament' | 'friendly';
  date: ISODate;
  eventName?: string;
  level?: string;
  format?: GameFormat;
  /** Sarja, esim. P9 (18.11.2026). */
  series?: string;
  team?: string;
  /** Pelin alku (ottelu) tai ensimmäisen pelin alku (turnaus). */
  kickoff?: HHmm;
  /** Paikalla (30 min ennen, vähintään lämmittelyn verran). */
  arrival?: HHmm;
  /** Harjoituspelin loppu (alku + kesto). */
  end?: HHmm;
  location?: string;
  /** Ottelu: yksi rivi; turnaus: otteluohjelma kellonajan mukaan (ajattomat lopussa). */
  games: PreviewGame[];
  /** Valinnainen kommentti pelin alle (17.11.2026). */
  comment?: string;
}

/** Ennakkokuvan laatikot, jotka käyttäjä voi piilottaa (17.11.2026). */
export type PreviewBox = 'arrival' | 'kickoff' | 'end' | 'games' | 'place';
export const PREVIEW_BOXES: readonly PreviewBox[] = ['arrival', 'kickoff', 'end', 'games', 'place'];

export function previewBoxLabel(box: PreviewBox, card: Pick<PreviewCard, 'kind'>): string {
  if (box === 'kickoff') return card.kind === 'tournament' ? '1. peli' : card.kind === 'friendly' ? 'Alkaa' : 'Peli alkaa';
  return box === 'arrival' ? 'Paikalla' : box === 'end' ? 'Päättyy' : box === 'games' ? 'Pelit' : 'Paikka';
}

/** Laatikot, joille kortilla on tieto (vain nämä tarjotaan valittaviksi). */
export function availableBoxes(card: PreviewCard): PreviewBox[] {
  return PREVIEW_BOXES.filter((b) =>
    b === 'arrival' ? !!card.arrival : b === 'kickoff' ? !!card.kickoff : b === 'end' ? !!card.end : b === 'games' ? card.kind === 'tournament' && card.games.length > 0 : !!card.location,
  );
}

/** Aikalaatikot (otsikko, arvo) piilotukset huomioiden; paikka piirretään omana laatikkonaan. */
export function previewTimeBoxes(card: PreviewCard, hidden: ReadonlySet<PreviewBox> = new Set()): [string, string][] {
  const out: [string, string][] = [];
  for (const b of availableBoxes(card)) {
    if (hidden.has(b) || b === 'place') continue;
    out.push([previewBoxLabel(b, card), b === 'arrival' ? card.arrival! : b === 'kickoff' ? card.kickoff! : b === 'end' ? card.end! : String(card.games.length)]);
  }
  return out;
}

const clean = (s: string | undefined) => s?.replace(/\s+/g, ' ').trim() || undefined;

/** Kellonaika + minuutit (saman päivän sisällä; muuten ei loppuaikaa). */
function addMin(t: HHmm, min: number): HHmm | undefined {
  const [h, m] = t.split(':').map(Number);
  const x = h * 60 + m + Math.round(min);
  if (!(min > 0) || x >= 24 * 60) return undefined;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}` as HHmm;
}

export function previewCard(
  plan: Pick<PlannedSession, 'activityTypeId' | 'date' | 'startTime'> & { durationMin?: number },
  fixture: Fixture | undefined,
  team?: { name: string; format?: GameFormat; series?: string },
): PreviewCard {
  const tournament = plan.activityTypeId === 't:football_tournament';
  const friendly = plan.activityTypeId === 't:football_friendly';
  const f = fixture;
  const base = {
    date: plan.date,
    ...(clean(f?.eventName) && tournament ? { eventName: clean(f?.eventName) } : {}),
    ...(f?.level ? { level: LEVEL_LABEL[f.level] } : {}),
    ...(clean(f?.series ?? team?.series) ? { series: clean(f?.series ?? team?.series) } : {}),
    ...((f?.format ?? team?.format) ? { format: f?.format ?? team?.format } : {}),
    ...(clean(team?.name) ? { team: clean(team?.name) } : {}),
    ...(clean(f?.location) ? { location: clean(f?.location) } : {}),
    ...(clean(f?.previewNote) ? { comment: clean(f?.previewNote) } : {}),
  };
  if (friendly) {
    // Harjoituspeli: vastustajat kalenterin järjestyksessä, alku ja loppu (ei paikalla-aikaa).
    const opponents = (f?.games ?? []).map((g) => clean(g.opponent)).filter((o): o is string => !!o);
    const end = plan.startTime && plan.durationMin ? addMin(plan.startTime, plan.durationMin) : undefined;
    return {
      kind: 'friendly',
      ...base,
      ...(plan.startTime ? { kickoff: plan.startTime } : {}),
      ...(end ? { end } : {}),
      // Koti/vieras koskee koko harjoituspeliä, joten se on jokaisella vastustajarivillä.
      games: (opponents.length ? opponents.map((opponent) => ({ opponent })) : [{}]).map((g) => (f?.homeAway ? { ...g, homeAway: f.homeAway } : g)),
    };
  }
  if (!tournament) {
    const kickoff = plan.startTime;
    return {
      kind: 'game',
      ...base,
      ...(kickoff ? { kickoff, arrival: gameDaySchedule(kickoff, f?.warmupMin).arrival } : {}),
      games: [{ ...(clean(f?.opponent) ? { opponent: clean(f?.opponent) } : {}), ...(kickoff ? { time: kickoff } : {}), ...(f?.homeAway ? { homeAway: f.homeAway } : {}) }],
    };
  }
  const scheduled = (f?.games ?? []).map((g) => ({
    ...(clean(g.opponent) ? { opponent: clean(g.opponent) } : {}),
    ...(g.time ? { time: g.time } : {}),
    ...(clean(g.location) ? { location: clean(g.location) } : {}),
    ...(g.homeAway ? { homeAway: g.homeAway } : {}),
    ...(g.internal ? { internal: true as const } : {}),
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
  return [previewTitleOf(card), card.series, card.level, card.format].filter(Boolean).join(' · ');
}

/** Kuvan yläreunan tunniste. */
export function previewTitleOf(card: Pick<PreviewCard, 'kind'>): string {
  return card.kind === 'tournament' ? 'Turnausennakko' : card.kind === 'friendly' ? 'Harjoituspeli' : 'Otteluennakko';
}

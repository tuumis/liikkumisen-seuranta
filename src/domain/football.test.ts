// Vaihe 5: jalkapallon pelit, yhteenvedot, mittarit ja trendit. SPEC 14: A17.

import { describe, expect, it } from 'vitest';
import {
  footballPeriodSummary,
  footballTrend,
  gameRows,
  gamesCsv,
  median,
  normalizeName,
  seasonKey,
  summarizeBy,
  summarizeGames,
} from './football';
import { monthPeriod, weekPeriod } from './dates';
import { activityTypeId } from './ids';
import { planned, session, typesMap } from './test-helpers';
import type { FootballDetails, Session } from './types';

const GAME = activityTypeId('football_game');
const TOURNAMENT = activityTypeId('football_tournament');
const TRAINING = activityTypeId('football_training');
const types = typesMap();
const M = { light: 0, moderate: 0, vigorous: 0 };

const fd = (sessionId: string, over: Partial<FootballDetails> = {}): FootballDetails => ({
  sessionId,
  attendance: 'full',
  focusTags: [],
  updatedAt: 'x',
  updatedBy: 'd',
  ...over,
});

function fixtureA17() {
  const s: Session[] = [
    session({ id: 'g1', date: '2026-09-05', activityTypeId: GAME, minutes: M, playedMin: 30 }),
    session({ id: 'g2', date: '2026-09-12', activityTypeId: GAME, minutes: M, playedMin: 20 }),
    session({ id: 'g3', date: '2026-09-19', activityTypeId: GAME, minutes: M }),
    session({ id: 't1', date: '2026-09-26', activityTypeId: TOURNAMENT, minutes: M }),
    session({ id: 'g4', date: '2026-10-03', activityTypeId: GAME, minutes: M, playedMin: 40 }),
    session({ id: 'tr', date: '2026-10-04', activityTypeId: TRAINING, minutes: M }),
  ];
  const d = new Map<string, FootballDetails>([
    ['g1', fd('g1', { team: 'P2018 Valkoinen', opponent: 'FC Kasi', goalsFor: 3, goalsAgainst: 1 })],
    ['g2', fd('g2', { team: 'p2018  valkoinen ', opponent: 'HJK', goalsFor: 2, goalsAgainst: 2 })],
    ['g3', fd('g3', { team: 'P2018 Valkoinen', opponent: 'fc kasi', goalsFor: 0, goalsAgainst: 1 })],
    [
      't1',
      fd('t1', {
        team: 'P2018 Valkoinen',
        eventName: 'Syyscup',
        games: [
          { opponent: 'PK-35', goalsFor: 1, goalsAgainst: 0, playedMin: 15 },
          { opponent: 'HJK', goalsFor: 0, goalsAgainst: 3, playedMin: 10 },
        ],
      }),
    ],
    ['g4', fd('g4', { team: 'P2018 Valkoinen', opponent: 'Honka' })], // ei tulosta
  ]);
  return { s, d };
}

describe('A17 pelit ja tulokset', () => {
  it('pelit 3–1, 2–2, 0–1, turnaus 1–0 ja 0–3, yksi ilman tulosta → 6 peliä, 2–1–2, maalit 6–7, maaliero −1', () => {
    const { s, d } = fixtureA17();
    const rows = gameRows(s, d, types);
    expect(rows).toHaveLength(6); // treeni ei ole peli
    const sum = summarizeGames(rows);
    expect(sum).toMatchObject({ games: 6, wins: 2, draws: 1, losses: 2, goalsFor: 6, goalsAgainst: 7, goalDiff: -1, noResult: 1 });
  });

  it('turnauksen pelit näkyvät turnauksen nimen alla järjestysnumeroin', () => {
    const { s, d } = fixtureA17();
    const t = gameRows(s, d, types).filter((r) => r.kind === 'tournament');
    expect(t.map((r) => [r.eventName, r.index, r.opponent, r.outcome])).toEqual([
      ['Syyscup', 1, 'PK-35', 'W'],
      ['Syyscup', 2, 'HJK', 'L'],
    ]);
  });

  it('turnaus ilman pelirivejä on yksi rivi: gamesCount peliä, ei tulosta', () => {
    const s = [session({ id: 't', date: '2026-09-26', activityTypeId: TOURNAMENT, minutes: M, playedMin: 60 })];
    const d = new Map([['t', fd('t', { gamesCount: 4, eventName: 'Kevätturnaus' })]]);
    const rows = gameRows(s, d, types);
    expect(rows).toHaveLength(1);
    expect(summarizeGames(rows)).toMatchObject({ games: 4, noResult: 4, wins: 0, playedMinTotal: 60, playedMinAvg: 15 });
  });

  it('peliaika yhteensä ja keskimäärin per peli (vain peleistä, joille aika on kirjattu)', () => {
    const { s, d } = fixtureA17();
    const sum = summarizeGames(gameRows(s, d, types));
    expect(sum.playedMinTotal).toBe(30 + 20 + 15 + 10 + 40);
    expect(sum.playedMinAvg).toBeCloseTo(115 / 5, 10);
  });

  it('joukkueet ja vastustajat yhdistyvät kirjainkoosta ja välilyönneistä riippumatta; eniten pelatut ensin', () => {
    const { s, d } = fixtureA17();
    const rows = gameRows(s, d, types);
    const teams = summarizeBy(rows, (r) => r.team);
    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({ label: 'P2018 Valkoinen', summary: { games: 6 } });
    const opp = summarizeBy(rows, (r) => r.opponent);
    expect(opp.map((o) => [o.label, o.summary.games])).toEqual([
      ['FC Kasi', 2],
      ['HJK', 2],
      ['Honka', 1],
      ['PK-35', 1],
    ]);
    expect(opp[0].summary).toMatchObject({ wins: 1, losses: 1, goalsFor: 3, goalsAgainst: 2 });
    expect(normalizeName('  P2018   Valkoinen ')).toBe('p2018 valkoinen');
  });

  it('kaudet', () => {
    expect(seasonKey('2026-03-01')).toBe('Kevät 2026');
    expect(seasonKey('2026-07-01')).toBe('Kesä 2026');
    expect(seasonKey('2026-11-11')).toBe('Syksy 2026');
  });

  it('CSV: BOM, puolipisteet, yksi rivi per peli, ä ja ö säilyvät', () => {
    const { s, d } = fixtureA17();
    const csv = gamesCsv(gameRows(s, d, types));
    expect(csv.startsWith('﻿Päivä;Tapahtuma;')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(7);
    expect(lines[1]).toBe('5.9.2026;Peli;;P2018 Valkoinen;FC Kasi;3;1;V;30;1;;;');
    expect(lines.at(-1)).toContain('ei tulosta');
    expect(gamesCsv([{ ...gameRows(s, d, types)[0], opponent: 'A;"B"' }])).toContain('"A;""B"""');
  });
});

describe('jalkapallo jaksolta', () => {
  it('harjoitusmäärä, osallistumisaste (perutut pois), osallistuminen ja tagit vain tagitetuista', () => {
    const s = [
      session({ id: 'a', date: '2026-11-02', activityTypeId: TRAINING, minutes: M, durationMin: 90 }),
      session({ id: 'b', date: '2026-11-04', activityTypeId: TRAINING, minutes: M, durationMin: 75 }),
      session({ id: 'c', date: '2026-11-06', activityTypeId: TRAINING, minutes: M, durationMin: 60 }),
      session({ id: 'x', date: '2026-11-04', activityTypeId: activityTypeId('trampoline'), minutes: M }),
    ];
    const d = new Map([
      ['a', fd('a', { focusTags: ['passing', 'small_sided'] })],
      ['b', fd('b', { attendance: 'partial', focusTags: ['passing'] })],
    ]);
    const plans = [
      planned({ date: '2026-11-02', status: 'done', sessionId: 'a' }),
      planned({ date: '2026-11-09', status: 'skipped', skipReason: 'sick' }),
      planned({ date: '2026-11-11', status: 'skipped', skipReason: 'cancelled' }),
      planned({ date: '2026-11-12', activityTypeId: activityTypeId('swimming'), status: 'skipped' }),
    ];
    const r = footballPeriodSummary({ sessions: s, details: d, types, planned: plans, today: '2026-11-30' }, monthPeriod('2026-11-11'));
    expect(r.training).toEqual({ count: 3, minutes: 225 });
    expect(r.sessions).toBe(3);
    expect(r.withoutDetails).toBe(1);
    expect(r.attendance).toEqual({ full: 1, partial: 1 });
    expect(r.tags).toEqual({ tagged: 2, counts: { passing: 2, small_sided: 1 } });
    expect(r.participation.adherenceRate).toBeCloseTo(1 / 2, 10); // tehty 1, sairas 1; peruttu ja uinti pois
    expect(r.participation.skippedByReason.sick).toBe(1);

    const wk = footballPeriodSummary({ sessions: s, details: d, types, planned: plans, today: '2026-11-30' }, weekPeriod('2026-11-04'));
    expect(wk.training.count).toBe(3);
  });
});

describe('trendit', () => {
  const series = (values: number[], start = 1) => {
    const sessions: Session[] = [];
    const details = new Map<string, FootballDetails>();
    values.forEach((v, i) => {
      const id = `t${i}`;
      const day = String(start + i).padStart(2, '0');
      sessions.push(session({ id, date: `2026-10-${day}`, activityTypeId: TRAINING, minutes: M }));
      details.set(id, fd(id, { parentRating: v as 1, enjoyment: Math.min(3, v) as 1 }));
    });
    return { sessions, details, types };
  };

  it('mediaani', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('arviotrendi näytetään vasta, kun arvioita ≥ 5; viimeisten 8 mediaani', () => {
    expect(footballTrend(series([3, 4, 3, 2]), '2026-10-31', 'parentRating').median).toBeNull();
    const t = footballTrend(series([1, 1, 1, 3, 3, 4, 3, 2, 3, 5]), '2026-10-31', 'parentRating');
    expect(t.count).toBe(10);
    expect(t.median).toBe(3); // [1,3,3,4,3,2,3,5] → 3
    expect(t.declined).toBe(false); // edellisiä vain 2
  });

  it('viihtymisen lasku: viimeisten 8 mediaani < edellisten 8, kummassakin ≥ 5', () => {
    const t = footballTrend(series([3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 3, 3, 2]), '2026-10-31', 'enjoyment');
    expect(t.previousMedian).toBe(3);
    expect(t.median).toBe(2);
    expect(t.declined).toBe(true);
  });

  it('kausi rajaa: edellisen kauden arviot eivät ole mukana', () => {
    const s = series([5, 5, 5, 5, 5]);
    const summer = { ...s, sessions: s.sessions.map((x) => ({ ...x, date: x.date.replace('2026-10', '2026-08') })) };
    expect(footballTrend(summer, '2026-10-31', 'parentRating').count).toBe(0);
    expect(footballTrend(s, '2026-10-03', 'parentRating').count).toBe(3); // viitepäivän jälkeiset pois
  });
});

describe('näyttönimi', () => {
  it('yleisin kirjoitusasu; tasatilanteessa isot kirjaimet', async () => {
    const { preferredName } = await import('./football');
    expect(preferredName(['hjk', 'HJK'])).toBe('HJK');
    expect(preferredName(['Fc Kasi', 'FC Kasi', 'Fc Kasi'])).toBe('Fc Kasi');
  });
});

describe('pelipaikat ja peliaika (playSummary)', () => {
  const base = { sessionId: 's', date: '2026-10-01', kind: 'game' as const, games: 1 };
  it('pelipaikat lasketaan peleittäin, osuus minuuteista tai Koko/Ei-merkinnästä', async () => {
    const { playSummary } = await import('./football');
    const s = playSummary([
      { ...base, positions: ['def', 'mid'], playedMin: 30, gameMin: 45 },
      { ...base, positions: ['mid'], played: 'full', gameMin: 45 },
      { ...base, played: 'none', gameMin: 45 },
      { ...base, played: 'part', gameMin: 45 }, // osan ilman minuutteja: ei osuudessa
      { ...base, playedMin: 60, gameMin: 45 }, // yli pelin pituuden rajataan
    ]);
    expect(s.games).toBe(5);
    expect(s.positionGames).toBe(2);
    expect(s.positions).toEqual({ gk: 0, def: 1, mid: 2, fwd: 0 });
    expect(s.shareGames).toBe(4);
    expect(s.share).toBeCloseTo((30 + 45 + 0 + 45) / (45 * 4));
    expect(s.played).toEqual({ full: 1, part: 1, none: 1 });
  });
  it('ilman pelin pituutta ei osuutta', async () => {
    const { playSummary } = await import('./football');
    expect(playSummary([{ ...base, playedMin: 20 }]).share).toBeNull();
  });
  it('gameRows: pelin pituus = kesto − lämmittely, turnauksessa otteluohjelman pelin pituus', () => {
    const M0 = { light: 10, moderate: 20, vigorous: 30 };
    const g = session({ id: 'g', activityTypeId: activityTypeId('football_game'), minutes: M0, warmupMin: 15, date: '2026-10-01' });
    const t = session({ id: 't', activityTypeId: activityTypeId('football_tournament'), minutes: M0, date: '2026-10-02' });
    const details = new Map<string, FootballDetails>([
      ['g', { sessionId: 'g', attendance: 'full', focusTags: [], played: 'full' } as unknown as FootballDetails],
      ['t', { sessionId: 't', attendance: 'full', focusTags: [], gameLengthMin: 20, games: [{ played: 'part' }, { playedMin: 10 }] } as unknown as FootballDetails],
    ]);
    const rows = gameRows([g, t], details, typesMap());
    expect(rows.map((r) => [r.gameMin, r.played])).toEqual([
      [45, 'full'],
      [20, 'part'],
      [20, undefined],
    ]);
  });
});

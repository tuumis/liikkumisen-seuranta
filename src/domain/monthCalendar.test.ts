import { describe, expect, it } from 'vitest';
import { addMonths, clockText, eventTitle, gridRange, monthEvents, monthGrid, recordText, seasonMonths, eventsBetween } from './monthCalendar';
import type { Fixture, PlannedSession } from './types';
import type { GameRow } from './football';

const plan = (id: string, date: string, type: string): PlannedSession =>
  ({ id, profileId: 'p1', activityTypeId: type, date, durationMin: 90, status: 'open', createdAt: '', updatedAt: '', updatedBy: 'd' }) as PlannedSession;
const fx = (planId: string, f: Partial<Fixture>): Fixture => ({ plannedSessionId: planId, updatedAt: '', updatedBy: 'd', ...f }) as Fixture;

describe('kuukauden ruudukko', () => {
  it('marraskuu 2026: ma–su viikot 44–49, alku ja loppu viereisistä kuukausista', () => {
    const g = monthGrid('2026-11');
    expect(g.map((w) => w.week)).toEqual([44, 45, 46, 47, 48, 49]);
    expect(g[0].days[0]).toBe('2026-10-26');
    expect(g[5].days[6]).toBe('2026-12-06');
    expect(gridRange('2026-11')).toEqual({ from: '2026-10-26', to: '2026-12-06' });
  });

  it('vuodenvaihde: viikkonumerot ISO-säännöllä', () => {
    const g = monthGrid('2027-01');
    expect(g[0].week).toBe(53);
    expect(g[0].days[0]).toBe('2026-12-28');
  });

  it('kuukausien siirto ja kaudet', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(seasonMonths(2027, 'spring')).toEqual(['2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06']);
    expect(seasonMonths(2026, 'autumn')[5]).toBe('2026-12');
  });
});

describe('päivän tapahtumat', () => {
  const today = '2026-11-18';

  it('tuleva peli: aika, paikalla-aika ja vastustaja; tulos puuttuu menneelle; ei pelattu', () => {
    const ev = monthEvents({
      today,
      rows: [],
      fixtures: [
        { plan: { ...plan('a', '2026-11-21', 't:football_game'), startTime: '10:00' }, fixture: fx('a', { opponent: 'PK-35', warmupMin: 30, homeAway: 'away', series: 'P9', infoMissing: true }) },
        { plan: plan('b', '2026-11-15', 't:football_game'), fixture: fx('b', { opponent: 'HJK' }) },
        { plan: { ...plan('c', '2026-11-10', 't:football_game'), status: 'skipped' } },
      ],
    });
    expect(ev.get('2026-11-21')![0]).toMatchObject({ state: 'upcoming', time: '10:00', title: 'PK-35', homeAway: 'away', series: 'P9', infoMissing: true });
    expect(ev.get('2026-11-21')![0].arrival).toBeDefined();
    expect(ev.get('2026-11-15')![0]).toMatchObject({ state: 'pending', title: 'HJK' });
    expect(ev.get('2026-11-10')![0]).toMatchObject({ state: 'skipped', title: 'Vastustaja ?' });
  });

  it('turnaus: ensimmäisen pelin aika, suunnitelman alku paikalla-aikana; otteluohjelma riveinä', () => {
    const ev = monthEvents({
      today,
      rows: [],
      fixtures: [
        {
          plan: { ...plan('t', '2026-11-28', 't:football_tournament'), startTime: '08:30' },
          fixture: fx('t', { eventName: 'Syyscup', games: [{ time: '09:00', opponent: 'HJK', homeAway: 'home' }, { time: '11:00' }] }),
        },
      ],
    });
    expect(ev.get('2026-11-28')![0]).toMatchObject({ kind: 'tournament', title: 'Syyscup', time: '09:00', arrival: '08:30' });
    expect(ev.get('2026-11-28')![0].games).toHaveLength(2);
  });

  it('kirjattu: kuitattu suunnitelma näkyy kertana tuloksineen ja kalenterin paikkatiedolla', () => {
    const rows: GameRow[] = [
      { sessionId: 's1', date: '2026-11-08', kind: 'game', opponent: 'Ilves', goalsFor: 2, goalsAgainst: 1, outcome: 'W', games: 1 },
      { sessionId: 's2', date: '2026-11-01', kind: 'tournament', eventName: 'Cup', index: 1, outcome: 'W', goalsFor: 1, goalsAgainst: 0, games: 1 },
      { sessionId: 's2', date: '2026-11-01', kind: 'tournament', eventName: 'Cup', index: 2, outcome: 'D', goalsFor: 0, goalsAgainst: 0, games: 1 },
      { sessionId: 's2', date: '2026-11-01', kind: 'tournament', eventName: 'Cup', index: 3, outcome: 'W', goalsFor: 3, goalsAgainst: 2, games: 1 },
    ];
    const ev = monthEvents({
      today,
      rows,
      sessionStart: new Map([['s1', '17:00']]),
      fixtures: [{ plan: { ...plan('a', '2026-11-08', 't:football_game'), status: 'done', sessionId: 's1' }, fixture: fx('a', { opponent: 'Ilves', location: 'Kenttä 2' }) }],
    });
    expect(ev.get('2026-11-08')).toHaveLength(1);
    expect(ev.get('2026-11-08')![0]).toMatchObject({ state: 'played', result: '2–1 V', time: '17:00', location: 'Kenttä 2' });
    expect(ev.get('2026-11-01')![0]).toMatchObject({ kind: 'tournament', result: '2V 1T', title: 'Cup' });
    expect(ev.get('2026-11-01')![0].games!.map((g) => g.result)).toEqual(['1–0 V', '0–0 T', '3–2 V']);
  });

  it('treenit aikajärjestyksessä pelien kanssa; otteluohjelmaan vain pyydettäessä', () => {
    const ev = monthEvents({
      today,
      rows: [],
      fixtures: [{ plan: { ...plan('a', '2026-11-21', 't:football_friendly'), startTime: '12:00' }, fixture: fx('a', { games: [{ opponent: 'TPV' }, { opponent: 'Ilves' }], homeAway: 'home' }) }],
      trainings: [{ id: 'x', date: '2026-11-21', startTime: '09:00', durationMin: 75, name: 'Jalkapallo' }],
    });
    const day = ev.get('2026-11-21')!;
    expect(day.map((e) => e.kind)).toEqual(['training', 'friendly']);
    expect(day[1]).toMatchObject({ title: 'TPV, Ilves', homeAway: 'home' });
    expect(eventsBetween(ev, '2026-11-01', '2026-11-30').map((e) => e.kind)).toEqual(['friendly']);
    expect(eventsBetween(ev, '2026-11-01', '2026-11-30', true)).toHaveLength(2);
  });

  it('turnauksen tulos ilman kirjattuja pelejä on tyhjä', () => {
    expect(recordText([{}, {}])).toBeUndefined();
    expect(recordText([{ outcome: 'L' }, { outcome: 'L' }])).toBe('2H');
  });
});

describe('nimet ja kellonajat', () => {
  it('vastustajan nimi ruutuun, otteluohjelmaan ja päivän tietoihin', () => {
    const e = { title: 'x', opponents: ['HJK · Musta · 2018', 'PK-35'] };
    expect(eventTitle(e, 'short')).toBe('HJK Musta, PK-35');
    expect(eventTitle(e, 'compact')).toBe('HJK Musta 2018, PK-35');
    expect(eventTitle(e, 'full')).toBe('HJK · Musta · 2018 syntyneet, PK-35');
    expect(eventTitle({ title: 'Syyscup' }, 'short')).toBe('Syyscup');
    expect(clockText('09:30')).toBe('9.30');
    expect(clockText('17:05')).toBe('17.05');
  });
});

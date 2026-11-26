import { describe, expect, it } from 'vitest';
import type { GameRow } from './football';
import { countdownOf, daysUntilLabel, endMin, fixtureTitle, kickoffMin, nextFixtures, recentForm, splitMs, type UpcomingEntry } from './nextGames';
import { previewCard } from './previewCard';
import type { Fixture, PlannedSession } from './types';

const plan = (p: Partial<PlannedSession>): PlannedSession =>
  ({ id: 'p', profileId: 'a', activityTypeId: 't:football_game', date: '2026-11-28', durationMin: 75, status: 'open', updatedAt: '', updatedBy: 'd', ...p }) as PlannedSession;
const fx = (f: Partial<Fixture>): Fixture => ({ plannedSessionId: 'p', updatedAt: '', updatedBy: 'd', ...f }) as Fixture;
const e = (p: Partial<PlannedSession>, f?: Partial<Fixture>): UpcomingEntry => ({ plan: plan(p), ...(f ? { fixture: fx(f) } : {}) });

describe('kausikortin seuraavat pelit', () => {
  it('avoimet tulevat aikajärjestyksessä, enintään kolme', () => {
    const list = [
      e({ id: '1', date: '2026-12-05', startTime: '10:30' }),
      e({ id: '2', date: '2026-11-28' }),
      e({ id: '3', date: '2026-11-28', startTime: '14:00' }),
      e({ id: '4', date: '2026-11-20', startTime: '14:00' }),
      e({ id: '5', date: '2026-12-01', status: 'done' }),
      e({ id: '6', date: '2026-12-13' }),
    ];
    expect(nextFixtures(list, '2026-11-27').map((x) => x.plan.id)).toEqual(['3', '2', '1']);
  });
  it('alku: ottelu kellonajasta, turnaus ensimmäisestä pelistä, muuten paikallaoloajasta', () => {
    expect(kickoffMin(e({ startTime: '14:00' }))).toBe(14 * 60);
    expect(kickoffMin(e({ activityTypeId: 't:football_tournament', startTime: '08:30' }, { games: [{ opponent: 'B', time: '10:00' }, { opponent: 'A', time: '09:00' }] }))).toBe(9 * 60);
    expect(kickoffMin(e({ activityTypeId: 't:football_tournament', startTime: '08:30' }, { gamesCount: 3 }))).toBe(8 * 60 + 30);
    expect(kickoffMin(e({}))).toBeUndefined();
  });
  it('loppu: ottelu ilman lämmittelyä, harjoituspeli alku + kesto, turnaus otteluohjelmasta', () => {
    expect(endMin(e({ startTime: '14:00', durationMin: 75 }))).toBe(14 * 60 + 60);
    expect(endMin(e({ startTime: '14:00', durationMin: 75 }, { warmupMin: 20 }))).toBe(14 * 60 + 55);
    expect(endMin(e({ activityTypeId: 't:football_friendly', startTime: '18:00', durationMin: 90 }))).toBe(19 * 60 + 30);
    expect(endMin(e({ activityTypeId: 't:football_tournament', startTime: '08:30', durationMin: 300 }, { games: [{ time: '09:00' }, { time: '12:00' }], gameLengthMin: 20 }))).toBe(12 * 60 + 20);
  });
  it('laskuri: ennen alkua, käynnissä, päättynyt ja ilman kellonaikaa', () => {
    const g = e({ date: '2026-11-28', startTime: '14:00', durationMin: 75 });
    expect(countdownOf(g, new Date(2026, 10, 27, 12, 0, 0))).toEqual({ state: 'until', ms: 26 * 3600 * 1000 });
    expect(countdownOf(g, new Date(2026, 10, 28, 14, 30))).toEqual({ state: 'live' });
    expect(countdownOf(g, new Date(2026, 10, 28, 15, 0))).toEqual({ state: 'ended' });
    expect(countdownOf(e({ date: '2026-11-30' }), new Date(2026, 10, 27, 23, 0))).toEqual({ state: 'day', days: 3 });
  });
  it('osat ja päiväteksti', () => {
    expect(splitMs((26 * 3600 + 4 * 60 + 5) * 1000 + 999)).toEqual({ days: 1, hours: 2, minutes: 4, seconds: 5 });
    expect(daysUntilLabel('2026-11-27', '2026-11-27')).toBe('tänään');
    expect(daysUntilLabel('2026-11-28', '2026-11-27')).toBe('huomenna');
    expect(daysUntilLabel('2026-12-05', '2026-11-27')).toBe('8 pv');
  });
  it('otsikko', () => {
    expect(fixtureTitle(previewCard(plan({}), fx({ opponent: 'Ilves' })))).toBe('vs Ilves');
    expect(fixtureTitle(previewCard(plan({}), undefined))).toBe('Peli');
    expect(fixtureTitle(previewCard(plan({ activityTypeId: 't:football_tournament' }), fx({ eventName: 'Joulucup' })))).toBe('Joulucup');
    expect(fixtureTitle(previewCard(plan({ activityTypeId: 't:football_friendly' }), fx({ games: [{ opponent: 'A' }, { opponent: 'B' }] })))).toBe('vs A, B');
  });
  it('viimeiset tulokset: ei harjoituspelejä, sisäisiä eikä tuloksettomia; vanhimmasta uusimpaan', () => {
    const r = (date: string, outcome?: GameRow['outcome'], extra: Partial<GameRow> = {}): GameRow => ({ sessionId: date, date, kind: 'game', games: 1, ...(outcome ? { outcome } : {}), ...extra });
    const rows = [r('2026-09-01', 'W'), r('2026-09-08', 'L'), r('2026-09-15'), r('2026-09-20', 'D', { kind: 'friendly' }), r('2026-09-22', 'W', { internal: true }), r('2026-09-29', 'D'), r('2026-10-06', 'W'), r('2026-10-13', 'W'), r('2026-10-20', 'L')];
    expect(recentForm(rows).map((x) => x.outcome)).toEqual(['L', 'D', 'W', 'W', 'L']);
  });
});

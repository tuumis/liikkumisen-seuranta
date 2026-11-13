import { describe, expect, it } from 'vitest';
import { distinctTypes, latestComment, previousWeekStart, shouldShowDigest } from './weekDigest';
import type { FootballDetails, Session } from './types';

const s = (over: Partial<Session>): Session =>
  ({ id: 'a', profileId: 'p', activityTypeId: 't:x', date: '2026-11-10', durationMin: 30, createdAt: 'x', updatedAt: '2026-11-10T10:00:00.000Z', updatedBy: 'd', ...over }) as Session;

describe('viime viikko lyhyesti', () => {
  it('edellisen viikon maanantai', () => {
    expect(previousWeekStart('2026-11-13')).toBe('2026-11-02');
    expect(previousWeekStart('2026-11-09')).toBe('2026-11-02');
  });
  it('näytetään vain, jos kirjauksia on eikä koostetta ole suljettu', () => {
    const base = { lastWeekStart: '2026-11-02', trackingStart: '2026-09-01', sessionCount: 3 };
    expect(shouldShowDigest(base)).toBe(true);
    expect(shouldShowDigest({ ...base, dismissedFor: '2026-11-02' })).toBe(false);
    expect(shouldShowDigest({ ...base, dismissedFor: '2026-10-26' })).toBe(true);
    expect(shouldShowDigest({ ...base, sessionCount: 0 })).toBe(false);
    expect(shouldShowDigest({ ...base, trackingStart: '2026-11-09' })).toBe(false);
  });
  it('tuorein kommentti: jalkapallon kommentti, pelin kommentti tai muistiinpano', () => {
    const a = s({ id: 'a', date: '2026-11-03', note: 'Pyöräily mökille' });
    const b = s({ id: 'b', date: '2026-11-07' });
    const details = new Map<string, FootballDetails>([['b', { sessionId: 'b', attendance: 'full', focusTags: [], games: [{ note: '' }, { note: 'Hieno maali' }] } as unknown as FootballDetails]]);
    expect(latestComment([a, b], details)).toEqual({ text: 'Hieno maali', date: '2026-11-07' });
    expect(latestComment([a], new Map())).toEqual({ text: 'Pyöräily mökille', date: '2026-11-03' });
    expect(latestComment([s({})], new Map())).toBeUndefined();
  });
  it('lajien määrä ilman arkiliikunnan vahvistuksia', () => {
    expect(distinctTypes([s({ activityTypeId: 't:a' }), s({ activityTypeId: 't:a' }), s({ activityTypeId: 't:b' }), s({ activityTypeId: 't:c', estimateConfirmed: true })])).toBe(2);
  });
});

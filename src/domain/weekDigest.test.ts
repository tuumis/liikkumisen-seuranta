import { describe, expect, it } from 'vitest';
import { previousWeekStart, shouldShowDigest } from './weekDigest';

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
});

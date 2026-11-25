import { describe, expect, it } from 'vitest';
import { elapsedSec, formatClock, formatTimed, newStopwatch, pauseStopwatch, resumeStopwatch, timedMinutes } from './stopwatch';

describe('sekuntikello', () => {
  const start = new Date(2026, 10, 25, 17, 5, 0);
  const t0 = start.getTime();

  it('käynnistys tallentaa päivän ja alkamisajan', () => {
    const sw = newStopwatch('p1', 't1', start);
    expect(sw).toMatchObject({ profileId: 'p1', activityTypeId: 't1', date: '2026-11-25', startTime: '17:05', pausedMs: 0 });
    expect(newStopwatch('p1', undefined, start)).not.toHaveProperty('activityTypeId');
  });

  it('tauko ei kerrytä aikaa', () => {
    let sw = newStopwatch('p1', undefined, start);
    expect(elapsedSec(sw, t0 + 90_500)).toBe(90);
    sw = pauseStopwatch(sw, t0 + 600_000); // 10 min
    expect(elapsedSec(sw, t0 + 900_000)).toBe(600);
    expect(pauseStopwatch(sw, t0 + 999_000)).toBe(sw);
    sw = resumeStopwatch(sw, t0 + 900_000); // 5 min tauko
    expect(sw.pausedAt).toBeUndefined();
    expect(elapsedSec(sw, t0 + 1_200_000)).toBe(900);
  });

  it('kesto pyöristetään lähimpään minuuttiin, vähintään 1', () => {
    expect(timedMinutes(47 * 60 + 29)).toBe(47);
    expect(timedMinutes(47 * 60 + 30)).toBe(48);
    expect(timedMinutes(10)).toBe(1);
    expect(timedMinutes(0)).toBe(1);
  });

  it('muotoilu', () => {
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(47 * 60 + 32)).toBe('47:32');
    expect(formatClock(3723)).toBe('1:02:03');
    expect(formatTimed(45)).toBe('45 s');
    expect(formatTimed(47 * 60 + 32)).toBe('47 min 32 s');
    expect(formatTimed(3723)).toBe('1 h 2 min 3 s');
  });
});

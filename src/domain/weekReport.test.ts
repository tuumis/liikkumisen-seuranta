// Viikkoraportti (SPEC 16, 14.11.2026): rivit summautuvat päivän lukuihin, sairaspäivä ilman arviota.
import { describe, expect, it } from 'vitest';
import { weekPeriod } from './dates';
import { activityTypeId } from './ids';
import { DEFAULT_SETTINGS } from './recommendations';
import { periodReport, type ReportInput } from './report';
import { estimate, profile, session, typesMap } from './test-helpers';
import type { DayFlag } from './types';
import { footballBrief, shortName, weekReport } from './weekReport';

const types = typesMap();
const MON = '2026-11-02';
const sick: DayFlag = { id: 'f:p1:2026-11-04', profileId: 'p1', date: '2026-11-04', reason: 'sick', updatedAt: '2026-11-04T10:00:00.000Z', updatedBy: 'd' };
const recess = estimate({ category: 'school_recess', weekdayMin: 60, weekendMin: 0, shares: { light: 0.3, moderate: 0.3, vigorous: 0.2 } });

function build() {
  const sessions = [
    session({ date: MON, startTime: '17:30', activityTypeId: activityTypeId('football_training'), durationMin: 90, minutes: { light: 30, moderate: 40, vigorous: 20 }, muscle: true }),
    session({ date: MON, startTime: '08:00', activityTypeId: activityTypeId('kick_scooter'), durationMin: 30, minutes: { light: 10, moderate: 20, vigorous: 0 } }),
    session({ date: '2026-11-04', activityTypeId: activityTypeId('kick_scooter'), durationMin: 20, minutes: { light: 10, moderate: 10, vigorous: 0 } }),
    session({ date: '2026-11-07', activityTypeId: activityTypeId('trampoline'), durationMin: 60, minutes: { light: 18, moderate: 18, vigorous: 18 }, label: 'Superpark' }),
  ];
  const input: ReportInput = {
    profile: profile({ createdAt: '2026-09-01T10:00:00.000Z', birthYear: 2016, birthMonth: 5 }),
    period: weekPeriod(MON),
    sessions,
    estimates: [recess],
    flags: [sick],
    planned: [],
    types,
    settings: { ...DEFAULT_SETTINGS },
    today: '2026-11-14',
  };
  const r = periodReport(input);
  return { r, w: weekReport({ totals: r.allDays, hours: r.hours.days, sessions, types, flags: [sick], group: r.group.group }) };
}

describe('viikkoraportti', () => {
  it('päivän rivit (kerrat + arkiliikunta) summautuvat päivän kestoon ja tehoihin', () => {
    const { w } = build();
    for (const d of w.days) {
      const dur = d.entries.reduce((a, e) => a + e.durationMin, 0) + (d.arki?.durationMin ?? 0);
      const mvpa = d.entries.reduce((a, e) => a + e.mvpa, 0) + (d.arki?.mvpa ?? 0);
      expect(dur).toBe(d.durationMin);
      expect(mvpa).toBeCloseTo(d.mvpa, 6);
    }
    const mon = w.days[0];
    expect(mon.entries.map((e) => e.time)).toEqual(['08:00', '17:30']); // kellonajan mukaan
    expect(mon.arki?.durationMin).toBe(60);
    expect(mon.entries[1].muscle).toBe(true);
  });

  it('sairaspäivänä ei perusarviota eikä tavoitetta; yhteenveto vastaa viikon tunteja', () => {
    const { r, w } = build();
    const wed = w.days[2];
    expect(wed.flag).toBe('sick');
    expect(wed.arki).toBeUndefined();
    expect(wed.durationMin).toBe(20);
    expect(wed.goalMet).toBe(false);
    expect(w.summary.evaluatedDays).toBe(6);
    expect(w.summary.totalMin).toBe(r.hours.actualMin);
    expect(w.summary.sessionCount).toBe(4);
    expect(w.summary.mvpa).toBeCloseTo(w.days.reduce((a, d) => a + d.mvpa, 0), 6);
    expect(w.summary.muscleDays).toBe(1);
    expect(w.summary.byType[0].durationMin).toBe(90);
  });

  it('kerran oma nimi tarkenteena ja lyhyt nimi', () => {
    const { w } = build();
    expect(w.days[5].entries[0].detail).toBe('Superpark');
    expect(shortName({ label: 'Oma' })).toBe('Oma');
    expect(shortName({}, { name: 'Jalkapallo – treeni' })).toBe('Treeni');
  });

  it('jalkapallon tulos lyhyesti', () => {
    const s = session({ date: MON, minutes: { light: 0, moderate: 0, vigorous: 0 }, playedMin: 30 });
    const t = { ...types.get(activityTypeId('football_game'))! };
    expect(footballBrief(s, t, { sessionId: s.id, goalsFor: 3, goalsAgainst: 1, opponent: 'FC Testi', playerGoals: 2 } as never)).toBe('3–1 V · FC Testi · pelasi 30 min · ⚽ 2');
  });
});

import { describe, expect, it } from 'vitest';
import { buildStory } from './story';
import type { PeriodReport } from '../../domain/report';
import type { ActivityType, DayTotals, FootballDetails, Session, Team } from '../../domain/types';

const day = (date: string, total: number, mvpa: number) => ({ date, movingCombined: total, mvpaCombined: mvpa }) as DayTotals;
const type = (id: string, name: string, extra: Partial<ActivityType> = {}) => ({ id, name, icon: '⚽', ...extra }) as ActivityType;
const ses = (id: string, typeId: string, date: string, min: number) => ({ id, activityTypeId: typeId, date, durationMin: min, profileId: 'p' }) as Session;

describe('kauden kooste', () => {
  it('kortit: kansi, liikunta, lajit, paras viikko, jalkapallo ja harjoitellut asiat', () => {
    const types = new Map([
      ['t:football_training', type('t:football_training', 'Jalkapallo – treeni', { sport: 'football', footballKind: 'training' })],
      ['t:swim', type('t:swim', 'Uinti')],
    ]);
    const sessions = [ses('a', 't:football_training', '2026-11-02', 90), ses('b', 't:swim', '2026-11-03', 45), ses('c', 't:football_training', '2026-11-10', 90)];
    const report = { days: [day('2026-11-02', 120, 60), day('2026-11-03', 60, 30), day('2026-11-10', 300, 150)] } as PeriodReport;
    const details = new Map<string, FootballDetails>([['a', { sessionId: 'a', attendance: 'full', focusTags: ['passing'], enjoyment: 3 } as FootballDetails]]);
    const slides = buildStory({ name: 'Aino', seasonLabel: 'Syksy 2026', report, sessions, types, footballDetails: details });
    expect(slides.map((s) => s.id)).toEqual(['cover', 'total', 'types', 'best', 'football', 'focus', 'outro']);
    expect(slides[1].big).toBe('8,0'); // 480 min
    expect(slides[2].bars![0]).toMatchObject({ label: 'Jalkapallo – treeni', value: '3,0 h', pct: 1 });
    expect(slides[3]).toMatchObject({ title: 'Viikko 46', big: '5,0' });
    expect(slides[4].stats![0]).toEqual({ label: 'Treenit', value: '2' });
    expect(slides[5].lines[0]).toMatch(/viihtyi/i);
    // Jalkapallo pois käytöstä: ei jalkapallo- eikä harjoitellut asiat -korttia; lajit ja liikunta säilyvät.
    const off = buildStory({ name: 'Aino', seasonLabel: 'Syksy 2026', report, sessions, types, footballDetails: details, football: false });
    expect(off.map((s) => s.id)).toEqual(['cover', 'total', 'types', 'best', 'outro']);
  });

  it('joukkueittain-kortti, kun treenejä on kahdessa joukkueessa tai ryhmässä', () => {
    const types = new Map([['t:football_training', type('t:football_training', 'Jalkapallo – treeni', { sport: 'football', footballKind: 'training' })]]);
    const sessions = [
      { ...ses('a', 't:football_training', '2026-11-02', 90), teamId: 'A' },
      { ...ses('b', 't:football_training', '2026-11-03', 60), teamId: 'A' },
      { ...ses('c', 't:football_training', '2026-11-04', 60), teamId: 'G' },
    ];
    const teams = [
      { id: 'A', profileId: 'p', name: 'FC Testi · Sininen · 2016' },
      { id: 'G', profileId: 'p', name: 'Pienryhmä', kind: 'group' as const },
    ] as Team[];
    const report = { days: [day('2026-11-02', 90, 60)] } as PeriodReport;
    const slides = buildStory({ name: 'Aino', seasonLabel: 'Syksy 2026', report, sessions, types, footballDetails: new Map(), teams });
    const t = slides.find((s) => s.id === 'teams')!;
    expect(t.lines).toEqual(['1 joukkue ja 1 treeniryhmä']);
    expect(t.bars!.map((b) => [b.label, b.value])).toEqual([
      ['Sininen 2016', '2 treeniä'],
      ['Pienryhmä', '1 treeni'],
    ]);
    // Yksi joukkue: ei korttia.
    expect(buildStory({ name: 'Aino', seasonLabel: 'Syksy 2026', report, sessions, types, footballDetails: new Map(), teams: teams.slice(0, 1) }).some((s) => s.id === 'teams')).toBe(false);
  });

  it('tauot ja vaihtelu: päälajin osuus ja pisin tauko (lapsella)', () => {
    const types = new Map([
      ['t:ft', type('t:ft', 'Jalkapallo – treeni', { sport: 'football', footballKind: 'training', category: 'hobby' })],
      ['t:gym', type('t:gym', 'Telinevoimistelu', { category: 'hobby' })],
    ]);
    const dates = ['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-20', '2026-09-22'];
    const sessions = [...dates.map((d, k) => ses(`f${k}`, 't:ft', d, 90)), ses('g', 't:gym', '2026-09-10', 60)];
    const report = {
      days: [day('2026-09-01', 90, 40)],
      period: { kind: 'season', start: '2026-09-01', end: '2026-09-30' },
      trackingStart: '2026-08-01',
      group: { group: 'school_age', over64: false },
    } as PeriodReport;
    const slides = buildStory({ name: 'Aino', seasonLabel: 'Syksy 2026', report, sessions, types, footballDetails: new Map(), football: false });
    const b = slides.find((s) => s.id === 'balance')!;
    expect(b.title).toBe('Pisin tauko 14 päivää');
    expect(b.lines[0]).toBe('Jalkapallo: 88 % ohjatun urheilun ajasta');
    expect(b.lines[1]).toBe('Pisin tauko lajista 6.9.–19.9.');
    expect(b.stats).toContainEqual({ label: 'Ohjattuja lajeja', value: '2' });
    expect(buildStory({ name: 'Aino', seasonLabel: 'Syksy 2026', report, sessions, types, footballDetails: new Map(), load: false }).some((s) => s.id === 'balance')).toBe(false);
  });

  it('ilman kirjauksia vain kansi ja lopetus', () => {
    const slides = buildStory({ name: 'Aino', seasonLabel: 'Syksy 2026', report: { days: [] } as unknown as PeriodReport, sessions: [], types: new Map(), footballDetails: new Map() });
    expect(slides.map((s) => s.id)).toEqual(['cover', 'outro']);
  });
});

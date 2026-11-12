import { describe, expect, it } from 'vitest';
import { buildStory } from './story';
import type { PeriodReport } from '../../domain/report';
import type { ActivityType, DayTotals, FootballDetails, Session } from '../../domain/types';

const day = (date: string, total: number, mvpa: number) => ({ date, totalCombined: total, mvpaCombined: mvpa }) as DayTotals;
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
  });

  it('ilman kirjauksia vain kansi ja lopetus', () => {
    const slides = buildStory({ name: 'Aino', seasonLabel: 'Syksy 2026', report: { days: [] } as unknown as PeriodReport, sessions: [], types: new Map(), footballDetails: new Map() });
    expect(slides.map((s) => s.id)).toEqual(['cover', 'outro']);
  });
});

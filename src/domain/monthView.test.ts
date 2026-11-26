// Viikko-näkymän kuukausikalenteri (27.11.2026): päivän rivit kerroista, suunnitelmista ja merkinnöistä.
import { describe, expect, it } from 'vitest';
import { mergeMonthItems, monthItems } from './monthView';
import type { ActivityType, CalendarNote, Fixture, PlannedSession, Session } from './types';

const sync = { updatedAt: 't', updatedBy: 'd' };
const types = new Map<string, ActivityType>([
  ['t:swim', { id: 't:swim', name: 'Uinti', category: 'sport' } as unknown as ActivityType],
  ['t:football_game', { id: 't:football_game', name: 'Jalkapallo – peli', category: 'sport', sport: 'football' } as unknown as ActivityType],
]);
const session = (o: Partial<Session>): Session => ({ id: 's', profileId: 'p', date: '2026-11-21', activityTypeId: 't:swim', durationMin: 45, createdAt: 't', ...sync, ...o }) as Session;
const plan = (o: Partial<PlannedSession>): PlannedSession => ({ id: 'pl', profileId: 'p', date: '2026-11-21', activityTypeId: 't:swim', durationMin: 60, status: 'open', ...sync, ...o }) as PlannedSession;

describe('kuukauden rivit', () => {
  it('kerrat, avoimet ja väliin jääneet suunnitelmat, pelin vastustaja ja merkinnät aikajärjestyksessä', () => {
    const notes: CalendarNote[] = [{ id: 'n', date: '2026-11-21', title: 'Mummolaan', createdAt: 't', ...sync }];
    const fixtures = new Map<string, Fixture>([['g', { plannedSessionId: 'g', opponent: 'HJK · Musta · 2018', ...sync }]]);
    const items = monthItems({
      sessions: [session({ id: 's1', startTime: '17:00', label: 'Uintikoulu' })],
      plans: [
        plan({ id: 'g', activityTypeId: 't:football_game', startTime: '10:00' }),
        plan({ id: 'x', status: 'skipped', startTime: '18:30' }),
        plan({ id: 'd', status: 'done', sessionId: 's1' }),
      ],
      notes,
      fixtures,
      types,
    }).get('2026-11-21')!;
    expect(items.map((i) => `${i.kind}:${i.title}`)).toEqual(['note:Mummolaan', 'open:vs HJK Musta', 'done:Uintikoulu', 'skipped:Uinti']);
    expect(items[0].family).toBe(true);
  });
});

describe('perhenäkymä', () => {
  it('rivit profiileittain, koko perheen merkintä kerran', () => {
    const fam: CalendarNote = { id: 'f', date: '2026-11-21', title: 'Mummolaan', startTime: '12:00', createdAt: 't', ...sync };
    const a = monthItems({ sessions: [session({ id: 'a1', startTime: '09:00' })], plans: [], notes: [fam], types, profileId: 'A' });
    const b = monthItems({ sessions: [], plans: [plan({ id: 'b1', profileId: 'B', startTime: '10:00' })], notes: [fam], types, profileId: 'B' });
    const day = mergeMonthItems([a, b]).get('2026-11-21')!;
    expect(day.map((i) => `${i.profileId ?? '-'}:${i.key}`)).toEqual(['A:a1', 'B:b1', '-:f']);
  });
});

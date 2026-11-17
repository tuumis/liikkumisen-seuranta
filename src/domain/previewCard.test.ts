import { describe, expect, it } from 'vitest';
import { availableBoxes, previewCard, previewKicker, previewTimeBoxes } from './previewCard';
import type { Fixture } from './types';

const fx = (f: Partial<Fixture>): Fixture => ({ plannedSessionId: 'p1', updatedAt: '2026-11-14T10:00:00.000Z', updatedBy: 'd', ...f }) as Fixture;

describe('otteluennakko', () => {
  it('ottelu: aloitus, paikalla 30 min ennen, paikka ja pelimuoto joukkueelta', () => {
    const c = previewCard({ activityTypeId: 't:football_game', date: '2026-11-21', startTime: '14:00' }, fx({ opponent: ' HJK  · Valkoinen ', location: 'Tapiolan urheilupuisto', level: 'elite' }), { name: 'FC Honka · Musta · 2016', format: '8v8' });
    expect(c).toMatchObject({ kind: 'game', kickoff: '14:00', arrival: '13:30', location: 'Tapiolan urheilupuisto', format: '8v8', team: 'FC Honka · Musta · 2016', games: [{ opponent: 'HJK · Valkoinen', time: '14:00' }] });
    expect(previewKicker(c)).toBe('Otteluennakko · Elite · 8v8');
  });

  it('ottelu ilman kellonaikaa ja vastustajaa', () => {
    const c = previewCard({ activityTypeId: 't:football_game', date: '2026-11-21' }, undefined);
    expect(c.kickoff).toBeUndefined();
    expect(c.arrival).toBeUndefined();
    expect(c.games).toEqual([{}]);
  });

  it('turnaus: otteluohjelma kellonajan mukaan, yhteinen paikka kerran ja paikalla ennen 1. peliä', () => {
    const c = previewCard(
      { activityTypeId: 't:football_tournament', date: '2026-11-22', startTime: '08:30' },
      fx({ eventName: 'Syyscup', games: [{ opponent: 'B', time: '11:00', location: 'Kenttä 2' }, { opponent: 'A', time: '09:00', location: 'Kenttä 2' }, { opponent: 'C' }] }),
    );
    expect(c).toMatchObject({ kind: 'tournament', eventName: 'Syyscup', kickoff: '09:00', arrival: '08:30', location: 'Kenttä 2' });
    expect(c.games).toEqual([{ opponent: 'A', time: '09:00' }, { opponent: 'B', time: '11:00' }, { opponent: 'C' }]);
    expect(previewKicker(c)).toBe('Turnausennakko');
  });

  it('turnaus: eri paikat näkyvät pelirivillä; ilman ohjelmaa pelien määrä tyhjinä riveinä', () => {
    const c = previewCard({ activityTypeId: 't:football_tournament', date: '2026-11-22' }, fx({ games: [{ opponent: 'A', location: 'K1' }, { opponent: 'B', location: 'K2' }] }));
    expect(c.location).toBeUndefined();
    expect(c.games.map((g) => g.location)).toEqual(['K1', 'K2']);
    const d = previewCard({ activityTypeId: 't:football_tournament', date: '2026-11-22', startTime: '09:00' }, fx({ gamesCount: 3 }));
    expect(d.games).toHaveLength(3);
    expect(d.arrival).toBe('09:00');
  });
});

describe('ennakon laatikot ja kommentti (17.11.2026)', () => {
  it('ottelu: Paikalla ja Peli alkaa, piilotus poistaa laatikon; kommentti siistitään', () => {
    const c = previewCard({ activityTypeId: 't:football_game', date: '2026-11-21', startTime: '14:00' }, fx({ location: 'Tali', previewNote: '  Tervetuloa   kannustamaan! ' }));
    expect(c.comment).toBe('Tervetuloa kannustamaan!');
    expect(availableBoxes(c)).toEqual(['arrival', 'kickoff', 'place']);
    expect(previewTimeBoxes(c)).toEqual([['Paikalla', '13:30'], ['Peli alkaa', '14:00']]);
    expect(previewTimeBoxes(c, new Set(['arrival']))).toEqual([['Peli alkaa', '14:00']]);
  });

  it('turnaus: 1. peli ja Pelit; tuntemattomat laatikot puuttuvat', () => {
    const c = previewCard({ activityTypeId: 't:football_tournament', date: '2026-11-22' }, fx({ games: [{ opponent: 'A', time: '09:00' }, { opponent: 'B' }] }));
    expect(availableBoxes(c)).toEqual(['arrival', 'kickoff', 'games']);
    expect(previewTimeBoxes(c, new Set(['kickoff']))).toEqual([['Paikalla', '08:30'], ['Pelit', '2']]);
    const empty = previewCard({ activityTypeId: 't:football_game', date: '2026-11-21' }, undefined);
    expect(availableBoxes(empty)).toEqual([]);
    expect(empty.comment).toBeUndefined();
  });
});

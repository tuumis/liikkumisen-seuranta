import { describe, expect, it } from 'vitest';
import { highlights, ratingVerdict } from './highlights';
import { session } from './test-helpers';
import type { FootballDetails } from './types';

const M = { light: 10, moderate: 20, vigorous: 5 };
const fd = (sessionId: string, over: Partial<FootballDetails> = {}): FootballDetails => ({
  sessionId,
  attendance: 'full',
  focusTags: [],
  updatedAt: '2026-11-01T00:00:00.000Z',
  updatedBy: 'd',
  ...over,
});

describe('jakson kohokohdat', () => {
  it('kerää kommentit (kerta, päiväkirja, turnauksen pelit) uusin ensin ja rajaa jaksoon', () => {
    const a = session({ id: 'a', date: '2026-11-09', minutes: M, note: 'Hyvä fiilis' });
    const b = session({ id: 'b', date: '2026-11-11', minutes: M });
    const c = session({ id: 'c', date: '2026-11-01', minutes: M, note: 'ennen jaksoa' });
    const del = session({ id: 'x', date: '2026-11-10', minutes: M, note: 'poistettu', deletedAt: '2026-11-10T00:00:00.000Z' });
    const details = new Map([
      ['a', fd('a', { ratingNote: 'Syötöt kulkivat', parentRating: 4, enjoyment: 3, focusTags: ['passing'] })],
      ['b', fd('b', { parentRating: 3, enjoyment: 2, focusTags: ['passing', 'shooting'], games: [{ opponent: 'HJK', note: 'Maali!' }, {}], playerGoals: 2 })],
    ]);
    const h = highlights([a, b, c, del], details, '2026-11-09', '2026-11-15');
    expect(h.sessions).toBe(2);
    expect(h.comments.map((x) => [x.date, x.source, x.text])).toEqual([
      ['2026-11-11', 'game', 'Maali!'],
      ['2026-11-09', 'session', 'Hyvä fiilis'],
      ['2026-11-09', 'diary', 'Syötöt kulkivat'],
    ]);
    expect(h.comments[0]).toMatchObject({ opponent: 'HJK', gameIndex: 1 });
    expect(h.rating).toEqual({ avg: 3.5, count: 2, dist: [0, 0, 1, 1, 0] });
    expect(h.enjoyment).toEqual({ avg: 2.5, count: 2 });
    expect(h.verdict).toBe('above');
    expect(h.topTags).toEqual([
      { tag: 'passing', count: 2 },
      { tag: 'shooting', count: 1 },
    ]);
    expect(h.playerGoals).toBe(2);
  });

  it('yleisarvio: ≥ 3,5 parempi, ≤ 2,5 heikompi, muuten tavallinen; ilman arvioita ei arviota', () => {
    expect(ratingVerdict(null)).toBeNull();
    expect(ratingVerdict(3.5)).toBe('above');
    expect(ratingVerdict(3.4)).toBe('usual');
    expect(ratingVerdict(2.6)).toBe('usual');
    expect(ratingVerdict(2.5)).toBe('below');
    expect(highlights([], new Map(), '2026-11-09', '2026-11-15')).toMatchObject({ sessions: 0, comments: [], verdict: null, rating: { avg: null, count: 0 } });
  });
});

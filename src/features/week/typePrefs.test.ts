// Suosikkilajit ja lihas/luusto-oletukset (24.11.2026).
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BUILT_IN_ACTIVITY_TYPES } from '../../seed/activityTypes';
import { differsFromDefault } from './StrengthFields';
import { favoritesFirst, typeOptionLabel, visibleTypes } from './useLoggableTypes';

const types = BUILT_IN_ACTIVITY_TYPES.slice(0, 5).map((t) => ({ ...t }));

describe('suosikkilajit', () => {
  it('suosikit ensin, muuten järjestys säilyy; piilotetut pois', () => {
    const list = types.map((t, i) => (i === 3 ? { ...t, favorite: true } : t));
    expect(favoritesFirst(list).map((t) => t.id)).toEqual([list[3], list[0], list[1], list[2], list[4]].map((t) => t.id));
    expect(visibleTypes(list, new Set([list[0].id]))!.map((t) => t.id)).toEqual([list[3], list[1], list[2], list[4]].map((t) => t.id));
    expect(typeOptionLabel(list[3])).toMatch(/★$/);
    expect(typeOptionLabel(list[0])).not.toMatch(/★/);
  });

  it('lihas/luusto poikkeaa lajin oletuksesta', () => {
    const t = { ...types[0], muscleDefault: 'ask' as const, boneDefault: 'yes' as const };
    expect(differsFromDefault(t, false, true)).toBe(false);
    expect(differsFromDefault(t, true, true)).toBe(true);
    expect(differsFromDefault({ ...t, boneDefault: 'no' }, false, false)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { intensityNoteFor, INTENSITY_NOTES, sharesDiffer } from './intensityNotes';
import { BUILT_IN_ACTIVITY_TYPES } from '../seed/activityTypes';

describe('tehon selitykset (17.11.2026)', () => {
  it('jokaisella sisäänrakennetulla lajilla on perustelu, eikä ylimääräisiä ole', () => {
    for (const t of BUILT_IN_ACTIVITY_TYPES) expect(intensityNoteFor(t), t.key).toBeTruthy();
    expect(Object.keys(INTENSITY_NOTES).sort()).toEqual(BUILT_IN_ACTIVITY_TYPES.map((t) => t.key!).sort());
  });

  it('omalle lajille ei perustelua; muutettu profiili tunnistetaan', () => {
    expect(intensityNoteFor({ key: 'football_training', builtIn: false })).toBeUndefined();
    expect(sharesDiffer({ light: 0.35, moderate: 0.3, vigorous: 0.15 }, { light: 0.35, moderate: 0.3, vigorous: 0.15 })).toBe(false);
    expect(sharesDiffer({ light: 0.35, moderate: 0.3, vigorous: 0.15 }, { light: 0.3, moderate: 0.35, vigorous: 0.15 })).toBe(true);
  });
});

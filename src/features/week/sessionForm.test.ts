import { describe, expect, it } from 'vitest';
import { dateSchema, durationSchema, manualSchema, optionalMinutes, showStrength } from './sessionForm';

describe('kerran lomakevalidointi', () => {
  it('valinnaiset minuutit', () => {
    expect(optionalMinutes.parse('')).toBeUndefined();
    expect(optionalMinutes.parse('  ')).toBeUndefined();
    expect(optionalMinutes.parse('40')).toBe(40);
    expect(optionalMinutes.safeParse('abc').success).toBe(false);
    expect(optionalMinutes.safeParse('-1').success).toBe(false);
    expect(optionalMinutes.safeParse('2.5').success).toBe(false);
  });

  it('kesto', () => {
    expect(durationSchema.parse('75')).toBe(75);
    expect(durationSchema.parse(90)).toBe(90);
    expect(durationSchema.safeParse('0').success).toBe(false);
    expect(durationSchema.safeParse('').success).toBe(false);
    expect(durationSchema.safeParse('1441').success).toBe(false);
  });

  it('päivä ei tulevaisuudessa', () => {
    const s = dateSchema('2026-11-11');
    expect(s.safeParse('2026-11-11').success).toBe(true);
    expect(s.safeParse('2026-11-12').success).toBe(false);
    expect(s.safeParse('2026-02-30').success).toBe(false);
  });

  it('käsin syötetyt minuutit', () => {
    expect(manualSchema.parse({ light: '5', moderate: '40', vigorous: '0' })).toEqual({ light: 5, moderate: 40, vigorous: 0 });
    expect(manualSchema.safeParse({ light: '', moderate: '1', vigorous: '1' }).success).toBe(false);
  });

  it('lihas/luusto: no piilotetaan, ellei valinta ole päällä', () => {
    expect(showStrength('yes')).toBe(true);
    expect(showStrength('ask')).toBe(true);
    expect(showStrength('no')).toBe(false);
    expect(showStrength('no', true)).toBe(true);
  });
});

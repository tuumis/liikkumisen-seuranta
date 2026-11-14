import { describe, expect, it } from 'vitest';
import { COUNTRIES, countryOf } from './flags';

describe('liput', () => {
  it('Suomi ensin, koodit yksilöllisiä ja muodot 30 × 20 -ruudukossa', () => {
    expect(COUNTRIES[0].code).toBe('FI');
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(40);
    for (const c of COUNTRIES) {
      expect(c.shapes.length).toBeGreaterThan(0);
      for (const s of c.shapes) {
        expect(s.c).toMatch(/^#[0-9a-f]{6}$/);
        const xs = 'r' in s ? [s.r[0], s.r[0] + s.r[2]] : 'o' in s ? [s.o[0]] : s.p.filter((_, i) => i % 2 === 0);
        for (const x of xs) {
          expect(x).toBeGreaterThanOrEqual(-0.01);
          expect(x).toBeLessThanOrEqual(30.1);
        }
      }
    }
    expect(countryOf('GB-SCT')?.name).toBe('Skotlanti');
    expect(countryOf('XX')).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { companionDuration } from './Companions';

describe('mukana myös: kesto profiileittain', () => {
  const c = (duration: string) => ({ profileId: 'p2', duration, effort: 0 as const, muscle: false, bone: false });
  it('tyhjä = pääkerran kesto; virheellinen = null', () => {
    expect(companionDuration(c(''), 90)).toBe(90);
    expect(companionDuration(c(' 45 '), 90)).toBe(45);
    expect(companionDuration(c('0'), 90)).toBeNull();
    expect(companionDuration(c('4,5'), 90)).toBeNull();
  });
});

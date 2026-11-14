import { describe, expect, it } from 'vitest';
import { isLightColor, mix, resolveShareColor, SHARE_COLORS } from './shareColors';

describe('jakokuvien värit', () => {
  it('teema, oma väri tai sovelluksen värit', () => {
    expect(resolveShareColor(undefined)).toBeUndefined();
    expect(resolveShareColor('navy')?.base).toBe('#1d4ed8');
    expect(resolveShareColor('#AABBCC')).toMatchObject({ base: '#aabbcc', label: 'Oma väri' });
    expect(resolveShareColor('bogus')).toBeUndefined();
    expect(new Set(SHARE_COLORS.map((c) => c.id)).size).toBe(SHARE_COLORS.length);
  });
  it('vaalea väri tunnistetaan (tumma teksti) ja sekoitus toimii', () => {
    expect(isLightColor('#facc15')).toBe(true);
    expect(isLightColor('#1d4ed8')).toBe(false);
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

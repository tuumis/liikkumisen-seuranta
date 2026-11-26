import { describe, expect, it } from 'vitest';
import { pickShown, toggleShown } from './familyLimit';

const all = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('perhenäkymän profiilimäärä', () => {
  it('rajan alla kaikki', () => {
    expect(pickShown(['a', 'b'], 'b', ['a'], 4)).toEqual(['a', 'b']);
  });
  it('oletuksena ensimmäiset, valittu aina mukana', () => {
    expect(pickShown(all, 'a', null, 4)).toEqual(['a', 'b', 'c', 'd']);
    expect(pickShown(all, 'f', null, 4)).toEqual(['a', 'b', 'c', 'f']);
  });
  it('tallennettu valinta profiilien järjestyksessä; poistetut pois, valittu lisätään ja ylimääräiset karsitaan', () => {
    expect(pickShown(all, 'b', ['e', 'b', 'x'], 4)).toEqual(['b', 'e']);
    expect(pickShown(all, 'f', ['a', 'b', 'c', 'd'], 4)).toEqual(['a', 'b', 'c', 'f']);
  });
  it('muutos: ei valitun poistoa, ei rajan ylitystä', () => {
    expect(toggleShown(['a', 'b'], 'b', 'a', 2)).toEqual(['a']);
    expect(toggleShown(['a', 'b'], 'a', 'a', 2)).toEqual(['a', 'b']);
    expect(toggleShown(['a', 'b'], 'c', 'a', 2)).toEqual(['a', 'b']);
    expect(toggleShown(['a'], 'c', 'a', 2)).toEqual(['a', 'c']);
  });
});

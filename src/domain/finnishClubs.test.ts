import { describe, expect, it } from 'vitest';
import { clubLabel, findFinnishClub, finnishClubs, homeOf, rankedFinnishClubs } from './finnishClubs';

describe('suomalaisten seurojen luettelo (17.11.2026)', () => {
  it('jäsentyy: lyhenne nimenä, virallinen nimi selitteenä', () => {
    const all = finnishClubs();
    expect(all.length).toBeGreaterThan(900);
    expect(all.every((c) => c.name && c.city && 'ELIPA'.includes(c.area))).toBe(true);
    const kups = findFinnishClub('kups')!;
    expect(kups).toMatchObject({ name: 'KuPS', fullName: 'Kuopion Palloseura', city: 'Kuopio', area: 'I', juniors: true });
    expect(clubLabel(kups)).toBe('Kuopion Palloseura · Kuopio');
    expect(findFinnishClub('Kuopion Palloseura')).toBe(kups);
    // Sama nimi kirjainkoolla eroteltuna ei tuota turhaa selitettä.
    expect(findFinnishClub('FC Lahti')).toMatchObject({ name: 'FC Lahti', city: 'Lahti', area: 'E' });
    expect(findFinnishClub('FC Lahti')!.fullName).toBeUndefined();
    expect(findFinnishClub('Ei tällaista seuraa')).toBeUndefined();
  });

  it('järjestys: oma kunta, oma alue, sitten muut; tutut pois', () => {
    const home = homeOf(['FC Lahti']);
    expect([...home.cities]).toEqual(['Lahti']);
    const ranked = rankedFinnishClubs(home, new Set(['fc lahti']));
    expect(ranked.some((c) => c.name === 'FC Lahti')).toBe(false);
    const firstOther = ranked.findIndex((c) => c.city !== 'Lahti');
    expect(firstOther).toBeGreaterThan(0);
    expect(ranked.slice(0, firstOther).every((c) => c.city === 'Lahti')).toBe(true);
    const firstFar = ranked.findIndex((c) => c.area !== 'E');
    expect(ranked.slice(firstOther, firstFar).every((c) => c.area === 'E')).toBe(true);
    expect(ranked).toHaveLength(finnishClubs().length - 1);
  });
});

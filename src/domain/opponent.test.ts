import { describe, expect, it } from 'vitest';
import { clubIdOf, formatTeamName, parseTeamName, squadKey } from './opponent';

describe('joukkueen nimi osina', () => {
  it('jäsentää vanhat muodot', () => {
    expect(parseTeamName('FC Honka / Musta')).toEqual({ club: 'FC Honka', group: 'Musta' });
    expect(parseTeamName('FC Honka / Musta / 2018')).toEqual({ club: 'FC Honka', group: 'Musta', age: '2018' });
    expect(parseTeamName('FC Honka · 2018')).toEqual({ club: 'FC Honka', age: '2018' });
    expect(parseTeamName('FC Lahti P2016')).toEqual({ club: 'FC Lahti', age: 'P2016' });
    expect(parseTeamName('P2016 Sininen')).toEqual({ club: 'Sininen', age: 'P2016' });
    expect(parseTeamName('HJK')).toEqual({ club: 'HJK' });
    expect(parseTeamName('  ')).toEqual({ club: '' });
    expect(parseTeamName('2018')).toEqual({ club: '2018' });
  });

  it('muotoilu ja jäsennys ovat toistensa käänteiset', () => {
    const p = { club: 'FC Honka', group: 'Musta', age: 'T2017' };
    expect(formatTeamName(p)).toBe('FC Honka · Musta · T2017');
    expect(parseTeamName(formatTeamName(p))).toEqual(p);
    expect(formatTeamName({ club: 'HJK', group: ' ', age: '' })).toBe('HJK');
  });

  it('seuran tunniste ei riipu kirjainkoosta', () => {
    expect(clubIdOf('FC  Honka')).toBe(clubIdOf('fc honka'));
    expect(squadKey(parseTeamName('FC Honka / Musta'))).toBe(squadKey(parseTeamName('fc honka · musta')));
  });
});

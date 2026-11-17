import { describe, expect, it } from 'vitest';
import { applyTeamDetails, hasTeamDetails } from './shareNames';

const card = (team: string | undefined, ...opponents: (string | undefined)[]) => ({ team, games: opponents.map((opponent) => ({ opponent, time: '10:00' })) });

describe('jakokuvan joukkuenimet', () => {
  it('kaikki näkyvissä: kortti sellaisenaan', () => {
    const c = card('FC Lahti · Valkoinen · 2018', 'HJK · Musta · 2018');
    expect(applyTeamDetails(c, { team: true, opponents: true })).toBe(c);
  });

  it('oma joukkue ja vastustajat valitaan erikseen', () => {
    const c = card('FC Lahti · Valkoinen · 2018', 'HJK · Musta · 2018', 'PK-35 · P2018');
    expect(applyTeamDetails(c, { team: false, opponents: true })).toMatchObject({ team: 'FC Lahti', games: [{ opponent: 'HJK · Musta · 2018' }, { opponent: 'PK-35 · P2018' }] });
    const o = applyTeamDetails(c, { team: true, opponents: false });
    expect(o.team).toBe('FC Lahti · Valkoinen · 2018');
    expect(o.games.map((g) => g.opponent)).toEqual(['HJK', 'PK-35']);
    expect(o.games[0].time).toBe('10:00');
  });

  it('sama seura molemmin puolin: ryhmä jää erottamaan, ikäluokka piiloon', () => {
    const c = card('HJK · Valkoinen · 2016', 'HJK · Musta · 2016', 'KäPa · 2016');
    const o = applyTeamDetails(c, { team: false, opponents: false });
    expect(o.team).toBe('HJK · Valkoinen');
    expect(o.games.map((g) => g.opponent)).toEqual(['HJK · Musta', 'KäPa']);
  });

  it('nimet ilman ryhmää ja ikäluokkaa sekä puuttuvat vastustajat pysyvät', () => {
    const c = card('Ilves', undefined, 'TPS');
    expect(applyTeamDetails(c, { team: false, opponents: false })).toEqual(c);
    expect(hasTeamDetails('Ilves')).toBe(false);
    expect(hasTeamDetails('FC Lahti 2018')).toBe(true);
    expect(hasTeamDetails('FC Honka / Musta')).toBe(true);
    expect(hasTeamDetails(undefined)).toBe(false);
  });
});

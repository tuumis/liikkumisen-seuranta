import { describe, expect, it } from 'vitest';
import { checkInvite, INVITE_HASHES, inviteFromHash, inviteHash, normalizeInvite, stripInvite } from './invite';

// Oikeaa koodia ei kirjoiteta testeihin (repo on julkinen); testit käyttävät omaa koodiaan.
describe('kutsukoodi', () => {
  it('normalisointi: kirjainkoko, väliviivat, välit ja ä/ö', () => {
    expect(normalizeInvite(' Testi-Säde-07 ')).toBe('testisade07');
    expect(normalizeInvite('TESTI SADE 07')).toBe('testisade07');
    expect(normalizeInvite('Söö')).toBe('soo');
  });

  it('koodi kelpaa eri kirjoitusasuissa, väärä ja tyhjä eivät', async () => {
    const hashes = [await inviteHash('Testi-Säde-07')];
    expect(await checkInvite('testi sade 07', hashes)).toBe(true);
    expect(await checkInvite('TESTI-SÄDE-07', hashes)).toBe(true);
    expect(await checkInvite('testi-sade-08', hashes)).toBe(false);
    expect(await checkInvite('  -- ', hashes)).toBe(false);
  });

  it('voimassa olevat tiivisteet ovat SHA-256-heksoja', async () => {
    expect(INVITE_HASHES.length).toBeGreaterThan(0);
    for (const h of INVITE_HASHES) expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await checkInvite('testi-sade-07')).toBe(false);
  });

  it('kutsulinkki: koodi #-osasta ja sen poisto', () => {
    expect(inviteFromHash('#kutsu=Testi-S%C3%A4de-07')).toBe('Testi-Säde-07');
    expect(inviteFromHash('#x=1&kutsu=abc')).toBe('abc');
    expect(inviteFromHash('#muu')).toBeUndefined();
    expect(inviteFromHash('')).toBeUndefined();
    expect(stripInvite('#kutsu=abc')).toBe('');
    expect(stripInvite('#x=1&kutsu=abc')).toBe('#x=1');
    expect(stripInvite('')).toBe('');
  });
});

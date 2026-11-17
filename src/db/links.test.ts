// Pelin ja turnauksen linkki (17.11.2026).
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from './schema';
import { createRepositories, type Repositories } from './repositories';
import { linkHost, normalizeLink } from '../domain/link';

let n = 0;
let db: AppDB;
let repo: Repositories;
beforeEach(async () => {
  db = new AppDB(`links-${++n}`);
  repo = createRepositories(db);
  await repo.initialize();
});
afterEach(async () => {
  await db.delete();
});

const DAY = '2026-11-14';

describe('linkin siistiminen', () => {
  it('lisää https:// puuttuessa ja hylkää muut kuin verkko-osoitteet', () => {
    expect(normalizeLink('  ')).toBeUndefined();
    expect(normalizeLink(undefined)).toBeUndefined();
    expect(normalizeLink('tulospalvelu.palloliitto.fi/match/123')).toBe('https://tulospalvelu.palloliitto.fi/match/123');
    expect(normalizeLink('https://www.syyscup.fi/otteluohjelma?sarja=P10')).toBe('https://www.syyscup.fi/otteluohjelma?sarja=P10');
    expect(normalizeLink('http://example.fi')).toBe('http://example.fi/');
    expect(normalizeLink('javascript:alert(1)')).toBeNull();
    expect(normalizeLink('mailto:a@b.fi')).toBeNull();
    expect(normalizeLink('ei linkki')).toBeNull();
    expect(normalizeLink(`https://a.fi/${'x'.repeat(600)}`)).toBeNull();
  });
  it('näyttää palvelimen nimen ilman www-alkua', () => {
    expect(linkHost('https://www.syyscup.fi/ohjelma')).toBe('syyscup.fi');
  });
});

describe('pelin ja turnauksen linkki', () => {
  it('tallentuu kalenteriin ja siirtyy kuittauksessa kirjaukseen; pikakirjaus säilyttää sen', async () => {
    const e = await repo.createFixture('p1', { kind: 'tournament', date: DAY, durationMin: 240, eventName: 'Syyscup', gamesCount: 2, link: 'syyscup.fi/ohjelma' });
    expect(e.fixture?.link).toBe('https://syyscup.fi/ohjelma');
    const a = await repo.recordTournamentGame({ planId: e.plan.id }, 0, { goalsFor: 2, goalsAgainst: 1 }, DAY);
    expect((await repo.getFootballDetails(a.sessionId))!.link).toBe('https://syyscup.fi/ohjelma');
    await repo.recordTournamentGame({ sessionId: a.sessionId }, 1, { goalsFor: 0, goalsAgainst: 0 }, DAY);
    expect((await repo.getFootballDetails(a.sessionId))!.link).toBe('https://syyscup.fi/ohjelma');
  });

  it('pelin linkki: kuittaus kopioi, lomake vaihtaa tai tyhjentää; virheellinen jätetään pois', async () => {
    const e = await repo.createFixture('p1', { kind: 'game', date: DAY, durationMin: 90, opponent: 'PK-35', link: 'https://tulospalvelu.fi/peli/1' });
    const { session } = await repo.confirmPlanned(e.plan.id, DAY);
    expect((await repo.getFootballDetails(session.id))!.link).toBe('https://tulospalvelu.fi/peli/1');
    await repo.saveFootballDetails(session.id, { attendance: 'full', focusTags: [], opponent: 'PK-35', link: 'tulospalvelu.fi/peli/2' });
    expect((await repo.getFootballDetails(session.id))!.link).toBe('https://tulospalvelu.fi/peli/2');
    await repo.saveFootballDetails(session.id, { attendance: 'full', focusTags: [], opponent: 'PK-35', link: '' });
    expect((await repo.getFootballDetails(session.id))!.link).toBeUndefined();

    const bad = await repo.createFixture('p1', { kind: 'game', date: DAY, durationMin: 90, link: 'javascript:alert(1)' });
    expect(bad.fixture?.link).toBeUndefined();
  });
});

// Esimerkkitilan kattavuus (24.11.2026): aineisto syntyy virheettä mistä päivästä tahansa, ja jokaiselle
// ominaisuudelle on esimerkki. Kun sovellukseen tulee uusi tietue tai ominaisuus, lisää sille esimerkki
// seedDemo.ts:ään ja tarkistus tähän; uusi tyhjäksi jäävä taulu kaatuu testiin automaattisesti.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDB } from '../db/schema';
import { createRepositories } from '../db/repositories';
import { activityTypeId } from '../domain/ids';
import { recommendationGroup } from '../domain/groups';
import { seedDemo } from './seedDemo';

const dbs: AppDB[] = [];
let n = 0;
afterEach(async () => {
  while (dbs.length) await dbs.pop()!.delete();
});

async function seeded(today: string) {
  const db = new AppDB(`demo-${++n}`);
  dbs.push(db);
  const repo = createRepositories(db);
  await repo.initialize();
  const ids = await seedDemo(repo, today);
  return { db, repo, ids };
}

const t = (key: string) => activityTypeId(key);

describe('esimerkkitilan aineisto', () => {
  // Maanantai, keskiviikko, lauantai ja sunnuntai sekä vuodenvaihde.
  it.each(['2026-11-23', '2026-11-25', '2026-11-28', '2026-11-29', '2027-01-02'])('syntyy virheettä päivälle %s', async (today) => {
    const { db } = await seeded(today);
    expect(await db.sessions.count()).toBeGreaterThan(60);
  });

  it('jokaisessa taulussa on tietoja', async () => {
    const { db } = await seeded('2026-11-25');
    for (const table of db.tables) expect(await table.count(), table.name).toBeGreaterThan(0);
  });

  it('kattaa ominaisuudet', async () => {
    const today = '2026-11-25';
    const { db, ids } = await seeded(today);
    const profiles = await db.profiles.toArray();
    const sessions = await db.sessions.toArray();
    const plans = await db.plannedSessions.toArray();
    const details = await db.footballDetails.toArray();
    const fixtures = await db.fixtures.toArray();
    const planOf = new Map(plans.map((p) => [p.id, p]));
    const check = (name: string, ok: boolean) => expect(ok, name).toBe(true);

    // Profiilit: koululainen ja alle kouluikäinen, jalkapallo, piilotettu laji.
    check('koululainen', recommendationGroup(profiles.find((p) => p.id === ids.school)!, today) === 'school_age');
    check('alle kouluikäinen', recommendationGroup(profiles.find((p) => p.id === ids.early)!, today) === 'early_years');
    check('jalkapallo päällä', profiles.some((p) => p.football));
    check('piilotettu laji', profiles.some((p) => p.hiddenTypeIds?.length));
    check('suosikkilaji', (await db.activityTypes.toArray()).some((x) => x.favorite));

    // Arkiliikunta, loma ja päivämerkinnät.
    const cats = new Set((await db.estimates.toArray()).map((e) => e.category));
    for (const c of ['daycare', 'school_recess', 'commute', 'self_directed']) check(`arvio ${c}`, cats.has(c as never));
    check('loma', ((await db.settings.get('settings'))?.holidays.length ?? 0) > 0);
    const flags = new Set((await db.dayFlags.toArray()).map((f) => f.reason));
    check('sairauspäivä', flags.has('sick'));
    check('matkapäivä', flags.has('travel'));

    // Viikkorytmi: kuitatut, väliin jääneet syineen, kuittaamattomat ja tulevat.
    check('kuitattu', plans.some((p) => p.status === 'done'));
    for (const r of ['sick', 'cancelled', 'holiday', 'other_commitment']) check(`väliin: ${r}`, plans.some((p) => p.status === 'skipped' && p.skipReason === r));
    check('väliin jäänyt kommentilla', plans.some((p) => p.skipNote));
    check('kuittaamatta', plans.some((p) => p.status === 'open' && p.date < today));
    check('tuleva', plans.some((p) => p.status === 'open' && p.date > today));
    check('kuitattu kovempana', sessions.some((s) => s.plannedSessionId && s.intensityPreset === 'vigorous'));
    check('koululiikunta', sessions.some((s) => s.activityTypeId === t('school_pe')));

    // Kerrat: osat, käsin syötetty teho, ponnistelu, tarkenne ja muistiinpano, omatoiminen verryttely.
    check('osat', sessions.some((s) => s.parts?.length));
    check('teho käsin', sessions.some((s) => s.intensitySource === 'manual'));
    check('kovempi ponnistelu', sessions.some((s) => s.effort === 1));
    check('tarkenne', sessions.some((s) => s.label));
    check('muistiinpano', sessions.some((s) => s.note));
    check('lihaskunto', sessions.some((s) => s.muscle));
    check('luusto', sessions.some((s) => s.bone));
    check('treenin verryttely', sessions.some((s) => s.linkedTo));

    // Joukkueet ja seura.
    const teams = await db.teams.toArray();
    check('joukkue', teams.some((x) => !x.kind));
    check('treeniryhmä', teams.some((x) => x.kind === 'group'));
    check('sarja', teams.some((x) => x.series));
    check('seura', (await db.clubs.count()) > 0);
    check('treenin joukkue', sessions.some((s) => s.teamId));

    // Jalkapallon lisätiedot ja pelit.
    check('treenin arvio', details.some((d) => d.focusTags.length && d.parentRating && d.enjoyment));
    const kindOf = (planId: string) => planOf.get(planId)?.activityTypeId;
    for (const [k, key] of [['peli', 'football_game'], ['turnaus', 'football_tournament'], ['harjoituspeli', 'football_friendly']] as const) {
      check(`mennyt ${k}`, fixtures.some((f) => kindOf(f.plannedSessionId) === t(key) && planOf.get(f.plannedSessionId)?.status === 'done'));
      check(`tuleva ${k}`, fixtures.some((f) => kindOf(f.plannedSessionId) === t(key) && planOf.get(f.plannedSessionId)!.date > today));
    }
    check('pelin tulos ja omat maalit', details.some((d) => d.goalsFor !== undefined && d.playerGoals));
    check('turnauksen pelit', details.some((d) => (d.games?.length ?? 0) >= 3 && d.games!.every((g) => g.goalsFor !== undefined)));
    check('pelin kommentti', details.some((d) => d.games?.some((g) => g.note)));
    check('tuloskuvan teksti', details.some((d) => d.shareNote));
    check('ennakkoteksti', fixtures.some((f) => f.previewNote));
    check('tietoja puuttuu', fixtures.some((f) => f.infoMissing));
    check('otteluohjelma', fixtures.some((f) => (f.games?.length ?? 0) >= 3 && planOf.get(f.plannedSessionId)!.date > today));
    check('koti ja vieras', fixtures.some((f) => f.homeAway === 'home') && fixtures.some((f) => f.homeAway === 'away'));

    // Perheen kalenteri: sisarusten kerrat päällekkäin samana päivänä.
    const future = plans.filter((p) => p.date > today && p.startTime);
    check(
      'päällekkäiset menot',
      future.some((a) => future.some((b) => a.profileId !== b.profileId && a.date === b.date && Math.abs(Number(a.startTime!.slice(0, 2)) - Number(b.startTime!.slice(0, 2))) <= 1)),
    );
  });
});

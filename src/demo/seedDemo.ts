// Esimerkkitilan aineisto (24.11.2026): kaksi keksittyä lasta, joiden tiedot kattavat sovelluksen ominaisuudet.
// Aineisto luodaan aina suhteessa tähän päivään samoilla tallennusfunktioilla kuin tavallinen käyttö, joten se
// pysyy ajan tasalla sovelluksen muuttuessa. Kattavuustesti (seedDemo.test.ts) varmistaa, että jokaiselle
// ominaisuudelle on esimerkki: uuden ominaisuuden tiedot lisätään tänne.

import type { Repositories } from '../db/repositories';
import { addDays, datesBetween, isoWeekday, startOfIsoWeek } from '../domain/dates';
import { activityTypeId } from '../domain/ids';
import type { Category, FocusTag, GameResult, ISODate, PlannedSession, UUID } from '../domain/types';
import { ESTIMATE_DEFAULT_TYPE_KEY } from '../seed/activityTypes';

type Repo = Repositories;

/** Esimerkkilasten nimet (keksittyjä). */
export const DEMO_NAMES = { school: 'Aino', early: 'Eino' } as const;

const CLUB = 'Järvikylän Pallo';
const OPPONENTS = ['Koivulan Kisa', 'Harjun Pallo', 'Rantakylän Ryhti', 'Mäntylän Pallo', 'Kalliorinteen Kisa', 'Lehtolan Liiga'];

/** Toistettava satunnaisluku (sama aineisto joka kerta, vain päivät siirtyvät). */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const t = (key: string) => activityTypeId(key);

let seeding: Promise<unknown> | null = null;
/** Esimerkkitilan käynnistys: aineisto luodaan kerran, vaikka käynnistys ajettaisiin samanaikaisesti kahdesti. */
export function seedDemoOnce(repo: Repo, today: ISODate): Promise<unknown> {
  seeding ??= (async () => {
    if (!(await repo.getMeta<boolean>('demoSeeded'))) await seedDemo(repo, today);
  })();
  return seeding;
}

export interface DemoIds {
  school: UUID;
  early: UUID;
}

export async function seedDemo(repo: Repo, today: ISODate): Promise<DemoIds> {
  const rnd = random(2026);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
  const year = Number(today.slice(0, 4));
  const mon = startOfIsoWeek(today);
  /** Seurannan alku: yhdeksän viikkoa taaksepäin (maanantai). */
  const start = addDays(mon, -63);
  /** Viikon `w` (0 = tämä, -1 = edellinen) päivä `d` (1 = ma … 7 = su). */
  const wd = (w: number, d: number) => addDays(mon, w * 7 + d - 1);
  const past = (d: ISODate) => d < today;

  const types = await repo.listActivityTypes();
  const sharesOf = (key: string) => types.find((x) => x.id === t(key))!.shares;

  // ---------- profiilit ----------
  const aino = await repo.createProfile({
    name: DEMO_NAMES.school,
    kind: 'child',
    birthYear: year - 9,
    birthMonth: 5,
    schoolStart: { year: year - 2, month: 8 },
    color: '#0891b2',
    trackingStart: start,
    football: true,
  });
  const eino = await repo.createProfile({ name: DEMO_NAMES.early, kind: 'child', birthYear: year - 5, birthMonth: 2, color: '#ea580c', trackingStart: start, football: true });
  await repo.setTypeHidden(eino.id, t('floorball'), true);
  await repo.updateActivityType(t('football_self'), { favorite: true });
  await repo.updateActivityType(t('cycling'), { favorite: true });

  // ---------- arkiliikunta ja loma ----------
  const estimate = async (profileId: UUID, category: Category, label: string, weekdayMin: number, weekendMin: number, key = ESTIMATE_DEFAULT_TYPE_KEY[category]) =>
    repo.saveEstimate(profileId, { category, label, weekdayMin, weekendMin, shares: sharesOf(key) }, today, start);
  await estimate(aino.id, 'school_recess', 'Välitunnit ja pihaleikit', 45, 0);
  await estimate(aino.id, 'commute', 'Koulumatkat pyörällä', 20, 0, 'commute_bike');
  await estimate(aino.id, 'self_directed', 'Leikki ja oma liikkuminen', 30, 60);
  await estimate(eino.id, 'daycare', 'Päiväkotipäivä', 150, 0);
  await estimate(eino.id, 'self_directed', 'Leikki ja oma liikkuminen', 50, 120);
  await repo.updateSettings({ holidays: [{ id: 'demo-loma', label: 'Lomaviikko', start: wd(-6, 1), end: wd(-6, 5) }] });

  // ---------- joukkueet ----------
  await repo.saveClub(CLUB, { city: 'Järvikylä', country: 'FI', shareColor: '#0f766e' });
  const team = await repo.saveTeam(aino.id, { name: `${CLUB} · Sininen · ${year - 9}`, format: '7v7', series: 'T10', kind: 'team' });
  const group = await repo.saveTeam(aino.id, { name: `${CLUB} · Taitoryhmä`, kind: 'group' });
  // Einolla oma joukkue: perheen kalenterissa sisarusten pelit ja niiden päällekkäisyys.
  const einoTeam = await repo.saveTeam(eino.id, { name: `${CLUB} · Keltainen · ${year - 5}`, format: '5v5', kind: 'team' });

  // ---------- viikkorytmi ----------
  const items = [
    await repo.createTemplateItem(aino.id, { activityTypeId: t('football_training'), weekdays: [1, 3], startTime: '17:30', durationMin: 75, validFrom: start, teamId: team.id, selfBeforeMin: 10 }, today),
    await repo.createTemplateItem(aino.id, { activityTypeId: t('football_training'), weekdays: [5], startTime: '16:00', durationMin: 60, validFrom: start, teamId: group.id, label: 'Taitotreeni' }, today),
    await repo.createTemplateItem(aino.id, { activityTypeId: t('school_pe'), weekdays: [2, 4], startTime: '09:00', durationMin: 45, validFrom: start }, today),
    await repo.createTemplateItem(eino.id, { activityTypeId: t('swimming'), weekdays: [6], startTime: '10:00', durationMin: 45, validFrom: start, label: 'Uimakoulu' }, today),
    await repo.createTemplateItem(eino.id, { activityTypeId: t('gymnastics'), weekdays: [3], startTime: '17:00', durationMin: 45, validFrom: start, label: 'Temppujumppa' }, today),
    await repo.createTemplateItem(eino.id, { activityTypeId: t('football_training'), weekdays: [2], startTime: '17:00', durationMin: 45, validFrom: start, teamId: einoTeam.id, label: 'Futiskoulu' }, today),
  ];
  for (const it of items) await repo.backfillTemplateItem(it.id, today);
  await repo.applyAutoSkips();

  // Sairauspäivät (Aino, viikko -4 ti–to): päivät merkitään ja kerrat jäävät väliin.
  const sick = [wd(-4, 2), wd(-4, 3), wd(-4, 4)];
  for (const d of sick) await repo.setDayFlag(aino.id, d, 'sick');
  await repo.setDayFlag(eino.id, wd(-2, 6), 'travel');
  // Loukkaantumisjakso (Aino, viikko -7 ti–pe, paluu lauantaina): jakson kerrat ohittuvat automaattisesti.
  const injury = { start: wd(-7, 2), returnDate: wd(-7, 6) };
  await repo.setInjury(aino.id, injury, null);
  const injuredDays = datesBetween(injury.start, addDays(injury.returnDate, -1));

  // Kuittaamatta jäävät: eilinen ja toissapäivä (Kuittaa-muistutus ja pikakuittaus).
  const pending = new Set([addDays(today, -1), addDays(today, -2)]);
  const focus: FocusTag[] = ['passing', 'dribbling', 'shooting', 'one_v_one', 'small_sided', 'game_understanding', 'coordination', 'physical'];
  for (const profile of [aino, eino]) {
    const plans = (await repo.plansInRange(profile.id, start, addDays(today, -1))).filter((p: PlannedSession) => p.status === 'open');
    for (const p of plans) {
      if (pending.has(p.date)) continue;
      if (profile.id === aino.id && sick.includes(p.date)) {
        await repo.skipPlanned(p.id, 'sick');
        continue;
      }
      if (profile.id === eino.id && p.date === wd(-2, 6)) {
        await repo.skipPlanned(p.id, 'other_commitment', 'Mummolassa');
        continue;
      }
      if (p.activityTypeId === t('football_training') && p.date === wd(-3, 3)) {
        await repo.skipPlanned(p.id, 'cancelled', 'Kenttä jäässä');
        continue;
      }
      const vigorous = rnd() < 0.2;
      // Lihaskunto ja luusto: treeneissä hyppyjä ja kuntopiiri osassa kerroista, temppujumppa aina.
      const strength = p.activityTypeId === t('gymnastics') || (p.activityTypeId === t('football_training') && rnd() < 0.5);
      const { session } = await repo.confirmPlanned(p.id, today, {
        ...(vigorous ? { intensityPreset: 'vigorous' as const } : {}),
        ...(strength ? { muscle: true, bone: true } : {}),
      });
      if (p.activityTypeId === t('football_training') && rnd() < 0.7) {
        await repo.saveFootballDetails(session.id, {
          attendance: rnd() < 0.9 ? 'full' : 'partial',
          focusTags: [pick(focus), pick(focus)].filter((x, i, a) => a.indexOf(x) === i),
          parentRating: (3 + Math.floor(rnd() * 3)) as 3 | 4 | 5,
          enjoyment: (2 + Math.floor(rnd() * 2)) as 2 | 3,
          teamId: p.teamId,
        });
      }
    }
  }

  // ---------- omat kerrat ----------
  const add = (profileId: UUID, key: string, date: ISODate, durationMin: number, extra: Partial<Parameters<Repo['createSession']>[0]> = {}) =>
    repo.createSession({ profileId, activityTypeId: t(key), date, durationMin, effort: 0, muscle: false, bone: false, ...extra });
  for (let w = -9; w <= 0; w++) {
    for (let d = 1; d <= 7; d++) {
      const date = wd(w, d);
      if (date < start || !past(date) || pending.has(date) || sick.includes(date) || injuredDays.includes(date)) continue;
      // Aino: viikonloppuna vaihtelevasti, keskiviikkona omatoiminen pallottelu.
      if (d === 6) {
        const key = pick(['cycling', 'swimming', 'trampoline', 'inline_skating']);
        await add(aino.id, key, date, 40 + Math.round(rnd() * 4) * 10, { bone: key === 'trampoline' });
      }
      if (d === 7 && w % 2 === 0)
        await add(aino.id, 'activity_park', date, 90, {
          muscle: true,
          bone: true,
          label: 'Liikuntapuisto',
          parts: [
            { activityTypeId: t('trampoline'), durationMin: 30 },
            { activityTypeId: t('climbing'), durationMin: 30 },
            { activityTypeId: t('football_self'), durationMin: 20 },
          ],
        });
      if (d === 3 && rnd() < 0.6) await add(aino.id, 'football_self', date, 20, { bone: true, note: 'Kikkailua pihalla' });
      // Eino: leikkipuisto arkena, potkulauta ja perheretki viikonloppuna.
      if ((d === 2 || d === 4) && rnd() < 0.7) await add(eino.id, 'playground', date, 30 + Math.round(rnd() * 3) * 10);
      if (d === 6 && date !== wd(-2, 6)) await add(eino.id, 'kick_scooter', date, 30);
      if (d === 7) {
        for (const p of [aino.id, eino.id]) await add(p, 'family_walk', date, 60, { label: 'Metsäretki' });
      }
    }
  }
  // Tehon käsin syöttö ja kovempi ponnistelu: yksi esimerkki kumpaakin.
  const lastSat = wd(isoWeekday(today) >= 6 ? 0 : -1, 6);
  await add(aino.id, 'floorball', addDays(lastSat, -2), 60, { manual: { light: 15, moderate: 25, vigorous: 15 }, label: 'Kerhosähly', note: 'Koulun kerho' });
  await add(eino.id, 'skating', addDays(lastSat, -3), 30, { effort: 1, label: 'Luistelukoulu' });

  // ---------- pelit, turnaukset ja harjoituspelit ----------
  const fixture = (date: ISODate, extra: Partial<Parameters<Repo['createFixture']>[1]> & { kind: 'game' | 'tournament' | 'friendly' }) =>
    repo.createFixture(aino.id, { date, startTime: '11:00', durationMin: 60, teamId: team.id, level: 'kilpa', format: '7v7', series: 'T10', ...extra });
  // Menneet sarjapelit tuloksineen.
  const results: [number, number, number][] = [
    [3, 1, 1],
    [2, 2, 0],
    [1, 4, 0],
    [5, 2, 2],
  ];
  const gameWeeks = [-8, -6, -3, -1];
  for (const [i, w] of gameWeeks.entries()) {
    const date = wd(w, 6);
    if (!past(date)) continue;
    const { plan } = await fixture(date, { kind: 'game', opponent: OPPONENTS[i], homeAway: i % 2 ? 'away' : 'home', location: i % 2 ? undefined : 'Järvikylän tekonurmi' });
    const [gf, ga, own] = results[i];
    const { sessionId } = await repo.recordGameResult({ planId: plan.id }, { goalsFor: gf, goalsAgainst: ga, playerGoals: own, played: 'full' }, today);
    if (i === 3) await repo.setResultNote(sessionId, 'Hieno joukkuepeli, kaksi omaa maalia!');
  }
  // Mennyt turnaus pelikohtaisine tuloksineen.
  const cupDay = wd(-2, 7);
  if (past(cupDay)) {
    const games = [
      { time: '09:00', opponent: OPPONENTS[1], location: 'Kenttä 2' },
      { time: '10:40', opponent: OPPONENTS[4], location: 'Kenttä 1' },
      { time: '12:20', opponent: OPPONENTS[5], location: 'Kenttä 2' },
    ];
    const { plan } = await fixture(cupDay, { kind: 'tournament', startTime: '08:30', durationMin: 260, eventName: 'Järvikylä Cup', location: 'Järvikylän urheilupuisto', games });
    const res: GameResult[] = [
      { goalsFor: 2, goalsAgainst: 1, playerGoals: 1, played: 'full' },
      { goalsFor: 0, goalsAgainst: 0, played: 'part' },
      { goalsFor: 3, goalsAgainst: 2, playerGoals: 1, played: 'full' },
    ];
    let sessionId: UUID | undefined;
    for (const [i, r] of res.entries()) sessionId = (await repo.recordTournamentGame(sessionId ? { sessionId } : { planId: plan.id }, i, { ...games[i], ...r }, today)).sessionId;
    if (sessionId) await repo.setGameComment(sessionId, 2, 'Voittomaali viime minuutilla');
  }
  // Mennyt harjoituspeli (pikakirjaus: pelien määrä, pituus ja lämmittely).
  const friendlyDay = wd(-5, 4);
  if (past(friendlyDay)) {
    const { plan } = await fixture(friendlyDay, { kind: 'friendly', startTime: '17:30', durationMin: 90, games: [{ opponent: OPPONENTS[2] }, { opponent: OPPONENTS[3] }] });
    await repo.recordFriendlyDay({ planId: plan.id }, { gamesCount: 2, gameLengthMin: 25, warmupMin: 15, games: [{ opponent: OPPONENTS[2], goalsFor: 2, goalsAgainst: 3 }, { opponent: OPPONENTS[3], goalsFor: 4, goalsAgainst: 1, playerGoals: 1 }] }, today);
  }
  // Tulevat: sarjapeli lauantaina (päällekkäin Einon uimakoulun kanssa), turnaus ja harjoituspeli, jonka tiedot puuttuvat.
  const nextSat = wd(isoWeekday(today) >= 6 ? 1 : 0, 6);
  const upcoming = await fixture(nextSat, { kind: 'game', startTime: '10:15', opponent: OPPONENTS[4], homeAway: 'home', location: 'Järvikylän tekonurmi' });
  await repo.setPreviewNote(upcoming.plan.id, 'Kokoontuminen 9.45, mukaan sininen peliasu.');
  await fixture(addDays(nextSat, 8), {
    kind: 'tournament',
    startTime: '09:00',
    durationMin: 240,
    eventName: 'Talviturnaus',
    location: 'Harjun halli',
    games: [
      { time: '09:30', opponent: OPPONENTS[0], homeAway: 'home' },
      { time: '11:10', opponent: OPPONENTS[3], homeAway: 'away' },
      { time: '12:50', opponent: OPPONENTS[5] },
    ],
  });
  await fixture(addDays(nextSat, 12), { kind: 'friendly', startTime: '18:00', durationMin: 90, games: [{ opponent: OPPONENTS[1] }], infoMissing: true, missingNote: 'Kenttä tarkentuu' });

  // Einon pelit: mennyt tuloksineen ja tuleva samana päivänä kuin Ainon turnaus (päällekkäin).
  const einoGame = (date: ISODate, extra: Partial<Parameters<Repo['createFixture']>[1]> & { kind: 'game' }) =>
    repo.createFixture(eino.id, { date, startTime: '11:00', durationMin: 45, teamId: einoTeam.id, format: '5v5', ...extra });
  const einoPast = wd(-1, 7);
  if (past(einoPast)) {
    const { plan } = await einoGame(einoPast, { kind: 'game', opponent: OPPONENTS[1], location: 'Järvikylän tekonurmi' });
    await repo.recordGameResult({ planId: plan.id }, { goalsFor: 4, goalsAgainst: 4, playerGoals: 1, played: 'full' }, today);
  }
  await einoGame(addDays(nextSat, 8), { kind: 'game', startTime: '10:30', opponent: OPPONENTS[2], location: 'Harjun halli' });

  await repo.setMeta('onboarded', true);
  await repo.setMeta('demoSeeded', true);
  return { school: aino.id, early: eino.id };
}

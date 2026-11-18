// Alkusivun pikatesti (18.11.2026): karkea arvio lapsen liikkumisesta muutaman kysymyksen perusteella.
// Laskenta käyttää samoja suosituksia (RECOMMENDATIONS) ja lajien teho-osuuksia kuin ohjelma, joten
// arvio vastaa sitä, mitä ohjelma näyttäisi samoilla tiedoilla. Kaikki lasketaan laitteella; vastauksia
// ei lähetetä eikä tallenneta. Arvio, ei mittaus.

import type { Category, IntensityShares } from './types';
import { APP_INTERPRETATIONS, RECOMMENDATIONS } from './recommendations';
import { BUILT_IN_ACTIVITY_TYPES } from '../seed/activityTypes';

export type QuickGroup = 'early_years' | 'school_age';
export type HobbyKey = 'football' | 'floorball' | 'ice_hockey' | 'gymnastics' | 'dance' | 'swimming' | 'other';
export type Commute = 'car' | 'walk' | 'bike';
export type Level = 0 | 1 | 2;

export interface QuickHobby {
  key: HobbyKey;
  perWeek: number;
  minutes: number;
}

export interface QuickAnswers {
  age: number;
  /** Kysytään vain, kun ikä ei ratkaise (ks. schoolQuestionNeeded). */
  inSchool?: boolean;
  hobbies: QuickHobby[];
  commute: Commute;
  /** Koulu- tai päiväkotimatka yhteensä päivässä (molemmat suunnat), min. */
  commuteMin: number;
  /** Koululainen: välitunnit (0 enimmäkseen paikallaan, 1 liikkuu jonkin verran, 2 leikkii, juoksee ja pelaa). */
  recess: Level;
  /** Alle kouluikäinen: onko päiväkodissa arkisin. */
  daycare: boolean;
  /** Vapaa-ajan leikki ja oma liikkuminen tavallisena päivänä (0 vähän, 1 jonkin verran, 2 paljon). */
  play: Level;
  /** Koululainen: monenako päivänä viikossa hengästyy ja hikoilee kunnolla. */
  vigorousDays: number;
  /** Koululainen: monenako päivänä viikossa hyppii, juoksee tai kiipeilee (lihakset ja luusto). */
  strengthDays: number;
}

export interface HobbyDef {
  key: HobbyKey;
  label: string;
  icon: string;
  /** Vastaava laji ohjelmassa (teho-osuudet ja viikkorytmin esitäyttö). */
  typeKey: string;
}

export const QUICK_HOBBIES: readonly HobbyDef[] = Object.freeze([
  { key: 'football', label: 'Jalkapallo', icon: '⚽', typeKey: 'football_training' },
  { key: 'floorball', label: 'Salibandy', icon: '🏑', typeKey: 'floorball' },
  { key: 'ice_hockey', label: 'Jääkiekko', icon: '🏒', typeKey: 'ice_hockey' },
  { key: 'gymnastics', label: 'Voimistelu tai temppujumppa', icon: '🤸‍♀️', typeKey: 'gymnastics' },
  { key: 'dance', label: 'Tanssi', icon: '💃', typeKey: 'dance' },
  { key: 'swimming', label: 'Uinti', icon: '🏊', typeKey: 'swimming' },
  { key: 'other', label: 'Muu ohjattu harrastus', icon: '✳️', typeKey: 'other' },
]);

/**
 * "Muu ohjattu harrastus": listan lajien keskitaso (reipas ja rasittava noin puolet ajasta). Ohjelman
 * "Muu"-laji on tarkoituksella varovainen (0,2), mikä aliarvioisi esim. kamppailulajit ja yleisurheilun.
 */
export const OTHER_HOBBY_SHARES: Readonly<IntensityShares> = Object.freeze({ light: 0.4, moderate: 0.35, vigorous: 0.15 });

/**
 * Vapaa-ajan leikin minuutit päivässä tasoittain (0, 1, 2), samat kaikille viikonpäiville. Kotona hoidettavan
 * pienen lapsen koko päivä on vapaa-aikaa, päiväkotilaisella ilta.
 */
export const PLAY_MIN = Object.freeze({
  school_age: [20, 60, 120] as const,
  early_daycare: [45, 90, 150] as const,
  early_home: [90, 180, 240] as const,
});
export function playMin(group: QuickGroup, daycare: boolean): readonly [number, number, number] {
  return group === 'school_age' ? PLAY_MIN.school_age : daycare ? PLAY_MIN.early_daycare : PLAY_MIN.early_home;
}
/** Koululiikunta viikossa (oletus 2 × 45 min). */
export const SCHOOL_PE_MIN_PER_WEEK = 90;
/** Päiväkotipäivän liikkuminen (Liikkuva varhaiskasvatus: 2 h päivässä). */
export const DAYCARE_MIN = RECOMMENDATIONS.early_years.daycareMinPerDay.value;
/** Matkavinkin oletus: 15 min suuntaansa. */
const TIP_COMMUTE_MIN = 30;
/** Pienempiä lisäyksiä (min/pv) ei tarjota vinkkinä. */
const MIN_TIP_GAIN = 3;

const STILL: Readonly<IntensityShares> = Object.freeze({ light: 0.4, moderate: 0.1, vigorous: 0 });

function sharesOf(typeKey: string): IntensityShares {
  const t = BUILT_IN_ACTIVITY_TYPES.find((x) => x.key === typeKey);
  if (!t) throw new Error(`Tuntematon laji: ${typeKey}`);
  return t.shares;
}
const mvpaShare = (s: IntensityShares) => s.moderate + s.vigorous;
const totalShare = (s: IntensityShares) => s.light + s.moderate + s.vigorous;

function hobbyShares(key: HobbyKey): IntensityShares {
  if (key === 'other') return OTHER_HOBBY_SHARES;
  return sharesOf(QUICK_HOBBIES.find((h) => h.key === key)!.typeKey);
}

/** Välitunnit tasoittain: minuutit koulupäivänä ja teho. "Paikallaan" on kevyttä oleilua. */
function recessLevel(level: Level): { min: number; shares: IntensityShares } {
  if (level === 0) return { min: 30, shares: STILL };
  if (level === 1) return { min: 45, shares: sharesOf('school_recess') };
  return { min: 45, shares: sharesOf('outdoor_play') };
}

const COMMUTE_KEY: Record<Exclude<Commute, 'car'>, string> = { walk: 'commute_walk', bike: 'commute_bike' };

/**
 * Ikä ei ratkaise koulua, kun koulu alkaa elokuussa sinä vuonna, jona lapsi täyttää 7: syksyllä osa
 * 6-vuotiaista on jo koulussa, keväällä osa 7-vuotiaista vielä esikoulussa. Silloin kysytään.
 */
export function schoolQuestionNeeded(age: number, month: number): boolean {
  return (age === 6 && month >= 8) || (age === 7 && month < 8);
}

export function quickGroup(age: number, inSchool?: boolean): QuickGroup {
  if (inSchool !== undefined && (age === 6 || age === 7)) return inSchool ? 'school_age' : 'early_years';
  return age >= 7 ? 'school_age' : 'early_years';
}

export type PartKey = 'hobbies' | 'school' | 'daycare' | 'commute' | 'play';
export interface Part {
  key: PartKey;
  label: string;
  /** Reipas ja rasittava, min/pv viikon keskiarvona (pyöristämätön). */
  mvpa: number;
  /** Kaikki liikkuminen, min/pv viikon keskiarvona (pyöristämätön). */
  total: number;
  /** Näytettävä kokonaisluku pääluvun mittarilla; osien summa = pääluku. */
  shown: number;
  /** Mistä luku tulee, käyttäjän vastauksina (esim. "2 kertaa viikossa, yhteensä 180 min"). */
  basis: string;
}

export type QuickStatus = 'meets' | 'near' | 'below';

export interface QuickCheck {
  label: string;
  done: number;
  target: number;
  ok: boolean;
}

export interface Tip {
  text: string;
  /** Arvioitu lisäys pääluvun mittariin (min/pv); järjestää vinkit. */
  gain: number;
}

export interface QuickResult {
  group: QuickGroup;
  status: QuickStatus;
  /** Pääluku: koululaisella reipas ja rasittava, alle kouluikäisellä kaikki liikkuminen (min/pv). */
  headline: number;
  headlineTarget: number;
  headlineLabel: string;
  mvpa: number;
  total: number;
  parts: Part[];
  checks: QuickCheck[];
  tips: Tip[];
}

/** Viikon minuutit → päivän keskiarvo. Pyöristys vasta lopuksi. */
function part(key: PartKey, label: string, basis: string, items: { minPerWeek: number; shares: IntensityShares }[]): Omit<Part, 'shown'> {
  let mvpa = 0;
  let total = 0;
  for (const i of items) {
    mvpa += i.minPerWeek * mvpaShare(i.shares);
    total += i.minPerWeek * totalShare(i.shares);
  }
  return { key, label, basis, mvpa: mvpa / 7, total: total / 7 };
}

/** Suurimman jäännöksen menetelmä: kokonaisluvut, joiden summa on sum (pyöristetty kokonaissumma). */
export function apportion(values: number[], sum: number): number[] {
  const floors = values.map(Math.floor);
  let left = sum - floors.reduce((a, b) => a + b, 0);
  const order = values.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const out = [...floors];
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out;
}

const clampDays = (n: number) => Math.max(0, Math.min(7, Math.round(n)));

export function computeQuick(a: QuickAnswers): QuickResult {
  const group = quickGroup(a.age, a.inSchool);
  const school = group === 'school_age';
  const hobbies = a.hobbies.filter((h) => h.perWeek > 0 && h.minutes > 0);
  const goes = school || a.daycare;
  const commuteMin = goes && a.commute !== 'car' ? Math.max(0, a.commuteMin) : 0;
  const recess = recessLevel(a.recess);

  const hobbyMin = hobbies.reduce((s, h) => s + Math.min(7, h.perWeek) * h.minutes, 0);
  const each = hobbies.map((h) => `${Math.min(7, h.perWeek)} × ${h.minutes} min`);
  const hobbyBasis = !each.length
    ? 'Ei säännöllisiä harrastuksia'
    : each.length === 1
      ? `Viikossa ${each[0]}`
      : `Viikossa ${each.slice(0, -1).join(', ')} ja ${each[each.length - 1]} (yhteensä ${hobbyMin} min)`;
  const play = playMin(group, a.daycare)[a.play];
  const raw = [
    part('hobbies', 'Harrastukset', hobbyBasis, hobbies.map((h) => ({ minPerWeek: Math.min(7, h.perWeek) * h.minutes, shares: hobbyShares(h.key) }))),
    school
      ? part('school', 'Koulu: liikuntatunnit ja välitunnit', `Liikuntatunnit ${SCHOOL_PE_MIN_PER_WEEK} min viikossa ja välitunnit arkipäivisin`, [
          { minPerWeek: SCHOOL_PE_MIN_PER_WEEK, shares: sharesOf('school_pe') },
          { minPerWeek: 5 * recess.min, shares: recess.shares },
        ])
      : part('daycare', 'Päiväkoti', a.daycare ? `Arkipäivisin noin ${DAYCARE_MIN} min liikkumista` : 'Ei päiväkotia', a.daycare ? [{ minPerWeek: 5 * DAYCARE_MIN, shares: sharesOf('daycare_day') }] : []),
    part('commute', school ? 'Koulumatkat' : 'Päiväkotimatkat', commuteMin > 0 ? `Arkipäivisin ${commuteMin} min` : 'Ei lasketa (autolla tai ei matkaa)', commuteMin > 0 && a.commute !== 'car' ? [{ minPerWeek: 5 * commuteMin, shares: sharesOf(COMMUTE_KEY[a.commute]) }] : []),
    part('play', 'Leikki ja oma liikkuminen', `Joka päivä noin ${play} min`, [{ minPerWeek: 7 * play, shares: sharesOf('outdoor_play') }]),
  ];

  const mvpa = Math.round(raw.reduce((s, p) => s + p.mvpa, 0));
  const total = Math.round(raw.reduce((s, p) => s + p.total, 0));
  const shown = apportion(
    raw.map((p) => (school ? p.mvpa : p.total)),
    school ? mvpa : total,
  );
  const parts: Part[] = raw.map((p, i) => ({ ...p, shown: shown[i] }));
  const near = APP_INTERPRETATIONS.NEAR_THRESHOLD;

  let status: QuickStatus;
  let checks: QuickCheck[];
  let headline: number;
  let headlineTarget: number;
  let headlineLabel: string;
  if (school) {
    const r = RECOMMENDATIONS.school_age;
    const target = r.mvpaAvgMinPerDay.value;
    headline = mvpa;
    headlineTarget = target;
    headlineLabel = 'reipasta ja rasittavaa liikuntaa päivässä';
    status = mvpa >= target ? 'meets' : mvpa >= target * near ? 'near' : 'below';
    const vig = clampDays(a.vigorousDays);
    const strength = clampDays(a.strengthDays);
    checks = [
      { label: 'Rasittavia päiviä viikossa', done: vig, target: r.vigorousDaysPerWeek.value, ok: vig >= r.vigorousDaysPerWeek.value },
      { label: 'Lihaksia vahvistavia päiviä', done: strength, target: r.muscleDaysPerWeek.value, ok: strength >= r.muscleDaysPerWeek.value },
      { label: 'Luustoa vahvistavia päiviä', done: strength, target: r.boneDaysPerWeek.value, ok: strength >= r.boneDaysPerWeek.value },
    ];
  } else {
    const r = RECOMMENDATIONS.early_years;
    headline = total;
    headlineTarget = r.totalMinPerDay.value;
    headlineLabel = 'liikkumista päivässä kaikilla tehoilla';
    // Tila heikomman tavoitteen mukaan (kaikki liikkuminen ja siitä vauhdikas).
    const ratio = Math.min(total / r.totalMinPerDay.value, mvpa / r.mvpaMinPerDay.value);
    status = ratio >= 1 ? 'meets' : ratio >= near ? 'near' : 'below';
    checks = [
      { label: 'Liikkumista kaikkiaan (min/pv)', done: total, target: r.totalMinPerDay.value, ok: total >= r.totalMinPerDay.value },
      { label: 'Siitä vauhdikasta (min/pv)', done: mvpa, target: r.mvpaMinPerDay.value, ok: mvpa >= r.mvpaMinPerDay.value },
    ];
  }

  return { group, status, headline, headlineTarget, headlineLabel, mvpa, total, parts, checks, tips: tips(a, group, status === 'meets', checks) };
}

/**
 * Enintään kaksi vinkkiä. Minuuttivinkit (matka, leikki, välitunnit) vain, kun pääsuositus ei täyty;
 * lisäys lasketaan nykytilanteesta samoilla teho-osuuksilla. Päivävinkit, kun päiväraja ei täyty.
 */
function tips(a: QuickAnswers, group: QuickGroup, met: boolean, checks: QuickCheck[]): Tip[] {
  const school = group === 'school_age';
  const out: Tip[] = [];
  const perDay = (minPerWeek: number) => Math.round(minPerWeek / 7);
  // Koululaisella mittari on reipas ja rasittava, pienemmällä kaikki liikkuminen.
  const metric = school ? mvpaShare : totalShare;

  if (!met) {
    const goes = school || a.daycare;
    const curCommute = goes && a.commute !== 'car' ? 5 * a.commuteMin * metric(sharesOf(COMMUTE_KEY[a.commute])) : 0;
    if (goes && a.commuteMin < TIP_COMMUTE_MIN) {
      const dest = school ? 'kouluun' : 'päiväkotiin';
      const walk = perDay(5 * TIP_COMMUTE_MIN * metric(sharesOf('commute_walk')) - curCommute);
      if (school) {
        const bike = perDay(5 * TIP_COMMUTE_MIN * metric(sharesOf('commute_bike')) - curCommute);
        if (bike >= MIN_TIP_GAIN)
          out.push({
            gain: bike,
            text:
              a.commute === 'car'
                ? `Kävellen tai pyörällä ${dest} (15 min suuntaansa) toisi noin ${Math.max(walk, 0)}–${bike} min reipasta liikuntaa päivässä.`
                : `Pyörällä ja 15 min suuntaansa ${dest} toisi noin ${bike} min lisää reipasta liikuntaa päivässä.`,
          });
      } else if (walk >= MIN_TIP_GAIN) {
        out.push({ gain: walk, text: `Kävely ${dest} (15 min suuntaansa) toisi noin ${walk} min liikkumista lisää päivässä.` });
      }
    }
    if (a.play < 2) {
      const s = sharesOf('outdoor_play');
      const levels = playMin(group, a.daycare);
      const extra = levels[a.play + 1] - levels[a.play];
      const gain = Math.round(extra * metric(s));
      if (gain >= MIN_TIP_GAIN)
        out.push({
          gain,
          text: school
            ? `${extra} min lisää ulkoleikkiä päivässä toisi noin ${gain} min reipasta liikuntaa.`
            : `${extra} min lisää ulkoleikkiä päivässä toisi noin ${gain} min liikkumista, josta noin ${Math.round(extra * mvpaShare(s))} min vauhdikasta.`,
        });
    }
    if (school && a.recess < 2) {
      const cur = recessLevel(a.recess);
      const best = recessLevel(2);
      const gain = perDay(5 * (best.min * mvpaShare(best.shares) - cur.min * mvpaShare(cur.shares)));
      if (gain >= MIN_TIP_GAIN) out.push({ gain, text: `Pallopelit ja leikit välitunneilla toisivat noin ${gain} min reipasta liikuntaa päivässä.` });
    }
  }
  if (!school && !met && out.length === 0)
    out.push({ gain: 0.05, text: 'Liikettä kertyy helpoimmin arjen siirtymistä: kävellen kauppaan ja puistoon, portaat, pihaleikit ennen ja jälkeen ruoan.' });
  if (school) {
    // Päivävinkit järjestetään minuuttivinkkien jälkeen (pieni tekninen paino).
    if (!checks[0].ok) out.push({ gain: 0.2, text: 'Hengästyttävää menoa ainakin kolmena päivänä viikossa: juoksuleikit, pallopelit, mäenlasku tai uinti.' });
    if (!checks[1].ok) out.push({ gain: 0.1, text: 'Hyppimistä ja kiipeilyä kolmena päivänä viikossa vahvistaa lihaksia ja luustoa: trampoliini, liikuntapuisto, hyppynaru.' });
  }
  return out.sort((x, y) => y.gain - x.gain).slice(0, 2);
}

/** Ohjelman aloituksen esitäyttö pikatestin vastauksista (vain muistissa, ei tallenneta). */
export interface QuickPrefill {
  birthYear: number;
  /** Koulun aloitusvuosi (elokuu): suositusryhmä menee ohjelmassa samoin kuin pikatestissä. */
  schoolStartYear: number;
  football: boolean;
  hobbies: { typeKey: string; label: string; icon: string; perWeek: number; minutes: number }[];
  /** Arkiliikunnan perusarviot; typeKey = laji, jonka teho-osuuksilla arvio lasketaan. */
  estimates: { category: Category; typeKey: string; weekdayMin: number; weekendMin: number }[];
}

/**
 * Syntymävuosi: kuluva vuosi − ikä (syntymäpäivä oletetaan jo olleen). Koulukysymyksen tapauksissa vuosi
 * tiedetään tarkasti: koulussa oleva 6-vuotias (syksy) tai 7-vuotias (kevät) on syntynyt vuotta aiemmin.
 */
export function prefillFromQuick(a: QuickAnswers, year: number, month: number): QuickPrefill {
  const group = quickGroup(a.age, a.inSchool);
  const school = group === 'school_age';
  const ambiguous = schoolQuestionNeeded(a.age, month) && a.inSchool !== undefined;
  const birthYear = year - a.age - (ambiguous && a.inSchool ? 1 : 0);
  const play = playMin(group, a.daycare)[a.play];
  const estimates: QuickPrefill['estimates'] = [];
  if (school) {
    // Perusarvio lasketaan ohjelmassa lajin teho-osuuksilla; paikallaan olo vastaa 10 min välituntileikkiä.
    const r = a.recess === 0 ? { typeKey: 'school_recess', min: 10 } : a.recess === 1 ? { typeKey: 'school_recess', min: 45 } : { typeKey: 'outdoor_play', min: 45 };
    estimates.push({ category: 'school_recess', typeKey: r.typeKey, weekdayMin: r.min, weekendMin: 0 });
  } else if (a.daycare) estimates.push({ category: 'daycare', typeKey: 'daycare_day', weekdayMin: DAYCARE_MIN, weekendMin: 0 });
  if (a.commute !== 'car' && a.commuteMin > 0 && (school || a.daycare)) estimates.push({ category: 'commute', typeKey: COMMUTE_KEY[a.commute], weekdayMin: a.commuteMin, weekendMin: 0 });
  estimates.push({ category: 'self_directed', typeKey: 'outdoor_play', weekdayMin: play, weekendMin: play });
  return {
    birthYear,
    schoolStartYear: birthYear + 7,
    football: a.hobbies.some((h) => h.key === 'football'),
    hobbies: a.hobbies
      .filter((h) => h.perWeek > 0 && h.minutes > 0)
      .map((h) => {
        const d = QUICK_HOBBIES.find((x) => x.key === h.key)!;
        return { typeKey: d.typeKey, label: d.label, icon: d.icon, perWeek: Math.min(7, h.perWeek), minutes: h.minutes };
      }),
    estimates,
  };
}

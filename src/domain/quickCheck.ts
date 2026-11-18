// Alkusivun pikatesti (18.11.2026): karkea arvio lapsen liikkumisesta muutaman kysymyksen perusteella.
// Laskenta käyttää samoja suosituksia (RECOMMENDATIONS) ja lajien tehoarvioita kuin ohjelma. Kaikki
// lasketaan laitteella; vastauksia ei lähetetä eikä tallenneta. Arvio, ei mittaus.

import type { Category, IntensityShares } from './types';
import { APP_INTERPRETATIONS, RECOMMENDATIONS } from './recommendations';
import { INTENSITY_PRESETS } from './intensity';
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
  hobbies: QuickHobby[];
  commute: Commute;
  /** Koulu- tai päiväkotimatka yhteensä päivässä (molemmat suunnat), min. */
  commuteMin: number;
  /** Koululainen: liikkuuko välitunneilla (0 paikallaan, 1 vähän, 2 leikkii ja pelaa). */
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
  /** Vastaava laji ohjelmassa (viikkorytmin esitäyttö). */
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

/** Vapaa-ajan leikin minuutit päivässä tasoittain (0, 1, 2). */
export const PLAY_MIN: Readonly<Record<QuickGroup, readonly [number, number, number]>> = Object.freeze({
  school_age: [20, 60, 120] as const,
  early_years: [45, 90, 150] as const,
});
/** Välituntien minuutit koulupäivänä tasoittain; "paikallaan" lasketaan kevyeksi oleiluksi. */
export const RECESS_MIN: readonly [number, number, number] = [30, 45, 45];
/** Koululiikunta viikossa (oletus 2 × 45 min). */
export const SCHOOL_PE_MIN_PER_WEEK = 90;
/** Päiväkotipäivän liikkuminen (Liikkuva varhaiskasvatus: 2 h päivässä). */
export const DAYCARE_MIN = RECOMMENDATIONS.early_years.daycareMinPerDay.value;

const STILL: IntensityShares = { light: 0.4, moderate: 0.1, vigorous: 0 };

function sharesOf(typeKey: string): IntensityShares {
  const t = BUILT_IN_ACTIVITY_TYPES.find((x) => x.key === typeKey);
  if (!t) throw new Error(`Tuntematon laji: ${typeKey}`);
  return t.shares;
}

function hobbyShares(key: HobbyKey): IntensityShares {
  // "Muu" on ohjelmassa varovainen oletus; ohjatulle harrastukselle käytetään "enimmäkseen reipasta".
  if (key === 'other') return INTENSITY_PRESETS.moderate;
  return sharesOf(QUICK_HOBBIES.find((h) => h.key === key)!.typeKey);
}

export function quickGroup(age: number): QuickGroup {
  return age >= 7 ? 'school_age' : 'early_years';
}

export type PartKey = 'hobbies' | 'school' | 'daycare' | 'commute' | 'play';
export interface Part {
  key: PartKey;
  label: string;
  /** Reipas ja rasittava, min/pv viikon keskiarvona. */
  mvpa: number;
  /** Kaikki liikkuminen, min/pv viikon keskiarvona. */
  total: number;
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
  /** Arvioitu lisäys reippaaseen ja rasittavaan (min/pv); järjestää vinkit. */
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

/** Viikon minuutit → päivän keskiarvo; pyöristys kokonaisiin minuutteihin vasta lopuksi. */
function part(key: PartKey, label: string, items: { minPerWeek: number; shares: IntensityShares }[]): Part {
  let mvpa = 0;
  let total = 0;
  for (const i of items) {
    const m = i.minPerWeek * (i.shares.moderate + i.shares.vigorous);
    mvpa += m;
    total += m + i.minPerWeek * i.shares.light;
  }
  return { key, label, mvpa: mvpa / 7, total: total / 7 };
}

const COMMUTE_KEY: Record<Exclude<Commute, 'car'>, string> = { walk: 'commute_walk', bike: 'commute_bike' };

export function computeQuick(a: QuickAnswers): QuickResult {
  const group = quickGroup(a.age);
  const school = group === 'school_age';
  const hobbies = a.hobbies.filter((h) => h.perWeek > 0 && h.minutes > 0);
  const commuteMin = a.commute === 'car' ? 0 : Math.max(0, a.commuteMin);
  const commuteDays = school || a.daycare ? 5 : 0;

  const parts: Part[] = [
    part(
      'hobbies',
      'Harrastukset',
      hobbies.map((h) => ({ minPerWeek: h.perWeek * h.minutes, shares: hobbyShares(h.key) })),
    ),
    school
      ? part('school', 'Koulu: liikuntatunnit ja välitunnit', [
          { minPerWeek: SCHOOL_PE_MIN_PER_WEEK, shares: sharesOf('school_pe') },
          { minPerWeek: 5 * RECESS_MIN[a.recess], shares: a.recess === 0 ? STILL : sharesOf('school_recess') },
        ])
      : part('daycare', 'Päiväkoti', a.daycare ? [{ minPerWeek: 5 * DAYCARE_MIN, shares: sharesOf('daycare_day') }] : []),
    part('commute', school ? 'Koulumatkat' : 'Päiväkotimatkat', a.commute === 'car' ? [] : [{ minPerWeek: commuteDays * commuteMin, shares: sharesOf(COMMUTE_KEY[a.commute]) }]),
    part('play', 'Leikki ja oma liikkuminen', [{ minPerWeek: 7 * PLAY_MIN[group][a.play], shares: sharesOf('outdoor_play') }]),
  ];

  const mvpa = Math.round(parts.reduce((s, p) => s + p.mvpa, 0));
  const total = Math.round(parts.reduce((s, p) => s + p.total, 0));
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
    const strength = Math.max(0, Math.min(7, a.strengthDays));
    checks = [
      { label: 'Rasittavia päiviä viikossa', done: clampDays(a.vigorousDays), target: r.vigorousDaysPerWeek.value, ok: clampDays(a.vigorousDays) >= r.vigorousDaysPerWeek.value },
      { label: 'Lihaksia vahvistavia päiviä', done: strength, target: r.muscleDaysPerWeek.value, ok: strength >= r.muscleDaysPerWeek.value },
      { label: 'Luustoa vahvistavia päiviä', done: strength, target: r.boneDaysPerWeek.value, ok: strength >= r.boneDaysPerWeek.value },
    ];
  } else {
    const r = RECOMMENDATIONS.early_years;
    headline = total;
    headlineTarget = r.totalMinPerDay.value;
    headlineLabel = 'liikkumista päivässä kaikilla tehoilla';
    const ratio = Math.min(total / r.totalMinPerDay.value, mvpa / r.mvpaMinPerDay.value);
    status = ratio >= 1 ? 'meets' : ratio >= near ? 'near' : 'below';
    checks = [
      { label: 'Liikkumista kaikkiaan (min/pv)', done: total, target: r.totalMinPerDay.value, ok: total >= r.totalMinPerDay.value },
      { label: 'Siitä vauhdikasta (min/pv)', done: mvpa, target: r.mvpaMinPerDay.value, ok: mvpa >= r.mvpaMinPerDay.value },
    ];
  }

  return { group, status, headline, headlineTarget, headlineLabel, mvpa, total, parts, checks, tips: tips(a, group) };
}

function clampDays(n: number): number {
  return Math.max(0, Math.min(7, Math.round(n)));
}

/** Enintään kaksi vinkkiä, suurimman arvioidun lisäyksen mukaan. */
function tips(a: QuickAnswers, group: QuickGroup): Tip[] {
  const school = group === 'school_age';
  const out: Tip[] = [];
  const goesSomewhere = school || a.daycare;
  if (goesSomewhere && (a.commute === 'car' || a.commuteMin < 20)) {
    const bike = sharesOf('commute_bike');
    const gain = Math.round((5 * 30 * (bike.moderate + bike.vigorous)) / 7);
    out.push({ gain, text: `Kävely tai pyöräily ${school ? 'kouluun' : 'päiväkotiin'} 15 min suuntaansa toisi noin ${gain} min reipasta liikuntaa päivässä.` });
  }
  if (a.play < 2) {
    const s = sharesOf('outdoor_play');
    const extra = PLAY_MIN[group][a.play + 1] - PLAY_MIN[group][a.play];
    const gain = Math.round(extra * (s.moderate + s.vigorous));
    out.push({ gain, text: `${extra} min lisää ulkoleikkiä päivässä toisi noin ${gain} min ${school ? 'reipasta liikuntaa' : 'vauhdikasta liikkumista'}.` });
  }
  if (school && a.recess < 2) {
    const s = sharesOf('school_recess');
    const gain = Math.round((5 * RECESS_MIN[2] * (s.moderate + s.vigorous) - (a.recess === 0 ? 5 * RECESS_MIN[0] * STILL.moderate : 0)) / 7);
    out.push({ gain, text: `Pallopelit ja leikit välitunneilla toisivat noin ${gain} min reipasta liikuntaa päivässä.` });
  }
  if (school && clampDays(a.vigorousDays) < 3) {
    out.push({ gain: 5, text: 'Hengästyttävää menoa ainakin kolmena päivänä viikossa: juoksuleikit, pallopelit, mäenlasku tai uinti.' });
  }
  if (school && clampDays(a.strengthDays) < 3) {
    out.push({ gain: 4, text: 'Hyppimistä ja kiipeilyä kolmena päivänä viikossa vahvistaa lihaksia ja luustoa: trampoliini, liikuntapuisto, hyppynaru.' });
  }
  return out.sort((x, y) => y.gain - x.gain).slice(0, 2);
}

/** Ohjelman aloituksen esitäyttö pikatestin vastauksista (vain muistissa, ei tallenneta). */
export interface QuickPrefill {
  birthYear: number;
  football: boolean;
  hobbies: { typeKey: string; label: string; icon: string; perWeek: number; minutes: number }[];
  estimates: { category: Category; weekdayMin: number; weekendMin: number }[];
}

export function prefillFromQuick(a: QuickAnswers, year: number): QuickPrefill {
  const group = quickGroup(a.age);
  const school = group === 'school_age';
  const play = PLAY_MIN[group][a.play];
  const estimates: QuickPrefill['estimates'] = [];
  if (school) estimates.push({ category: 'school_recess', weekdayMin: a.recess === 0 ? 15 : RECESS_MIN[a.recess], weekendMin: 0 });
  else if (a.daycare) estimates.push({ category: 'daycare', weekdayMin: DAYCARE_MIN, weekendMin: 0 });
  if (a.commute !== 'car' && a.commuteMin > 0 && (school || a.daycare)) estimates.push({ category: 'commute', weekdayMin: a.commuteMin, weekendMin: 0 });
  estimates.push({ category: 'self_directed', weekdayMin: play, weekendMin: play });
  return {
    birthYear: year - a.age,
    football: a.hobbies.some((h) => h.key === 'football'),
    hobbies: a.hobbies
      .filter((h) => h.perWeek > 0 && h.minutes > 0)
      .map((h) => {
        const d = QUICK_HOBBIES.find((x) => x.key === h.key)!;
        return { typeKey: d.typeKey, label: d.label, icon: d.icon, perWeek: h.perWeek, minutes: h.minutes };
      }),
    estimates,
  };
}

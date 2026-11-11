// Suositusryhmän valinta (SPEC 4) ja kategorian konteksti (SPEC 2).

import { datesBetween, firstDayOf, parseISODate } from './dates';
import { APP_INTERPRETATIONS } from './recommendations';
import type { Category, Context, ISODate, Period, Profile, RecommendationGroup } from './types';

/** Ikä täysinä vuosina; syntymäpäiväksi oletetaan kuun 15. päivä. */
export function ageInYears(birthYear: number, birthMonth: number, on: ISODate): number {
  const { year, month, day } = parseISODate(on);
  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < 15)) age -= 1;
  return age;
}

type GroupProfile = Pick<Profile, 'birthYear' | 'birthMonth' | 'schoolStart' | 'groupOverride'>;

export function recommendationGroup(p: GroupProfile, on: ISODate): RecommendationGroup {
  if (p.groupOverride) return p.groupOverride; // käsin asetettu
  const age = ageInYears(p.birthYear, p.birthMonth, on);
  if (age >= 18) return 'adult';
  if (p.schoolStart && on >= firstDayOf(p.schoolStart)) return 'school_age';
  if (!p.schoolStart && age >= 7) return 'school_age'; // varasääntö, jos koulun alkua ei ole annettu
  return 'early_years';
}

export interface PeriodGroupInfo {
  /** Jakson viimeisen päivän ryhmä. */
  group: RecommendationGroup;
  /** Päivä, jona ryhmä vaihtui kesken jakson ("suositusryhmä vaihtui [pvm]"). */
  changedOn?: ISODate;
  /** Yli 64-vuotias: 65+ -suositusta ei toteuteta. */
  over64: boolean;
}

export function periodGroup(p: GroupProfile, period: Period): PeriodGroupInfo {
  const group = recommendationGroup(p, period.end);
  let changedOn: ISODate | undefined;
  let prev: RecommendationGroup | undefined;
  for (const d of datesBetween(period.start, period.end)) {
    const g = recommendationGroup(p, d);
    if (prev !== undefined && g !== prev) changedOn = d; // viimeisin vaihto
    prev = g;
  }
  const over64 =
    group === 'adult' && ageInYears(p.birthYear, p.birthMonth, period.end) > APP_INTERPRETATIONS.ADULT_MAX_AGE;
  return { group, changedOn, over64 };
}

/**
 * Konteksti johdetaan kategoriasta. Harrastus ja koululiikunta = ohjattu.
 * Tulkinta (vahvistettu käyttäjän kanssa): välitunnit, omaehtoinen ja perhe =
 * omaehtoinen; koulumatka ja muu = arki.
 */
export const CATEGORY_CONTEXT: Readonly<Record<Category, Context>> = Object.freeze({
  hobby: 'organized',
  school_pe: 'organized',
  school_recess: 'self_directed',
  self_directed: 'self_directed',
  family: 'self_directed',
  commute: 'everyday',
  other: 'everyday',
});

export function contextOf(category: Category): Context {
  return CATEGORY_CONTEXT[category];
}

// Käyttöliittymän suomenkieliset nimet (SPEC 2: koodissa englanti, UI:ssa suomi).

import { CATEGORY_CONTEXT } from '../domain/groups';
import type { Category, Context, FocusTag, MovementGroup, RecommendationGroup, SkipReason, StrengthDefault } from '../domain/types';

export const CATEGORY_LABEL: Record<Category, string> = {
  hobby: 'Harrastus',
  school_pe: 'Koululiikunta',
  school_recess: 'Välitunnit',
  daycare: 'Päiväkoti',
  commute: 'Koulumatka',
  self_directed: 'Omaehtoinen',
  family: 'Perhe',
  other: 'Muu',
};

/** Ohjattu / omaehtoinen / arki (SPEC 2: kategoriasta johdettu konteksti). */
export const CONTEXT_LABEL: Record<Context, string> = { organized: 'Ohjattu', self_directed: 'Omaehtoinen', everyday: 'Arki' };

/**
 * Kontekstin kategoriat näkyviin (17.11.2026): "Omaehtoinen" konteksti on laajempi kuin samanniminen
 * kategoria (myös välitunnit ja perhe), joten jaossa kerrotaan aina, mitä se sisältää.
 */
export function contextContents(ctx: Context): string {
  return (Object.keys(CATEGORY_LABEL) as Category[])
    .filter((c) => CATEGORY_CONTEXT[c] === ctx)
    .map((c) => CATEGORY_LABEL[c])
    .join(', ');
}

export const MOVEMENT_GROUP_LABEL: Record<MovementGroup, string> = {
  ball_games: 'Pallopelit',
  endurance: 'Kestävyys',
  wheels: 'Pyörät ja laudat',
  winter: 'Talvi',
  water: 'Vesi',
  jumping_gymnastics: 'Hypyt ja voimistelu',
  strength: 'Voima',
  play: 'Leikki',
  varies: 'Vaihtelee',
  other: 'Muu',
};

export const GROUP_LABEL: Record<RecommendationGroup, string> = {
  early_years: 'Alle kouluikäinen',
  school_age: 'Kouluikäinen (7–17 v)',
  adult: 'Aikuinen',
};

export const STRENGTH_LABEL: Record<StrengthDefault, string> = {
  yes: 'esivalittu',
  ask: 'kysytään',
  no: '–',
};

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  sick: 'Sairas',
  injured: 'Loukkaantunut',
  cancelled: 'Peruttu',
  holiday: 'Loma',
  other_commitment: 'Muu meno',
  other: 'Muu',
};

export const FOCUS_TAG_LABEL: Record<FocusTag, string> = {
  passing: 'Syöttely',
  dribbling: 'Kuljetus',
  shooting: 'Laukaukset',
  one_v_one: '1v1',
  two_v_two: '2v2',
  small_sided: 'Pienpelit',
  goalkeeping: 'Maalivahti',
  game_understanding: 'Pelikäsitys',
  physical: 'Fysiikka',
  coordination: 'Koordinaatio',
  other: 'Muu',
};

/** Tagin nimi; tuntematon (uudemman version) tagi näytetään tunnisteena eikä kaada näkymää. */
export const focusTagLabel = (t: string): string => FOCUS_TAG_LABEL[t as FocusTag] ?? t;

/** Suoritusarvio suhteessa lapsen omaan tavalliseen tasoon (SPEC 8). */
export const RATING_LABEL: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Selvästi tavallista vaikeampi päivä',
  2: 'Hieman tavallista heikompi',
  3: 'Tavallinen oma taso',
  4: 'Hieman tavallista parempi',
  5: 'Selvästi tavallista parempi',
};

export const ENJOYMENT_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Ei viihtynyt',
  2: 'Ihan ok',
  3: 'Viihtyi selvästi',
};

export const MONTHS = [
  'tammikuu',
  'helmikuu',
  'maaliskuu',
  'huhtikuu',
  'toukokuu',
  'kesäkuu',
  'heinäkuu',
  'elokuu',
  'syyskuu',
  'lokakuu',
  'marraskuu',
  'joulukuu',
];

export const PROFILE_COLORS = ['#16a34a', '#2563eb', '#db2777', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#475569'];

/** Prosenttiluku ilman desimaaleja, esim. 0.3 → "30 %". */
export const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Pelaajan maalit: "<Nimi>: maalit" (ei taivutusta), ilman nimeä "Pelaajan maalit". */
export const goalsLabel = (name?: string) => (name ? `${name}: maalit` : 'Pelaajan maalit');

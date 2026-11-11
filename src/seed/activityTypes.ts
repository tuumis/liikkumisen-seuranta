// Sisäänrakennetut liikkumismuodot (SPEC 5, "Oletusprofiilit").
// Arvot ovat sovelluksen lähtöoletuksia, eivät virallisia lukuja.
// Tunniste johdetaan pysyvästä avaimesta (t:<key>), ja aikaleima sekä laite
// ovat kiinteitä, jotta molemmat laitteet tuottavat täsmälleen saman tietueen.

import { activityTypeId } from '../domain/ids';
import type {
  ActivityType,
  Category,
  FootballKind,
  MovementGroup,
  StrengthDefault,
  Timestamp,
} from '../domain/types';

export const SEED_TIMESTAMP: Timestamp = '2026-11-11T00:00:00.000Z';
export const SEED_DEVICE = 'seed';

type Row = [
  key: string,
  name: string,
  icon: string,
  category: Category,
  group: MovementGroup,
  light: number,
  moderate: number,
  vigorous: number,
  muscle: StrengthDefault,
  bone: StrengthDefault,
  footballKind?: FootballKind,
];

const ROWS: Row[] = [
  ['football_training', 'Jalkapallo – treeni', '⚽', 'hobby', 'ball_games', 0.35, 0.3, 0.15, 'ask', 'yes', 'training'],
  ['football_game', 'Jalkapallo – peli', '🥅', 'hobby', 'ball_games', 0.2, 0.45, 0.3, 'ask', 'yes', 'game'],
  ['football_tournament', 'Jalkapallo – turnaus', '🏆', 'hobby', 'ball_games', 0.2, 0.45, 0.3, 'ask', 'yes', 'tournament'],
  ['school_pe', 'Koululiikunta', '🏫', 'school_pe', 'varies', 0.35, 0.3, 0.1, 'ask', 'ask'],
  ['school_recess', 'Välitunnit', '🛝', 'school_recess', 'play', 0.5, 0.25, 0.05, 'no', 'ask'],
  ['commute_walk', 'Koulumatka kävellen', '🚶', 'commute', 'endurance', 0.6, 0.4, 0, 'no', 'no'],
  ['commute_bike', 'Koulumatka pyörällä', '🚲', 'commute', 'wheels', 0.2, 0.7, 0.05, 'no', 'no'],
  ['kick_scooter', 'Potkulauta', '🛴', 'self_directed', 'wheels', 0.4, 0.5, 0.05, 'no', 'no'],
  ['outdoor_play', 'Vapaa leikki ulkona', '🌳', 'self_directed', 'play', 0.45, 0.3, 0.1, 'ask', 'ask'],
  ['trampoline', 'Trampoliini', '🤸', 'self_directed', 'jumping_gymnastics', 0.3, 0.3, 0.3, 'ask', 'yes'],
  ['swimming', 'Uinti ja vesileikit', '🏊', 'self_directed', 'water', 0.4, 0.35, 0.1, 'ask', 'no'],
  ['skating', 'Luistelu', '⛸️', 'self_directed', 'winter', 0.3, 0.5, 0.1, 'no', 'ask'],
  ['skiing', 'Hiihto', '⛷️', 'self_directed', 'winter', 0.2, 0.6, 0.15, 'no', 'no'],
  ['family_walk', 'Perheretki / kävely', '👨‍👩‍👧', 'family', 'endurance', 0.7, 0.3, 0, 'no', 'no'],
  ['running', 'Juoksu (aikuinen)', '🏃', 'self_directed', 'endurance', 0, 0.4, 0.6, 'no', 'no'],
  ['gym', 'Kuntosali (aikuinen)', '🏋️', 'self_directed', 'strength', 0.5, 0.25, 0, 'yes', 'no'],
  ['other', 'Muu', '✳️', 'other', 'other', 0.5, 0.2, 0, 'ask', 'ask'],
];

/**
 * Perusarvion oletustehoprofiili kategorian tyypillisestä lajista (sovelluksen
 * oma valinta; SPEC ei määrittele). Käyttäjä voi valita toisen lajin profiilin.
 */
export const ESTIMATE_DEFAULT_TYPE_KEY: Readonly<Record<Category, string>> = Object.freeze({
  hobby: 'football_training',
  school_pe: 'school_pe',
  school_recess: 'school_recess',
  commute: 'commute_walk',
  self_directed: 'outdoor_play',
  family: 'family_walk',
  other: 'other',
});

/** Ensikäynnistyksen ehdotukset (SPEC 12): koulumatkat, välitunnit ja leikki. */
export const ESTIMATE_SUGGESTIONS: readonly { category: Category; label: string }[] = Object.freeze([
  { category: 'school_recess', label: 'Välitunnit ja pihaleikit' },
  { category: 'commute', label: 'Koulumatkat' },
  { category: 'self_directed', label: 'Leikki ja oma liikkuminen' },
]);

export const BUILT_IN_ACTIVITY_TYPES: readonly ActivityType[] = Object.freeze(
  ROWS.map(([key, name, icon, category, movementGroup, light, moderate, vigorous, muscle, bone, footballKind], i) => {
    const t: ActivityType = {
      id: activityTypeId(key),
      key,
      name,
      icon,
      category,
      movementGroup,
      shares: { light, moderate, vigorous },
      muscleDefault: muscle,
      boneDefault: bone,
      usesPlayedMinutes: footballKind === 'game' || footballKind === 'tournament',
      builtIn: true,
      archived: false,
      sortOrder: i,
      updatedAt: SEED_TIMESTAMP,
      updatedBy: SEED_DEVICE,
    };
    if (footballKind) {
      t.sport = 'football';
      t.footballKind = footballKind;
    }
    return Object.freeze(t);
  }),
);

// Viikko-näkymän kortit: näkyvyys, järjestys ja PC:llä palsta (laitekohtainen). Päivät ovat aina näkyvissä.

import { useCardLayout, type CardDef, type CardLayout } from '../../ui/cardLayout';
import { legacyDefaults } from '../../ui/theme';

export type WeekCardId = 'hero' | 'daily' | 'rhythm' | 'gauge' | 'hours' | 'hoursDetail' | 'upcoming' | 'days' | 'recent' | 'details';

export const WEEK_CARDS: CardDef<WeekCardId>[] = [
  { id: 'hero', title: 'Viikon tilanne', text: 'Reipas ja rasittava liikunta, kokonaismäärä ja viikon päivät tiiviisti' },
  { id: 'daily', title: 'Päivittäinen kaavio', text: 'Liikunta päivittäin pylväinä' },
  { id: 'rhythm', title: 'Viikon rytmi', text: 'Rasittavat sekä lihaksia ja luustoa vahvistavat päivät' },
  { id: 'gauge', title: 'Liikuntaa viikossa', text: 'Kokonaismäärä tunteina luokiteltuna (kouluikäiset)', side: true },
  { id: 'hours', title: 'Viikon liikuntatunnit', text: 'Toteutunut ja arvio koko viikolle', side: true },
  { id: 'hoursDetail', title: 'Tunnit päivittäin ja lajeittain', text: 'Erittely: toteuma ja arvio päivittäin, lajit ja viikkorytmi', side: true },
  { id: 'upcoming', title: 'Tulevat kerrat', text: 'Seuraavat suunnitellut kerrat ja pelit', side: true },
  { id: 'days', title: 'Päivät', text: 'Viikon päivät kirjauksineen', locked: true },
  { id: 'recent', title: 'Viimeisimmät kirjaukset', text: 'Viisi viimeksi kirjattua kertaa', side: true },
  { id: 'details', title: 'Tarkemmat luvut', text: 'Tavoitteet ja suositusvertailu yksityiskohtaisesti', side: true },
];

/**
 * Uuden laitteen oletus (27.11.2026, ylläpitäjän oma näkymä): pääpalstassa viikon tilanne ja päivät, sivupalstassa
 * liikuntatunnit, päiväkaavio, liikuntaa viikossa ja tunnit päivittäin. Puhelimella päivät heti tilanteen jälkeen.
 * Jo käytössä olevat laitteet pitävät vanhan oletuksen (legacyDefaults).
 */
export const WEEK_DEFAULT_LAYOUT: CardLayout<WeekCardId> = {
  order: ['hero', 'days', 'hours', 'daily', 'rhythm', 'gauge', 'hoursDetail', 'upcoming', 'recent', 'details'],
  hidden: ['rhythm', 'upcoming', 'recent', 'details'],
  side: ['hours', 'daily', 'rhythm', 'gauge', 'hoursDetail', 'upcoming', 'recent', 'details'],
};

export const useWeekLayout = () => useCardLayout('weekLayout', WEEK_CARDS, ['hoursDetail'], legacyDefaults() ? undefined : WEEK_DEFAULT_LAYOUT);

// Viikko-näkymän kortit: näkyvyys, järjestys ja PC:llä palsta (laitekohtainen). Päivät ovat aina näkyvissä.

import { useCardLayout, type CardDef } from '../../ui/cardLayout';

export type WeekCardId = 'hero' | 'daily' | 'rhythm' | 'gauge' | 'hours' | 'upcoming' | 'days' | 'recent' | 'details';

export const WEEK_CARDS: CardDef<WeekCardId>[] = [
  { id: 'hero', title: 'Viikon tilanne', text: 'Reipas ja rasittava liikunta, kokonaismäärä ja viikon päivät tiiviisti' },
  { id: 'daily', title: 'Päivittäinen kaavio', text: 'Liikunta päivittäin pylväinä' },
  { id: 'rhythm', title: 'Viikon rytmi', text: 'Rasittavat sekä lihaksia ja luustoa vahvistavat päivät' },
  { id: 'gauge', title: 'Liikuntaa viikossa', text: 'Kokonaismäärä tunteina luokiteltuna (kouluikäiset)', side: true },
  { id: 'hours', title: 'Viikon liikuntatunnit', text: 'Toteuma ja arvio koko viikolle', side: true },
  { id: 'upcoming', title: 'Tulevat kerrat', text: 'Seuraavat suunnitellut kerrat ja pelit', side: true },
  { id: 'days', title: 'Päivät', text: 'Viikon päivät kirjauksineen', locked: true },
  { id: 'recent', title: 'Viimeisimmät kirjaukset', text: 'Viisi viimeksi kirjattua kertaa', side: true },
  { id: 'details', title: 'Tarkemmat luvut', text: 'Tavoitteet ja suositusvertailu yksityiskohtaisesti', side: true },
];

export const useWeekLayout = () => useCardLayout('weekLayout', WEEK_CARDS);

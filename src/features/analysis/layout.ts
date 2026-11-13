// Analyysin kortit: käyttäjä valitsee näkyvät kortit ja niiden järjestyksen (laitekohtainen).

import { useCardLayout, type CardDef } from '../../ui/cardLayout';

export type AnalysisCardId = 'goals' | 'daily' | 'gauge' | 'hours' | 'hoursDetail' | 'highlights' | 'football' | 'categories' | 'adherence' | 'heatmap' | 'quality';

export const ANALYSIS_CARDS: CardDef<AnalysisCardId>[] = [
  { id: 'goals', title: 'Tavoitteet', text: 'Suositusvertailu: reipas ja rasittava, rasittavat ja vahvistavat päivät' },
  { id: 'daily', title: 'Päivittäinen kaavio', text: 'Reipas ja rasittava liikunta päivittäin' },
  { id: 'gauge', title: 'Liikuntaa viikossa', text: 'Kokonaismäärä tunteina luokiteltuna (kouluikäiset)' },
  { id: 'hours', title: 'Viikon liikuntatunnit', text: 'Toteutunut ja arvio koko viikolle' },
  { id: 'hoursDetail', title: 'Tunnit päivittäin ja lajeittain', text: 'Erittely: toteuma ja arvio päivittäin, lajit ja viikkopohja' },
  { id: 'highlights', title: 'Kohokohdat', text: 'Kommentit ja yleisarvio suoritustasosta' },
  { id: 'football', title: 'Jalkapallo', text: 'Treenit, pelit, peliaika ja tulokset' },
  { id: 'categories', title: 'Jakauma kategorioittain', text: 'Mistä reipas ja rasittava liikunta kertyy' },
  { id: 'adherence', title: 'Suunnitelma vs. toteuma', text: 'Kuinka suunnitellut kerrat toteutuivat' },
  { id: 'heatmap', title: 'Aktiivisuuskartta', text: 'Vuoden päivät ruudukkona: tavoite, minuutit tai kerrat. Koko leveys, suurennettavissa' },
  { id: 'quality', title: 'Datan laatu', text: 'Vertailtavat päivät, kattavuus ja arvion osuus' },
];

export const useAnalysisLayout = () => useCardLayout('analysisLayout', ANALYSIS_CARDS, ['quality']);

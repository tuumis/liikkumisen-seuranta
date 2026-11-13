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

/** Kuukausi-, kausi- ja vuosinäkymän kortit (oma järjestys ja näkyvyys). */
export type LongCardId = 'trend' | 'compare' | 'context' | 'variety' | 'weeklyGoals' | 'quality' | 'heatmap';

export const LONG_CARDS: CardDef<LongCardId>[] = [
  { id: 'trend', title: 'Reipas ja rasittava', text: 'Kehitys viikoittain tai kuukausittain' },
  { id: 'compare', title: 'Vertailu', text: 'Valittu jakso ja edellinen samanlainen jakso' },
  { id: 'context', title: 'Ohjattu ja omaehtoinen', text: 'Mistä reipas ja rasittava kertyy' },
  { id: 'variety', title: 'Monipuolisuus ja lajit', text: 'Liikuntaryhmät ja lajit kirjatuista kerroista' },
  { id: 'weeklyGoals', title: 'Suositusten toteutuminen viikoittain', text: 'Viikkotavoitteet' },
  { id: 'quality', title: 'Datan laatu', text: 'Kattavuus ja arvion osuus' },
  { id: 'heatmap', title: 'Aktiivisuuskartta', text: 'Vuoden päivät ruudukkona; valittu jakso korostettuna. Koko leveys' },
];

export const useLongTermLayout = () => useCardLayout('longTermLayout', LONG_CARDS);

/** Kortit palstaryhmiin; täysleveä kortti (aktiivisuuskartta) omaksi lohkokseen järjestyksen mukaiseen kohtaan. */
export function fullWidthSegments<Id extends string, F extends Id>(ids: Id[], full: F): (Exclude<Id, F>[] | F)[] {
  const out: (Exclude<Id, F>[] | F)[] = [];
  for (const id of ids) {
    const last = out.at(-1);
    if (id === full) out.push(full);
    else if (Array.isArray(last)) last.push(id as Exclude<Id, F>);
    else out.push([id as Exclude<Id, F>]);
  }
  return out;
}

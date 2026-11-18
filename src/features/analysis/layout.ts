// Analyysin kortit. Selkeytetty 18.11.2026: jokainen taso vastaa omiin kysymyksiinsä ja näkymä valitaan
// aiheina ("Mitä haluat nähdä?"); yksittäiset kortit ja järjestys löytyvät "Lisää vaihtoehtoja" -kohdasta.
// Viikko: täyttyikö suositus ja mistä liikunta kertyi. Kuukausi: mihin suuntaan ollaan menossa.
// Kausi: kausi kokonaisuutena. Vuosi: koko vuosi yhdellä silmäyksellä.
// Asetus on laitekohtainen. Tallennusavaimet vaihtuivat, joten kaikki aloittavat uusista oletuksista.

import { useCardLayout, type CardDef, type CardTopic } from '../../ui/cardLayout';
import type { LongKind } from '../../domain/longTerm';

export type AnalysisCardId = 'goals' | 'days' | 'adherence' | 'football' | 'highlights' | 'hours' | 'hoursDetail' | 'gauge' | 'heatmap' | 'quality';

export const ANALYSIS_CARDS: CardDef<AnalysisCardId>[] = [
  { id: 'goals', title: 'Suositus', text: 'Täyttyikö ikäryhmän suositus: pääluku ja päivätavoitteet' },
  { id: 'days', title: 'Päivät ja lajit', text: 'Reipas ja rasittava liikunta päivittäin ja mistä se kertyi' },
  { id: 'adherence', title: 'Suunnitelma ja toteuma', text: 'Toteutuivatko suunnitellut kerrat (näkyy, kun viikolla on suunnitelmia)' },
  { id: 'football', title: 'Jalkapallo', text: 'Treenit, pelit, peliaika ja tulokset' },
  { id: 'highlights', title: 'Kohokohdat', text: 'Kommentit ja yleisarvio treeneistä ja peleistä' },
  { id: 'hours', title: 'Viikon liikuntatunnit', text: 'Toteutunut ja arvio koko viikolle' },
  { id: 'hoursDetail', title: 'Tunnit päivittäin ja lajeittain', text: 'Toteuma ja arvio päivittäin, lajit ja viikkopohja' },
  { id: 'gauge', title: 'Liikuntaa viikossa', text: 'Kokonaismäärä tunteina luokiteltuna (kouluikäiset)' },
  { id: 'heatmap', title: 'Aktiivisuuskartta', text: 'Vuoden päivät ruudukkona. Koko leveys' },
  { id: 'quality', title: 'Datan laatu', text: 'Vertailtavat päivät, kattavuus ja arvion osuus' },
];

export const ANALYSIS_TOPICS: CardTopic<AnalysisCardId>[] = [
  { id: 'goals', title: 'Suositus', text: 'Täyttyikö ikäryhmän liikkumissuositus', cards: ['goals'] },
  { id: 'days', title: 'Päivät ja lajit', text: 'Minä päivinä ja mistä liikunta kertyi', cards: ['days'] },
  { id: 'plan', title: 'Suunnitelma', text: 'Toteutuivatko suunnitellut kerrat', cards: ['adherence'] },
  { id: 'football', title: 'Jalkapallo', text: 'Treenit, pelit, peliaika ja tulokset', cards: ['football'] },
  { id: 'highlights', title: 'Kohokohdat', text: 'Kommentit ja arviot treeneistä ja peleistä', cards: ['highlights'] },
  { id: 'details', title: 'Tarkemmat luvut', text: 'Tunnit päivittäin ja lajeittain, aktiivisuuskartta ja datan laatu', cards: ['hours', 'hoursDetail', 'gauge', 'heatmap', 'quality'] },
];

export const useAnalysisLayout = () => useCardLayout('analysisLayout2', ANALYSIS_CARDS, ['highlights', 'hours', 'hoursDetail', 'gauge', 'heatmap', 'quality']);

/** Kuukausi-, kausi- ja vuosinäkymän kortit; kullakin tasolla oma järjestys ja näkyvyys. */
export type LongCardId = 'trend' | 'compare' | 'weeklyGoals' | 'variety' | 'context' | 'highlights' | 'heatmap' | 'quality';

const LONG_DEF: Record<LongCardId, Omit<CardDef<LongCardId>, 'id'>> = {
  trend: { title: 'Kehitys', text: 'Reipas ja rasittava liikunta viikoittain tai kuukausittain' },
  compare: { title: 'Vertailu edelliseen', text: 'Valittu jakso ja edellinen samanlainen jakso' },
  weeklyGoals: { title: 'Suositusten toteutuminen', text: 'Monenako viikkona tavoitteet täyttyivät' },
  variety: { title: 'Lajit ja monipuolisuus', text: 'Liikuntaryhmät ja lajit kirjatuista kerroista' },
  context: { title: 'Ohjattu ja omaehtoinen', text: 'Mistä kirjattu reipas ja rasittava kertyy' },
  highlights: { title: 'Kohokohdat', text: 'Kommentit ja yleisarvio jaksolta' },
  heatmap: { title: 'Aktiivisuuskartta', text: 'Vuoden päivät ruudukkona; valittu jakso korostettuna. Koko leveys' },
  quality: { title: 'Datan laatu', text: 'Kattavuus ja arvion osuus' },
};

/** Tason oletusjärjestys ja piilotetut: kuukausi = suunta, kausi = kokonaisuus, vuosi = kartta ensin. */
const LONG_DEFAULTS: Record<LongKind, { order: LongCardId[]; hidden: LongCardId[] }> = {
  month: { order: ['trend', 'compare', 'variety', 'highlights', 'weeklyGoals', 'context', 'heatmap', 'quality'], hidden: ['weeklyGoals', 'context', 'heatmap', 'quality'] },
  season: { order: ['trend', 'weeklyGoals', 'variety', 'compare', 'highlights', 'context', 'heatmap', 'quality'], hidden: ['context', 'heatmap', 'quality'] },
  year: { order: ['heatmap', 'trend', 'weeklyGoals', 'variety', 'compare', 'context', 'highlights', 'quality'], hidden: ['compare', 'context', 'highlights', 'quality'] },
};

const LONG_CARDS: Record<LongKind, CardDef<LongCardId>[]> = {
  month: LONG_DEFAULTS.month.order.map((id) => ({ id, ...LONG_DEF[id] })),
  season: LONG_DEFAULTS.season.order.map((id) => ({ id, ...LONG_DEF[id] })),
  year: LONG_DEFAULTS.year.order.map((id) => ({ id, ...LONG_DEF[id] })),
};

export const LONG_TOPICS: CardTopic<LongCardId>[] = [
  { id: 'trend', title: 'Kehitys', text: 'Liikunta ajan mittaan ja vertailu edelliseen jaksoon', cards: ['trend', 'compare'] },
  { id: 'goals', title: 'Suositukset', text: 'Monenako viikkona tavoitteet täyttyivät', cards: ['weeklyGoals'] },
  { id: 'variety', title: 'Lajit ja monipuolisuus', text: 'Mitä lajeja ja mistä liikunta kertyi', cards: ['variety', 'context'] },
  { id: 'highlights', title: 'Kohokohdat', text: 'Kommentit ja arviot jaksolta', cards: ['highlights'] },
  { id: 'details', title: 'Tarkemmat luvut', text: 'Aktiivisuuskartta ja datan laatu', cards: ['heatmap', 'quality'] },
];

export const useLongTermLayout = (kind: LongKind) => useCardLayout(`longLayout:${kind}`, LONG_CARDS[kind], LONG_DEFAULTS[kind].hidden);

/** Tason esittely näkymän yläosassa: mihin kysymykseen taso vastaa. */
export const LEVEL_INTRO: Record<'week' | LongKind, string> = {
  week: 'Täyttyikö suositus tällä viikolla ja mistä liikunta kertyi.',
  month: 'Mihin suuntaan ollaan menossa: kehitys viikoittain ja vertailu edelliseen kuukauteen.',
  season: 'Kausi kokonaisuutena: kehitys kuukausittain, suositusten toteutuminen ja lajit.',
  year: 'Koko vuosi yhdellä silmäyksellä: aktiivisuuskartta, kehitys ja suositukset.',
};

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

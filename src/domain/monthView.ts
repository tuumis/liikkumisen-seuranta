// Viikko-näkymän kuukausikalenteri (27.11.2026): kaikki lajit kuukauden ruudukossa. Päivän rivit kirjatuista
// kerroista, avoimista ja väliin jääneistä suunnitelmista (viikkorytmi, yksittäiset, pelit) ja kalenterimerkinnöistä.
// Puhdas laskenta; näkymä (features/week/MonthView) piirtää ruudut ja valitun päivän kortin.

import { foldTrainingSelves } from './football';
import { isEstimateConfirmation } from './hours';
import { teamNameFor } from './monthCalendar';
import { shortName } from './weekReport';
import type { ActivityType, CalendarNote, Fixture, ISODate, PlannedSession, Session, UUID } from './types';

/** done = kirjattu kerta; open = suunniteltu; skipped = ei tehty; note = kalenterimerkintä. */
export type MonthItemKind = 'done' | 'open' | 'skipped' | 'note';

export interface MonthItem {
  key: string;
  kind: MonthItemKind;
  time?: string;
  title: string;
  /** Laji (kuvake); puuttuu merkinnältä. */
  typeId?: UUID;
  /** Koko perheen merkintä. */
  family?: boolean;
  /** Perhenäkymässä: kenen rivi (puuttuu koko perheen merkinnältä). */
  profileId?: UUID;
}

export interface MonthItemsInput {
  sessions: Session[];
  plans: PlannedSession[];
  notes?: CalendarNote[];
  /** Pelien ja turnausten tiedot suunnitelmille (vastustaja, tapahtuman nimi). */
  fixtures?: ReadonlyMap<UUID, Fixture>;
  types: ReadonlyMap<UUID, ActivityType>;
  /** Perhenäkymä (27.11.2026): rivit merkitään profiilille (ei koko perheen merkintöjä). */
  profileId?: UUID;
}

/** Tulevan pelin nimi: vastustaja ("vs HJK Musta") tai tapahtuman nimi; muuten lajin nimi. */
function planTitle(p: PlannedSession, t: ActivityType | undefined, f: Fixture | undefined): string {
  const opp = f?.opponent ?? f?.games?.find((g) => g.opponent)?.opponent;
  if (f?.eventName) return f.eventName;
  if (opp) return `vs ${teamNameFor(opp, 'short')}`;
  return shortName(p, t);
}

const order = (a: MonthItem, b: MonthItem) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title, 'fi');

/** Päivittäiset rivit aikajärjestyksessä (ilman kellonaikaa ensin). */
export function monthItems(input: MonthItemsInput): Map<ISODate, MonthItem[]> {
  const out = new Map<ISODate, MonthItem[]>();
  const who = input.profileId ? { profileId: input.profileId } : {};
  const add = (date: ISODate, item: MonthItem) => out.set(date, [...(out.get(date) ?? []), item.family ? item : { ...item, ...who }]);
  // Arkiliikunnan vahvistukset eivät ole kertoja; treenin verryttely näkyy treenin yhteydessä.
  const { rows } = foldTrainingSelves(input.sessions.filter((s) => !isEstimateConfirmation(s)));
  for (const s of rows) {
    add(s.date, { key: s.id, kind: 'done', title: shortName(s, input.types.get(s.activityTypeId)), typeId: s.activityTypeId, ...(s.startTime ? { time: s.startTime } : {}) });
  }
  for (const p of input.plans) {
    if (p.status === 'done') continue; // kuitattu näkyy kertana
    add(p.date, {
      key: p.id,
      kind: p.status === 'skipped' ? 'skipped' : 'open',
      title: planTitle(p, input.types.get(p.activityTypeId), input.fixtures?.get(p.id)),
      typeId: p.activityTypeId,
      ...(p.startTime ? { time: p.startTime } : {}),
    });
  }
  for (const n of input.notes ?? []) {
    add(n.date, { key: n.id, kind: 'note', title: n.title, ...(n.startTime ? { time: n.startTime } : {}), ...(n.profileId ? {} : { family: true }) });
  }
  for (const list of out.values()) list.sort(order);
  return out;
}

/**
 * Perhenäkymä (27.11.2026): profiilien rivit samaan kalenteriin. Koko perheen merkintä on jokaisen profiilin
 * listalla, joten se näytetään kerran. Päivän sisällä aikajärjestys.
 */
export function mergeMonthItems(maps: ReadonlyMap<ISODate, MonthItem[]>[]): Map<ISODate, MonthItem[]> {
  const out = new Map<ISODate, MonthItem[]>();
  const seen = new Set<string>();
  for (const m of maps) {
    for (const [d, list] of m) {
      const add = list.filter((i) => !seen.has(i.key));
      for (const i of add) seen.add(i.key);
      if (add.length) out.set(d, [...(out.get(d) ?? []), ...add]);
    }
  }
  for (const list of out.values()) list.sort(order);
  return out;
}

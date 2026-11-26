// Viikko-näkymän kuukausikalenteri (27.11.2026): kaikki lajit kuukauden ruudukossa. Päivän rivit kirjatuista
// kerroista, avoimista ja väliin jääneistä suunnitelmista (viikkorytmi, yksittäiset, pelit) ja kalenterimerkinnöistä.
// Puhdas laskenta; näkymä (features/week/MonthView) piirtää ruudut ja valitun päivän kortin.

import { noteTimeText } from './calendarNotes';
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
  /** Valitun päivän lisätiedot (27.11.2026): kesto, joukkue, paikka; merkinnän päättyminen ja muistiinpanot. */
  durationMin?: number;
  teamId?: UUID;
  templateItemId?: UUID;
  location?: string;
  endTime?: string;
  memo?: string;
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
    add(s.date, {
      key: s.id,
      kind: 'done',
      title: shortName(s, input.types.get(s.activityTypeId)),
      typeId: s.activityTypeId,
      durationMin: s.durationMin,
      ...(s.startTime ? { time: s.startTime } : {}),
      ...(s.teamId ? { teamId: s.teamId } : {}),
    });
  }
  for (const p of input.plans) {
    if (p.status === 'done') continue; // kuitattu näkyy kertana
    add(p.date, {
      key: p.id,
      kind: p.status === 'skipped' ? 'skipped' : 'open',
      title: planTitle(p, input.types.get(p.activityTypeId), input.fixtures?.get(p.id)),
      typeId: p.activityTypeId,
      durationMin: p.durationMin,
      ...(p.startTime ? { time: p.startTime } : {}),
      ...(p.teamId ? { teamId: p.teamId } : {}),
      ...(p.templateItemId ? { templateItemId: p.templateItemId } : {}),
      ...(input.fixtures?.get(p.id)?.location ? { location: input.fixtures.get(p.id)!.location } : {}),
    });
  }
  for (const n of input.notes ?? []) {
    add(n.date, {
      key: n.id,
      kind: 'note',
      title: n.title,
      ...(n.startTime ? { time: n.startTime } : {}),
      ...(n.endTime ? { endTime: n.endTime } : {}),
      ...(n.location ? { location: n.location } : {}),
      ...(n.memo ? { memo: n.memo } : {}),
      ...(n.profileId ? {} : { family: true }),
    });
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

const GAME_LABEL: Record<string, string> = { 't:football_game': 'Ottelu', 't:football_tournament': 'Turnaus', 't:football_friendly': 'Harjoituspeli' };
const clock = (t: string) => t.replace(/^0(\d)/, '$1').replace(':', '.');

/**
 * Valitun päivän rivin lisätiedot (27.11.2026) kuten Jalkapallo-välilehden kalenterissa:
 * "Ottelu · klo 10.00 · Kisapuisto", "FC 2018 · klo 17.30 · 60 min", "Muu merkintä · klo 13.00–14.00 · Terveyskeskus".
 */
export function monthItemDetail(i: MonthItem, team?: string): string {
  if (i.kind === 'note') return ['Muu merkintä', noteTimeText({ startTime: i.time, endTime: i.endTime }), i.location, i.family && 'Koko perhe'].filter(Boolean).join(' · ');
  const game = i.typeId ? GAME_LABEL[i.typeId] : undefined;
  const parts: (string | undefined | false)[] = [game, team, i.time && `klo ${clock(i.time)}`, !game && i.durationMin !== undefined && `${i.durationMin} min`, i.location];
  return parts.filter(Boolean).join(' · ');
}

/** Rivin aikaikkuna minuutteina (alku = kellonaika, loppu = alku + kesto tai merkinnän päättyminen; oletus 60 min). */
function itemWindow(i: MonthItem): { start: number; end: number } | undefined {
  if (!i.time) return undefined;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const start = toMin(i.time);
  const end = i.endTime ? toMin(i.endTime) : start + (i.durationMin ?? 60);
  return { start, end: Math.max(end, start + 15) };
}

/** Ikkuna tekstinä: "17.30–18.30". */
export function itemWindowText(i: MonthItem): string | undefined {
  const w = itemWindow(i);
  if (!w) return undefined;
  const t = (m: number) => `${Math.floor(m / 60) % 24}.${String(m % 60).padStart(2, '0')}`;
  return `${t(w.start)}–${t(Math.min(w.end, 24 * 60 - 1))}`;
}

/**
 * Perheen viikko (27.11.2026): eri profiilien samaan aikaan osuvat menot samana päivänä. Mukana vain kellonajalliset
 * kerrat, suunnitelmat ja omat merkinnät (ei väliin jääneitä, ei koko perheen merkintöjä); ilman kellonaikaa olevaa
 * riviä (esim. koululiikunta) ei tulkita päällekkäiseksi.
 */
export function familyClashes(day: MonthItem[]): [MonthItem, MonthItem][] {
  const list = day.filter((i) => i.profileId && !i.family && i.kind !== 'skipped' && i.time);
  const out: [MonthItem, MonthItem][] = [];
  for (let a = 0; a < list.length; a++) {
    for (let b = a + 1; b < list.length; b++) {
      const x = list[a];
      const y = list[b];
      if (x.profileId === y.profileId) continue;
      const wx = itemWindow(x)!;
      const wy = itemWindow(y)!;
      if (wx.start < wy.end && wy.start < wx.end) out.push([x, y]);
    }
  }
  return out;
}

// Kokonaiskuormitus valmentajalle (25.11.2026): jakson koko liikunta yhdellä kuvalla – jalkapallo, omatoiminen
// harjoittelu, muut lajit, koululiikunta ja arkiliikunta viikoittain, lepo- ja rasittavat päivät sekä osallistuminen.
// Puhdas funktio. Lajit kirjatuista kerroista; arkiliikunta (25.11.2026 korjaus, käyttäjä: "todellisuus on yli 20 h")
// = päivän liikunta kuten Viikko-näkymän tunneissa (weeklyHours actualMin: kerrat + arkiliikunnan arvio) miinus
// lajikerrat, joten koosteen summa vastaa sovelluksen liikuntatunteja. Luvut ovat arvioita lajien tyypillisestä tehosta.

import { addDays, datesBetween, isoWeek, isoWeekday, parseISODate, startOfIsoWeek } from './dates';
import { isClubFootball, isClubTraining } from './football';
import { isEstimateConfirmation } from './hours';
import type { ActivityType, DayFlag, ISODate, PlannedSession, Session, SkipReason, UUID } from './types';

export type CoachPart = 'football' | 'own' | 'other' | 'school' | 'everyday';
export const COACH_PARTS: readonly CoachPart[] = ['football', 'own', 'other', 'school', 'everyday'];
export const COACH_PART_LABEL: Record<CoachPart, string> = {
  football: 'Jalkapallo',
  own: 'Omatoiminen',
  other: 'Muut lajit',
  school: 'Koululiikunta',
  everyday: 'Arkiliikunta',
};

/** Kuvassa näytettävät tiedot (jakopaneelin valinnat). */
export interface CoachOptions {
  /** Muut lajit ja koululiikunta. */
  other: boolean;
  /** Omatoiminen jalkapalloharjoittelu (myös treenin verryttely). */
  own: boolean;
  /** Rasittavat päivät ja lepopäivät. */
  days: boolean;
  /** Poissaolojen määrä. */
  absences: boolean;
  /** Poissaolojen syyt. */
  reasons: boolean;
  /** Jalkapallokertojen muistiinpanot. */
  notes: boolean;
  /** Arkiliikunta (välitunnit, koulumatkat, päiväkoti ym.). */
  everyday: boolean;
}

export const DEFAULT_COACH_OPTIONS: CoachOptions = { other: true, own: true, everyday: true, days: true, absences: true, reasons: false, notes: false };

export interface CoachBucket {
  /** "vk 46" tai "marras". */
  label: string;
  start: ISODate;
  end: ISODate;
  minutes: Record<CoachPart, number>;
  total: number;
  /** Viikko tai kuukausi on vielä kesken (päättyy tähän päivään). */
  partial: boolean;
}

export interface CoachSummary {
  start: ISODate;
  /** Jakson loppu rajattuna tähän päivään. */
  end: ISODate;
  /** Jakson nimi kuvaan: "vk 45–48", "vk 47", "1.9.–25.11.2026". */
  title: string;
  days: number;
  /** Viikot (enintään 9) tai pidemmällä jaksolla kuukaudet. */
  buckets: CoachBucket[];
  bucketKind: 'week' | 'month';
  minutes: Record<CoachPart, number>;
  /** Kaikki kirjattu liikunta (h/vko). */
  hoursPerWeek: number;
  /** Jalkapallo + omatoiminen (h/vko). */
  footballHoursPerWeek: number;
  /** Jalkapallon osuus kaikesta liikunnasta (myös arkiliikunta; 0–1); null, jos ei liikuntaa. */
  footballShare: number | null;
  restDaysPerWeek: number;
  vigorousDaysPerWeek: number;
  clubTrainings: { count: number; perWeek: number; attended: number; planned: number };
  games: { count: number; tournaments: number; tournamentLabels: string[] };
  /** Muut lajit kerroittain (eniten ensin), koululiikunta erikseen. */
  otherTypes: { name: string; count: number; perWeek: number }[];
  schoolPerWeek: number;
  absences: { count: number; reasons: { reason: SkipReason; count: number }[] };
  injuredDays: number;
  notes: { date: ISODate; text: string }[];
  /** Neutraalit huomiot (enintään 2) kaikesta liikunnasta. */
  observations: string[];
  /** Huomioiden osat: rasittava putki ja viikko ilman lepopäivää (kasvu lasketaan näkyvistä osista, coachView). */
  streakNote?: string;
  noRestNote?: string;
}

export interface CoachInput {
  start: ISODate;
  end: ISODate;
  today: ISODate;
  sessions: Session[];
  plans: PlannedSession[];
  flags: DayFlag[];
  types: Map<UUID, ActivityType>;
  /** Rasittavan päivän raja (min). */
  vigorousMin: number;
  /** Päivän liikunta (min) kuten Viikko-näkymän tunneissa (kerrat + arkiliikunnan arvio); puuttuessa ei arkiliikuntaa. */
  dayTotalMin?: ReadonlyMap<ISODate, number>;
}

const MONTHS = ['tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'];
const WEEKDAYS = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'];
/** Arkiliikunta (pääosin arviona): ei kuulu valmentajan koosteeseen. */
const EVERYDAY: readonly string[] = ['school_recess', 'commute', 'daycare'];
/** Yli 9 viikon jakso näytetään kuukausittain. */
const MAX_WEEKS = 9;

/** Kerran osa koosteessa; undefined = ei mukana. */
export function coachPartOf(s: Session, types: Map<UUID, ActivityType>): CoachPart | undefined {
  if (s.deletedAt || s.durationMin <= 0 || isEstimateConfirmation(s)) return undefined;
  const t = types.get(s.activityTypeId);
  if (!t) return 'other';
  if (isClubFootball(t)) return 'football';
  if (t.sport === 'football') return 'own';
  if (t.category === 'school_pe') return 'school';
  if (EVERYDAY.includes(t.category)) return undefined;
  return 'other';
}

const emptyParts = (): Record<CoachPart, number> => ({ football: 0, own: 0, other: 0, school: 0, everyday: 0 });
const sumParts = (m: Record<CoachPart, number>) => COACH_PARTS.reduce((a, p) => a + m[p], 0);
const fiDate = (d: ISODate) => {
  const p = parseISODate(d);
  return `${p.day}.${p.month}.`;
};

/** Jakson otsikko: maanantaista sunnuntaihin (tai tähän päivään) "vk 45–48", muuten päivämäärät. */
export function coachTitle(start: ISODate, end: ISODate, today: ISODate): string {
  const ws = isoWeek(start);
  const we = isoWeek(end);
  if (isoWeekday(start) === 1 && (isoWeekday(end) === 7 || end === today)) {
    return ws.week === we.week && ws.year === we.year ? `vk ${ws.week}` : `vk ${ws.week}–${we.week}`;
  }
  return `${fiDate(start)}–${fiDate(end)}${parseISODate(end).year}`;
}

type BucketRange = Pick<CoachBucket, 'label' | 'start' | 'end'>;

function buckets(start: ISODate, end: ISODate): { kind: 'week' | 'month'; list: BucketRange[] } {
  const weeks: BucketRange[] = [];
  for (let w = startOfIsoWeek(start); w <= end; w = addDays(w, 7)) {
    weeks.push({ label: `vk ${isoWeek(w).week}`, start: w < start ? start : w, end: addDays(w, 6) > end ? end : addDays(w, 6) });
  }
  if (weeks.length <= MAX_WEEKS) return { kind: 'week', list: weeks };
  const months: BucketRange[] = [];
  let d = start;
  while (d <= end) {
    const p = parseISODate(d);
    const next = p.month === 12 ? `${p.year + 1}-01-01` : `${p.year}-${String(p.month + 1).padStart(2, '0')}-01`;
    const last = addDays(next, -1);
    months.push({ label: MONTHS[p.month - 1], start: d, end: last > end ? end : last });
    d = next;
  }
  return { kind: 'month', list: months };
}

export function coachSummary(input: CoachInput): CoachSummary {
  const { start, today, types, vigorousMin } = input;
  const end = input.end > today ? today : input.end;
  const dates = end >= start ? datesBetween(start, end) : [];
  const days = dates.length;
  const perWeek = (n: number) => (days > 0 ? (n / days) * 7 : 0);
  const inRange = (d: ISODate) => d >= start && d <= end;

  const sessions = input.sessions.filter((s) => inRange(s.date));
  const counted = sessions.map((s) => ({ s, part: coachPartOf(s, types) })).filter((x): x is { s: Session; part: CoachPart } => x.part !== undefined);

  // Kertymät osittain ja päivittäin.
  const minutes = emptyParts();
  const dayMinutes = new Map<ISODate, number>();
  const dayVigorous = new Map<ISODate, number>();
  for (const { s, part } of counted) {
    minutes[part] += s.durationMin;
    dayMinutes.set(s.date, (dayMinutes.get(s.date) ?? 0) + s.durationMin);
  }
  // Rasittava päivä kuten muualla sovelluksessa: kirjattujen kertojen rasittavat minuutit (myös arkiliikunnan kerrat).
  for (const s of sessions) {
    if (s.deletedAt || isEstimateConfirmation(s)) continue;
    dayVigorous.set(s.date, (dayVigorous.get(s.date) ?? 0) + (s.minutes?.vigorous ?? 0));
  }
  // Arkiliikunta: päivän liikunta miinus koosteen lajikerrat (ei negatiivinen).
  const everyday = new Map<ISODate, number>();
  for (const d of dates) {
    const e = Math.max(0, Math.round((input.dayTotalMin?.get(d) ?? 0) - (dayMinutes.get(d) ?? 0)));
    if (e > 0) everyday.set(d, e);
    minutes.everyday += e;
  }
  const vigorousDates = dates.filter((d) => (dayVigorous.get(d) ?? 0) >= vigorousMin && vigorousMin > 0);
  const restDates = dates.filter((d) => !dayMinutes.get(d));

  const b = buckets(start, end);
  const bucketList: CoachBucket[] = b.list.map((x) => {
    const m = emptyParts();
    for (const { s, part } of counted) if (s.date >= x.start && s.date <= x.end) m[part] += s.durationMin;
    for (const [d, e] of everyday) if (d >= x.start && d <= x.end) m.everyday += e;
    const full = b.kind === 'week' ? isoWeekday(x.end) === 7 : parseISODate(addDays(x.end, 1)).day === 1;
    return { ...x, minutes: m, total: sumParts(m), partial: x.end === today && !full };
  });

  const total = sumParts(minutes);
  const fb = minutes.football + minutes.own;

  // Seuran treenit ja osallistuminen suunnitelluista kerroista (peruttu ei ole poissaolo).
  const clubTrainingCount = counted.filter(({ s }) => !s.linkedTo && isClubTraining(types.get(s.activityTypeId))).length;
  const pastPlans = input.plans.filter((p) => !p.deletedAt && inRange(p.date) && (p.date < today || p.status !== 'open'));
  const trainingPlans = pastPlans.filter((p) => isClubTraining(types.get(p.activityTypeId)));
  const attended = trainingPlans.filter((p) => p.status === 'done').length;
  const missedTraining = trainingPlans.filter((p) => p.status === 'skipped' && p.skipReason !== 'cancelled').length;

  // Poissaolot: seuran jalkapallon väliin jääneet kerrat (ei peruttuja).
  const absent = pastPlans.filter((p) => p.status === 'skipped' && p.skipReason !== 'cancelled' && isClubFootball(types.get(p.activityTypeId)));
  const reasonCounts = new Map<SkipReason, number>();
  for (const p of absent) reasonCounts.set(p.skipReason ?? 'other', (reasonCounts.get(p.skipReason ?? 'other') ?? 0) + 1);

  // Pelit ja turnaukset.
  let gameCount = 0;
  const tournamentLabels: string[] = [];
  for (const { s } of counted) {
    const t = types.get(s.activityTypeId);
    if (!isClubFootball(t) || s.linkedTo) continue;
    if (t?.footballKind === 'game' || t?.footballKind === 'friendly') gameCount++;
    if (t?.footballKind === 'tournament') {
      const l = `vk ${isoWeek(s.date).week}`;
      if (!tournamentLabels.includes(l)) tournamentLabels.push(l);
    }
  }
  const tournaments = counted.filter(({ s }) => !s.linkedTo && types.get(s.activityTypeId)?.footballKind === 'tournament' && isClubFootball(types.get(s.activityTypeId))).length;

  // Muut lajit kerroittain.
  const other = new Map<string, number>();
  let schoolCount = 0;
  for (const { s, part } of counted) {
    if (s.linkedTo) continue;
    if (part === 'school') schoolCount++;
    if (part !== 'other') continue;
    const name = types.get(s.activityTypeId)?.name ?? 'Muu';
    other.set(name, (other.get(name) ?? 0) + 1);
  }
  const otherTypes = [...other.entries()]
    .sort((a, b2) => b2[1] - a[1] || a[0].localeCompare(b2[0], 'fi'))
    .map(([name, count]) => ({ name, count, perWeek: perWeek(count) }));

  const injuredDays = input.flags.filter((f) => !f.deletedAt && f.reason === 'injured' && inRange(f.date)).length;

  const notes = counted
    .filter(({ s, part }) => (part === 'football' || part === 'own') && s.note?.trim())
    .map(({ s }) => ({ date: s.date, text: s.note!.trim() }))
    .sort((a, b2) => (a.date < b2.date ? 1 : -1))
    .slice(0, 3);

  return {
    start,
    end,
    title: coachTitle(start, end, today),
    days,
    buckets: bucketList,
    bucketKind: b.kind,
    minutes,
    hoursPerWeek: perWeek(total) / 60,
    footballHoursPerWeek: perWeek(fb) / 60,
    footballShare: total > 0 ? fb / total : null,
    restDaysPerWeek: perWeek(restDates.length),
    vigorousDaysPerWeek: perWeek(vigorousDates.length),
    clubTrainings: { count: clubTrainingCount, perWeek: perWeek(clubTrainingCount), attended, planned: attended + missedTraining },
    games: { count: gameCount, tournaments, tournamentLabels },
    otherTypes,
    schoolPerWeek: perWeek(schoolCount),
    absences: { count: absent.length, reasons: [...reasonCounts.entries()].sort((a, b2) => b2[1] - a[1]).map(([reason, count]) => ({ reason, count })) },
    injuredDays,
    notes,
    ...observations(vigorousDates, dates, bucketList, b.kind, dayMinutes),
  };
}

/** Neutraalit huomiot: pitkä rasittava putki, viikon kasvu edellisestä ja viikko ilman lepopäivää. */
function observations(
  vigorous: ISODate[],
  dates: ISODate[],
  list: CoachBucket[],
  kind: 'week' | 'month',
  dayMinutes: Map<ISODate, number>,
): Pick<CoachSummary, 'observations' | 'streakNote' | 'noRestNote'> {
  let streakNote: string | undefined;
  let noRestNote: string | undefined;
  // Pisin putki peräkkäisiä rasittavia päiviä (vähintään 3).
  const set = new Set(vigorous);
  let best: { from: ISODate; len: number } | undefined;
  let run: { from: ISODate; len: number } | undefined;
  for (const d of dates) {
    if (!set.has(d)) {
      run = undefined;
      continue;
    }
    run = run ? { from: run.from, len: run.len + 1 } : { from: d, len: 1 };
    if (!best || run.len > best.len) best = { ...run };
  }
  if (best && best.len >= 3) {
    const to = addDays(best.from, best.len - 1);
    const n = best.len === 3 ? 'Kolme' : best.len === 4 ? 'Neljä' : best.len === 5 ? 'Viisi' : String(best.len);
    streakNote = `${n} rasittavaa päivää peräkkäin vk ${isoWeek(best.from).week} (${WEEKDAYS[isoWeekday(best.from) - 1]}–${WEEKDAYS[isoWeekday(to) - 1]}).`;
  }
  if (kind === 'week') {
    // Kokonainen viikko ilman lepopäivää.
    const noRest = list.find((w) => datesBetween(w.start, w.end).length === 7 && datesBetween(w.start, w.end).every((d) => (dayMinutes.get(d) ?? 0) > 0));
    if (noRest) noRestNote = `Viikolla ${noRest.label.replace('vk ', '')} ei ollut lepopäivää.`;
  }
  const observations = [streakNote, growthNote(list, kind), noRestNote].filter((x): x is string => !!x).slice(0, 2);
  return { observations, streakNote, noRestNote };
}

/** Suurin kasvu edellisestä kokonaisesta viikosta (yli 20 % ja vähintään tunti; AAP:n 10–20 %:n raja, sportLoad). */
export function growthNote(list: Pick<CoachBucket, 'label' | 'start' | 'end' | 'total'>[], kind: 'week' | 'month'): string | undefined {
  if (kind !== 'week') return undefined;
  let grow: { label: string; pct: number } | undefined;
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const cur = list[i];
    if (datesBetween(prev.start, prev.end).length < 7 || datesBetween(cur.start, cur.end).length < 7 || prev.total <= 0) continue;
    const pct = (cur.total - prev.total) / prev.total;
    if (pct > 0.2 && cur.total - prev.total >= 60 && (!grow || pct > grow.pct)) grow = { label: cur.label, pct };
  }
  return grow ? `Viikolla ${grow.label.replace('vk ', '')} liikuntaa oli ${Math.round(grow.pct * 100)} % enemmän kuin edellisellä viikolla.` : undefined;
}

/** Suomalainen luku yhdellä desimaalilla ("2,5"); kokonaisluku ilman desimaalia. */
export function fi1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}

// ---------- Kuvan ja PDF:n yhteinen sisältö ----------

export interface CoachTile {
  value: string;
  unit: string;
  label: string;
}
export interface CoachRow {
  label: string;
  value: string;
}
export interface CoachView {
  parts: CoachPart[];
  buckets: CoachBucket[];
  tiles: CoachTile[];
  rows: CoachRow[];
  notes: { date: ISODate; text: string }[];
  observations: string[];
}

const SKIP_WORD: Record<SkipReason, string> = { sick: 'sairas', injured: 'loukkaantunut', cancelled: 'peruttu', holiday: 'loma', other_commitment: 'muu meno', other: 'muu syy' };

/** Näytettävät osat valintojen mukaan (piilotettu osa jää pois myös summista). */
export function coachParts(o: CoachOptions): CoachPart[] {
  return COACH_PARTS.filter((p) => (p === 'own' ? o.own : p === 'other' || p === 'school' ? o.other : p === 'everyday' ? o.everyday : true));
}

const hours = (min: number) => `${fi1(min / 60)} h`;

/** Kuvan ja PDF:n sisältö koosteesta ja valinnoista. */
export function coachView(s: CoachSummary, o: CoachOptions): CoachView {
  const parts = coachParts(o);
  const perWeek = (n: number) => (s.days > 0 ? (n / s.days) * 7 : 0);
  const visible = parts.reduce((a, p) => a + s.minutes[p], 0);
  const fbMin = s.minutes.football + (o.own ? s.minutes.own : 0);
  const buckets = s.buckets.map((b) => ({ ...b, total: parts.reduce((a, p) => a + b.minutes[p], 0) }));

  const training: CoachTile = { value: fi1(s.clubTrainings.perWeek), unit: '/vko', label: 'Jalkapallotreenejä' };
  // Kokonaisliikunta ja osuus, kun mukana on muutakin kuin jalkapallo.
  const broad = o.other || o.everyday;
  const tiles: CoachTile[] = broad
    ? [
        { value: fi1(perWeek(visible) / 60), unit: 'h/vko', label: 'Liikuntaa' },
        { value: visible > 0 ? `${Math.round((fbMin / visible) * 100)} %` : '–', unit: '', label: 'Jalkapalloa' },
      ]
    : [{ value: fi1(perWeek(fbMin) / 60), unit: 'h/vko', label: 'Jalkapalloa' }, training];
  if (o.days) tiles.push({ value: fi1(s.restDaysPerWeek), unit: '/vko', label: 'Lepopäiviä' });
  else if (broad) tiles.push(training);
  else tiles.push({ value: String(s.games.count + s.games.tournaments), unit: '', label: 'Pelejä ja turnauksia' });

  const rows: CoachRow[] = [];
  const ct = s.clubTrainings;
  // Nimi 25.11.2026 (käyttäjä): "jalkapallotreenit" – mukana kaikki seuran treenit, myös talenttitreenit.
  rows.push({ label: 'Jalkapallotreenit', value: `${fi1(ct.perWeek)} /vko${ct.planned > 0 ? ` · osallistui ${ct.attended}/${ct.planned}` : ''}` });
  const g = s.games;
  const gameParts: string[] = [];
  if (g.count > 0) gameParts.push(`${g.count} ${g.count === 1 ? 'peli' : 'peliä'}`);
  if (g.tournaments > 0) gameParts.push(`${g.tournaments === 1 ? 'turnaus' : `${g.tournaments} turnausta`} ${g.tournamentLabels.join(', ')}`);
  rows.push({ label: 'Pelit ja turnaukset', value: gameParts.join(' · ') || 'ei pelejä' });
  if (o.own && s.minutes.own > 0) rows.push({ label: 'Omatoiminen harjoittelu', value: `${hours(perWeek(s.minutes.own))} /vko` });
  if (o.other) {
    const top = s.otherTypes.slice(0, 3).map((t) => `${t.name.toLowerCase()} ${fi1(t.perWeek)} /vko`);
    rows.push({ label: 'Muut lajit', value: top.join(', ') || 'ei muita lajeja' });
    if (s.schoolPerWeek > 0) rows.push({ label: 'Koululiikunta', value: `${fi1(s.schoolPerWeek)} /vko` });
  }
  if (o.everyday && s.minutes.everyday > 0) rows.push({ label: 'Arkiliikunta', value: `${hours(perWeek(s.minutes.everyday))} /vko` });
  if (o.days) rows.push({ label: 'Rasittavia päiviä', value: `${fi1(s.vigorousDaysPerWeek)} /vko` });
  if (o.absences) {
    const reasons = o.reasons && s.absences.reasons.length ? ` (${s.absences.reasons.map((r) => `${SKIP_WORD[r.reason]} ${r.count}`).join(', ')})` : '';
    const injured = s.injuredDays > 0 ? ` · loukkaantuneena ${s.injuredDays} pv` : '';
    rows.push({ label: 'Poissaolot', value: `${s.absences.count === 0 ? 'ei poissaoloja' : `${s.absences.count} ${s.absences.count === 1 ? 'kerta' : 'kertaa'}`}${reasons}${injured}` });
  }
  return { parts, buckets, tiles, rows, notes: o.notes ? s.notes : [], observations: [o.days && s.streakNote, growthNote(buckets, s.bucketKind), o.days && s.noRestNote].filter((x): x is string => !!x).slice(0, 2) };
}

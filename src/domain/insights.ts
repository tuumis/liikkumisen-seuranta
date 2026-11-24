// Viikon huomiot (SPEC 16, 20.11.2026): päättyneeltä viikolta lyhyet, lähteistetyt huomiot omasta datasta.
// Vaihe 1: liikkumissuosituksen huomiot. Vaihe 2 (24.11.2026): urheilun kuormitus lapsilla (sportLoad.ts). Huomio kertoo havainnon ja tarjoaa vaihtoehdon; ei käskyjä, ei
// terveys- tai valmennusneuvoja, ei vertailuja muihin. Hyvästä viikosta ei keksitä parannettavaa.
// Puhdas funktio: kaikki data annetaan parametreina.

import { isVigorousDay } from './aggregate';
import { addDays, isoWeekday } from './dates';
import { ageInYears } from './groups';
import { formatHours } from './hours';
import { LOAD_INCREASE_LIMIT, LOAD_INCREASE_MIN, organizedDays, organizedMinutes, previousWeeksMinutes, RESEARCH_SOURCES } from './sportLoad';
import { RECOMMENDATIONS, SOURCES, type SourceRef } from './recommendations';
import type { PeriodReport } from './report';
import type { ActivityType, DayTotals, ISODate, Profile, Session, TemplateItem, UUID, Weekday } from './types';

/** Lähdetaso: virallinen suositus, tutkimus (vaihe 2) tai sovelluksen oma tulkinta. */
export type InsightTier = 'official' | 'research' | 'app';

export type InsightId =
  | 'mvpa_avg'
  | 'mvpa_days'
  | 'vigorous_days'
  | 'strength_days'
  | 'ey_days'
  | 'adult_weighted'
  | 'adult_muscle'
  | 'hours_vs_age'
  | 'no_rest_day'
  | 'load_spike';

export interface Insight {
  id: InsightId;
  tier: InsightTier;
  /** Havainto yhdellä lauseella. */
  title: string;
  /** Mitä suositus sanoo ja tarkenne datasta. */
  text: string;
  /** Konkreettinen vaihtoehto (esim. harrastuksettomat päivät viikkorytmissä). */
  option?: string;
  /** Laskutapa ("Miksi?"). */
  why: string;
  source: SourceRef;
  /** Peräkkäiset viikot, joilla sama vaje (tämä mukaan lukien), kun vähintään 3. */
  streak?: number;
}

export type InsightState =
  /** Viikko on kesken. */
  | 'current'
  /** Ei vertailtavia päiviä. */
  | 'none'
  /** Kuittaamattomia kertoja. */
  | 'pending'
  /** Liian vähän kirjauksia. */
  | 'lowData'
  /** Vertailtavia päiviä alle viisi (sairaus, loma). */
  | 'partial'
  /** Ei huomautettavaa. */
  | 'ok'
  | 'insights';

export interface InsightResult {
  state: InsightState;
  insights: Insight[];
  /** Kuittaamattomat kerrat (pending). */
  unconfirmed: number;
  /** Vertailtavat päivät. */
  validDays: number;
}

export interface InsightInput {
  report: PeriodReport;
  /** Edelliset viikot uusimmasta alkaen (toisto); puuttuva = ei tietoa. */
  previous?: (PeriodReport | undefined)[];
  today: ISODate;
  templateItems?: TemplateItem[];
  types: Map<UUID, ActivityType>;
  /** Kuormitushuomioihin (vaihe 2): syntymävuosi ja -kuukausi. */
  profile?: Pick<Profile, 'birthYear' | 'birthMonth'>;
  /** Kerrat viikolta ja vähintään kuudelta edeltävältä viikolta (ohjatun urheilun määrä, kasvu ja toisto). */
  sessions?: Session[];
  /** Kuormitushuomiot (oletus päällä lapsilla; aikuisilla ei koskaan). */
  load?: boolean;
}

/** Vähintään näin monta vertailtavaa päivää, jotta päivämäärätavoitteet ovat reiluja. */
export const MIN_VALID_DAYS = 5;

const WD = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'] as const;
const wd = (d: ISODate) => WD[isoWeekday(d) - 1];

/** "ma", "ma ja ti", "ma, ti ja ke". */
export function listFi(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} ja ${xs[xs.length - 1]}`;
}

const days = (n: number) => `${n} päivänä`;

/** Järjestys: suosituksen pääluku, rasittavat päivät, vahvistavat päivät, päivittäiset vajeet. */
// Kuormitus (vaihe 2) heti pääluvun jälkeen: viikon kahdessa tärkeimmässä huomiossa sen kuuluu näkyä.
const ORDER: InsightId[] = ['mvpa_avg', 'ey_days', 'adult_weighted', 'no_rest_day', 'hours_vs_age', 'load_spike', 'vigorous_days', 'strength_days', 'adult_muscle', 'mvpa_days'];

interface LoadCtx {
  sessions: Session[];
  types: Map<UUID, ActivityType>;
  birthYear: number;
  birthMonth: number;
}

const LOAD_WHY =
  'Ohjattu urheilu = harrastusten kerrat (treenit, pelit ja turnaukset), ei koululiikuntaa, omatoimista eikä treenin verryttelyä. Turnauksen kesto sisältää odottelun, joten luku voi olla todellista suurempi.';

/** Urheilun kuormitus (vaihe 2): lähdetaso Tutkimus. Ei aikuisille. */
function loadInsights(report: PeriodReport, c: LoadCtx): Insight[] {
  if (report.group.group === 'adult') return [];
  const { start, end } = report.period;
  const out: Insight[] = [];
  const min = organizedMinutes(c.sessions, c.types, start, end);
  if (min <= 0) return out;
  const days = organizedDays(c.sessions, c.types, start, end);
  if (days.size === 7) {
    out.push({
      id: 'no_rest_day',
      tier: 'research',
      title: 'Ohjattua urheilua viikon jokaisena päivänä',
      text: 'Yhdysvaltain lastenlääkäriyhdistyksen (AAP) mukaan lapsen ei pitäisi joutua harjoittelemaan tai pelaamaan useampana kuin 5–6 päivänä viikossa. Vapaapäivä tarkoittaa vapaata ohjatusta urheilusta; muuten liikkuminen joka päivä on suositeltavaa.',
      why: `${LOAD_WHY} Päivä lasketaan, kun sille on kirjattu ohjattua urheilua.`,
      source: RESEARCH_SOURCES.aap2024,
    });
  }
  const age = ageInYears(c.birthYear, c.birthMonth, end);
  if (age >= 7 && min > age * 60) {
    out.push({
      id: 'hours_vs_age',
      tier: 'research',
      title: `Ohjattua urheilua ${formatHours(min)} viikossa, enemmän kuin ikävuosia (${age})`,
      text: 'Tutkimuksessa 7–18-vuotiailla urheilijoilla ikävuodet ylittävä viikkotuntimäärä oli yhteydessä vakaviin rasitusvammoihin. Tutkimus osoittaa yhteyden, ei syy-seurausta.',
      why: `${LOAD_WHY} Vertailuluku on ikä vuosina viikon viimeisenä päivänä.`,
      source: RESEARCH_SOURCES.jayanthi2015,
    });
  }
  const prev = previousWeeksMinutes(c.sessions, c.types, start, 4, report.trackingStart);
  if (prev.every((x) => x !== undefined)) {
    const avg = (prev as number[]).reduce((a, b) => a + b, 0) / prev.length;
    if (avg > 0 && min > avg * (1 + LOAD_INCREASE_LIMIT) && min - avg >= LOAD_INCREASE_MIN) {
      out.push({
        id: 'load_spike',
        tier: 'research',
        title: `Ohjattua urheilua ${formatHours(min)}, ${Math.round((min / avg - 1) * 100)} % enemmän kuin edellisillä viikoilla keskimäärin (${formatHours(avg)})`,
        text: 'AAP:n mukaan viikoittaista harjoitusmäärää lisätään kerralla enintään 10–20 %. Yksittäinen turnaus- tai leiriviikko ei ole sama asia kuin pysyvä kasvu.',
        why: `${LOAD_WHY} Vertailu edellisten neljän viikon keskiarvoon on sovelluksen tulkinta (AAP puhuu viikoittaisesta lisäyksestä); alle tunnin erot jätetään huomiotta.`,
        source: RESEARCH_SOURCES.aap2024,
      });
    }
  }
  return out;
}

/**
 * Viikonpäivät, joille viikkorytmissä ei ole harrastusta (laji kategoriaa harrastus) seuraavalla viikolla.
 * Tyhjä, kun viikkorytmissä ei ole harrastuksia lainkaan (vaihtoehto ei silloin kerro mitään).
 */
export function freeWeekdays(items: TemplateItem[] | undefined, types: Map<UUID, ActivityType>, weekStart: ISODate): Weekday[] {
  const end = addDays(weekStart, 6);
  const busy = new Set<Weekday>();
  let any = false;
  for (const i of items ?? []) {
    if (!i.active || i.deletedAt || i.validFrom > end || (i.validTo && i.validTo < weekStart)) continue;
    if (types.get(i.activityTypeId)?.category !== 'hobby') continue;
    any = true;
    i.weekdays.forEach((d) => busy.add(d));
  }
  if (!any) return [];
  return ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).filter((d) => !busy.has(d));
}

/** Huomiot ilman datan porttia ja vaihtoehtoja (myös toiston tunnistamiseen edellisiltä viikoilta). */
function raw(report: PeriodReport, free: string | undefined, load?: LoadCtx): Insight[] {
  const ev = report.evaluation;
  const valid = report.days;
  const out: Insight[] = load ? loadInsights(report, load) : [];
  const n = ev.n;
  if (ev.schoolAge) {
    const s = ev.schoolAge;
    const src = SOURCES.okm2021;
    const target = RECOMMENDATIONS.school_age.mvpaAvgMinPerDay.value;
    const short = valid.filter((d) => d.mvpaCombined < target - 1e-9).map((d) => wd(d.date));
    const estimateWhy = 'Reippaan ja rasittavan osuus lajeista on sovelluksen arvio, ja arkiliikunta tulee perusarviosta.';
    if (s.mvpaAvg.combined.actual < target - 1e-9) {
      out.push({
        id: 'mvpa_avg',
        tier: 'official',
        title: `Reipasta ja rasittavaa liikuntaa keskimäärin ${Math.round(s.mvpaAvg.combined.actual)} min päivässä`,
        text: `Suositus on vähintään ${target} min päivässä. Alle tunnin jäi ${short.length === 7 ? 'joka päivä' : listFi(short)}.`,
        option: free,
        why: `Keskiarvo kirjatuista kerroista ja arkiliikunnan arviosta ${n} vertailtavalta päivältä. ${estimateWhy}`,
        source: src,
      });
    } else if (short.length >= 3) {
      out.push({
        id: 'mvpa_days',
        tier: 'official',
        title: `Keskiarvo täyttyi, mutta ${short.length} päivää jäi alle tunnin (${listFi(short)})`,
        text: 'Suosituksen mukaan olisi hyvä liikkua viikon jokaisena päivänä.',
        why: `Päivä jää alle tunnin, kun reipasta ja rasittavaa on alle ${target} min (kirjatut kerrat ja arkiliikunnan arvio). ${estimateWhy}`,
        source: src,
      });
    }
    const vTarget = s.vigorousDays.target;
    if (s.vigorousDays.actual < vTarget) {
      const vDays = valid.filter((d) => isVigorousDay(d, report.vigorousDay.min)).map((d) => wd(d.date));
      out.push({
        id: 'vigorous_days',
        tier: 'official',
        title: vDays.length === 0 ? 'Ei yhtään rasittavan liikunnan päivää' : `Rasittavaa liikuntaa ${days(vDays.length)} (${listFi(vDays)})`,
        text: `Suositus on vähintään ${vTarget} päivänä viikossa.`,
        option: free,
        why: `Rasittava päivä: kirjatuissa kerroissa vähintään ${report.vigorousDay.min} min rasittavaa (sovelluksen raja, muokattavissa kohdassa Asetukset → Tavoitteet ja lajit). Arkiliikunnan arvio ei tuota rasittavaa päivää.`,
        source: src,
      });
    }
    const mT = s.muscleDays.target;
    const bT = s.boneDays.target;
    const m = s.muscleDays.actual;
    const b = s.boneDays.actual;
    if (m < mT || b < bT) {
      const title =
        m < mT && b < bT
          ? `Lihaksia vahvistavaa ${m} ja luustoa vahvistavaa ${b} päivänä`
          : m < mT
            ? `Lihaksia vahvistavaa liikuntaa ${days(m)}`
            : `Luustoa vahvistavaa liikuntaa ${days(b)}`;
      out.push({
        id: 'strength_days',
        tier: 'official',
        title,
        text: `Suositus on ${m < mT && b < bT ? 'kumpaakin ' : ''}vähintään ${Math.max(mT, bT)} päivänä viikossa. Lajin vahvistavuuden voi tarkistaa kohdassa Asetukset → Tavoitteet ja lajit.`,
        why: 'Päivä lasketaan, kun jokin kirjattu kerta on lajiltaan lihaksia tai luustoa vahvistava. Arkiliikunnan arvio ei vaikuta.',
        source: src,
      });
    }
  }
  if (ev.earlyYears) {
    const r = RECOMMENDATIONS.early_years;
    const met = (d: DayTotals) => d.movingCombined >= r.totalMinPerDay.value - 1e-9 && d.mvpaCombined >= r.mvpaMinPerDay.value - 1e-9;
    const unmet = valid.filter((d) => !met(d));
    if (unmet.length >= 2) {
      const weekend = (d: DayTotals) => isoWeekday(d.date) >= 6;
      const wk = valid.filter((d) => !weekend(d));
      const we = valid.filter(weekend);
      let pattern = '';
      if (wk.length && we.length && wk.every(met) && !we.some(met)) pattern = ' Arkipäivinä tavoite täyttyi, viikonloppuna ei.';
      else if (wk.length && we.length && we.every(met) && !wk.some(met)) pattern = ' Viikonloppuna tavoite täyttyi, arkipäivinä ei.';
      const mvpaShort = unmet.filter((d) => d.movingCombined >= r.totalMinPerDay.value - 1e-9).length;
      const movingShort = unmet.length - mvpaShort;
      const part =
        mvpaShort >= (unmet.length * 2) / 3
          ? ' Vajaina päivinä liikkumista oli tarpeeksi, mutta vauhdikasta (reipasta ja rasittavaa) jäi alle tunnin.'
          : movingShort >= (unmet.length * 2) / 3
            ? ' Vajaina päivinä jäi vajaaksi erityisesti liikkumisen kokonaisaika.'
            : '';
      out.push({
        id: 'ey_days',
        tier: 'official',
        title: `Päivän tavoite täyttyi ${valid.length - unmet.length}/${n} päivänä (vajaat: ${listFi(unmet.map((d) => wd(d.date)))})`,
        text: `Suositus on vähintään ${r.totalMinPerDay.value / 60} tuntia liikkumista päivässä, josta ${r.mvpaMinPerDay.value} min vauhdikasta.${pattern}${part}`,
        why: 'Päivän liikkuminen kirjatuista kerroista ja arkiliikunnan arviosta (päiväkoti, leikit). Vauhdikkaan osuus lajeista on sovelluksen arvio.',
        source: SOURCES.ukkAllAges,
      });
    }
  }
  if (ev.adult) {
    const a = ev.adult;
    const r = RECOMMENDATIONS.adult;
    if (a.weighted.combined.actual < a.weighted.combined.target - 1e-9) {
      out.push({
        id: 'adult_weighted',
        tier: 'official',
        title: `Reipasta ja rasittavaa liikuntaa ${Math.round(a.weighted.combined.actual)} min viikossa`,
        text: `Suositus on vähintään ${r.weightedMinPerWeek.value} min reipasta viikossa; rasittava lasketaan kahdesti.`,
        option: free,
        why: `Reipas + 2 × rasittava kirjatuista kerroista ja arkiliikunnan arviosta ${n} vertailtavalta päivältä (tavoite suhteutettuna: ${Math.round(a.weighted.combined.target)} min).`,
        source: SOURCES.ukkAdult2019,
      });
    }
    if (a.muscleDays.actual < a.muscleDays.target) {
      out.push({
        id: 'adult_muscle',
        tier: 'official',
        title: `Lihaskuntoa ja liikehallintaa ${days(a.muscleDays.actual)}`,
        text: `Suositus on vähintään ${a.muscleDays.target} kertaa viikossa. Lajin vahvistavuuden voi tarkistaa kohdassa Asetukset → Tavoitteet ja lajit.`,
        option: free,
        why: 'Päivä lasketaan, kun jokin kirjattu kerta on lajiltaan lihaksia vahvistava. Arkiliikunnan arvio ei vaikuta.',
        source: SOURCES.ukkAdult2019,
      });
    }
  }
  return out.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

/** Edellisen viikon huomiot toistoa varten: vain luotettavalta viikolta. */
function reliable(r: PeriodReport | undefined): boolean {
  return !!r && r.evaluation.evaluable && !r.evaluation.quality.lowData && r.evaluation.n >= MIN_VALID_DAYS && r.adherence.unconfirmed === 0;
}

export function weekInsights(input: InsightInput): InsightResult {
  const { report, today } = input;
  const ev = report.evaluation;
  const base = { insights: [] as Insight[], unconfirmed: report.adherence.unconfirmed, validDays: ev.n };
  if (report.period.end >= today) return { ...base, state: 'current' };
  if (!ev.evaluable) return { ...base, state: 'none' };
  if (report.adherence.unconfirmed > 0) return { ...base, state: 'pending' };
  if (ev.quality.lowData) return { ...base, state: 'lowData' };
  if (ev.n < MIN_VALID_DAYS) return { ...base, state: 'partial' };

  const freeDays = freeWeekdays(input.templateItems, input.types, addDays(report.period.end, 1));
  const free = freeDays.length ? `Viikkorytmissä harrastuksettomia päiviä: ${listFi(freeDays.map((d) => WD[d - 1]))}.` : undefined;
  const p = input.profile;
  const load: LoadCtx | undefined =
    input.load !== false && p && input.sessions ? { sessions: input.sessions, types: input.types, birthYear: p.birthYear, birthMonth: p.birthMonth } : undefined;
  const insights = raw(report, free, load);
  // Sama vaihtoehto vain kerran (ensimmäisessä huomiossa), ettei se toistu joka rivillä.
  insights.forEach((i, k) => {
    if (i.option && insights.slice(0, k).some((x) => x.option === i.option)) delete i.option;
  });
  // Toisto: sama vaje peräkkäisinä viikkoina.
  const prevIds = (input.previous ?? []).map((r) => (reliable(r) ? new Set(raw(r!, undefined, load).map((i) => i.id)) : undefined));
  for (const i of insights) {
    let streak = 1;
    for (const ids of prevIds) {
      if (!ids?.has(i.id)) break;
      streak++;
    }
    if (streak >= 3) i.streak = streak;
  }
  return { ...base, state: insights.length ? 'insights' : 'ok', insights };
}

// Viikkoraportti tulostettavaksi (SPEC 16, 14.11.2026): viikon tapahtumat päivittäin taulukkona ja
// yhteenveto tunteina. Puhdas funktio: rivit summautuvat täsmälleen päivän lukuihin, koska
// arkiliikunnan rivi on päivän kokonaismäärän ja kirjattujen kertojen erotus (perusarvio ja
// päiväkohtaiset vahvistukset).

import { isEstimateConfirmation } from './aggregate';
import { dayGoalMet } from './dayTarget';
import { foldTrainingSelves, outcomeOf } from './football';
import type { DayHours } from './hours';
import { mvpaOf } from './intensity';
import type { ActivityType, DayFlag, DayFlagReason, DayTotals, FootballDetails, ISODate, RecommendationGroup, Session, UUID } from './types';

export interface WeekReportEntry {
  id: UUID;
  time?: string;
  typeId: UUID;
  name: string;
  /** Tarkenne: kerran nimi, jalkapallon tulos tai osat. */
  detail?: string;
  durationMin: number;
  /** Reipas + rasittava (min). */
  mvpa: number;
  vigorous: number;
  muscle: boolean;
  bone: boolean;
}

export interface WeekReportDay {
  date: ISODate;
  future: boolean;
  flag?: DayFlagReason;
  entries: WeekReportEntry[];
  /** Arkiliikunta (perusarvio tai päivän vahvistus); puuttuu, jos ei mitään. */
  arki?: { durationMin: number; mvpa: number; vigorous: number; confirmed: boolean };
  durationMin: number;
  light: number;
  moderate: number;
  vigorous: number;
  mvpa: number;
  /** Päivätavoite täyttyi (vain menneet, merkitsemättömät päivät). */
  goalMet: boolean;
}

export interface WeekReportSummary {
  totalMin: number;
  sessionsMin: number;
  arkiMin: number;
  light: number;
  moderate: number;
  vigorous: number;
  mvpa: number;
  sessionCount: number;
  goalDays: number;
  /** Päivät, joilta tavoite arvioidaan (menneet, ei sairas-/matkapäiviä). */
  evaluatedDays: number;
  muscleDays: number;
  boneDays: number;
  byType: { typeId: UUID; name: string; count: number; durationMin: number }[];
}

export interface WeekReport {
  days: WeekReportDay[];
  summary: WeekReportSummary;
}

/** Kerran tai suunnitelman lyhyt nimi: oma nimi tai lajin nimen viimeinen osa. */
export function shortName(s: { label?: string }, t?: Pick<ActivityType, 'name'>): string {
  if (s.label) return s.label;
  const n = t?.name ?? 'Laji';
  const tail = n.includes(' – ') ? n.split(' – ').pop()! : n;
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}

/** Jalkapallon tiivis yhteenveto: tulos tai turnauksen V-T-H, peliaika ja pelaajan maalit. */
export function footballBrief(s: Session, t: ActivityType | undefined, d: FootballDetails | undefined): string {
  const parts: string[] = [];
  if (t?.footballKind === 'game' && d) {
    const o = outcomeOf(d.goalsFor, d.goalsAgainst);
    if (o) parts.push(`${d.goalsFor}–${d.goalsAgainst} ${{ W: 'V', D: 'T', L: 'H' }[o]}`);
    if (d.opponent) parts.push(d.opponent);
  }
  if (t?.footballKind === 'tournament' && d) {
    const games = d.games ?? [];
    const res = games.map((g) => outcomeOf(g.goalsFor, g.goalsAgainst)).filter(Boolean);
    parts.push(res.length ? `${res.filter((r) => r === 'W').length}–${res.filter((r) => r === 'D').length}–${res.filter((r) => r === 'L').length}` : `${games.length || d.gamesCount || '?'} peliä`);
  }
  // Harjoituspeli: vastustajat ja tulokset ilman V–T–H-merkintää (17.11.2026).
  if (t?.footballKind === 'friendly' && d?.games?.length) {
    parts.push(
      d.games
        .map((g) => [g.opponent, g.goalsFor !== undefined && g.goalsAgainst !== undefined ? `${g.goalsFor}–${g.goalsAgainst}` : undefined].filter(Boolean).join(' '))
        .filter(Boolean)
        .join(', '),
    );
  }
  if (s.playedMin !== undefined) parts.push(`pelasi ${s.playedMin} min`);
  if (d?.playerGoals) parts.push(`⚽ ${d.playerGoals}`);
  return parts.join(' · ');
}

const pos = (x: number) => Math.max(0, Math.round(x));

export function weekReport(input: {
  totals: DayTotals[];
  hours: DayHours[];
  sessions: Session[];
  types: Map<UUID, ActivityType>;
  flags: DayFlag[];
  group: RecommendationGroup;
  details?: Map<UUID, FootballDetails>;
}): WeekReport {
  const flagByDate = new Map(input.flags.filter((f) => !f.deletedAt).map((f) => [f.date, f.reason]));
  const typeAcc = new Map<UUID, { typeId: UUID; name: string; count: number; durationMin: number }>();
  let muscleDays = 0;
  let boneDays = 0;

  const days = input.totals.map((t, i): WeekReportDay => {
    const h = input.hours[i];
    const future = h?.future ?? false;
    const flag = flagByDate.get(t.date);
    const daySessions = input.sessions.filter((s) => s.date === t.date && !s.deletedAt);
    const real = daySessions.filter((s) => !isEstimateConfirmation(s)).sort((a, b) => (a.startTime ?? '99').localeCompare(b.startTime ?? '99') || a.createdAt.localeCompare(b.createdAt));
    // Treenin verryttely on osa treeniä: sama rivi ja yksi kerta (17.11.2026).
    const { rows, selfOf } = foldTrainingSelves(real);
    const entries = rows.map((s): WeekReportEntry => {
      const self = selfOf(s.id);
      const selfDur = self ? Math.max(0, self.durationMin) : 0;
      const ty = input.types.get(s.activityTypeId);
      const fb = ty?.sport === 'football' ? footballBrief(s, ty, input.details?.get(s.id)) : '';
      const parts = s.parts?.length ? s.parts.map((p) => shortName({}, input.types.get(p.activityTypeId))).join(' + ') : '';
      const typeName = ty?.name ?? 'Laji';
      const label = s.label && s.label !== typeName ? s.label : '';
      const acc = typeAcc.get(s.activityTypeId) ?? { typeId: s.activityTypeId, name: typeName, count: 0, durationMin: 0 };
      acc.count++;
      acc.durationMin += Math.max(0, s.durationMin) + selfDur;
      typeAcc.set(s.activityTypeId, acc);
      return {
        id: s.id,
        time: s.startTime,
        typeId: s.activityTypeId,
        name: typeName,
        detail: [label, fb, parts, self ? `verryttely ${selfDur} min` : ''].filter(Boolean).join(' · ') || undefined,
        durationMin: Math.max(0, s.durationMin) + selfDur,
        mvpa: mvpaOf(s.minutes) + (self ? mvpaOf(self.minutes) : 0),
        vigorous: s.minutes.vigorous + (self?.minutes.vigorous ?? 0),
        muscle: s.muscle || !!self?.muscle,
        bone: s.bone || !!self?.bone,
      };
    });
    const sum = (f: (e: WeekReportEntry) => number) => entries.reduce((a, e) => a + f(e), 0);
    if (future) return { date: t.date, future, flag, entries, durationMin: 0, light: 0, moderate: 0, vigorous: 0, mvpa: 0, goalMet: false };

    // Sairas-/matkapäivänä perusarvio ei ole mukana; päivän luvut ovat kirjauksista.
    const useCombined = !flag;
    const c = useCombined ? t.combined : t.logged;
    const durationMin = h ? h.actualMin : t.movingCombined;
    const arkiDur = pos(durationMin - sum((e) => e.durationMin));
    const arkiMvpa = Math.max(0, mvpaOf(c) - sum((e) => e.mvpa));
    const confirmed = daySessions.some(isEstimateConfirmation);
    const arki = arkiDur > 0 || arkiMvpa > 0.5 ? { durationMin: arkiDur, mvpa: arkiMvpa, vigorous: Math.max(0, c.vigorous - sum((e) => e.vigorous)), confirmed } : undefined;
    // Lihas- ja luustopäivät kuten suositusarviossa: sairas- ja matkapäivät eivät ole mukana (17.11.2026).
    if (t.muscle && !flag) muscleDays++;
    if (t.bone && !flag) boneDays++;
    return {
      date: t.date,
      future,
      flag,
      entries,
      arki,
      durationMin,
      light: c.light,
      moderate: c.moderate,
      vigorous: c.vigorous,
      mvpa: mvpaOf(c),
      goalMet: !flag && dayGoalMet(input.group, t),
    };
  });

  const total = (f: (d: WeekReportDay) => number) => days.reduce((a, d) => a + f(d), 0);
  const sessionsMin = total((d) => d.entries.reduce((a, e) => a + e.durationMin, 0));
  const evaluated = days.filter((d) => !d.future && !d.flag);
  return {
    days,
    summary: {
      totalMin: total((d) => d.durationMin),
      sessionsMin,
      arkiMin: total((d) => d.arki?.durationMin ?? 0),
      light: total((d) => d.light),
      moderate: total((d) => d.moderate),
      vigorous: total((d) => d.vigorous),
      mvpa: total((d) => d.mvpa),
      sessionCount: total((d) => d.entries.length),
      goalDays: evaluated.filter((d) => d.goalMet).length,
      evaluatedDays: evaluated.length,
      muscleDays,
      boneDays,
      byType: [...typeAcc.values()].sort((a, b) => b.durationMin - a.durationMin || a.name.localeCompare(b.name, 'fi')),
    },
  };
}

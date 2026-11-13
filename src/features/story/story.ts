// Kauden kooste tarinakortteina (SPEC 16): puhdas koostefunktio raportista ja kerroista. Kortit
// näytetään sekä näkymässä että piirretään kuvaksi samoista tiedoista.

import { formatHours, isEstimateConfirmation } from '../../domain/hours';
import { footballKindOf, gameRows, summarizeGames } from '../../domain/football';
import { isoWeek, startOfIsoWeek } from '../../domain/dates';
import type { PeriodReport } from '../../domain/report';
import type { ActivityType, FocusTag, FootballDetails, Session, UUID } from '../../domain/types';
import { ENJOYMENT_LABEL, FOCUS_TAG_LABEL } from '../../ui/labels';

export interface StoryBar {
  label: string;
  icon?: string;
  value: string;
  /** Osuus suurimmasta (0–1). */
  pct: number;
}

export interface StorySlide {
  id: string;
  kicker: string;
  title: string;
  big?: string;
  bigUnit?: string;
  lines: string[];
  bars?: StoryBar[];
  /** Tunnuslukurivi (enintään 3). */
  stats?: { label: string; value: string }[];
}

export interface StoryInput {
  name: string;
  seasonLabel: string;
  report: PeriodReport;
  /** Jakson kerrat (kaikki lajit). */
  sessions: Session[];
  types: Map<UUID, ActivityType>;
  footballDetails: Map<UUID, FootballDetails>;
  /** Jalkapallo-ominaisuus profiilille (SPEC 16); false = ei jalkapallo- eikä harjoitellut asiat -korttia. */
  football?: boolean;
}

const fi = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function buildStory(input: StoryInput): StorySlide[] {
  const { name, seasonLabel, report, types } = input;
  const sessions = input.sessions.filter((s) => !s.deletedAt && s.durationMin > 0 && !isEstimateConfirmation(s));
  const totalMin = report.days.reduce((a, d) => a + d.totalCombined, 0);
  const mvpaMin = report.days.reduce((a, d) => a + d.mvpaCombined, 0);
  const slides: StorySlide[] = [
    {
      id: 'cover',
      kicker: `${seasonLabel} · ${name}`,
      title: 'Kauden kooste',
      lines: ['Liikunta, lajit ja kauden parhaat hetket.'],
    },
  ];

  if (totalMin > 0) {
    slides.push({
      id: 'total',
      kicker: 'Liikuntaa yhteensä',
      title: 'Liikettä riitti',
      big: formatHours(totalMin).replace(' h', ''),
      bigUnit: 'tuntia',
      lines: [`josta reipasta ja rasittavaa ≈ ${formatHours(mvpaMin)}`, `${sessions.length} kirjattua liikuntakertaa`],
    });
  }

  // Lajit keston mukaan (kirjatut kerrat).
  const byType = new Map<UUID, number>();
  for (const s of sessions) byType.set(s.activityTypeId, (byType.get(s.activityTypeId) ?? 0) + s.durationMin);
  const top = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (top.length) {
    const max = top[0][1];
    slides.push({
      id: 'types',
      kicker: 'Eniten aikaa',
      title: types.get(top[0][0])?.name ?? 'Suosikkilaji',
      lines: [`${byType.size} eri ${byType.size === 1 ? 'laji' : 'lajia'} kauden aikana`],
      bars: top.map(([id, min]) => ({ label: types.get(id)?.name ?? 'Laji', icon: types.get(id)?.icon, value: formatHours(min), pct: min / max })),
    });
  }

  // Paras viikko: eniten liikuntaa (kesto) kelvollisina päivinä.
  const weeks = new Map<string, number>();
  for (const d of report.days) {
    const w = startOfIsoWeek(d.date);
    weeks.set(w, (weeks.get(w) ?? 0) + d.totalCombined);
  }
  const best = [...weeks.entries()].sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] > 0 && weeks.size > 1) {
    const avg = [...weeks.values()].reduce((a, b) => a + b, 0) / weeks.size;
    slides.push({
      id: 'best',
      kicker: 'Paras viikko',
      title: `Viikko ${isoWeek(best[0]).week}`,
      big: formatHours(best[1]).replace(' h', ''),
      bigUnit: 'tuntia liikuntaa',
      lines: [`Keskimäärin ${formatHours(avg)} viikossa`],
    });
  }

  // Jalkapallo: treenit, pelit ja pelaajan maalit.
  const football = input.football === false ? [] : input.sessions.filter((s) => !s.deletedAt && types.get(s.activityTypeId)?.sport === 'football');
  if (football.length) {
    const trainings = football.filter((s) => footballKindOf(s, types) === 'training').length;
    const g = summarizeGames(gameRows(football, input.footballDetails, types));
    const stats = [
      { label: 'Treenit', value: fi(trainings) },
      { label: 'Pelit', value: fi(g.games) },
      ...(g.wins + g.draws + g.losses > 0 ? [{ label: 'V–T–H', value: `${g.wins}–${g.draws}–${g.losses}` }] : []),
    ];
    const lines: string[] = [];
    if (g.playerGoalsGames > 0) lines.push(`${name}: maalit ${g.playerGoals}`);
    if (g.playedMinTotal > 0) lines.push(`Peliaikaa kirjattu ${fi(g.playedMinTotal)} min`);
    if (g.goalsFor + g.goalsAgainst > 0) lines.push(`Joukkueen maalit ${g.goalsFor}–${g.goalsAgainst}`);
    slides.push({ id: 'football', kicker: 'Jalkapallo', title: g.games ? 'Kentällä' : 'Treeneissä', stats, lines });

    const tagCount = new Map<FocusTag, number>();
    let enjoySum = 0;
    let enjoyN = 0;
    for (const s of football) {
      const d = input.footballDetails.get(s.id);
      if (!d || d.deletedAt) continue;
      for (const t of d.focusTags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
      if (d.enjoyment) {
        enjoySum += d.enjoyment;
        enjoyN++;
      }
    }
    const tags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (tags.length || enjoyN) {
      const maxT = tags[0]?.[1] ?? 1;
      slides.push({
        id: 'focus',
        kicker: 'Harjoiteltua',
        title: tags.length ? FOCUS_TAG_LABEL[tags[0][0]] : 'Viihtyminen',
        lines: enjoyN ? [`Viihtyminen: ${ENJOYMENT_LABEL[Math.round(enjoySum / enjoyN) as 1 | 2 | 3].toLowerCase()}`] : [],
        bars: tags.map(([t, n]) => ({ label: FOCUS_TAG_LABEL[t], value: `${n} ×`, pct: n / maxT })),
      });
    }
  }

  slides.push({ id: 'outro', kicker: seasonLabel, title: `Hienoa kautta, ${name}!`, lines: ['Jatketaan samaan malliin.'] });
  return slides;
}

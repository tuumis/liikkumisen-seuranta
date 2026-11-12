// Jakson kohokohdat (Analyysi): kommentit ja yleisarvio suoritustasosta vanhemman antamien
// arvioiden perusteella. Arvio on suhteessa lapsen omaan tavalliseen tasoon (3 = tavallinen),
// ei vertailua muihin. Puhdas funktio.

import type { FocusTag, FootballDetails, ISODate, Session, UUID } from './types';

export interface HighlightComment {
  sessionId: UUID;
  date: ISODate;
  activityTypeId: UUID;
  text: string;
  /** session = kerran muistiinpano, diary = jalkapallon päiväkirja, game = turnauksen pelin kommentti. */
  source: 'session' | 'diary' | 'game';
  opponent?: string;
  gameIndex?: number;
}

export type RatingVerdict = 'above' | 'usual' | 'below';

export interface HighlightSummary {
  sessions: number;
  comments: HighlightComment[];
  rating: { avg: number | null; count: number; dist: [number, number, number, number, number] };
  enjoyment: { avg: number | null; count: number };
  verdict: RatingVerdict | null;
  topTags: { tag: FocusTag; count: number }[];
  playerGoals: number;
}

/** Keskiarvo ≥ 3,5 = tavallista parempi, ≤ 2,5 = tavallista heikompi, muuten tavallinen oma taso. */
export function ratingVerdict(avg: number | null): RatingVerdict | null {
  if (avg === null) return null;
  return avg >= 3.5 ? 'above' : avg <= 2.5 ? 'below' : 'usual';
}

export function highlights(sessions: Session[], details: Map<UUID, FootballDetails>, from: ISODate, to: ISODate): HighlightSummary {
  const inRange = sessions.filter((s) => !s.deletedAt && s.date >= from && s.date <= to);
  const comments: HighlightComment[] = [];
  const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let ratingSum = 0;
  let ratingN = 0;
  let enjoySum = 0;
  let enjoyN = 0;
  let playerGoals = 0;
  const tags = new Map<FocusTag, number>();

  for (const s of inRange) {
    const base = { sessionId: s.id, date: s.date, activityTypeId: s.activityTypeId };
    if (s.note?.trim()) comments.push({ ...base, text: s.note.trim(), source: 'session' });
    const d = details.get(s.id);
    if (!d || d.deletedAt) continue;
    if (d.ratingNote?.trim()) comments.push({ ...base, text: d.ratingNote.trim(), source: 'diary', ...(d.opponent ? { opponent: d.opponent } : {}) });
    d.games?.forEach((g, i) => {
      if (g.note?.trim()) comments.push({ ...base, text: g.note.trim(), source: 'game', gameIndex: i + 1, ...(g.opponent ? { opponent: g.opponent } : {}) });
    });
    if (d.parentRating) {
      dist[d.parentRating - 1]++;
      ratingSum += d.parentRating;
      ratingN++;
    }
    if (d.enjoyment) {
      enjoySum += d.enjoyment;
      enjoyN++;
    }
    for (const t of d.focusTags) tags.set(t, (tags.get(t) ?? 0) + 1);
    playerGoals += d.playerGoals ?? 0;
  }

  comments.sort((a, b) => b.date.localeCompare(a.date) || (a.gameIndex ?? 0) - (b.gameIndex ?? 0));
  const avg = ratingN ? ratingSum / ratingN : null;
  return {
    sessions: inRange.length,
    comments,
    rating: { avg, count: ratingN, dist },
    enjoyment: { avg: enjoyN ? enjoySum / enjoyN : null, count: enjoyN },
    verdict: ratingVerdict(avg),
    topTags: [...tags.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, 4),
    playerGoals,
  };
}

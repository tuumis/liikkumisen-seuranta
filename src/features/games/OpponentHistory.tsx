// Vastustajan historia pelikalenterissa (SPEC 16): aiemmat kohtaamiset saman ryhmän ja seuran
// kanssa (tulokset, oman pelaajan maalit ja kommentit) joukkuekirjaston tiedoista.

import { useMemo } from 'react';
import { gameRows, OUTCOME_LABEL, type GameOutcome, type GameRow } from '../../domain/football';
import { displayTeamName, parseTeamName, squadLabel } from '../../domain/opponent';
import { opponentHistory, type OpponentHistory } from '../../domain/opponentLibrary';
import type { Profile, UUID } from '../../domain/types';
import { formatDate } from '../../ui/format';
import { logoFor, TeamLogo, useClubLogos } from '../../ui/TeamLogo';
import { useFootball } from '../football/useFootball';

const OUTCOME_CLASS: Record<GameOutcome, string> = {
  W: 'bg-green-700 text-white',
  D: 'bg-slate-200 text-slate-800',
  L: 'bg-red-100 text-red-800',
};

/**
 * Pelatut pelit (kaikki) historiaa varten; yksittäisen pelin kommentti (ratingNote) liitetään riviin.
 * Elää tietokannan mukana.
 */
export function useGameRows(profileId: UUID | undefined): GameRow[] | undefined {
  const data = useFootball(profileId);
  return useMemo(
    () => data && gameRows(data.sessions, data.details, data.types).map((r) => (r.index || r.note ? r : { ...r, note: data.details.get(r.sessionId)?.ratingNote })),
    [data],
  );
}

const score = (r: GameRow) => (r.outcome ? `${r.goalsFor}–${r.goalsAgainst}` : 'ei tulosta');

/** Yhden rivin tiivistelmä kalenteriin: "Aiemmin 2 peliä · 1–0–1 · viimeksi 0–2". */
export function historyLine(h: OpponentHistory | undefined): string | undefined {
  if (!h) return undefined;
  const list = h.squad.length ? h.squad : h.others;
  if (!list.length) return undefined;
  const s = h.squad.length ? h.squadSummary : h.othersSummary;
  const who = h.squad.length ? '' : ` (${h.club}, muu ryhmä)`;
  const record = s.wins + s.draws + s.losses > 0 ? ` · V–T–H ${s.wins}–${s.draws}–${s.losses}` : '';
  return `Aiemmin ${s.games} ${s.games === 1 ? 'peli' : 'peliä'}${who}${record} · viimeksi ${score(list[0])}`;
}

function Line({ r, profile, squad }: { r: GameRow; profile: Profile; squad?: boolean }) {
  return (
    <li className="rounded-xl bg-[var(--surface-raised)] px-3 py-2 ring-1 ring-slate-200/70">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-[4.5rem] shrink-0 tabular-nums text-slate-600">{formatDate(r.date, 'd.M.yy')}</span>
        <span className="min-w-0 flex-1 truncate text-slate-700">
          {r.kind === 'tournament' ? r.eventName ?? 'Turnaus' : 'Peli'}
          {squad && r.opponent && <span className="text-slate-500"> · {squadLabel(parseTeamName(r.opponent))}</span>}
        </span>
        {r.playerGoals ? (
          <span className="shrink-0 text-xs font-semibold text-slate-700" title={`${profile.name}: maalit`}>
            ⚽ {r.playerGoals}
          </span>
        ) : null}
        <span className={`shrink-0 tabular-nums ${r.outcome ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{score(r)}</span>
        {r.outcome && <span className={`w-6 shrink-0 rounded text-center text-xs font-bold ${OUTCOME_CLASS[r.outcome]}`}>{OUTCOME_LABEL[r.outcome]}</span>}
      </div>
      {r.note && <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{r.note}</p>}
    </li>
  );
}

/** Lomakkeeseen: vastustajan aiemmat kohtaamiset (enintään 5 saman ryhmän ja 3 muun ryhmän peliä). */
export function OpponentHistoryCard({ profile, opponent }: { profile: Profile; opponent: string }) {
  const rows = useGameRows(profile.id);
  const logos = useClubLogos();
  const h = useMemo(() => (rows ? opponentHistory(rows, opponent) : undefined), [rows, opponent]);
  if (!h) return null;
  const s = h.squadSummary;
  return (
    <div className="rounded-2xl bg-[var(--surface-sunk)] p-3" aria-label="Aiemmat kohtaamiset">
      <div className="flex items-center gap-3">
        <TeamLogo logo={logoFor(logos, opponent)} name={opponent} size="md" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Aiemmat kohtaamiset</div>
          <div className="truncate text-sm font-semibold text-slate-900">{displayTeamName(opponent)}</div>
          {h.squad.length > 0 ? (
            <div className="text-xs tabular-nums text-slate-600">
              {s.games} {s.games === 1 ? 'peli' : 'peliä'}
              {s.wins + s.draws + s.losses > 0 && ` · V–T–H ${s.wins}–${s.draws}–${s.losses} · maalit ${s.goalsFor}–${s.goalsAgainst}`}
              {s.playerGoalsGames > 0 && ` · ${profile.name}: ⚽ ${s.playerGoals}`}
            </div>
          ) : (
            <div className="text-xs text-slate-600">Ei aiempia pelejä tätä ryhmää vastaan.</div>
          )}
        </div>
      </div>
      {h.squad.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {h.squad.slice(0, 5).map((r) => (
            <Line key={`${r.sessionId}-${r.index ?? 0}`} r={r} profile={profile} />
          ))}
        </ul>
      )}
      {h.others.length > 0 && (
        <>
          <div className="mt-3 text-xs font-semibold text-slate-600">
            Muut {h.club} -ryhmät · {h.othersSummary.games} {h.othersSummary.games === 1 ? 'peli' : 'peliä'}
            {h.othersSummary.wins + h.othersSummary.draws + h.othersSummary.losses > 0 &&
              ` · V–T–H ${h.othersSummary.wins}–${h.othersSummary.draws}–${h.othersSummary.losses}`}
          </div>
          <ul className="mt-1 space-y-1.5">
            {h.others.slice(0, 3).map((r) => (
              <Line key={`${r.sessionId}-${r.index ?? 0}`} r={r} profile={profile} squad />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// Otteluennakko (SPEC 16, 14.11.2026): kalenterin tulevasta pelistä tai turnauksesta jaettava kuva
// samalla pohjalla kuin tuloskuva. Avataan kalenterin rivin jakopainikkeesta.

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { previewCard } from '../../domain/previewCard';
import type { UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { db } from '../../db/schema';
import { logoFor, useClubLogos, useClubs } from '../../ui/TeamLogo';
import { drawPreviewCard } from './drawPreview';
import { loadImage } from './drawResult';
import { originOf } from './ResultShare';
import { findOwnTeam, MissingTeamInfo, ShareImageSheet, type RenderOptions } from './ShareSheet';

const EVENT = 'preview-share-open';
let pending: UUID | null = null;

/** Avaa ennakkokuvan kalenterin tapahtumalle (suunnitelman tunniste). */
export function openPreviewShare(planId: UUID): void {
  pending = planId;
  window.dispatchEvent(new Event(EVENT));
}

export function PreviewShareHost() {
  const [id, setId] = useState<UUID | null>(null);
  useEffect(() => {
    const run = () => {
      if (pending === null) return;
      setId(pending);
      pending = null;
    };
    window.addEventListener(EVENT, run);
    run();
    return () => window.removeEventListener(EVENT, run);
  }, []);
  return <PreviewShareSheet planId={id} onClose={() => setId(null)} />;
}

/** Ennakon tiedot: suunnitelma, kalenterin tiedot ja oma joukkue (valittu tai profiilin ainoa joukkue). */
export function usePreviewCard(planId: UUID | null) {
  return useLiveQuery(async () => {
    if (!planId) return null;
    const plan = await db.plannedSessions.get(planId);
    if (!plan || plan.deletedAt) return null;
    const fixture = await db.fixtures.get(planId);
    const live = fixture && !fixture.deletedAt ? fixture : undefined;
    let team = await findOwnTeam(plan.profileId, live?.teamId, undefined);
    if (!team) {
      const own = await repo.listTeams(plan.profileId);
      team = own.length === 1 ? own[0] : undefined;
    }
    return { card: previewCard(plan, live, team), teamPhoto: team?.photo };
  }, [planId]);
}

export function PreviewShareSheet({ planId, onClose }: { planId: UUID | null; onClose: () => void }) {
  const data = usePreviewCard(planId);
  const card = data?.card;
  const logos = useClubLogos();
  const teamLogo = card ? (logoFor(logos, card.team) ?? data?.teamPhoto) : undefined;
  const clubs = useClubs();
  const names = card ? [card.team, ...card.games.map((g) => g.opponent)] : [];
  const renderKey = useMemo(
    () => JSON.stringify([card, (teamLogo ?? '').length, names.map((n) => (logoFor(logos, n) ?? '').length), names.map((n) => originOf(clubs, n))]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card, logos, clubs, teamLogo],
  );
  const render = card
    ? async (o: RenderOptions) => {
        const [team, ...opponents] = await Promise.all(names.map((n, i) => loadImage(i === 0 ? teamLogo : logoFor(logos, n))));
        return drawPreviewCard(card, {
          ...o,
          logos: { team, opponents },
          origins: { team: originOf(clubs, card.team), opponents: card.games.map((g) => originOf(clubs, g.opponent)) },
        });
      }
    : undefined;
  const base = card?.kind === 'tournament' ? (card.eventName ?? 'turnaus') : 'ottelu';
  const fileName = `ennakko-${base.toLocaleLowerCase('fi').replace(/[^\p{L}\p{N}]+/gu, '-')}-${card?.date ?? ''}.png`;
  const opponentsMissing = card ? card.games.filter((g) => g.opponent && (!logoFor(logos, g.opponent) || !originOf(clubs, g.opponent))).length : 0;

  return (
    <ShareImageSheet open={!!planId} onClose={onClose} title="Jaa otteluennakko" alt="Otteluennakon esikatselu" teamName={card?.team} render={render} renderKey={renderKey} fileName={fileName}>
      {data === null && <p className="text-sm text-slate-600">Tapahtumaa ei löytynyt.</p>}
      {card && !card.team && <p className="text-xs text-slate-500">Valitse tapahtumalle oma joukkue, niin sen nimi, logo ja väri tulevat kuvaan.</p>}
      {card && <MissingTeamInfo key={planId ?? ''} teamName={card.team} teamLogo={!!teamLogo} opponentsMissing={opponentsMissing} />}
    </ShareImageSheet>
  );
}

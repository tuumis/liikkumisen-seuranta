// Jaettava tuloskuva (SPEC 16): pelin tai turnauksen tulokset kuvaksi. Paneelin yhteiset valinnat
// (muoto, tyyli, väri, jako) ovat ShareSheetissä; täällä kortin tiedot ja lapsen maalit (oletus pois).

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { gameRows } from '../../domain/football';
import { resultCard } from '../../domain/resultCard';
import type { UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { db } from '../../db/schema';
import { clubFor, logoFor, useClubLogos, useClubs } from '../../ui/TeamLogo';
import { Switch } from '../settings/DesktopSection';
import { drawResultCard, loadImage } from './drawResult';
import { ShareImageSheet, type RenderOptions } from './ShareSheet';

const EVENT = 'result-share-open';
let pending: UUID | null = null;

/** Avaa tuloskuvan kerralle (peli tai turnaus) mistä tahansa näkymästä. */
export function openResultShare(sessionId: UUID): void {
  pending = sessionId;
  window.dispatchEvent(new Event(EVENT));
}

/** Kiinnitetään kerran sovellukseen. */
export function ResultShareHost() {
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
  return <ResultShareSheet sessionId={id} onClose={() => setId(null)} />;
}

/** Kortin tiedot kerrasta: yhteenvedon rivit samalla laskennalla kuin Tulokset-näkymässä. */
export function useResultCard(sessionId: UUID | null) {
  return useLiveQuery(async () => {
    if (!sessionId) return null;
    const session = await db.sessions.get(sessionId);
    if (!session || session.deletedAt) return null;
    const [details, types, profile] = await Promise.all([
      repo.footballDetailsFor([session.id]),
      repo.listActivityTypes({ includeArchived: true }),
      db.profiles.get(session.profileId),
    ]);
    const card = resultCard(gameRows([session], details, new Map(types.map((t) => [t.id, t]))));
    return card ? { card, profileName: profile?.name ?? '' } : null;
  }, [sessionId]);
}

/** Seuran maa ja paikkakunta piirtoa varten. */
export const originOf = (clubs: ReturnType<typeof useClubs>, name: string | undefined) => {
  const c = clubFor(clubs, name);
  return c && (c.country || c.city) ? { country: c.country, city: c.city } : undefined;
};

export function ResultShareSheet({ sessionId, onClose }: { sessionId: UUID | null; onClose: () => void }) {
  const data = useResultCard(sessionId);
  const logos = useClubLogos();
  const clubs = useClubs();
  const [showPlayer, setShowPlayer] = useState(false);

  useEffect(() => {
    if (sessionId) setShowPlayer(false); // lapsen tiedot aina oletuksena pois
  }, [sessionId]);

  const card = data?.card;
  const names = card ? [card.team, ...card.games.map((g) => g.opponent)] : [];
  const renderKey = useMemo(
    () => JSON.stringify([card, names.map((n) => (logoFor(logos, n) ?? '').length), names.map((n) => originOf(clubs, n)), showPlayer, data?.profileName]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card, logos, clubs, showPlayer, data?.profileName],
  );

  const render = card
    ? async (o: RenderOptions) => {
        const [team, ...opponents] = await Promise.all(names.map((n) => loadImage(logoFor(logos, n))));
        return drawResultCard(card, {
          ...o,
          logos: { team, opponents },
          origins: { team: originOf(clubs, card.team), opponents: card.games.map((g) => originOf(clubs, g.opponent)) },
          player: showPlayer ? data?.profileName : undefined,
        });
      }
    : undefined;

  const base = card?.kind === 'tournament' ? (card.eventName ?? 'turnaus') : 'ottelu';
  const fileName = `${base.toLocaleLowerCase('fi').replace(/[^\p{L}\p{N}]+/gu, '-')}-${card?.date ?? ''}.png`;
  const missingLogos = names.some((n) => n && !logoFor(logos, n));

  return (
    <ShareImageSheet open={!!sessionId} onClose={onClose} title="Jaa tulos" alt="Tuloskuvan esikatselu" teamName={card?.team} render={render} renderKey={renderKey} fileName={fileName}>
      {data === null && <p className="text-sm text-slate-600">Tälle kerralle ei ole vielä kirjattu tulosta.</p>}
      {card && card.playerGoals > 0 && (
        <Switch
          on={showPlayer}
          onChange={setShowPlayer}
          label={`Näytä nimi ja maalit (${data!.profileName})`}
          text="Kuva on julkinen, kun jaat sen. Lapsen nimi ja maalit näkyvät vain, kun valitset tämän."
        />
      )}
      {card && missingLogos && <p className="text-xs text-slate-500">Logon puuttuessa näkyvät seuran nimikirjaimet. Logot, maat ja paikkakunnat lisätään Jalkapallo → Joukkueet.</p>}
    </ShareImageSheet>
  );
}

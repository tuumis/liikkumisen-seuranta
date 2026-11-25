// Jaettava tuloskuva (SPEC 16): pelin tai turnauksen tulokset kuvaksi. Paneelin yhteiset valinnat
// (muoto, tyyli, väri, jako) ovat ShareSheetissä; täällä kortin tiedot ja lapsen maalit (oletus pois).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { gameRows } from '../../domain/football';
import { resultCard, withoutInternal } from '../../domain/resultCard';
import type { UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { db } from '../../db/schema';
import { clubFor, logoFor, useClubLogos, useClubs } from '../../ui/TeamLogo';
import { Switch } from '../settings/DesktopSection';
import { drawResultCard, loadImage, ALL_SHARE_STYLES } from './drawResult';
import { findOwnTeam, MissingTeamInfo, ShareExtrasChips, ShareImageSheet, TeamDetailChips, useStoredFlag, useTeamDetailPrefs, type RenderOptions } from './ShareSheet';
import { inputClass } from '../../ui/components';
import { useToast } from '../../ui/Toast';
import { applyTeamDetails } from '../../domain/shareNames';

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
    if (!card) return null;
    const team = await findOwnTeam(session.profileId, details.get(session.id)?.teamId, card.team);
    // Kalenterin tapahtuma, josta kerta kuitattiin: pelin alku ja paikka kuvan alalaatikoihin.
    const plan = (await db.plannedSessions.where('[profileId+date]').equals([session.profileId, session.date]).toArray()).find((x) => x.sessionId === session.id && !x.deletedAt);
    const fixture = plan ? await db.fixtures.get(plan.id) : undefined;
    const location = fixture && !fixture.deletedAt ? fixture.location?.replace(/\s+/g, ' ').trim() : undefined;
    const kickoff = card.kind === 'game' ? (session.startTime ?? plan?.startTime) : undefined;
    const comment = details.get(session.id)?.shareNote;
    return { card: { ...card, ...(kickoff ? { kickoff } : {}), ...(location ? { location } : {}), ...(comment ? { comment } : {}) }, profileName: profile?.name ?? '', teamPhoto: team?.photo };
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

  const toast = useToast();
  // Kommentti (18.11.2026): luonnos piirretään heti, tallennus kerralle hetken tauon jälkeen (synkronoituu).
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => setDraft(null), [sessionId]);
  const saveTimer = useRef<number | undefined>(undefined);
  const editComment = (text: string) => {
    setDraft(text);
    const id = sessionId;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (id) repo.setResultNote(id, text).catch((e: unknown) => toast(e instanceof Error ? e.message : String(e)));
    }, 600);
  };
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);
  const stored = data?.card;
  const comment = draft ?? stored?.comment ?? '';
  // Seuran sisäiset pelit (25.11.2026): oletuksena pois kuvasta; valinta muistetaan laitteella.
  const [showInternal, setShowInternal] = useStoredFlag('shareInternal', false);
  const hasInternal = !!stored?.games.some((g) => g.internal);
  const card = useMemo(() => {
    if (!stored) return stored;
    const c = { ...(showInternal ? stored : withoutInternal(stored)) };
    const t = comment.replace(/\s+/g, ' ').trim().slice(0, 140);
    if (t) c.comment = t;
    else delete c.comment;
    return c;
  }, [stored, comment, showInternal]);
  // Ryhmä ja ikäluokka kuvassa (17.11.2026): logot ja seuran tiedot haetaan alkuperäisillä nimillä.
  const [details, setDetails] = useTeamDetailPrefs();
  const drawn = useMemo(() => (card ? applyTeamDetails(card, details) : card), [card, details]);
  const [panel, setPanel] = useStoredFlag('shareCommentPanel', true);
  const [showHomeAway, setShowHomeAway] = useStoredFlag('shareHomeAway', true);
  const teamLogo = card ? (logoFor(logos, card.team) ?? data?.teamPhoto) : undefined;
  const names = card ? [card.team, ...card.games.map((g) => g.opponent)] : [];
  const renderKey = useMemo(
    () => JSON.stringify([drawn, panel, showHomeAway, (teamLogo ?? '').length, names.map((n) => (logoFor(logos, n) ?? '').length), names.map((n) => originOf(clubs, n)), showPlayer, data?.profileName]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawn, logos, clubs, teamLogo, showPlayer, data?.profileName, panel, showHomeAway],
  );

  const render = card && drawn
    ? async (o: RenderOptions) => {
        const [team, ...opponents] = await Promise.all(names.map((n, i) => loadImage(i === 0 ? teamLogo : logoFor(logos, n))));
        return drawResultCard(drawn, {
          ...o,
          logos: { team, opponents },
          origins: { team: originOf(clubs, card.team), opponents: card.games.map((g) => originOf(clubs, g.opponent)) },
          player: showPlayer ? data?.profileName : undefined,
          commentPanel: panel,
          homeAway: showHomeAway,
        });
      }
    : undefined;

  const base = card?.kind === 'tournament' ? (card.eventName ?? 'turnaus') : 'ottelu';
  const fileName = `${base.toLocaleLowerCase('fi').replace(/[^\p{L}\p{N}]+/gu, '-')}-${card?.date ?? ''}.png`;
  const opponentsMissing = card ? card.games.filter((g) => g.opponent && (!logoFor(logos, g.opponent) || !originOf(clubs, g.opponent))).length : 0;

  return (
    <ShareImageSheet
      open={!!sessionId}
      video
      onClose={onClose}
      title="Jaa tulos"
      alt="Tuloskuvan esikatselu"
      teamName={card?.team}
      render={render}
      renderKey={renderKey}
      fileName={fileName}
      styles={ALL_SHARE_STYLES}
    >
      {data === null && <p className="text-sm text-slate-600">Tälle kerralle ei ole vielä kirjattu tulosta.</p>}
      {card && <TeamDetailChips team={card.team} opponents={card.games.map((g) => g.opponent)} prefs={details} onChange={setDetails} />}
      {card && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Kommentti kuvaan (valinnainen)</span>
          <input className={inputClass} value={comment} maxLength={140} onChange={(e) => editComment(e.target.value)} placeholder="esim. Hieno turnaus, kiitos kannustuksesta!" aria-label="Kommentti kuvaan" />
          <span className="mt-1 block text-xs text-slate-500">Tallentuu tälle pelille. {comment.length}/140</span>
        </label>
      )}
      {card && (
        <ShareExtrasChips
          hasComment={!!card.comment}
          hasHomeAway={card.games.some((g) => g.homeAway)}
          panel={panel}
          onPanel={setPanel}
          homeAway={showHomeAway}
          onHomeAway={setShowHomeAway}
          hasInternal={hasInternal}
          internal={showInternal}
          onInternal={setShowInternal}
        />
      )}
      {card && card.playerGoals > 0 && (
        <Switch
          on={showPlayer}
          onChange={setShowPlayer}
          label={`Näytä nimi ja maalit (${data!.profileName})`}
          text="Kuva on julkinen, kun jaat sen. Lapsen nimi ja maalit näkyvät vain, kun valitset tämän."
        />
      )}
      {card && <MissingTeamInfo key={sessionId ?? ''} teamName={card.team} teamLogo={!!teamLogo} opponentsMissing={opponentsMissing} />}
    </ShareImageSheet>
  );
}

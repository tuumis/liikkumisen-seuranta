// Otteluennakko (SPEC 16, 14.11.2026): kalenterin tulevasta pelistä tai turnauksesta jaettava kuva
// samalla pohjalla kuin tuloskuva. Avataan kalenterin rivin jakopainikkeesta.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { availableBoxes, previewBoxLabel, previewCard, PREVIEW_BOXES, type PreviewBox } from '../../domain/previewCard';
import type { UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { db } from '../../db/schema';
import { logoFor, useClubLogos, useClubs } from '../../ui/TeamLogo';
import { drawPreviewCard } from './drawPreview';
import { loadImage, type ShareStyle } from './drawResult';
import { ToggleChip } from '../../ui/controls';
import { inputClass } from '../../ui/components';
import { useToast } from '../../ui/Toast';

/** Ennakkokuvan tyylit (17.11.2026): tuloskuvan kaksi ja neljä uutta. */
const PREVIEW_STYLES: readonly ShareStyle[] = ['theme', 'sport', 'field', 'poster', 'clean', 'scoreboard'];

/** Piilotetut laatikot muistetaan laitteelle (kaikille ennakoille). */
const HIDDEN_KEY = 'previewHiddenBoxes';
function readHidden(): Set<PreviewBox> {
  try {
    const v = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(v) ? v.filter((b): b is PreviewBox => PREVIEW_BOXES.includes(b as PreviewBox)) : []);
  } catch {
    return new Set();
  }
}
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
  const toast = useToast();
  const data = usePreviewCard(planId);
  const [hidden, setHiddenState] = useState<Set<PreviewBox>>(readHidden);
  const setHidden = (box: PreviewBox, hide: boolean) =>
    setHiddenState((cur) => {
      const next = new Set(cur);
      if (hide) next.add(box);
      else next.delete(box);
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
      } catch {
        /* ei muistia */
      }
      return next;
    });
  // Kommentti: luonnos piirretään heti, tallennus tapahtumalle hetken tauon jälkeen (synkronoituu).
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => setDraft(null), [planId]);
  const saveTimer = useRef<number | undefined>(undefined);
  const editComment = (text: string) => {
    setDraft(text);
    const id = planId;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (id) repo.setPreviewNote(id, text).catch((e: unknown) => toast(e instanceof Error ? e.message : String(e)));
    }, 600);
  };
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);
  const stored = data?.card;
  const comment = draft ?? stored?.comment ?? '';
  const card = useMemo(() => {
    if (!stored) return stored;
    const c = { ...stored };
    const t = comment.replace(/\s+/g, ' ').trim().slice(0, 140);
    if (t) c.comment = t;
    else delete c.comment;
    return c;
  }, [stored, comment]);
  const boxes = card ? availableBoxes(card) : [];
  const logos = useClubLogos();
  const teamLogo = card ? (logoFor(logos, card.team) ?? data?.teamPhoto) : undefined;
  const clubs = useClubs();
  const names = card ? [card.team, ...card.games.map((g) => g.opponent)] : [];
  const renderKey = useMemo(
    () => JSON.stringify([card, [...hidden].sort(), (teamLogo ?? '').length, names.map((n) => (logoFor(logos, n) ?? '').length), names.map((n) => originOf(clubs, n))]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card, logos, clubs, teamLogo, hidden],
  );
  const render = card
    ? async (o: RenderOptions) => {
        const [team, ...opponents] = await Promise.all(names.map((n, i) => loadImage(i === 0 ? teamLogo : logoFor(logos, n))));
        return drawPreviewCard(card, {
          ...o,
          hidden,
          logos: { team, opponents },
          origins: { team: originOf(clubs, card.team), opponents: card.games.map((g) => originOf(clubs, g.opponent)) },
        });
      }
    : undefined;
  const base = card?.kind === 'tournament' ? (card.eventName ?? 'turnaus') : 'ottelu';
  const fileName = `ennakko-${base.toLocaleLowerCase('fi').replace(/[^\p{L}\p{N}]+/gu, '-')}-${card?.date ?? ''}.png`;
  const opponentsMissing = card ? card.games.filter((g) => g.opponent && (!logoFor(logos, g.opponent) || !originOf(clubs, g.opponent))).length : 0;

  return (
    <ShareImageSheet
      open={!!planId}
      onClose={onClose}
      title="Jaa otteluennakko"
      alt="Otteluennakon esikatselu"
      teamName={card?.team}
      render={render}
      renderKey={renderKey}
      fileName={fileName}
      styles={PREVIEW_STYLES}
      prefsKey="previewSharePrefs"
    >
      {data === null && <p className="text-sm text-slate-600">Tapahtumaa ei löytynyt.</p>}
      {card && boxes.length > 0 && (
        <div>
          <div className="mb-1.5 text-sm font-medium text-slate-700">Laatikot kuvassa</div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Laatikot kuvassa">
            {boxes.map((b) => (
              <ToggleChip key={b} on={!hidden.has(b)} onChange={(on) => setHidden(b, !on)}>
                {previewBoxLabel(b, card)}
              </ToggleChip>
            ))}
          </div>
        </div>
      )}
      {card && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Kommentti pelin alle (valinnainen)</span>
          <input className={inputClass} value={comment} maxLength={140} onChange={(e) => editComment(e.target.value)} placeholder="esim. Tervetuloa kannustamaan!" aria-label="Kommentti pelin alle" />
          <span className="mt-1 block text-xs text-slate-500">Tallentuu tälle tapahtumalle. {comment.length}/140</span>
        </label>
      )}
      {card && !card.team && <p className="text-xs text-slate-500">Valitse tapahtumalle oma joukkue, niin sen nimi, logo ja väri tulevat kuvaan.</p>}
      {card && <MissingTeamInfo key={planId ?? ''} teamName={card.team} teamLogo={!!teamLogo} opponentsMissing={opponentsMissing} />}
    </ShareImageSheet>
  );
}

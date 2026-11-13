// Jaettava tuloskuva (SPEC 16): esikatselu, muoto (tarina / julkaisu), tyyli (teema / urheilu),
// lapsen maalit valinnaisesti (oletus pois) sekä jako tai tallennus. Kuva syntyy laitteella; mitään ei
// lähetetä ennen kuin käyttäjä valitsee "Jaa".

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { gameRows } from '../../domain/football';
import { resultCard } from '../../domain/resultCard';
import type { UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { db } from '../../db/schema';
import { Button } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';
import { logoFor, useClubLogos } from '../../ui/TeamLogo';
import { useToast } from '../../ui/Toast';
import { Switch } from '../settings/DesktopSection';
import { drawResultCard, loadImage, type ShareSize, type ShareStyle } from './drawResult';

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

const PREFS = 'resultSharePrefs';
type Prefs = { size: ShareSize; style: ShareStyle };
function readPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? '{}') as Partial<Prefs>;
    return { size: p.size === 'post' ? 'post' : 'story', style: p.style === 'sport' ? 'sport' : 'theme' };
  } catch {
    return { size: 'story', style: 'theme' };
  }
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

export function ResultShareSheet({ sessionId, onClose }: { sessionId: UUID | null; onClose: () => void }) {
  const toast = useToast();
  const data = useResultCard(sessionId);
  const logos = useClubLogos();
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [showPlayer, setShowPlayer] = useState(false);
  const [src, setSrc] = useState<string>();
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (sessionId) setShowPlayer(false); // lapsen tiedot aina oletuksena pois
  }, [sessionId]);
  const setPref = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS, JSON.stringify(next));
      } catch {
        /* ei muistia */
      }
      return next;
    });

  const card = data?.card;
  const logoKey = useMemo(() => {
    if (!card) return '';
    return [card.team, ...card.games.map((g) => g.opponent)].map((n) => (logoFor(logos, n) ?? '').length).join(',');
  }, [card, logos]);

  useEffect(() => {
    if (!card) return;
    let cancelled = false;
    void (async () => {
      const [team, ...opponents] = await Promise.all([loadImage(logoFor(logos, card.team)), ...card.games.map((g) => loadImage(logoFor(logos, g.opponent)))]);
      await document.fonts?.ready;
      if (cancelled) return;
      const c = drawResultCard(card, { size: prefs.size, style: prefs.style, logos: { team, opponents }, player: showPlayer ? data?.profileName : undefined });
      canvas.current = c;
      setSrc(c.toDataURL('image/png'));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, logoKey, prefs.size, prefs.style, showPlayer, data?.profileName]);

  useEffect(() => {
    if (!sessionId) {
      setSrc(undefined);
      canvas.current = null;
    }
  }, [sessionId]);

  const fileName = () => {
    const base = card?.kind === 'tournament' ? (card.eventName ?? 'turnaus') : 'ottelu';
    return `${base.toLocaleLowerCase('fi').replace(/[^\p{L}\p{N}]+/gu, '-')}-${card?.date ?? ''}.png`;
  };
  const blob = () => new Promise<Blob | null>((res) => (canvas.current ? canvas.current.toBlob(res, 'image/png') : res(null)));

  async function save() {
    const b = await blob();
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Kuva tallennettu', undefined, 'success');
  }
  async function share() {
    const b = await blob();
    if (!b) return;
    const file = new File([b], fileName(), { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] })) return save();
    try {
      await navigator.share({ files: [file] });
    } catch {
      /* peruttu */
    }
  }
  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';
  const missingLogos = card ? [card.team, ...card.games.map((g) => g.opponent)].some((n) => n && !logoFor(logos, n)) : false;

  return (
    <Sheet open={!!sessionId} onClose={onClose} title="Jaa tulos">
      {data === null && <p className="text-sm text-slate-600">Tälle kerralle ei ole vielä kirjattu tulosta.</p>}
      {card && (
        <div className="space-y-4">
          <div className="flex justify-center rounded-2xl bg-[var(--surface-sunk)] p-3">
            {src ? (
              <img
                src={src}
                alt="Tuloskuvan esikatselu"
                className={`h-auto w-auto rounded-xl shadow-lg ${prefs.size === 'story' ? 'max-h-[52dvh]' : 'max-h-[46dvh]'} max-w-full`}
              />
            ) : (
              <div className={`${prefs.size === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]'} h-[40dvh] animate-pulse rounded-xl bg-slate-200`} />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Segmented<ShareSize>
              label="Kuvan muoto"
              value={prefs.size}
              onChange={(size) => setPref({ size })}
              options={[
                { value: 'story', label: 'Tarina 9:16' },
                { value: 'post', label: 'Julkaisu 4:5' },
              ]}
            />
            <Segmented<ShareStyle>
              label="Kuvan tyyli"
              value={prefs.style}
              onChange={(style) => setPref({ style })}
              options={[
                { value: 'theme', label: 'Teema' },
                { value: 'sport', label: 'Urheilu' },
              ]}
            />
          </div>
          {card.playerGoals > 0 && (
            <Switch
              on={showPlayer}
              onChange={setShowPlayer}
              label={`Näytä nimi ja maalit (${data!.profileName})`}
              text="Kuva on julkinen, kun jaat sen. Lapsen nimi ja maalit näkyvät vain, kun valitset tämän."
            />
          )}
          {missingLogos && <p className="text-xs text-slate-500">Logon puuttuessa näkyvät seuran nimikirjaimet. Logot lisätään Jalkapallo → Joukkueet.</p>}
          <div className="flex gap-2">
            {canShare && (
              <Button className="flex-1" onClick={() => void share()} disabled={!src}>
                Jaa
              </Button>
            )}
            <Button variant="secondary" className={canShare ? '' : 'flex-1'} onClick={() => void save()} disabled={!src}>
              Tallenna kuva
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

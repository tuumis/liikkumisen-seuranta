// Sovelluksen komennot (SPEC 16): tehtäväpalkin pikakuvakkeet (?action=…), pikanäppäimet ja
// komentovalikko käyttävät samaa väylää. Komento odottaa, kunnes sen käsittelijä on kiinnitetty
// (esim. Viikko-näkymä avautuu vasta käynnistyksen jälkeen).

export type AppCommand =
  | { kind: 'add' }
  | { kind: 'sync' }
  | { kind: 'review' }
  | { kind: 'week'; delta: -1 | 0 | 1 }
  | { kind: 'story' };

type Kind = AppCommand['kind'];
const EVENT = 'app-command';
const pending = new Map<Kind, { cmd: AppCommand; at: number }>();
/** Käsittelemätön komento vanhenee (esim. synkronointi, kun synkronointia ei ole otettu käyttöön). */
const TTL_MS = 8000;

export function dispatchCommand(cmd: AppCommand): void {
  pending.set(cmd.kind, { cmd, at: Date.now() });
  window.dispatchEvent(new Event(EVENT));
}

/** Kuuntelee annettuja komentoja; handler palauttaa false, jos se ei käsitellyt komentoa (esim. piilossa). */
export function subscribeCommands(kinds: Kind[], handler: (cmd: AppCommand) => boolean | void): () => void {
  const run = () => {
    for (const k of kinds) {
      const p = pending.get(k);
      if (!p) continue;
      if (Date.now() - p.at > TTL_MS) pending.delete(k);
      else if (handler(p.cmd) !== false) pending.delete(k);
    }
  };
  run();
  window.addEventListener(EVENT, run);
  return () => window.removeEventListener(EVENT, run);
}

/** Tehtäväpalkin pikakuvake: ?action=add | sync | review → komento; osoite siistitään. */
export function consumeLaunchAction(): AppCommand | null {
  const url = new URL(window.location.href);
  const action = url.searchParams.get('action');
  if (!action) return null;
  url.searchParams.delete('action');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return action === 'add' ? { kind: 'add' } : action === 'sync' ? { kind: 'sync' } : action === 'review' ? { kind: 'review' } : null;
}

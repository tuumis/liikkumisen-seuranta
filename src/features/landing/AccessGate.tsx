// Pääsy ohjelmaan (18.11.2026): uusi laite näkee alkusivun ja pääsee sisään kutsukoodilla tai kutsulinkillä
// (`#kutsu=KOODI`). Laite, jolla on jo tietoja, avautuu suoraan. Hyväksyntä muistetaan laitteelle.

import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { DEMO } from '../../demo/demoMode';
import { checkInvite, inviteFromHash, stripInvite } from '../../domain/invite';
import { db } from '../../db/schema';

const Landing = lazy(() => import('./Landing').then((m) => ({ default: m.Landing })));

const KEY = 'inviteAccepted';
let acceptedInSession = false;

function isAccepted() {
  // Esimerkkitilaan pääsee vain kutsukoodin jälkeen; tila jatkuu uudelleenlatauksessa ilman uutta tarkistusta.
  if (acceptedInSession || DEMO) return true;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function accept() {
  acceptedInSession = true;
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* yksityinen tila: hyväksyntä vain tämän käynnin ajan */
  }
}

type GateState = 'checking' | 'locked' | 'open';

// Kutsulinkin koodi luetaan kerran sivun latautuessa ja poistetaan osoitteesta heti, ettei se jää historiaan
// eikä kirjanmerkkeihin (ja ettei tarkistus riipu efektien ajokerroista).
const linkCode = (() => {
  if (typeof location === 'undefined') return undefined;
  const code = inviteFromHash(location.hash);
  if (code !== undefined) history.replaceState(history.state, '', location.pathname + location.search + stripInvite(location.hash));
  return code;
})();

export function AccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>(() => (isAccepted() ? 'open' : 'checking'));
  const [linkFailed, setLinkFailed] = useState(false);

  useEffect(() => {
    if (state !== 'checking') return;
    let cancelled = false;
    void (async () => {
      if (linkCode !== undefined) {
        if (await checkInvite(linkCode)) {
          accept();
          if (!cancelled) setState('open');
          return;
        }
        if (!cancelled) setLinkFailed(true);
      }
      // Nykyiset käyttäjät: laitteella on jo profiili (myös arkistoitu) → suoraan sisään.
      let existing = false;
      try {
        existing = (await db.profiles.count()) > 0;
      } catch {
        existing = false;
      }
      if (cancelled) return;
      if (existing) {
        accept();
        setState('open');
      } else setState('locked');
    })();
    return () => {
      cancelled = true;
    };
  }, [state]);

  if (state === 'open') return <>{children}</>;
  if (state === 'checking') return null;
  return (
    <Suspense fallback={null}>
      <Landing
        linkFailed={linkFailed}
        onUnlock={() => {
          accept();
          setState('open');
          window.scrollTo({ top: 0 });
        }}
      />
    </Suspense>
  );
}

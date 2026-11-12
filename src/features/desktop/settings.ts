// Työpöytätilan laitekohtaiset asetukset (localStorage) ja asennuskehote (SPEC 16).

import { useSyncExternalStore } from 'react';

export interface DesktopSettings {
  /** Kuittaamattomien määrä sovelluskuvakkeen merkkinä (ja välilehden otsikossa). */
  badge: boolean;
  /** Windows-/selainilmoitukset (vaatii luvan). */
  notify: boolean;
  /** Ilmoitus, kun suunniteltu kerta (kellonajalla) päättyy. */
  planEnd: boolean;
  /** Iltamuistutus kuittaamattomista ja tarkistamattomasta arkiliikunnasta. */
  evening: boolean;
  eveningTime: string;
  /** PC: automaattinen synkronointi kansioon (jo annetulla luvalla). */
  autoSync: boolean;
}

export const DESKTOP_DEFAULTS: DesktopSettings = { badge: true, notify: false, planEnd: true, evening: true, eveningTime: '20:00', autoSync: true };

const KEY = 'desktop';
const EVENT = 'desktopsettingschange';

let cache: DesktopSettings | undefined;
function read(): DesktopSettings {
  if (cache) return cache;
  try {
    cache = { ...DESKTOP_DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<DesktopSettings>) };
  } catch {
    cache = { ...DESKTOP_DEFAULTS };
  }
  return cache;
}

export function setDesktopSettings(patch: Partial<DesktopSettings>) {
  cache = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ei tallennusta */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useDesktopSettings(): [DesktopSettings, (patch: Partial<DesktopSettings>) => void] {
  const s = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    read,
    () => DESKTOP_DEFAULTS,
  );
  return [s, setDesktopSettings];
}

// ---------- asennus omaksi sovellukseksi ----------

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installEvent: InstallPromptEvent | null = null;
const INSTALL_EVENT = 'installpromptchange';
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // näytetään omasta painikkeesta (Asetukset → Laitteet)
    installEvent = e as InstallPromptEvent;
    window.dispatchEvent(new Event(INSTALL_EVENT));
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    window.dispatchEvent(new Event(INSTALL_EVENT));
  });
}

/** Asennuskehote, jos selain tarjoaa sen (Chrome, Edge); null muuten. */
export function useInstallPrompt(): (() => Promise<boolean>) | null {
  const ev = useSyncExternalStore(
    (cb) => {
      window.addEventListener(INSTALL_EVENT, cb);
      return () => window.removeEventListener(INSTALL_EVENT, cb);
    },
    () => installEvent,
    () => null,
  );
  if (!ev) return null;
  return async () => {
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    installEvent = null;
    window.dispatchEvent(new Event(INSTALL_EVENT));
    return outcome === 'accepted';
  };
}

// ---------- ilmoitukset ----------

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

/** Näyttää ilmoituksen; klikkaus tuo sovelluksen eteen. Puhelimella (ei Notification-konstruktoria) service workerin kautta. */
export async function showNotification(title: string, body: string, tag: string, onClick?: () => void): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const icon = new URL('pwa-192.png', document.baseURI).href;
  try {
    const n = new Notification(title, { body, tag, icon });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.showNotification(title, { body, tag, icon });
  }
}

// ---------- pyyntö Viikko-näkymälle (ilmoituksen klikkaus) ----------

const REVIEW_EVENT = 'openweekrequest';
let pendingReview: boolean | null = null;

/** Pyytää Viikko-näkymää palaamaan kuluvaan viikkoon ja (review) avaamaan "Käy viikko läpi". */
export function requestWeek(review: boolean) {
  pendingReview = review;
  window.dispatchEvent(new Event(REVIEW_EVENT));
}

/** Viikko-näkymän kuuntelija; käsittelee myös ennen kiinnitystä tulleen pyynnön. */
export function subscribeWeekRequest(cb: (review: boolean) => void): () => void {
  const run = () => {
    if (pendingReview === null) return;
    const r = pendingReview;
    pendingReview = null;
    cb(r);
  };
  run();
  window.addEventListener(REVIEW_EVENT, run);
  return () => window.removeEventListener(REVIEW_EVENT, run);
}

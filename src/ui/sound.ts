// Äänet (SPEC 16): lyhyet, hiljaiset äänet onnistumisista. Syntetisoidaan Web Audio -rajapinnalla:
// ei äänitiedostoja eikä verkkoliikennettä. Laitekohtainen valinta (oletus päällä), iPhonella äänetön
// tila hiljentää äänet.

import { useSyncExternalStore } from 'react';

export type SoundKind = 'confirm' | 'allDone' | 'goal';

const KEY = 'sounds';
const listeners = new Set<() => void>();

function readEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

let enabled = typeof window !== 'undefined' ? readEnabled() : false;

export const soundsSupported = (): boolean =>
  typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window);

export function setSoundsEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* ei muistia: valinta voimassa tämän istunnon */
  }
  for (const l of listeners) l();
  if (on) unlock();
}

export function useSoundsEnabled(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => enabled,
    () => false,
  );
  return [on, setSoundsEnabled];
}

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  if (!soundsSupported()) return null;
  try {
    // iPhone (Safari 16.4+): "ambient" noudattaa äänetöntä tilaa eikä keskeytä musiikkia.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Selaimet sallivat äänen vasta käyttäjän eleen jälkeen: konteksti avataan painalluksella. */
function unlock(): void {
  if (!enabled) return;
  const c = context();
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

type Note = { f: number; at: number; dur: number; gain: number };

// Duurisävelet: kuittaus nouseva kaksisävel, läpikäynti valmis kolmisointu, tavoite täyttyi pidempi nousu.
const SOUNDS: Record<SoundKind, Note[]> = {
  confirm: [
    { f: 784, at: 0, dur: 0.16, gain: 0.55 },
    { f: 1175, at: 0.07, dur: 0.3, gain: 0.5 },
  ],
  allDone: [
    { f: 1047, at: 0, dur: 0.22, gain: 0.45 },
    { f: 1319, at: 0.09, dur: 0.24, gain: 0.45 },
    { f: 1568, at: 0.18, dur: 0.55, gain: 0.5 },
  ],
  goal: [
    { f: 523, at: 0, dur: 0.2, gain: 0.5 },
    { f: 659, at: 0.08, dur: 0.2, gain: 0.5 },
    { f: 784, at: 0.16, dur: 0.22, gain: 0.5 },
    { f: 1047, at: 0.24, dur: 0.8, gain: 0.55 },
    { f: 1568, at: 0.3, dur: 0.7, gain: 0.18 },
  ],
};

const VOLUME = 0.13;

/** Soittaa äänen, jos äänet ovat päällä ja sovellus näkyvissä. `delay` sekunteina (esim. kuittauksen perään). */
export function playSound(kind: SoundKind, delay = 0): void {
  if (!enabled || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
  const c = context();
  if (!c) return;
  try {
    if (c.state === 'suspended') void c.resume().catch(() => undefined);
    const t0 = c.currentTime + 0.02 + delay;
    const master = c.createGain();
    master.gain.value = VOLUME;
    master.connect(c.destination);
    for (const n of SOUNDS[kind]) {
      // Perussävel ja hiljainen oktaavi: pehmeä kellomainen sointi.
      for (const [mult, share] of [
        [1, 1],
        [2, 0.22],
      ] as const) {
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.value = n.f * mult;
        const g = c.createGain();
        const s = t0 + n.at;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(n.gain * share, s + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, s + n.dur);
        o.connect(g).connect(master);
        o.start(s);
        o.stop(s + n.dur + 0.03);
      }
    }
  } catch {
    /* ääni ei ole välttämätön */
  }
}

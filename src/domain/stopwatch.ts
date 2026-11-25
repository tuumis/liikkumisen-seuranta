// Sekuntikello (25.11.2026): liikkumisen todellisen ajan kellotus. Kello perustuu aikaleimoihin, joten se
// pysyy oikeassa, vaikka näyttö sammuu tai sovellus suljetaan. Kerralle tallentuu tarkka aika sekunteina
// (timedSec) ja laskelmiin minuutteihin pyöristetty kesto.

import { localDateOf } from './dates';
import type { HHmm, ISODate, UUID } from './types';

/** Käynnissä tai tauolla oleva kello. Laitekohtainen: ei synkronoida eikä varmuuskopioida. */
export interface Stopwatch {
  profileId: UUID;
  /** Laji, jos valittu käynnistettäessä; muuten valitaan tallennettaessa. */
  activityTypeId?: UUID;
  /** Käynnistyshetki (ms). */
  startedAt: number;
  /** Kirjauksen päivä ja alkamisaika (käynnistyshetken mukaan). */
  date: ISODate;
  startTime: HHmm;
  /** Päättyneiden taukojen yhteiskesto (ms). */
  pausedMs: number;
  /** Käynnissä olevan tauon alku (ms); puuttuu, kun kello käy. */
  pausedAt?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function newStopwatch(profileId: UUID, activityTypeId: UUID | undefined, now: Date): Stopwatch {
  const sw: Stopwatch = {
    profileId,
    startedAt: now.getTime(),
    date: localDateOf(now),
    startTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    pausedMs: 0,
  };
  if (activityTypeId) sw.activityTypeId = activityTypeId;
  return sw;
}

/** Kellotettu aika sekunteina (tauot pois). */
export function elapsedSec(sw: Stopwatch, now: number): number {
  const end = sw.pausedAt ?? now;
  return Math.max(0, Math.floor((end - sw.startedAt - sw.pausedMs) / 1000));
}

export const isPaused = (sw: Stopwatch) => sw.pausedAt !== undefined;

export function pauseStopwatch(sw: Stopwatch, now: number): Stopwatch {
  return isPaused(sw) ? sw : { ...sw, pausedAt: now };
}

export function resumeStopwatch(sw: Stopwatch, now: number): Stopwatch {
  if (sw.pausedAt === undefined) return sw;
  const { pausedAt, ...rest } = sw;
  return { ...rest, pausedMs: sw.pausedMs + Math.max(0, now - pausedAt) };
}

/** Kerran kesto minuutteina: lähimpään minuuttiin, vähintään 1 min. */
export function timedMinutes(sec: number): number {
  return Math.max(1, Math.round(sec / 60));
}

/** Kellonäyttö: 0:05, 47:32, 1:02:03. */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** Tarkka aika tekstinä: 45 s, 47 min 32 s, 1 h 2 min 3 s. */
export function formatTimed(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${m} min ${s % 60} s`;
  if (m > 0) return `${m} min ${s % 60} s`;
  return `${s} s`;
}

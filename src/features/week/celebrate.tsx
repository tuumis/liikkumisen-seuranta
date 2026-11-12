// Onnistumisen hetki (SPEC 16): viikon suositus täyttyi -juhlistus kerran viikossa profiilia kohden
// ja peräkkäisten täyttyneiden viikkojen putki. Puhdas esitys; laskenta tulee raportista.

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays } from '../../domain/dates';
import { periodReport } from '../../domain/report';
import type { ActivityType, ISODate, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { today as todayFn } from '../../ui/today';
import { weekModel } from './WeekSummary';

/** Tarkasteltavien aiempien viikkojen enimmäismäärä putkessa. */
export const STREAK_LOOKBACK_WEEKS = 12;

/**
 * Peräkkäiset viikot, joina pääsuositus täyttyi, tämä viikko mukaan lukien (0, jos tämä viikko ei täyty).
 * Lasketaan samalla raportilla kuin etusivu; ennen seurannan alkua olevat viikot katkaisevat putken.
 */
export function useMetStreak(profile: Profile, weekStart: ISODate, enabled: boolean): number {
  const today = todayFn();
  const from = addDays(weekStart, -7 * STREAK_LOOKBACK_WEEKS);
  const end = addDays(weekStart, 6);
  const data = useLiveQuery(async () => {
    if (!enabled) return undefined;
    const [sessions, estimates, flags, planned, types, settings] = await Promise.all([
      repo.sessionsInRange(profile.id, from, end),
      repo.listEstimates(profile.id),
      repo.dayFlagsInRange(profile.id, from, end),
      repo.plansInRange(profile.id, from, end),
      repo.listActivityTypes({ includeArchived: true }),
      repo.getSettings(),
    ]);
    return { sessions, estimates, flags, planned, types: new Map<string, ActivityType>(types.map((t) => [t.id, t])), settings };
  }, [enabled, profile.id, from, end]);

  return useMemo(() => {
    if (!enabled || !data) return 0;
    let n = 0;
    for (let w = 0; w <= STREAK_LOOKBACK_WEEKS; w++) {
      const start = addDays(weekStart, -7 * w);
      const r = periodReport({ profile, period: { kind: 'week', start, end: addDays(start, 6) }, ...data, today });
      const main = weekModel(r, data.settings).main;
      if (!r.evaluation.evaluable || main?.m.status !== 'met') break;
      n++;
    }
    return n;
  }, [enabled, data, profile, weekStart, today]);
}

const KEY = 'celebratedWeeks';

function readCelebrated(): Record<string, ISODate> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, ISODate>;
  } catch {
    return {};
  }
}

/**
 * true kerran viikossa profiilia kohden, kun ehto täyttyy (selaimen muistiin; ei synkronoida).
 * Palauttaa { message: näytetäänkö onnitteluteksti, sparks: kipinäanimaatio käynnissä }.
 */
export function useCelebrateOnce(profileId: string, weekStart: ISODate, when: boolean): { message: boolean; sparks: boolean } {
  const [message, setMessage] = useState(false);
  const [sparks, setSparks] = useState(false);
  useEffect(() => {
    if (!when) return;
    const seen = readCelebrated();
    if (seen[profileId] === weekStart) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...seen, [profileId]: weekStart }));
    } catch {
      /* ei muistia → juhlistus voi toistua */
    }
    setMessage(true);
    setSparks(true);
    navigator.vibrate?.([30, 60, 30]);
  }, [when, profileId, weekStart]);
  useEffect(() => {
    if (!sparks) return;
    const id = window.setTimeout(() => setSparks(false), 3200);
    return () => window.clearTimeout(id);
  }, [sparks]);
  return { message, sparks };
}

const SPARK_COLORS = ['var(--hero-accent)', '#ffffff', 'var(--hero-pill-bg)', '#f6d7a7'];

/** Kipinäpurske renkaan ympärille (koristeellinen, piilotetaan "vähennä liikettä" -asetuksella). */
export function Sparks({ count = 18, radius = 96 }: { count?: number; radius?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + (i % 2 ? 0.18 : 0);
        const d = radius * (0.75 + ((i * 37) % 10) / 30);
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, c: SPARK_COLORS[i % SPARK_COLORS.length], s: 4 + (i % 3) * 2, delay: (i % 4) * 40 };
      }),
    [count, radius],
  );
  return (
    <span className="sparks pointer-events-none absolute inset-0" aria-hidden>
      {items.map((p, i) => (
        <span
          key={i}
          className="spark"
          style={{
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
            width: p.s,
            height: p.s,
            background: p.c,
            animationDelay: `${1100 + p.delay}ms`,
          }}
        />
      ))}
    </span>
  );
}

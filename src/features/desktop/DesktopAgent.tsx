// Työpöytätila (SPEC 16): sovelluskuvakkeen merkki, ilmoitukset ja PC:n automaattinen synkronointi.
// Toimii, kun sovellus on auki (myös pienennettynä); ei palvelinta eikä verkkoliikennettä.

import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays } from '../../domain/dates';
import { weeklyHours } from '../../domain/hours';
import { endedBetween, hhmmToMin, reminderText, unconfirmedNow } from '../../domain/reminders';
import { endOfFor } from '../review/unconfirmed';
import type { MergeSummary } from '../../db/backup';
import { repo } from '../../db/repositories';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { ConflictSheet } from '../sync/ConflictSheet';
import { pcAutoSync } from '../sync/useSync';
import { requestWeek, showNotification, useDesktopSettings } from './settings';

const BASE_TITLE = typeof document !== 'undefined' ? document.title : 'Liikkumisen seuranta';
const SYNC_EVERY_MS = 5 * 60_000;
const SYNC_THROTTLE_MS = 60_000;
const EVENING_KEY = 'desktopEveningShown';

const minOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function DesktopAgent({ onOpen }: { onOpen: (profileId: string) => void }) {
  const [settings] = useDesktopSettings();
  const toast = useToast();
  const [conflicts, setConflicts] = useState<MergeSummary | null>(null);

  // Kello: tarkistus puolen minuutin välein (taustalla selain voi harventaa, mikä riittää).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    const wake = () => setNow(new Date());
    window.addEventListener('focus', wake);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', wake);
    };
  }, []);
  const t = todayFn();
  const nowMin = minOf(now);

  // Kaikkien profiilien avoimet kerrat tähän päivään asti ja tämän päivän tarkistamaton arkiliikunta.
  const data = useLiveQuery(async () => {
    const types = new Map((await repo.listActivityTypes({ includeArchived: true })).map((x) => [x.id, x]));
    const rows = await Promise.all(
      (await repo.listProfiles()).map(async (profile) => {
        const [plans, sessions, todayPlans, estimates, flags] = await Promise.all([
          repo.unconfirmedPlans(profile.id, addDays(t, 1)),
          repo.sessionsInRange(profile.id, t, t),
          repo.plansInRange(profile.id, t, t),
          repo.listEstimates(profile.id),
          repo.dayFlagsInRange(profile.id, t, t),
        ]);
        const day = weeklyHours({ period: { kind: 'week', start: t, end: t }, sessions, planned: todayPlans, estimates, flags, types, today: t }).days[0];
        return { profile, plans, endOf: await endOfFor(plans, t), arkiPending: !!day && !day.flagged && day.estimateMin > 0 };
      }),
    );
    return { types, rows };
  }, [t]);

  const pending = (data?.rows ?? []).flatMap((r) => unconfirmedNow(r.plans, t, nowMin, r.endOf).map((p) => ({ p, profile: r.profile })));
  const count = pending.length;

  // Merkki sovelluskuvakkeeseen (asennettu sovellus) ja määrä välilehden otsikkoon.
  const badgeCount = settings.badge ? count : 0;
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    try {
      if (badgeCount > 0) void nav.setAppBadge?.(badgeCount)?.catch(() => {});
      else void nav.clearAppBadge?.()?.catch(() => {});
    } catch {
      /* ei tukea */
    }
    document.title = badgeCount > 0 ? `(${badgeCount}) ${BASE_TITLE}` : BASE_TITLE;
  }, [badgeCount]);

  // Ilmoitukset: kerta päättyi (vain sovelluksen ollessa auki päättyneet) ja iltamuistutus kerran päivässä.
  const lastMin = useRef<{ date: string; min: number } | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = lastMin.current;
    lastMin.current = { date: t, min: nowMin };
    if (!settings.notify) return;
    if (settings.planEnd && prev && prev.date === t && nowMin > prev.min) {
      for (const r of data.rows) {
        for (const p of endedBetween(r.plans, t, prev.min, nowMin, r.endOf)) {
          const name = p.label ?? data.types.get(p.activityTypeId)?.name ?? 'Kerta';
          const start = p.startTime ?? '';
          const end = r.endOf(p);
          void showNotification(
            `${name} päättyi`,
            `${r.profile.name} · ${start}${end !== undefined ? `–${hhmm(end)}` : ''} · Kuittaa tehdyksi tai merkitse "Ei tehty"`,
            `plan-${p.id}`,
            () => {
              onOpen(r.profile.id);
              requestWeek(false);
            },
          );
        }
      }
    }
    if (settings.evening && nowMin >= hhmmToMin(settings.eveningTime)) {
      let shown: string | null = null;
      try {
        shown = localStorage.getItem(EVENING_KEY);
      } catch {
        /* ei muistia */
      }
      if (shown !== t) {
        try {
          localStorage.setItem(EVENING_KEY, t);
        } catch {
          /* ei muistia */
        }
        const text = reminderText({ unconfirmed: count, arkiNames: data.rows.filter((r) => r.arkiPending).map((r) => r.profile.name) });
        const first = pending[0]?.profile ?? data.rows.find((r) => r.arkiPending)?.profile;
        if (text && first) {
          const review = pending.some((x) => x.p.date < t);
          void showNotification(text.title, text.body, 'evening', () => {
            onOpen(first.id);
            requestWeek(review);
          });
        }
      }
    }
  }, [nowMin, t, data, settings.notify, settings.planEnd, settings.evening, settings.eveningTime]);

  // PC: automaattinen synkronointi käynnistyessä, 5 min välein ja ikkunan saadessa fokuksen.
  const busy = useRef(false);
  const lastRun = useRef(0);
  useEffect(() => {
    if (!settings.autoSync) return;
    const run = async (force = false) => {
      if (busy.current || (!force && Date.now() - lastRun.current < SYNC_THROTTLE_MS)) return;
      busy.current = true;
      lastRun.current = Date.now();
      try {
        const r = await pcAutoSync();
        const s = r?.summary;
        if (s && (s.added || s.updated || s.deleted || s.conflicts.length)) {
          const msg = `Puhelimelta: ${r.message.replace(/^Yhdistetty: /, '')}`;
          if (s.conflicts.length) toast(msg, { label: 'Näytä', run: () => setConflicts(s) });
          else toast(msg);
        }
      } catch {
        /* automaattinen yritys; käsin "Synkronoi" näyttää virheen */
      } finally {
        busy.current = false;
      }
    };
    const first = window.setTimeout(() => void run(true), 3000);
    const id = window.setInterval(() => void run(true), SYNC_EVERY_MS);
    const onFocus = () => void run();
    const onVis = () => document.visibilityState === 'visible' && void run();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [settings.autoSync, toast]);

  return <ConflictSheet summary={conflicts} onClose={() => setConflicts(null)} />;
}

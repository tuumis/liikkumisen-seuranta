// Jalkapallodata live-kyselyistä: kerrat, lisätiedot, suunnitelmat ja lajit aikaväliltä.

import { useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { FootballInput } from '../../domain/football';
import type { ActivityType, ISODate, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { today as todayFn } from '../../ui/today';

/**
 * from/to undefined = koko historia. Haku on sidottu profiiliin ja aikaväliin (17.11.2026): vaihdon aikana
 * edellisen profiilin kertoja ei näytetä uuden nimellä, vaan edellinen kokonainen tulos pysyy, kunnes uusi on valmis.
 */
export function useFootball(profileId: UUID | undefined, from: ISODate = '0000-01-01', to: ISODate = '9999-12-31'): FootballInput | undefined {
  const today = todayFn();
  const key = `${profileId}|${from}|${to}`;
  const raw = useLiveQuery(async () => {
    if (!profileId) return undefined;
    const typesList = await repo.listActivityTypes({ includeArchived: true });
    const footballIds = new Set(typesList.filter((t) => t.sport === 'football').map((t) => t.id));
    const sessions = (await repo.sessionsInRange(profileId, from, to)).filter((s) => footballIds.has(s.activityTypeId));
    const [details, planned] = await Promise.all([repo.footballDetailsFor(sessions.map((s) => s.id)), repo.plansInRange(profileId, from, to)]);
    return { key, sessions, details, planned, typesList };
  }, [profileId, from, to]);
  const fresh = raw && raw.key === key ? raw : undefined;
  const last = useRef(fresh);
  if (fresh) last.current = fresh;
  const data = profileId ? (fresh ?? last.current) : undefined;

  return useMemo(
    () =>
      data && {
        sessions: data.sessions,
        details: data.details,
        planned: data.planned,
        types: new Map<UUID, ActivityType>(data.typesList.map((t) => [t.id, t])),
        today,
      },
    [data, today],
  );
}

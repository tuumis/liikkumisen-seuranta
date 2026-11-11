// Jalkapallodata live-kyselyistä: kerrat, lisätiedot, suunnitelmat ja lajit aikaväliltä.

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { FootballInput } from '../../domain/football';
import type { ActivityType, ISODate, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { today as todayFn } from '../../ui/today';

/** from/to undefined = koko historia. */
export function useFootball(profileId: UUID | undefined, from: ISODate = '0000-01-01', to: ISODate = '9999-12-31'): FootballInput | undefined {
  const today = todayFn();
  const data = useLiveQuery(async () => {
    if (!profileId) return undefined;
    const typesList = await repo.listActivityTypes({ includeArchived: true });
    const footballIds = new Set(typesList.filter((t) => t.sport === 'football').map((t) => t.id));
    const sessions = (await repo.sessionsInRange(profileId, from, to)).filter((s) => footballIds.has(s.activityTypeId));
    const [details, planned] = await Promise.all([repo.footballDetailsFor(sessions.map((s) => s.id)), repo.plansInRange(profileId, from, to)]);
    return { sessions, details, planned, typesList };
  }, [profileId, from, to]);

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

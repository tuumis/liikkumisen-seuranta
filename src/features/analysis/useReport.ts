// Jakson raportti live-kyselyistä (repositoriokerros → puhdas periodReport).

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { periodReport, type PeriodReport } from '../../domain/report';
import type { ActivityType, Period, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { today as todayFn } from '../../ui/today';

export function useReport(profile: Profile | undefined, period: Period): PeriodReport | undefined {
  const today = todayFn();
  const pid = profile?.id;
  const data = useLiveQuery(async () => {
    if (!pid) return undefined;
    const [sessions, estimates, flags, planned, types, settings] = await Promise.all([
      repo.sessionsInRange(pid, period.start, period.end),
      repo.listEstimates(pid),
      repo.dayFlagsInRange(pid, period.start, period.end),
      repo.plansInRange(pid, period.start, period.end),
      repo.listActivityTypes({ includeArchived: true }),
      repo.getSettings(),
    ]);
    return { sessions, estimates, flags, planned, types, settings };
  }, [pid, period.start, period.end]);

  return useMemo(() => {
    if (!profile || !data) return undefined;
    return periodReport({
      profile,
      period,
      ...data,
      types: new Map<string, ActivityType>(data.types.map((t) => [t.id, t])),
      today,
    });
  }, [profile, period, data, today]);
}

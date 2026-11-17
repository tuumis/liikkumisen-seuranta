// Jakson raportti live-kyselyistä (repositoriokerros → puhdas periodReport).

import { useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { periodReport, type PeriodReport } from '../../domain/report';
import type { ActivityType, Period, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { today as todayFn } from '../../ui/today';

/**
 * Jakson raportti. Haku on sidottu profiiliin ja jaksoon (17.11.2026, käyttäjän havainto välkkymisestä):
 * kun profiili tai jakso vaihtuu, live-kysely palauttaa hetken vielä edellisen haun tiedot. Niitä ei
 * yhdistetä uuteen profiiliin tai jaksoon (tulos olisi tyhjä raportti "0 / 60 · Liian vähän kirjauksia"),
 * vaan näytetään edellinen kokonainen raportti, kunnes uuden tiedot ovat valmiit.
 */
export function useReport(profile: Profile | undefined, period: Period): PeriodReport | undefined {
  const today = todayFn();
  const pid = profile?.id;
  const key = `${pid}|${period.start}|${period.end}`;
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
    return { key, sessions, estimates, flags, planned, types, settings };
  }, [pid, period.start, period.end]);
  const fresh = data && data.key === key ? data : undefined;

  const report = useMemo(() => {
    if (!profile || !fresh) return undefined;
    return periodReport({
      profile,
      period,
      ...fresh,
      types: new Map<string, ActivityType>(fresh.types.map((t) => [t.id, t])),
      today,
    });
  }, [profile, period, fresh, today]);
  const last = useRef<PeriodReport | undefined>(undefined);
  if (report) last.current = report;
  return profile ? (report ?? last.current) : undefined;
}

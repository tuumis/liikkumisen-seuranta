// Kuukausikalenterin ja tulosteen tiedot (18.11.2026): pelikalenteri, kirjatut pelit ja valinnaiset treenit
// väliltä yhdellä live-kyselyllä. Vaihdettaessa väliä palautetaan edellinen valmis tulos, kunnes uusi on
// haettu (ruudukko ei hetkeksi tyhjene).

import { useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo, type FixtureEntry } from '../../db/repositories';
import { friendlyRows, gameRows } from '../../domain/football';
import { monthEvents, type CalEvent } from '../../domain/monthCalendar';
import type { ActivityType, ISODate, Session, UUID } from '../../domain/types';

export interface CalendarData {
  from: ISODate;
  to: ISODate;
  events: Map<ISODate, CalEvent[]>;
  fixtures: Map<UUID, FixtureEntry>;
  sessions: Map<UUID, Session>;
  types: Map<UUID, ActivityType>;
}

export function useCalendarEvents(profileId: UUID, from: ISODate, to: ISODate, today: ISODate, trainings: boolean): CalendarData | undefined {
  const key = `${profileId}|${from}|${to}|${today}|${trainings}`;
  const raw = useLiveQuery(async () => {
    const typesList = await repo.listActivityTypes({ includeArchived: true });
    const footballIds = new Set(typesList.filter((t) => t.sport === 'football').map((t) => t.id));
    const sessions = (await repo.sessionsInRange(profileId, from, to)).filter((s) => footballIds.has(s.activityTypeId));
    const [details, fixtures, plans] = await Promise.all([
      repo.footballDetailsFor(sessions.map((s) => s.id)),
      repo.listFixtures(profileId, from, to),
      trainings ? repo.calendarTrainings(profileId, from, to, today) : Promise.resolve([]),
    ]);
    return { key, from, to, typesList, sessions, details, fixtures, plans };
  }, [key]);
  const fresh = raw && raw.key === key ? raw : undefined;
  const last = useRef(fresh);
  if (fresh) last.current = fresh;
  const data = fresh ?? (last.current?.key.startsWith(`${profileId}|`) ? last.current : undefined);

  return useMemo(() => {
    if (!data) return undefined;
    const types = new Map<UUID, ActivityType>(data.typesList.map((t) => [t.id, t]));
    const rows = [...gameRows(data.sessions, data.details, types), ...friendlyRows(data.sessions, data.details, types)];
    const events = monthEvents({
      today,
      fixtures: data.fixtures,
      rows,
      sessionStart: new Map(data.sessions.map((s) => [s.id, s.startTime])),
      trainings: data.plans.map((p) => ({ id: p.id, date: p.date, startTime: p.startTime, durationMin: p.durationMin, name: p.label ?? 'Treeni' })),
    });
    return {
      from: data.from,
      to: data.to,
      events,
      fixtures: new Map(data.fixtures.map((e) => [e.plan.id, e])),
      sessions: new Map(data.sessions.map((s) => [s.id, s])),
      types,
    };
  }, [data, today]);
}

// Kuukausikalenterin, tulosteen ja kalenteriviennin tiedot (18.11.2026): pelikalenteri, kirjatut pelit ja
// valinnaiset treenit väliltä yhdellä live-kyselyllä. Perhekalenterissa (19.11.2026) usean profiilin
// tapahtumat yhdistetään, ja jokainen tapahtuma tietää profiilinsa. Vaihdettaessa väliä palautetaan
// edellinen valmis tulos, kunnes uusi on haettu (ruudukko ei hetkeksi tyhjene).

import { useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo, type FixtureEntry } from '../../db/repositories';
import { friendlyRows, gameRows } from '../../domain/football';
import { mergeProfileEvents, monthEvents, type CalEvent } from '../../domain/monthCalendar';
import type { ActivityType, ISODate, Session, Team, UUID } from '../../domain/types';

export interface CalendarData {
  from: ISODate;
  to: ISODate;
  events: Map<ISODate, CalEvent[]>;
  fixtures: Map<UUID, FixtureEntry>;
  sessions: Map<UUID, Session>;
  types: Map<UUID, ActivityType>;
  /** Kaikkien mukana olevien profiilien joukkueet (myös arkistoidut). */
  teams: Map<UUID, Team>;
}

export function useCalendarEvents(profileIds: UUID[], from: ISODate, to: ISODate, today: ISODate, trainings: boolean): CalendarData | undefined {
  const ids = profileIds.join(',');
  const key = `${ids}|${from}|${to}|${today}|${trainings}`;
  const raw = useLiveQuery(async () => {
    const typesList = await repo.listActivityTypes({ includeArchived: true });
    const footballIds = new Set(typesList.filter((t) => t.sport === 'football').map((t) => t.id));
    const perProfile = await Promise.all(
      ids.split(',').filter(Boolean).map(async (profileId) => {
        const sessions = (await repo.sessionsInRange(profileId, from, to)).filter((s) => footballIds.has(s.activityTypeId));
        const [details, fixtures, plans, teams] = await Promise.all([
          repo.footballDetailsFor(sessions.map((s) => s.id)),
          repo.listFixtures(profileId, from, to),
          trainings ? repo.calendarTrainings(profileId, from, to, today) : Promise.resolve([]),
          repo.listTeams(profileId, { includeArchived: true }),
        ]);
        return { profileId, sessions, details, fixtures, plans, teams };
      }),
    );
    return { key, from, to, typesList, perProfile };
  }, [key]);
  const fresh = raw && raw.key === key ? raw : undefined;
  const last = useRef(fresh);
  if (fresh) last.current = fresh;
  const data = fresh ?? (last.current?.key.startsWith(`${ids}|`) ? last.current : undefined);

  return useMemo(() => {
    if (!data) return undefined;
    const types = new Map<UUID, ActivityType>(data.typesList.map((t) => [t.id, t]));
    const byProfile = data.perProfile.map((p) => ({
      profileId: p.profileId,
      events: monthEvents({
        today,
        fixtures: p.fixtures,
        rows: [...gameRows(p.sessions, p.details, types), ...friendlyRows(p.sessions, p.details, types)],
        sessionStart: new Map(p.sessions.map((s) => [s.id, s.startTime])),
        sessionDuration: new Map(p.sessions.map((s) => [s.id, s.durationMin])),
        trainings: p.plans.map((t) => ({ id: t.id, date: t.date, startTime: t.startTime, durationMin: t.durationMin, name: t.label ?? 'Treeni' })),
      }),
    }));
    return {
      from: data.from,
      to: data.to,
      events: mergeProfileEvents(byProfile),
      fixtures: new Map(data.perProfile.flatMap((p) => p.fixtures.map((e) => [e.plan.id, e] as const))),
      sessions: new Map(data.perProfile.flatMap((p) => p.sessions.map((s) => [s.id, s] as const))),
      types,
      teams: new Map(data.perProfile.flatMap((p) => p.teams.map((t) => [t.id, t] as const))),
    };
  }, [data, today]);
}

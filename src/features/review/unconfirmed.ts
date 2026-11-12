// Kuittaamattomat kerrat nyt: menneet avoimet ja tämän päivän jo päättyneet (SPEC 12, 16).

import { useEffect, useState } from 'react';
import { addDays } from '../../domain/dates';
import { unconfirmedNow, type EndOf } from '../../domain/reminders';
import { endOfWithFixtures } from '../../domain/tournamentTime';
import type { Fixture, ISODate, PlannedSession, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { db } from '../../db/schema';

export const minutesNow = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

/** Päättymisajat: turnauksilla otteluohjelman mukaan (tämän päivän kerrat). */
export async function endOfFor(plans: PlannedSession[], today: ISODate): Promise<EndOf> {
  const ids = plans.filter((p) => p.date === today).map((p) => p.id);
  const rows = ids.length ? await db.fixtures.bulkGet(ids) : [];
  return endOfWithFixtures(new Map(rows.filter((f): f is Fixture => !!f && !f.deletedAt).map((f) => [f.plannedSessionId, f])));
}

export async function loadUnconfirmed(profileId: UUID, today: ISODate): Promise<PlannedSession[]> {
  const plans = await repo.unconfirmedPlans(profileId, addDays(today, 1));
  return unconfirmedNow(plans, today, minutesNow(), await endOfFor(plans, today));
}

/** Minuuttilaskuri live-kyselyn riippuvuudeksi: tämän päivän kerta tulee kuitattavaksi päättyessään. */
export function useMinuteTick(): number {
  const [m, setM] = useState(minutesNow);
  useEffect(() => {
    const id = window.setInterval(() => setM(minutesNow()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return m;
}

// Kuittaamattomat kerrat nyt: menneet avoimet ja tämän päivän jo päättyneet (SPEC 12, 16).

import { useEffect, useState } from 'react';
import { addDays } from '../../domain/dates';
import { unconfirmedNow } from '../../domain/reminders';
import type { ISODate, PlannedSession, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';

export const minutesNow = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

export async function loadUnconfirmed(profileId: UUID, today: ISODate): Promise<PlannedSession[]> {
  return unconfirmedNow(await repo.unconfirmedPlans(profileId, addDays(today, 1)), today, minutesNow());
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

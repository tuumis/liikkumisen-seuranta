// Työpöytätilan muistutukset (SPEC 16): kuittaamattomat kerrat sovelluskuvakkeen merkkiin ja ilmoituksiin.
// Puhdas laskenta; ilmoitusten näyttäminen ja ajastus ovat käyttöliittymässä (features/desktop).

import type { ISODate, PlannedSession } from './types';

/** "HH:mm" → minuutit vuorokauden alusta. */
export function hhmmToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Kerran päättymishetki minuutteina vuorokauden alusta (alku + kesto); ilman kellonaikaa undefined. */
export function planEndMin(p: Pick<PlannedSession, 'startTime' | 'durationMin'>): number | undefined {
  return p.startTime ? hhmmToMin(p.startTime) + Math.max(0, p.durationMin) : undefined;
}

const isOpen = (p: PlannedSession) => !p.deletedAt && p.status === 'open';

/** Päättymisaika; turnauksella otteluohjelman mukaan (ks. tournamentTime). */
export type EndOf = (p: PlannedSession) => number | undefined;

/**
 * Kuittaamattomat kerrat nyt: avoimet menneiltä päiviltä sekä tämän päivän kerrat, joiden
 * päättymisaika on ohi. Tämän päivän kerta ilman kellonaikaa lasketaan vasta seuraavana päivänä.
 */
export function unconfirmedNow(planned: PlannedSession[], today: ISODate, nowMin: number, endOf: EndOf = planEndMin): PlannedSession[] {
  return planned.filter((p) => {
    if (!isOpen(p) || p.date > today) return false;
    if (p.date < today) return true;
    const end = endOf(p);
    return end !== undefined && end <= nowMin;
  });
}

/** Tänään välillä (fromMin, toMin] päättyneet avoimet kerrat (ilmoitus "kerta päättyi"). */
export function endedBetween(planned: PlannedSession[], today: ISODate, fromMin: number, toMin: number, endOf: EndOf = planEndMin): PlannedSession[] {
  return planned.filter((p) => {
    if (!isOpen(p) || p.date !== today) return false;
    const end = endOf(p);
    return end !== undefined && end > fromMin && end <= toMin;
  });
}

/** Iltamuistutuksen teksti; undefined, jos muistutettavaa ei ole. */
export function reminderText(input: { unconfirmed: number; arkiNames: string[] }): { title: string; body: string } | undefined {
  const { unconfirmed, arkiNames } = input;
  if (unconfirmed <= 0 && arkiNames.length === 0) return undefined;
  const parts: string[] = [];
  if (unconfirmed > 0) parts.push(unconfirmed === 1 ? '1 kerta odottaa kuittausta' : `${unconfirmed} kertaa odottaa kuittausta`);
  if (arkiNames.length) parts.push(`tämän päivän arkiliikunta tarkistamatta (${arkiNames.join(', ')})`);
  const body = parts.join(' · ');
  return { title: unconfirmed > 0 ? 'Kuittaamattomia kertoja' : 'Tarkista arkiliikunta', body: body.charAt(0).toUpperCase() + body.slice(1) };
}

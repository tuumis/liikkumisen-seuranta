// Tunnisteet (SPEC 6, "Synkronointikentät ja johdetut tunnisteet").
// Kun sama tietue voi syntyä kahdella laitteella toisistaan tietämättä,
// tunniste johdetaan sisällöstä, jotta yhdistäminen ei tuplaa sitä.

import type { ISODate, UUID } from './types';

/** Sisäänrakennettu laji: t:<key>. */
export const activityTypeId = (key: string): UUID => `t:${key}`;

/** Pohjasta luotu suunnitelma: p:<templateItemId>:<date>. */
export const plannedSessionId = (templateItemId: UUID, date: ISODate): UUID => `p:${templateItemId}:${date}`;

/** Suunnitelman kuittauksesta syntyvä kerta: s:<plannedSessionId>. */
export const sessionIdFromPlanned = (plannedId: UUID): UUID => `s:${plannedId}`;

/** Päivämerkintä: f:<profileId>:<date>. */
export const dayFlagId = (profileId: UUID, date: ISODate): UUID => `f:${profileId}:${date}`;

/** Asetusrivin kiinteä tunniste. */
export const SETTINGS_ID = 'settings' as const;

/**
 * Satunnainen tunniste: crypto.randomUUID(). Varalla getRandomValues-pohjainen
 * v4-UUID, koska randomUUID puuttuu ei-suojatuissa yhteyksissä (esim. puhelimen
 * testaus lähiverkon http-osoitteesta).
 */
export function newId(): UUID {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

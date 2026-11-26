// Kalenterimerkinnät (27.11.2026): arjen muut tapahtumat liikunnan rinnalla. Eivät vaikuta mihinkään lukuun.

import { isISODate } from './dates';
import type { CalendarNote, ISODate, UUID } from './types';

export const NOTE_TITLE_MAX = 80;
export const NOTE_PLACE_MAX = 80;
export const NOTE_MEMO_MAX = 500;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface CalendarNoteInput {
  /** Puuttuu = koko perhe. */
  profileId?: UUID;
  date: ISODate;
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  memo?: string;
}

/** Tarkistus ennen tallennusta: virheilmoitus tai undefined. */
export function noteError(input: CalendarNoteInput): string | undefined {
  const title = input.title.trim();
  if (!title) return 'Kirjoita merkinnän nimi';
  if (title.length > NOTE_TITLE_MAX) return `Nimi on liian pitkä (enintään ${NOTE_TITLE_MAX} merkkiä)`;
  if ((input.location ?? '').trim().length > NOTE_PLACE_MAX) return `Paikka on liian pitkä (enintään ${NOTE_PLACE_MAX} merkkiä)`;
  if ((input.memo ?? '').trim().length > NOTE_MEMO_MAX) return `Muistiinpanot ovat liian pitkät (enintään ${NOTE_MEMO_MAX} merkkiä)`;
  if (!isISODate(input.date)) return 'Tarkista päivä';
  if (input.startTime && !CLOCK.test(input.startTime)) return 'Tarkista alkamisaika';
  if (input.endTime && !CLOCK.test(input.endTime)) return 'Tarkista päättymisaika';
  if (input.endTime && !input.startTime) return 'Anna myös alkamisaika';
  if (input.startTime && input.endTime && input.endTime <= input.startTime) return 'Päättymisajan pitää olla alkamisajan jälkeen';
  return undefined;
}

/** Päivän merkinnät: kellonajalliset aikajärjestyksessä, ilman aikaa olevat ensin (koko päivän muistiinpano). */
export const compareNotes = (a: CalendarNote, b: CalendarNote): number =>
  a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.title.localeCompare(b.title, 'fi');

/** "klo 14.30–15.15" tai "klo 14.30"; ilman aikaa tyhjä. */
export function noteTimeText(n: Pick<CalendarNote, 'startTime' | 'endTime'>): string {
  if (!n.startTime) return '';
  const f = (t: string) => t.replace(':', '.');
  return `klo ${f(n.startTime)}${n.endTime ? `–${f(n.endTime)}` : ''}`;
}

// Lomajaksot (SPEC 16): koulun lomat ym. Lomapäivinä arkipäivä lasketaan arkiliikunnan
// perusarviossa viikonlopun arvoilla, ja avoimet koululiikuntasuunnitelmat ohitetaan syyllä "Loma".
// Jaksot tallentuvat synkronoituvaan asetusriviin (yhteiset kaikille profiileille tai rajattu).

import { datesBetween, isWeekend } from './dates';
import type { Estimate, ISODate, UUID } from './types';

export interface Holiday {
  id: string;
  label: string;
  start: ISODate;
  /** Mukaan luettu päivä. */
  end: ISODate;
  /** Profiilit, joita jakso koskee; puuttuu = kaikki profiilit. */
  profileIds?: UUID[];
}

/** Ehdotetut nimet (Suomen koulujen lomat). */
export const HOLIDAY_SUGGESTIONS = ['Syysloma', 'Joululoma', 'Talviloma', 'Pääsiäinen', 'Kesäloma'] as const;

export const appliesTo = (h: Holiday, profileId: UUID) => !h.profileIds || h.profileIds.length === 0 || h.profileIds.includes(profileId);

/** Profiilin lomapäivät jaksolta `from`–`to` (mukaan luettuina). */
export function holidayDates(holidays: readonly Holiday[] | undefined, profileId: UUID, from: ISODate, to: ISODate): Set<ISODate> {
  const out = new Set<ISODate>();
  for (const h of holidays ?? []) {
    if (!appliesTo(h, profileId) || h.end < from || h.start > to) continue;
    for (const d of datesBetween(h.start < from ? from : h.start, h.end > to ? to : h.end)) out.add(d);
  }
  return out;
}

/** Päivän lomajakso (ensimmäinen osuva), jos sellainen on. */
export function holidayOn(holidays: readonly Holiday[] | undefined, profileId: UUID, d: ISODate): Holiday | undefined {
  return holidays?.find((h) => appliesTo(h, profileId) && h.start <= d && d <= h.end);
}

/** Lasketaanko päivä perusarviossa viikonlopuksi: la–su tai lomapäivä. */
export const weekendLike = (d: ISODate, holiday = false) => holiday || isWeekend(d);

/** Perusarvion kesto päivälle (ei tehokerrointa): arki- tai viikonloppuminuutit (loma = viikonloppu). */
export const estimateBaseMin = (e: Estimate, d: ISODate, holiday = false) => (weekendLike(d, holiday) ? e.weekendMin : e.weekdayMin);

/** Jakson tarkistus: virheilmoitus tai null. */
export function holidayError(h: Pick<Holiday, 'label' | 'start' | 'end'>): string | null {
  if (!h.label.trim()) return 'Anna jaksolle nimi';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(h.start) || !/^\d{4}-\d{2}-\d{2}$/.test(h.end)) return 'Valitse alku- ja loppupäivä';
  if (h.end < h.start) return 'Loppupäivä on ennen alkupäivää';
  if (datesBetween(h.start, h.end).length > 120) return 'Jakso voi olla enintään 120 päivää';
  return null;
}

/** Järjestys näyttöön: uusin alku ensin. */
export const sortHolidays = (hs: readonly Holiday[]) => [...hs].sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : a.label.localeCompare(b.label, 'fi')));

import { format } from 'date-fns';
import { fi } from 'date-fns/locale';
import { isoWeekday, parseISODate } from '../domain/dates';
import type { ISODate } from '../domain/types';

/** date-fns vain näyttömuotoiluun; Date-olio luodaan paikallisesta päivästä. */
export function formatDate(d: ISODate, pattern: string): string {
  const { year, month, day } = parseISODate(d);
  return format(new Date(year, month - 1, day), pattern, { locale: fi });
}

const WEEKDAY_SHORT = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];

/** "Ti 10.11." */
export function dayLabel(d: ISODate): string {
  const { month, day } = parseISODate(d);
  return `${WEEKDAY_SHORT[isoWeekday(d) - 1]} ${day}.${month}.`;
}

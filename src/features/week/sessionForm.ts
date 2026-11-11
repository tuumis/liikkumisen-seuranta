// Kerran lomakkeen validointi (zod) – yhteinen pikalisäykselle ja muokkaukselle.

import { z } from 'zod';
import { isISODate } from '../../domain/dates';
import type { ActivityType, ISODate, StrengthDefault } from '../../domain/types';

// Tyhjä merkkijono ei saa muuttua nollaksi (z.coerce.number('') === 0).
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const minutes = z.preprocess(
  blankToUndefined,
  z.coerce.number({ message: 'Anna minuutit' }).int('Kokonaisluku').min(0, 'Vähintään 0').max(1440, 'Enintään 1440'),
);

export const durationSchema = z.coerce
  .number({ message: 'Anna kesto' })
  .int('Kesto minuutteina')
  .min(1, 'Kesto vähintään 1 min')
  .max(1440, 'Kesto enintään 24 h');

/** Päivä: kelvollinen ISO-päivä, ei tulevaisuudessa (kerta on toteutunut liikkuminen). */
export const dateSchema = (today: ISODate) =>
  z
    .string()
    .refine(isISODate, 'Valitse päivä')
    .refine((d) => d <= today, 'Kertaa ei voi kirjata tulevalle päivälle');

/** Valinnainen kokonaislukukenttä merkkijonosta: '' → undefined. */
export const optionalMinutes = z.union([z.string().trim().length(0).transform(() => undefined), minutes]);

export const manualSchema = z.object({ light: minutes, moderate: minutes, vigorous: minutes });

/** Näkyykö lihas-/luustovalinta (yes ja ask näkyvät; no piilotetaan, ellei valinta ole jo päällä). */
export const showStrength = (d: StrengthDefault, current = false) => d !== 'no' || current;

export const strengthDefaults = (t: ActivityType) => ({ muscle: t.muscleDefault === 'yes', bone: t.boneDefault === 'yes' });

/** Ensimmäinen virheilmoitus kentittäin. */
export function issuesByField(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0] ?? '_')] ??= i.message;
  return out;
}

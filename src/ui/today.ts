import { localDateOf } from '../domain/dates';
import type { ISODate } from '../domain/types';

/** Tämän päivän paikallinen päivämäärä. */
export const today = (): ISODate => localDateOf(new Date());

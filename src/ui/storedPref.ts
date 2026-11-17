// Laitekohtaiset käyttöliittymävalinnat (localStorage). Muisti voi puuttua (yksityinen ikkuna):
// silloin käytetään oletusta eikä valinta säily.

import { useState } from 'react';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ei muistia */
  }
}

/** Kyllä/ei-valinta (esim. jakokuvien lisävalinnat, kalenterin treenit). */
export function useStoredFlag(key: string, fallback: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    const v = read(key);
    return v === null ? fallback : v === '1';
  });
  const update = (v: boolean) => {
    setValue(v);
    write(key, v ? '1' : '0');
  };
  return [value, update];
}

/** Yksi sallituista arvoista (esim. kalenterin Lista | Kuukausi). */
export function useStoredChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const v = read(key);
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  });
  const update = (v: T) => {
    setValue(v);
    write(key, v);
  };
  return [value, update];
}

/** JSON-olio; tallennettu arvo yhdistetään oletukseen ja tarkistetaan kutsujan funktiolla. */
export function readStoredJson<T extends object>(key: string, fallback: T, clean: (v: Partial<T>) => T): T {
  try {
    const v = JSON.parse(read(key) ?? 'null') as Partial<T> | null;
    return v && typeof v === 'object' ? clean({ ...fallback, ...v }) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key: string, value: object) {
  write(key, JSON.stringify(value));
}

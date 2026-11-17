// Suomalaisten jalkapalloseurojen valmis luettelo (17.11.2026, käyttäjän toive): seurakentän ehdotukset
// ilman verkkoyhteyttä. Luettelo on sovelluksen mukana (seed/finnishClubsData), eikä sitä tallenneta
// tietokantaan: seura tallentuu omaksi tiedoksi vasta, kun käyttäjä valitsee sen peliin tai vastustajaksi.

import { FINNISH_CLUBS_DATA } from '../seed/finnishClubsData';
import { clubKey } from './opponent';

/** Palloliiton alue: E = Eteläinen, L = Läntinen, I = Itäinen, P = Pohjoinen, A = Åland. */
export type ClubArea = 'E' | 'L' | 'I' | 'P' | 'A';

export const CLUB_AREA_LABEL: Readonly<Record<ClubArea, string>> = { E: 'Eteläinen', L: 'Läntinen', I: 'Itäinen', P: 'Pohjoinen', A: 'Åland' };

export interface DirectoryClub {
  /** Näytettävä nimi: lyhenne (esim. KuPS), jos se on virallista nimeä lyhyempi. */
  name: string;
  /** Virallinen nimi, jos eri kuin näytettävä (haku ja selite). */
  fullName?: string;
  city: string;
  area: ClubArea;
  /** Seuralla on juniorijoukkueita (pojat/tytöt) Palloliiton sarjoissa. */
  juniors: boolean;
}

let cache: DirectoryClub[] | undefined;

/** Koko luettelo (jäsennetään kerran). */
export function finnishClubs(): DirectoryClub[] {
  if (cache) return cache;
  cache = FINNISH_CLUBS_DATA.split('\n').map((row) => {
    const [short, full, city, area, j] = row.split('|');
    const useShort = !!short && short.length <= full.length;
    const name = useShort ? short : full;
    return { name, ...(useShort && clubKey(full) !== clubKey(short) ? { fullName: full } : {}), city, area: area as ClubArea, juniors: j === 'j' };
  });
  return cache;
}

let index: Map<string, DirectoryClub> | undefined;

/** Seura luettelosta nimen tai virallisen nimen perusteella (kirjainkoko ja välilyönnit eivät haittaa). */
export function findFinnishClub(name: string | undefined): DirectoryClub | undefined {
  if (!name?.trim()) return undefined;
  if (!index) {
    index = new Map();
    // Juniorijoukkueelliset ensin: saman lyhenteen seuroista ensisijainen on junioriseura.
    const list = [...finnishClubs()].sort((a, b) => Number(b.juniors) - Number(a.juniors));
    for (const c of list) for (const n of [c.name, c.fullName]) if (n && !index.has(clubKey(n))) index.set(clubKey(n), c);
  }
  return index.get(clubKey(name));
}

/** Seuran selite ehdotuslistaan: virallinen nimi ja kotikunta, esim. "Kuopion Palloseura · Kuopio". */
export function clubLabel(c: DirectoryClub): string {
  return [c.fullName, c.city].filter(Boolean).join(' · ');
}

/** Oma alue omien joukkueiden seuroista: kotikunnat ja Palloliiton alueet. */
export function homeOf(ownClubs: readonly string[]): { cities: Set<string>; areas: Set<ClubArea> } {
  const cities = new Set<string>();
  const areas = new Set<ClubArea>();
  for (const n of ownClubs) {
    const c = findFinnishClub(n);
    if (!c) continue;
    cities.add(c.city);
    areas.add(c.area);
  }
  return { cities, areas };
}

/**
 * Luettelon seurat ehdotusjärjestyksessä: oman kotikunnan seurat, sitten oman alueen, sitten muut.
 * Kunkin ryhmän sisällä juniorijoukkueelliset ensin ja aakkosjärjestys. `exclude`: jo listatut (seura-avaimet).
 */
export function rankedFinnishClubs(home: { cities: Set<string>; areas: Set<ClubArea> }, exclude: ReadonlySet<string> = new Set()): DirectoryClub[] {
  const tier = (c: DirectoryClub) => (home.cities.has(c.city) ? 0 : home.areas.has(c.area) ? 1 : 2);
  return finnishClubs()
    .filter((c) => !exclude.has(clubKey(c.name)))
    .sort((a, b) => tier(a) - tier(b) || Number(b.juniors) - Number(a.juniors) || a.name.localeCompare(b.name, 'fi'));
}

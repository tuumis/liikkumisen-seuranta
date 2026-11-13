// Joukkueen nimi kolmena osana (SPEC 16): seura, ryhmä ja ikäluokka, esim. "FC Honka · Musta · 2018".
// Nimi tallennetaan edelleen yhtenä tekstinä (vastustaja, oma joukkue), joten vanha data säilyy
// sellaisenaan: osat jäsennetään lukuhetkellä. Vanhat muodot "FC Honka / Musta" ja "P2016 Sininen"
// jaetaan erottimen ("/", "·", "|") ja ikäluokan (vuosi, P2016, T12) perusteella.

export interface TeamParts {
  club: string;
  group?: string;
  age?: string;
}

/** Erotin tallennettavassa nimessä. */
export const PART_SEP = ' · ';
const SPLIT_RE = /\s*[/·|]\s*/;
const AGE_RE = /^(?:[PT]\s?)?(?:19|20)\d{2}$|^[PT]\d{1,2}$/i;

export const isAgeClass = (s: string): boolean => AGE_RE.test(s.trim());

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Jäsentää nimen osiin. Tyhjä teksti → seura ''. */
export function parseTeamName(text: string | undefined): TeamParts {
  const s = clean(text);
  if (!s) return { club: '' };
  const parts = s.split(SPLIT_RE).map(clean).filter(Boolean);
  if (parts.length >= 2) {
    const [club, ...rest] = parts;
    const ageIdx = rest.map(isAgeClass).lastIndexOf(true);
    const age = ageIdx >= 0 ? rest[ageIdx] : undefined;
    const group = rest.filter((_, i) => i !== ageIdx).join(' ') || undefined;
    return { club, ...(group ? { group } : {}), ...(age ? { age } : {}) };
  }
  // Ilman erotinta: ikäluokka tunnistetaan sanoista, loput ovat seura.
  const words = s.split(' ');
  const ageIdx = words.map(isAgeClass).lastIndexOf(true);
  if (ageIdx < 0 || words.length === 1) return { club: s };
  const club = words.filter((_, i) => i !== ageIdx).join(' ');
  return { club, age: words[ageIdx] };
}

/** Osista tallennettava nimi (tyhjät osat jätetään pois). */
export function formatTeamName(p: Partial<TeamParts>): string {
  return [p.club, p.group, p.age].map(clean).filter(Boolean).join(PART_SEP);
}

/** Seuran vertailuavain: kirjainkoko ja välilyönnit eivät erota seuroja. */
export function clubKey(name: string): string {
  return clean(name).toLocaleLowerCase('fi');
}

/** Seuran tunniste johdetaan nimestä, joten kaksi laitetta tuottaa saman tietueen. */
export const clubIdOf = (name: string): string => `club:${clubKey(name)}`;

/** Ryhmän ja ikäluokan tunniste seuran sisällä (vertailuun). */
export function squadKey(p: TeamParts): string {
  return `${clubKey(p.club)}|${clean(p.group).toLocaleLowerCase('fi')}|${clean(p.age).toLocaleLowerCase('fi')}`;
}

/** Ikäluokka näytettäväksi: pelkkä syntymävuosi saa perään "syntyneet" (2018 → "2018 syntyneet"). */
export function ageLabel(age: string | undefined): string {
  const a = clean(age);
  return /^(?:19|20)\d{2}$/.test(a) ? `${a} syntyneet` : a;
}

/** Ryhmän ja ikäluokan näyttönimi seuran alla, esim. "Musta · 2018 syntyneet"; tyhjänä "Ei ryhmää". */
export function squadLabel(p: TeamParts): string {
  return [clean(p.group), ageLabel(p.age)].filter(Boolean).join(PART_SEP) || 'Ei ryhmää';
}

/** Koko nimi näytettäväksi (tallennettu teksti ei muutu): "FC Honka · Musta · 2018 syntyneet". */
export function displayTeamName(text: string | undefined): string {
  const p = parseTeamName(text);
  if (!p.age || !/^(?:19|20)\d{2}$/.test(p.age)) return clean(text);
  return [p.club, clean(p.group), ageLabel(p.age)].filter(Boolean).join(PART_SEP);
}

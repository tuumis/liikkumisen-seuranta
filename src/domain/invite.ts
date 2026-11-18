// Kutsukoodi (18.11.2026): uudet käyttäjät pääsevät ohjelmaan koodilla, jota pyydetään ohjelman tekijältä.
// Koodi tarkistetaan laitteella tiivisteestä, joten se on kevyt portti eikä tietoturvaa: koodi on julkisessa
// lähdekoodissa vain tiivisteenä, mutta tarkistuksen voi ohittaa. Käyttäjien tiedot ovat aina vain heidän
// omilla laitteillaan, joten suojattavaa ei ole palvelimella.

/** Voimassa olevien koodien tiivisteet (SHA-256, suola + normalisoitu koodi). Vaihto: lisää uusi, poista vanha. */
export const INVITE_HASHES: readonly string[] = ['b3f6f063717288ad379cfd48fe94b4deb70384aaa5bb4cdab1e9bf1e102db603'];

const SALT = 'liikkumisen-seuranta:kutsu:';

/** Kirjainkoolla, väliviivoilla, välilyönneillä ja ä/ö-pisteillä ei ole väliä. */
export function normalizeInvite(code: string): string {
  return code
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export async function inviteHash(code: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + normalizeInvite(code));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkInvite(code: string, hashes: readonly string[] = INVITE_HASHES): Promise<boolean> {
  if (!normalizeInvite(code)) return false;
  return hashes.includes(await inviteHash(code));
}

/** Kutsulinkin koodi osoitteen #-osasta (esim. `#kutsu=KOODI`); undefined = ei kutsua. */
export function inviteFromHash(hash: string): string | undefined {
  const m = /(?:^#|&)kutsu=([^&]*)/.exec(hash);
  if (!m) return undefined;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, ' '));
  } catch {
    return m[1];
  }
}

/** Osoitteen #-osa ilman kutsua (koodi ei jää selaimen historiaan eikä kirjanmerkkeihin). */
export function stripInvite(hash: string): string {
  const rest = hash
    .replace(/^#/, '')
    .split('&')
    .filter((p) => p && !p.startsWith('kutsu='));
  return rest.length ? `#${rest.join('&')}` : '';
}

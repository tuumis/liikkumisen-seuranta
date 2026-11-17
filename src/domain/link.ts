// Pelin ja turnauksen linkki (17.11.2026, käyttäjän toive): esim. turnauksen sivu, otteluohjelma tai
// tulospalvelu. Sovellus ei hae linkistä mitään (SPEC 11); linkki avautuu vain käyttäjän napautuksesta selaimeen.

/** Linkin enimmäispituus. */
export const LINK_MAX = 500;

/**
 * Siistii käyttäjän antaman linkin: tyhjä = undefined, virheellinen = null. Ilman osoitteen alkua
 * ("tulospalvelu.palloliitto.fi/…") lisätään https://. Vain http- ja https-osoitteet hyväksytään.
 */
export function normalizeLink(input: string | undefined): string | undefined | null {
  const s = input?.trim();
  if (!s) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname.includes('.')) return null;
  return url.href.length > LINK_MAX ? null : url.href;
}

/** Linkin lyhyt nimi näytettäväksi: palvelimen nimi ilman www-alkua. */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

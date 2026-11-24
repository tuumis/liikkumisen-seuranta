// Esimerkkitila (24.11.2026): sovellukseen voi tutustua keksityillä tiedoilla koskematta omiin tietoihin.
// Tila on välilehtikohtainen (sessionStorage) ja käyttää omaa tietokantaa, joka luodaan uudelleen jokaisella
// siirtymällä (seedDemo). Synkronointi, varmuuskopiointi ja PC:n ilmoitukset eivät ole esimerkissä käytössä.

import Dexie from 'dexie';

export const DEMO_DB_NAME = 'liikkumisseuranta-esimerkki';
const FLAG = 'demoMode';
/** Omat näkymäasetukset (localStorage) talteen siirryttäessä, palautetaan poistuttaessa. */
const RETURN = 'demoReturn';

function read(): boolean {
  try {
    return sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

/** Onko tämä välilehti esimerkkitilassa (luetaan kerran käynnistyksessä; tietokanta valitaan sen mukaan). */
export const DEMO = read();

/** Siirtyy esimerkkitilaan: vanha esimerkki poistetaan, joten tiedot luodaan tuoreina tämän päivän mukaan. */
export async function enterDemo(): Promise<void> {
  try {
    // Esimerkistä uudelleen aloitettaessa omat asetukset ovat jo tallessa.
    if (!DEMO) sessionStorage.setItem(RETURN, JSON.stringify({ ...localStorage }));
  } catch {
    // Asetusten tallennus ei estä tutustumista.
  }
  // Toisessa välilehdessä auki oleva esimerkki voi estää poiston: silloin jatketaan entisellä aineistolla.
  await Promise.race([Dexie.delete(DEMO_DB_NAME).catch(() => undefined), new Promise((r) => setTimeout(r, 1500))]);
  sessionStorage.setItem(FLAG, '1');
  try {
    localStorage.removeItem('selectedProfileId');
    localStorage.setItem('tab', 'week');
  } catch {
    // ei estä
  }
  location.reload();
}

/** Palaa omiin tietoihin; esimerkin aikana muuttuneet näkymäasetukset palautetaan ennalleen. */
export function exitDemo(): void {
  try {
    const saved = sessionStorage.getItem(RETURN);
    if (saved) {
      const values = JSON.parse(saved) as Record<string, string>;
      localStorage.clear();
      for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
    }
  } catch {
    // Palautus ei estä poistumista.
  }
  sessionStorage.removeItem(FLAG);
  sessionStorage.removeItem(RETURN);
  location.reload();
}

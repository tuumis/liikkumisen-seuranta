// Esimerkkitila (24.11.2026): sovellukseen voi tutustua keksityillä tiedoilla koskematta omiin tietoihin.
// Tila on välilehtikohtainen (sessionStorage) ja käyttää omaa tietokantaa, joka luodaan uudelleen jokaisella
// siirtymällä (seedDemo). Synkronointi, varmuuskopiointi ja PC:n ilmoitukset eivät ole esimerkissä käytössä.

import Dexie from 'dexie';
import type { HeroTheme, Settings } from '../domain/types';

export const DEMO_DB_NAME = 'liikkumisseuranta-esimerkki';
const FLAG = 'demoMode';
/** Omat näkymäasetukset (localStorage) talteen siirryttäessä, palautetaan poistuttaessa. */
const RETURN = 'demoReturn';
/**
 * Omat tietokanta-asetukset esimerkkiin (24.11.2026): laskenta-asetukset ja valitun profiilin näkymävalinnat
 * (pääkortin teema, viikon huomiot). Näkymän järjestys, väriteema, tausta ja muut laitteen asetukset
 * (localStorage) ovat esimerkissä valmiiksi samat kuin omassa sovelluksessa.
 */
const OWN = 'demoOwn';

export interface DemoOwnSettings {
  settings: Pick<Settings, 'vigorousDayMin' | 'vigorousDayRule' | 'vigorousDayByAge' | 'primaryView'>;
  heroTheme?: HeroTheme;
  heroThemeDark?: HeroTheme;
  insightsRec?: boolean;
  insightsLoad?: boolean;
}

/** Esimerkkiin siirrettävät omat asetukset (luetaan esimerkin luonnissa). */
export function readDemoOwn(): DemoOwnSettings | null {
  try {
    const v = sessionStorage.getItem(OWN);
    return v ? (JSON.parse(v) as DemoOwnSettings) : null;
  } catch {
    return null;
  }
}

/** Omista tiedoista (ei esimerkkitilassa): asetukset ja valitun profiilin näkymävalinnat talteen. */
async function captureOwn(): Promise<void> {
  const { repo } = await import('../db/repositories');
  const s = await repo.getSettings();
  const profiles = await repo.listProfiles();
  const sel = localStorage.getItem('selectedProfileId');
  const p = profiles.find((x) => x.id === sel) ?? profiles[0];
  const own: DemoOwnSettings = {
    settings: { vigorousDayMin: s.vigorousDayMin, vigorousDayRule: s.vigorousDayRule, vigorousDayByAge: s.vigorousDayByAge, primaryView: s.primaryView },
    heroTheme: p?.heroTheme,
    heroThemeDark: p?.heroThemeDark,
    insightsRec: p?.insightsRec,
    insightsLoad: p?.insightsLoad,
  };
  sessionStorage.setItem(OWN, JSON.stringify(own));
}

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
  // Omat asetukset esimerkkiin (vain omista tiedoista siirryttäessä; esimerkin uudelleenaloitus pitää ne).
  if (!DEMO) await captureOwn().catch(() => sessionStorage.removeItem(OWN));
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
  sessionStorage.removeItem(OWN);
  location.reload();
}

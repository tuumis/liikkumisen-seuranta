// Viralliset liikkumissuositukset versioituna vakiona (SPEC 4).
// Sovellus ei muuta näitä arvoja, eikä käyttäjä voi muokata niitä.
// Sovelluksen omat tulkinnat on erotettu omaksi vakiokseen (APP_INTERPRETATIONS).

import type { Holiday } from './holidays';
export const RECOMMENDATIONS_VERSION = '2026-11-11';

export interface SourceRef {
  title: string;
  url?: string;
  checked: string; // tarkistuspäivä
}

export const SOURCES = {
  okm2021: {
    title: 'Liikkumissuositus 7–17-vuotiaille lapsille ja nuorille, OKM 2021:50',
    url: 'https://ukkinstituutti.fi/wp-content/uploads/2022/03/OKM_2021_50.pdf',
    checked: '2026-11-11',
  },
  ukkAllAges: {
    title: 'UKK-instituutti: Liiku kaiken ikäisenä (mukaellen OKM 2016 ja 2021)',
    url: 'https://ukkinstituutti.fi/wp-content/uploads/2024/04/LiikuKaikenIkaisena-web-1.pdf',
    checked: '2026-11-11',
  },
  okm2016: {
    title: 'Iloa, leikkiä ja yhdessä tekemistä – Varhaisvuosien fyysisen aktiivisuuden suositukset, OKM 2016:21',
    checked: '2026-11-11',
  },
  ukkAdult2019: {
    title: 'UKK-instituutti: Viikoittainen liikkumisen suositus 18–64-vuotiaille (2019)',
    url: 'https://ukkinstituutti.fi/wp-content/uploads/2022/04/Diat-ryhmatoteutukseen-aikuiset-taydennetty.pdf',
    checked: '2026-11-11',
  },
} as const satisfies Record<string, SourceRef>;

export interface Rule {
  value: number;
  unit: string;
  description: string;
  source: SourceRef;
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

export const RECOMMENDATIONS = deepFreeze({
  early_years: {
    label: 'Alle kouluikäinen',
    evaluation: 'daily' as const,
    totalMinPerDay: {
      value: 180,
      unit: 'min/pv',
      description: 'Vähintään 3 tuntia liikkumista päivässä kaikilla tehoilla',
      source: SOURCES.ukkAllAges,
    },
    mvpaMinPerDay: {
      value: 60,
      unit: 'min/pv',
      description: 'Vähintään 1 tunti vauhdikasta liikkumista päivässä',
      source: SOURCES.ukkAllAges,
    },
  },
  school_age: {
    label: '7–17-vuotias koululainen',
    evaluation: 'period_average' as const,
    mvpaAvgMinPerDay: {
      value: 60,
      unit: 'min/pv',
      description: 'Vähintään 60 min reipasta ja rasittavaa liikkumista päivässä keskiarvona',
      source: SOURCES.okm2021,
    },
    vigorousDaysPerWeek: {
      value: 3,
      unit: 'pv/vko',
      description: 'Rasittavaa kestävyysliikuntaa vähintään kolmena päivänä viikossa',
      source: SOURCES.okm2021,
    },
    muscleDaysPerWeek: {
      value: 3,
      unit: 'pv/vko',
      description: 'Lihaksia vahvistavaa liikuntaa vähintään kolmena päivänä viikossa',
      source: SOURCES.okm2021,
    },
    boneDaysPerWeek: {
      value: 3,
      unit: 'pv/vko',
      description: 'Luustoa vahvistavaa liikuntaa vähintään kolmena päivänä viikossa',
      source: SOURCES.okm2021,
    },
  },
  adult: {
    label: 'Aikuinen (18–64 v)',
    evaluation: 'week' as const,
    weightedMinPerWeek: {
      value: 150,
      unit: 'min/vko',
      description: 'Reipas + 2 × rasittava vähintään 150 min viikossa',
      source: SOURCES.ukkAdult2019,
    },
    vigorousWeight: {
      value: 2,
      unit: 'kerroin',
      description: 'Rasittava minuutti vastaa kahta reipasta',
      source: SOURCES.ukkAdult2019,
    },
    muscleDaysPerWeek: {
      value: 2,
      unit: 'kertaa/vko',
      description: 'Lihaskuntoa ja liikehallintaa vähintään 2 kertaa viikossa',
      source: SOURCES.ukkAdult2019,
    },
  },
});

/** Sovelluksen omat tulkinnat – eivät virallisia lukuja (SPEC 4, 7). */
export const APP_INTERPRETATIONS = deepFreeze({
  /** Rasittavan päivän minuuttiraja; suositus ei anna rajaa. Asetuksissa muokattava. */
  VIGOROUS_DAY_MIN: 10,
  /** Aikuisten "2 kertaa viikossa" lasketaan erillisinä päivinä. */
  ADULT_STRENGTH_COUNTED_AS_DAYS: true,
  /** Tila 'near', kun toteuma/tavoite ≥ 75 %. */
  NEAR_THRESHOLD: 0.75,
  /** Pidemmillä jaksoilla viikko otetaan mukaan, jos kelvollisia päiviä ≥ 4. */
  MIN_VALID_DAYS_PER_WEEK: 4,
  /** Kattavuusraja, jonka alla vertailu himmennetään (jos perusarvioita ei ole). */
  LOW_COVERAGE: 0.5,
  /** Yli tämän ikäinen saa ryhmän adult ja huomautuksen (65+ -suositusta ei toteuteta). */
  ADULT_MAX_AGE: 64,
});

/**
 * Rasittavan päivän ikäkohtainen raja (min/pv). Käyttäjän antama oma tai valmentajan tavoite
 * (11.11.2026), ei virallinen suositus: OKM 2021:50 ei anna rasittavalle päivälle minuuttirajaa.
 */
export const VIGOROUS_DAY_BY_AGE_DEFAULT: Readonly<Record<string, number>> = deepFreeze({
  '7': 15,
  '8': 18,
  '9': 20,
  '10': 22,
  '11': 25,
  '12': 25,
  '13': 30,
  '14': 30,
  '15': 30,
  '16': 35,
  '17': 35,
});

export const DEFAULT_SETTINGS = deepFreeze({
  vigorousDayMin: APP_INTERPRETATIONS.VIGOROUS_DAY_MIN,
  vigorousDayRule: 'age' as const,
  vigorousDayByAge: VIGOROUS_DAY_BY_AGE_DEFAULT as Record<string, number>,
  primaryView: 'logged_plus_estimate' as const,
  backupReminderDays: 30,
  holidays: [] as Holiday[],
});

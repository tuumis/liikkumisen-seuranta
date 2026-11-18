// Mitä uutta: lyhyt muutosloki käyttäjälle (uusin ensin). Lisää rivi jokaiseen julkaisuun, jossa käyttäjä huomaa muutoksen.

export interface Release {
  version: string;
  /** Julkaisupäivä muodossa p.k.vvvv */
  date: string;
  items: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.1.5',
    date: '18.11.2026',
    items: ['Alkusivun esittelyteksti uudistettu.'],
  },
  {
    version: '1.1.4',
    date: '18.11.2026',
    items: ['Alkusivun otsikko ja esittely kertovat selkeämmin, mitä ohjelma tekee.', 'Alkusivun kuvaesittely vaihtuu nopeammin.'],
  },
  {
    version: '1.1.3',
    date: '18.11.2026',
    items: ['Treenin sisältöön uusi valinta 2v2.'],
  },
  {
    version: '1.1.2',
    date: '18.11.2026',
    items: ['Treenin omatoimisen alku- ja loppuverryttelyn minuutit voi kirjata kuittauksen jälkeen Lisätiedot-ikkunassa.'],
  },
  {
    version: '1.1.1',
    date: '18.11.2026',
    items: [
      'Liikuntaa viikossa: kesken viikon luokitus tehdään koko viikon arviosta.',
      'Yhtenäisemmät nimet ja painikkeet, selkeämmät synkronoinnin tekstit.',
      'Ohjeeseen aihe Analyysistä.',
    ],
  },
  {
    version: '1.1.0',
    date: '18.11.2026',
    items: [
      'Analyysi selkeämmäksi: viikolla, kuukaudella, kaudella ja vuodella omat oletusnäkymät ja lyhyt kuvaus siitä, mihin taso vastaa.',
      'Viikon päiväkaavio ja lajijakauma samassa kortissa "Päivät ja lajit".',
      'Muokkaa näkymää: valitse ensin aiheet, yksittäiset kortit ja järjestys löytyvät Lisää vaihtoehtoja -kohdasta.',
      'Kohokohdat myös kuukausi-, kausi- ja vuosinäkymässä.',
    ],
  },
  {
    version: '1.0.0',
    date: '18.11.2026',
    items: [
      'Ensimmäinen virallinen versio.',
      'Alkusivulla pikatesti, jonka vastaukset täyttävät aloituksen valmiiksi.',
      'Yhtenäiset ikonit koko ohjelmassa.',
      'Tietosuojaseloste ja versiotiedot Ohjeessa.',
    ],
  },
];

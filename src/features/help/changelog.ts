// Mitä uutta: lyhyt muutosloki käyttäjälle (uusin ensin). Lisää rivi jokaiseen julkaisuun, jossa käyttäjä huomaa muutoksen.

export interface Release {
  version: string;
  /** Julkaisupäivä muodossa p.k.vvvv */
  date: string;
  items: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.1.16',
    date: '19.11.2026',
    items: ['Pienet painikkeet on nyt helpompi osua puhelimella: napautusalue on vähintään sormen kokoinen, vaikka painike näyttää samalta.'],
  },
  {
    version: '1.1.15',
    date: '19.11.2026',
    items: [
      'Jalkapallo-sivu puhelimella: kauden luvut mahtuvat yhdelle riville, ja uuden pelin tai turnauksen lisäät yhdellä Lisää kalenteriin -painikkeella.',
      'Päiväkirja-, Kalenteri-, Tulokset- ja Joukkueet-valinnat näkyvät heti ja pysyvät ylhäällä, kun selaat alaspäin.',
    ],
  },
  {
    version: '1.1.14',
    date: '19.11.2026',
    items: ['Jakoikkunan Jaa- ja Tallenna-painikkeet pysyvät nyt aina näkyvissä ikkunan alareunassa, vaikka tyylejä ja värejä selaisi.'],
  },
  {
    version: '1.1.13',
    date: '19.11.2026',
    items: ['Puhelimella takaisin-ele sulkee nyt avoimen ikkunan, ja ikkunan voi sulkea myös vetämällä sen yläosasta alas.'],
  },
  {
    version: '1.1.12',
    date: '19.11.2026',
    items: ['Tuloskuvasta voi nyt tehdä myös videon: valitse Jaa tulos -kohdassa Video. Tulos ponnahtaa näkyviin joukkueiden jälkeen.'],
  },
  {
    version: '1.1.11',
    date: '19.11.2026',
    items: ['Puhelimella viikon päivät ovat nyt nauhana sivun yläosassa: valitse päivä napauttamalla, ja sen kerrat näkyvät heti alla kuitattavina. Pyyhkäisy vaihtaa päivää.'],
  },
  {
    version: '1.1.10',
    date: '19.11.2026',
    items: ['Ennakkovideot ovat nyt teräviä ja tasaisia, ja niiden teko kestää vain muutaman sekunnin.'],
  },
  {
    version: '1.1.9',
    date: '18.11.2026',
    items: ['Ennakko- ja tuloskuviin uusi Brändi-tyyli: iso päivä, joukkueet allekkain, iso VOITTO ja tulos sekä ohuin viivoin jaettu tietoruudukko.'],
  },
  {
    version: '1.1.8',
    date: '18.11.2026',
    items: ['Ennakko- ja tuloskuviin uusi Kapea-tyyli: kapea urheilufontti, tumma pohja ja yksi korostusväri. Uusi väri: musta ja vadelma.'],
  },
  {
    version: '1.1.7',
    date: '18.11.2026',
    items: ['Kuittaa kerrat -painike sivuvalikossa ja kuittaamattomien määrä profiilien vieressä. Ilmoituksen klikkaus avaa kuittauksen suoraan.'],
  },
  {
    version: '1.1.6',
    date: '18.11.2026',
    items: ['Yhtenäisemmät tekstit: sovellus ja viikkorytmi kaikkialla, Lisätiedot-painike ja samanlaiset lisäyspainikkeet.'],
  },
  {
    version: '1.1.5',
    date: '18.11.2026',
    items: ['Alkusivun esittelyteksti uudistettu.'],
  },
  {
    version: '1.1.4',
    date: '18.11.2026',
    items: ['Alkusivun otsikko ja esittely kertovat selkeämmin, mitä sovellus tekee.', 'Alkusivun kuvaesittely vaihtuu nopeammin.'],
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
      'Yhtenäiset ikonit koko sovelluksessa.',
      'Tietosuojaseloste ja versiotiedot Ohjeessa.',
    ],
  },
];

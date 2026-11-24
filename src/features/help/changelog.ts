// Mitä uutta: lyhyt muutosloki käyttäjälle (uusin ensin). Lisää rivi jokaiseen julkaisuun, jossa käyttäjä huomaa muutoksen.

export interface Release {
  version: string;
  /** Julkaisupäivä muodossa p.k.vvvv */
  date: string;
  items: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.1.41',
    date: '24.11.2026',
    items: ['Jos synkronointi keskeytyy, viestin alla on painike Valitse kansio uudelleen. Saman pilvikansion valinta uudelleen korjaa vanhentuneen kansioyhteyden.'],
  },
  {
    version: '1.1.40',
    date: '24.11.2026',
    items: [
      'Synkronoinnin aikana Synkronoi-painikkeen alla näkyy, mitä synkronointi parhaillaan tekee.',
      'Jos synkronointi ei valmistu kahdessa minuutissa, se keskeytyy ja kertoo vaiheen, johon se jäi. Syy jää näkyviin painikkeen alle.',
    ],
  },
  {
    version: '1.1.39',
    date: '24.11.2026',
    items: [
      'Korjattu: PC:n synkronointi saattoi jäädä pyörimään loputtomiin, jos pilvikansiossa (OneDrive tai Google Drive) oli lataamattomia tiedostoja. Synkronointi avaa nyt vain omat tiedostonsa.',
      'Jos pilvikansio ei vastaa, synkronointi keskeytyy noin puolessa minuutissa ja kertoo syyn, ja automaattinen synkronointi jatkaa seuraavalla kerralla.',
    ],
  },
  {
    version: '1.1.38',
    date: '24.11.2026',
    items: [
      'Viikon huomiot voi kytkeä pois profiilikohtaisesti (Asetukset → Profiilit → Muokkaa): liikkumissuosituksen ja urheilun kuormituksen huomiot erikseen.',
      'Kolmatta viikkoa peräkkäin toistuva huomio näytetään lyhyesti uusien jälkeen, ja tarkemmat tiedot saa auki kohdasta Näytä tarkemmin.',
    ],
  },
  {
    version: '1.1.37',
    date: '24.11.2026',
    items: [
      'Viikon huomiot kertovat lapsilla myös ohjatun urheilun kuormituksesta: ei yhtään vapaapäivää, viikkotunnit yli ikävuosien tai nopea kasvu edellisiin viikkoihin.',
      'Kuormitushuomiot perustuvat kansainväliseen tutkimustietoon (AAP ja Jayanthi ym. 2015), ja ne on merkitty sanalla Tutkimus. Lähde ja laskutapa kohdassa Miksi?.',
      'Kauden koosteessa uusi kortti Tauot ja vaihtelu: päälajin osuus ja pisin tauko lajista.',
    ],
  },
  {
    version: '1.1.36',
    date: '24.11.2026',
    items: [
      'Uusi Viikon huomiot: päättyneeltä viikolta lyhyet havainnot liikkumissuositusta vasten (esim. rasittavat päivät tai päivittäinen tunti) ja ehdotus viikkorytmin vapaista päivistä.',
      'Jokaisessa huomiossa on lähde ja laskutapa kohdassa Miksi?. Hyvästä viikosta sanotaan vain, että se oli hyvä.',
      'Kaksi tärkeintä huomiota näkyy viime viikon koosteessa Viikko-näkymässä, kaikki Analyysin Huomiot-kortissa.',
    ],
  },
  {
    version: '1.1.35',
    date: '19.11.2026',
    items: [
      'Asetusten Viikkorytmi-listassa näkyy treenin joukkue tai ryhmä, ja puuttuvasta valinnasta tulee muistutus.',
      'Viikkorytmin riveillä merkintä, jos rivi on päättynyt tai alkaa myöhemmin.',
    ],
  },
  {
    version: '1.1.34',
    date: '19.11.2026',
    items: [
      'Viikko-näkymän peleissä ja turnauksissa näkyy nyt oma joukkue, sekä menneissä että tulevissa.',
      'Viikkorytmin treeni, jolle ei ole valittu joukkuetta, saa sen aiemmista treeneistä: jos riviltä kuitatut tai samalla tarkenteella merkityt treenit ovat kaikki samaa joukkuetta tai ryhmää, tulevat treenit merkitään sille.',
      'Paneelit avautuvat sulavammin: liike ja taustan himmennys alkavat alusta eivätkä enää nyki.',
    ],
  },
  {
    version: '1.1.33',
    date: '19.11.2026',
    items: [
      'Treenin joukkue näkyy nyt myös, kun joukkueita on vain yksi: Viikko-näkymässä, Tulevat kerrat- ja Viimeisimmät kirjaukset -korteissa sekä kalenterissa, myös tuleville päiville.',
      'Kun lisäät toisen joukkueen tai treeniryhmän, aiemmat viikkorytmin treenit pysyvät ensimmäisellä joukkueella eivätkä jää ilman joukkuetta.',
    ],
  },
  {
    version: '1.1.32',
    date: '19.11.2026',
    items: ['Viikko-näkymän treenissä näkyy nyt joukkueen koko nimi omalla rivillään (aiemmin esim. pelkkä ikäluokka "2018").'],
  },
  {
    version: '1.1.31',
    date: '19.11.2026',
    items: [
      'Joukkueittain-kortin nimi on nyt Treeni- ja pelihistoria. Se on Omat joukkueet ja ryhmät -kortin alla ja oletuksena suljettu, ja se näkyy myös, kun joukkueita on vain yksi.',
      'Korjattu: omatoimiset jalkapalloharjoitukset näkyivät historiassa seuran treeneinä ilman joukkuetta. Merkitsemättömien treenien päivämäärät näkyvät nyt kortissa.',
    ],
  },
  {
    version: '1.1.30',
    date: '19.11.2026',
    items: ['Korjattu: Viikko-näkymän päivänauha näytti tulevalle päivälle valintamerkin, vaikka päivä ei ollut vielä alkanut.'],
  },
  {
    version: '1.1.29',
    date: '19.11.2026',
    items: [
      'Uusi Joukkueittain-kortti kohdassa Jalkapallo → Joukkueet: treenit, treeniaika, pelit, V–T–H ja maalit joukkueittain ja treeniryhmittäin (kausi, vuosi tai kaikki).',
      'Joukkueittain-erittely näkyy myös Analyysin jalkapallokortissa, tulostettavassa raportissa ja Kauden koosteessa.',
      'Viikko-näkymän ja kalenterin treeneissä näkyy joukkueen tai ryhmän nimi, ja tulosteen joukkuevalinta rajaa nyt myös treenit.',
    ],
  },
  {
    version: '1.1.28',
    date: '19.11.2026',
    items: ['Aiempien treenien merkitsemisessä voi nyt valita tarkenteen, esim. kaikki Talenttitreenit treeniryhmälle ja Joukkuetreenit joukkueelle. Paneeli pysyy auki, joten merkinnät voi tehdä peräkkäin.'],
  },
  {
    version: '1.1.27',
    date: '19.11.2026',
    items: ['Viikkorytmin treenissä näkyy nyt aina Joukkue-kohta: yhdellä joukkueella se kertoo automaattisesta valinnasta ja neuvoo, missä toisen joukkueen tai treeniryhmän voi lisätä.'],
  },
  {
    version: '1.1.26',
    date: '19.11.2026',
    items: [
      'Treenille voi nyt valita joukkueen tai treeniryhmän: viikkorytmissä, yksittäisessä suunnitelmassa ja treenin lisätiedoissa. Jos joukkueita ja ryhmiä on yhteensä yksi, treenit merkitään sille automaattisesti.',
      'Uusi treeniryhmä omalla nimellä, esim. pienryhmävalmennus tai taitokoulu: Jalkapallo → Joukkueet → Lisää → Treeniryhmä. Ryhmä on vain treenejä varten eikä näy peleissä.',
      'Aiemmat treenit voi merkitä joukkueelle tai ryhmälle kerralla: Jalkapallo → Joukkueet → Merkitse aiemmat treenit.',
    ],
  },
  {
    version: '1.1.25',
    date: '19.11.2026',
    items: ['Uudet taustat Revontulet ja Kenttävalot (Asetukset → Ulkoasu → Tausta). Ne on suunniteltu erityisesti tummalle teemalle, jossa kortit erottuvat syvää taustaa vasten.'],
  },
  {
    version: '1.1.24',
    date: '19.11.2026',
    items: ['Korjattu: päiväkortin alalaidan mittarin harmaa pohja erottuu nyt taustasta.'],
  },
  {
    version: '1.1.23',
    date: '19.11.2026',
    items: ['Korjattu: päiväkortin alalaidan tiedot mahtuvat nyt puhelimellakin yhdelle riville palkin sisään.'],
  },
  {
    version: '1.1.22',
    date: '19.11.2026',
    items: ['Päiväkorttien tiedot ovat nyt joka kortissa samassa kohdassa: päivän minuutit ovat kortin alalaidassa omalla rivillään.'],
  },
  {
    version: '1.1.21',
    date: '19.11.2026',
    items: ['Korjattu: puhelimen +-painike ei enää välähdä näkyviin, kun selaus pysähtyy päiväkortin kohdalle.'],
  },
  {
    version: '1.1.20',
    date: '19.11.2026',
    items: ['Puhelimella synkronointi on nyt yläpalkin kuvakkeessa. Oranssi piste kertoo, kun jotain odottaa siirtoa, ja Viikko-näkymä alkaa suoraan päivistä.'],
  },
  {
    version: '1.1.19',
    date: '19.11.2026',
    items: ['Puhelimella yläpalkki pienenee alaspäin selatessa, jolloin sisällölle jää enemmän tilaa. Profiilien vaihto pysyy näkyvissä.'],
  },
  {
    version: '1.1.18',
    date: '19.11.2026',
    items: ['Puhelimella suunnitelman voi kuitata pyyhkäisemällä: oikealle tehty, vasemmalle ei tehty. Toimii päiväkortissa ja Käy viikko läpi -kohdassa.'],
  },
  {
    version: '1.1.17',
    date: '19.11.2026',
    items: ['Viikko-näkymän pienimmät tekstit ovat nyt isompia ja helpompia lukea puhelimella.'],
  },
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

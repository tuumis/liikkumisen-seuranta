# Liikkumisen seuranta – määrittely

Nov 11, 2026 · @Tuomas

Yhden vanhemman offline-PWA, joka seuraa lapsen (ja tarvittaessa aikuisen) liikkumista viikkotasolla ja vertaa sitä suomalaisiin virallisiin liikkumissuosituksiin. Määrittely on tarkoitettu Claude Codelle vaiheittaiseen toteutukseen. Perustelut muutoksille ovat välilehdellä Tarkastusraportti.

Kolme periaatetta ohjaavat kaikkea:

1. **Arvio, suunnitelma ja toteuma ovat eri asioita** ja eri tauluissa. Suunnitelmat eivät koskaan näy liikuntamäärissä.
2. **Viralliset säännöt ja sovelluksen oma arviomalli erotetaan.** Suositusten raja-arvot tulevat lähteistä. Se, kuinka suuri osa treenistä on reipasta, on sovelluksen muokattava arvio, ja käyttöliittymä nimeää sen arvioksi.
3. **Kirjaamisen on oltava nopeaa:** uusi kerta alle 15 sekunnissa ja viikon kuittaus alle minuutissa. Kaikki lisätiedot ovat valinnaisia.

## 1. Tavoite ja rajaus

Sovelluksen tehtävä on antaa vanhemmalle luotettava kuva lapsen liikkumisen määrästä, laadusta ja monipuolisuudesta viikoittain ja usean vuoden aikana.

**Mukana**

- Yksi käyttäjä (vanhempi) ja kaksi laitetta: PC päälaitteena ja puhelin, tiedot yhdistetään tiedostosynkronoinnilla. Ei kirjautumista eikä omaa palvelinta.
- Useita seurattavia profiileja: lapsi tai aikuinen.
- Perusarvio tavallisesta arkiliikunnasta, toistuva viikkopohja, suunniteltujen kertojen kuittaus ja yksittäiset kirjaukset.
- Jalkapallo omin lisätiedoin; muut liikkumismuodot (pyöräily, potkulauta, kävely, koululiikunta, vapaa leikki ym.) yhteisellä mallilla.
- Vertailu iän ja koulun aloituksen mukaan valittuun viralliseen suositukseen.
- Pitkän aikavälin koosteet: kuukausi, kausi ja vuosi.

**Ei mukana**

- Monikäyttäjäominaisuudet, reaaliaikainen pilvisynkronointi (Dexie Cloud on mahdollinen myöhemmin), lapsen oma näkymä, sosiaaliset toiminnot.
- Lahjakkuusarviot, ennusteet ja vertailu muihin lapsiin.
- Uni-, ruutuaika- ja paikallaanoloseuranta (suositukset mainitsevat ne, mutta ne rajataan pois).
- Yli 65-vuotiaiden suositus.
- Älykello- ja liikemittaritiedot (myöhempi vaihe).

## 2. Sanasto

Koodissa käytetään englanninkielisiä nimiä, käyttöliittymässä suomenkielisiä.

| Termi (UI) | Koodissa | Määritelmä |
| --- | --- | --- |
| Profiili | `Profile` | Seurattava henkilö (lapsi tai aikuinen) |
| Liikkumismuoto | `ActivityType` | Laji tai liikkumisen tapa, esim. Jalkapallo – treeni, Pyöräily |
| Kategoria | `Category` | Liikkumisen yhteys: harrastus, koululiikunta, välitunnit, koulumatka, omaehtoinen, perhe, muu |
| Ohjattu / omaehtoinen | `Context` | Kategoriasta johdettu: harrastus ja koululiikunta = ohjattu; muut = omaehtoinen tai arki |
| Liikuntaryhmä | `MovementGroup` | Monipuolisuuden luokitus: pallopelit, kestävyys, pyörät ja laudat, talvi, vesi, hypyt ja voimistelu, voima, leikki |
| Perusarvio | `Estimate` | Arvio tavallisesta liikkumisesta kategoriassa, jota ei kirjata kerta kerralta |
| Viikkopohja | `TemplateItem` | Toistuva rivi, josta syntyy suunniteltuja kertoja |
| Suunniteltu kerta | `PlannedSession` | Yksittäinen tuleva tai kuittaamaton kerta; ei koskaan liikuntamääränä |
| Liikkumiskerta | `Session` | Toteutunut, kirjattu liikkuminen; analytiikan ensisijainen lähde |
| Kevyt | `light` | Ei hengästytä; noin 1,5–2,9 MET |
| Reipas | `moderate` | Hengästyttää, mutta puhuminen onnistuu; noin 3,0–5,9 MET |
| Rasittava | `vigorous` | Puhuminen on hankalaa hengästymisen takia; vähintään 6 MET |
| Vauhdikas | (= `moderate`+`vigorous`) | Alle kouluikäisten suosituksen termi; sovellus rinnastaa sen reippaaseen ja rasittavaan |
| Reipas ja rasittava (MVPA) | `mvpa` | Reippaat + rasittavat minuutit |
| Tehoprofiili | `IntensityShares` | Sovelluksen arvio siitä, kuinka suuri osa kestosta on kevyttä, reipasta ja rasittavaa |
| Ponnistelu | `effort` | Kertakohtainen säätö: kevyempi, tavallinen tai kovempi |
| Lihaksia vahvistava | `muscle` | Kerta kuormitti lihaksia (oma paino, voimaharjoitteet, portaat) |
| Luustoa vahvistava | `bone` | Kerta sisälsi hyppyjä, iskuja tai nopeita suunnanmuutoksia |
| Rasittava päivä | `vigorousDay` | Päivä, jona rasittavaa on vähintään raja-arvon verran (sovelluksen oletus 10 min) |
| Vahvistava päivä | `muscleDay`, `boneDay` | Päivä, jona vähintään yksi kerta on merkitty vahvistavaksi |
| Suositusryhmä | `RecommendationGroup` | `early_years`, `school_age` tai `adult` |
| Kelvollinen päivä | `validDay` | Jakson päivä, jota ei ole merkitty sairaaksi tai matkapäiväksi eikä ole tulevaisuudessa |
| Datakattavuus | `coverage` | Osuus kelvollisista päivistä, joilla on vähintään yksi kirjaus |
| Arvion osuus | `estimateShare` | Kuinka suuri osa MVPA:sta tulee perusarviosta |
| Suoritusarvio | `parentRating` | Vanhemman arvio 1–5 suhteessa lapsen omaan tavalliseen tasoon |
| Viihtyminen | `enjoyment` | Vanhemman arvio lapsen viihtymisestä 1–3 |
| Osallistuminen | `attendance` | Osallistuiko suunniteltuun treeniin tai peliin, ja kokonaan vai osittain |
| Taitotesti | `SkillTest` | Toistettava mittaus (myöhempi vaihe) |

## 3. Kolme tietokerrosta

Arvio, suunnitelma ja toteuma tallennetaan eri tauluihin. Ne yhdistyvät vain päiväkoosteessa, jonka säännöt on määritelty alla.

| Kerros | Taulu | Esimerkki | Liikuntamääriin? |
| --- | --- | --- | --- |
| Arvioitu | `Estimate` | Välitunnit ja pihaleikit noin 60 min arkipäivänä | Kyllä, korvausperiaatteella, ja aina erikseen merkittynä |
| Suunniteltu | `PlannedSession` | Tiistaina jalkapallotreeni 90 min | Ei koskaan; vain suunnitelma–toteuma-vertailussa |
| Toteutunut | `Session` | Tiistain treeni kesti 85 min | Kyllä, ensisijainen lähde |

&#91;embedded content: tietovirta · 3 kerrosta, 1 kooste\]

Suunniteltu kerta vaikuttaa liikuntamääriin vain kuittauksen kautta, kun siitä syntyy liikkumiskerta. Perusarvio täyttää vain ne kategoriat, joille päivällä ei ole kirjauksia.

**Kuittaus.** Suunniteltu kerta kuitataan tehdyksi, jolloin luodaan uusi `Session`. Sen kesto on oletuksena suunniteltu, mutta sitä voi muokata. `PlannedSession.status` muuttuu arvoon `done`, ja kertojen välinen linkki tallennetaan molempiin suuntiin. Suunnitelman kestoa ei muuteta, joten 90 vs. 85 min vertailu säilyy. Tekemättä jäänyt kerta saa tilan `skipped` ja valinnaisen syyn.

**Korvausperiaate.** Jokaiselle profiilille, päivälle ja kategorialle käytetään joko kirjauksia tai perusarviota, ei molempia:

- Jos päivälle ja kategorialle on vähintään yksi `Session`, käytetään kirjauksia.
- Muuten käytetään voimassa olevaa `Estimate`-arvoa (arki- tai viikonloppuarvo).
- Muuten 0.

Perusarvio lasketaan vain minuutteihin. Se ei koskaan tuota rasittavaa päivää eikä vahvistavaa päivää, koska niiden toteutumista ei voi arvioida luotettavasti ilman kirjausta.

**Näkyvyys.** Jokaisessa suositusvertailussa näytetään kaksi lukua, "kirjattu" ja "kirjattu + arvio", sekä arvion osuus prosentteina.

## 4. Viralliset suositukset ja ikäryhmälogiikka

Suositukset tarkistettiin 11.11.2026, eikä uudempia versioita löytynyt. Ne tallennetaan koodiin versioituna vakiona (`recommendations.ts`), jossa jokaisella säännöllä on lähde ja tarkistuspäivä. Sovellus ei muuta näitä arvoja; käyttäjä ei voi muokata niitä.

| Ryhmä | Määrä | Teho | Vahvistava | Arviointijakso | Lähde |
| --- | --- | --- | --- | --- | --- |
| `early_years` (alle kouluikäinen) | ≥ 180 min/pv kaikilla tehoilla | ≥ 60 min/pv vauhdikasta; loput reipasta ulkoilua ja kevyttä | Ei omaa määrää | Päivittäin | UKK, mukaellen OKM 2016 |
| `school_age` (7–17 v, koulussa) | ≥ 60 min/pv reipasta ja rasittavaa, keskiarvona | Rasittavaa kestävyysliikuntaa ≥ 3 pv/vko | Lihaksia ≥ 3 pv/vko ja luustoa ≥ 3 pv/vko | Keskiarvo jaksolla (esim. 4–7 vrk) | OKM 2021:50 |
| `adult` (18 v →) | Reipas + 2 × rasittava ≥ 150 min/vko | Rasittava minuutti = 2 reipasta | Lihaskunto ja liikehallinta ≥ 2 kertaa/vko | Viikko | UKK 2019 |

Lisäksi suosituksissa on laadullisia ohjeita, joita ei mitata: monipuolisuus, paikallaanolon tauottaminen ja riittävä uni. Niistä näytetään vain staattinen tietoteksti.

Kaksi tulkintaa on sovelluksen omia, ja ne merkitään sellaisiksi:

- 7–17-vuotiaiden suositus sanoo rasittavaa liikuntaa "vähintään kolmena päivänä" mutta ei anna päivälle minuuttirajaa. Sovellus käyttää rajaa `VIGOROUS_DAY_MIN = 10` (asetuksissa muokattava).
- Aikuisten "2 kertaa viikossa" lasketaan erillisinä päivinä, eli kaksi kertaa samana päivänä on yksi kerta.

### Suositusryhmän valinta

OKM 2016 -suositus koskee alle kouluikäisiä ja OKM 2021 -suositus 7–17-vuotiaita, joten 7-vuotias voi kuulua kumpaan tahansa. Ratkaisevaa on koulun aloitus.

```ts
function recommendationGroup(p: Profile, on: ISODate): RecommendationGroup {
  if (p.groupOverride) return p.groupOverride;          // käsin asetettu
  const age = ageInYears(p.birthYear, p.birthMonth, on); // syntymäpäiväksi oletetaan kuun 15. päivä
  if (age >= 18) return 'adult';
  if (p.schoolStart && on >= firstDayOf(p.schoolStart)) return 'school_age';
  if (!p.schoolStart && age >= 7) return 'school_age';  // varasääntö, jos koulun alkua ei ole annettu
  return 'early_years';
}
```

Jakson ryhmänä käytetään jakson **viimeisen** päivän ryhmää. Jos ryhmä vaihtuu kesken jakson, näkymässä on huomautus "suositusryhmä vaihtui \[pvm\]". Yli 64-vuotias saa ryhmän `adult` ja huomautuksen, että 65+ -suositusta ei toteuteta.

## 5. Sovelluksen tehomalli

Suositukset kertovat, kuinka paljon reipasta ja rasittavaa liikuntaa tarvitaan, mutta eivät sitä, kuinka paljon sitä yhdessä treenissä on. Tämä osio on sovelluksen oma arviomalli. Kaikki sen tuottamat luvut esitetään käyttöliittymässä arvioina ("arviolta 34 min reipasta").

**Miksi kesto ei riitä:** OKM:n suosituksen esimerkissä nuoren seuraharjoituksessa kertyy noin 40 min reipasta ja rasittavaa ja noin 50 min kevyttä liikettä alkulämmöissä ja loppuverryttelyssä. Suositus toteaa myös, että ohjatuissa treeneissä on harvoin päivän tarpeen verran reipasta liikuntaa. 90 minuutin harjoitus on siis tyypillisesti alle puolet reipasta.

### Tehoprofiili

Jokaisella liikkumismuodolla on profiili `{ light, moderate, vigorous }`: osuudet 0–1, joiden summa on enintään 1. Loppuosuus on paikallaanoloa (jonotus, ohjeet, tauot), eikä sitä lasketa liikkumiseksi.

### Laskenta yhdelle kerralle

1. **Laskentapohja** `base`: pelissä ja turnauksessa pelatut minuutit, jos ne on annettu, muuten `durationMin`. Vaihtopenkillä vietetty aika ei kerrytä liikuntaa.
2. **Ponnistelu** `effort`: kevyempi `e = 0.75`, tavallinen `e = 1`, kovempi `e = 1.25`. Kerroin kohdistuu reippaaseen ja rasittavaan osuuteen.
3. **Rajaus:** `m' = moderate·e`, `v' = vigorous·e`. Jos `m' + v' > 1`, molemmat skaalataan niin, että summa on 1. `l' = min(light, 1 − m' − v')`.
4. **Minuutit:** `light = round(base·l')`, `moderate = round(base·m')`, `vigorous = round(base·v')` (pyöristys `Math.round`).
5. **Käsin syöttö:** käyttäjä voi kirjoittaa minuutit suoraan, jolloin `intensitySource = 'manual'` ja profiilia ei käytetä.

Kerralle tallennetaan sekä minuutit että käytetty profiili (`sharesSnapshot`). Kun oletusprofiilia muutetaan, vanhat kerrat eivät muutu. Asetuksissa on erillinen toiminto "Laske uudelleen" (valittu laji, alkaen päivästä), joka ei koske käsin syötettyjä kertoja.

### Vahvistavan liikunnan tunnistus

Lajilla on erikseen `muscleDefault` ja `boneDefault`, kummallakin kolme mahdollista arvoa:

- `yes`: valinta näkyy kirjauksessa esivalittuna, ja käyttäjä voi poistaa sen.
- `ask`: valinta näkyy valitsemattomana, ja käyttäjä valitsee sen, jos kerralla oli esim. hyppyjä tai voimaharjoitteita.
- `no`: valintaa ei näytetä.

Perusarvio ei koskaan tuota vahvistavaa päivää.

### Oletusprofiilit

Arvot ovat sovelluksen lähtöoletuksia, eivät virallisia lukuja; tämä kerrotaan asetuksissa. Jalkapallotreenin profiili on mitoitettu OKM:n esimerkkiharjoituksen mukaan (noin 45 % reipasta ja rasittavaa).

| Liikkumismuoto | Kategoria | Ryhmä | Kevyt | Reipas | Rasittava | Lihas | Luusto |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Jalkapallo – treeni | harrastus | pallopelit | 0,35 | 0,30 | 0,15 | ask | yes |
| Jalkapallo – peli¹ | harrastus | pallopelit | 0,20 | 0,45 | 0,30 | ask | yes |
| Jalkapallo – turnaus¹ | harrastus | pallopelit | 0,20 | 0,45 | 0,30 | ask | yes |
| Koululiikunta | koululiikunta | vaihtelee | 0,35 | 0,30 | 0,10 | ask | ask |
| Välitunnit | välitunnit | leikki | 0,50 | 0,25 | 0,05 | no | ask |
| Koulumatka kävellen | koulumatka | kestävyys | 0,60 | 0,40 | 0 | no | no |
| Koulumatka pyörällä | koulumatka | pyörät ja laudat | 0,20 | 0,70 | 0,05 | no | no |
| Potkulauta | omaehtoinen | pyörät ja laudat | 0,40 | 0,50 | 0,05 | no | no |
| Vapaa leikki ulkona | omaehtoinen | leikki | 0,45 | 0,30 | 0,10 | ask | ask |
| Trampoliini | omaehtoinen | hypyt ja voimistelu | 0,30 | 0,30 | 0,30 | ask | yes |
| Uinti ja vesileikit | omaehtoinen | vesi | 0,40 | 0,35 | 0,10 | ask | no |
| Luistelu | omaehtoinen | talvi | 0,30 | 0,50 | 0,10 | no | ask |
| Hiihto | omaehtoinen | talvi | 0,20 | 0,60 | 0,15 | no | no |
| Perheretki / kävely | perhe | kestävyys | 0,70 | 0,30 | 0 | no | no |
| Juoksu (aikuinen) | omaehtoinen | kestävyys | 0 | 0,40 | 0,60 | no | no |
| Kuntosali (aikuinen) | omaehtoinen | voima | 0,50 | 0,25 | 0 | yes | no |
| Muu | muu | muu | 0,50 | 0,20 | 0 | ask | ask |

¹ Laskentapohja on pelatut minuutit. Turnauksessa `durationMin` on tapahtuman kokonaisaika ja pelatut minuutit kaikkien pelien summa.

**Esimerkki:** jalkapallotreeni 75 min, tavallinen ponnistelu → kevyt 26, reipas 23, rasittava 11, MVPA 34 min.

## 6. Tietomalli

Kymmenen taulua. Päivämäärät tallennetaan paikallisina merkkijonoina (`YYYY-MM-DD`) eikä `Date`-olioina, joten aikavyöhykkeet ja kesäaika eivät siirrä merkintöjä päivältä toiselle. Tunnisteet ovat joko johdettuja (ks. Synkronointikentät) tai luodaan funktiolla `crypto.randomUUID()`.

| Taulu | Sisältö | Elinkaari |
| --- | --- | --- |
| `profiles` | Seurattavat henkilöt | Arkistoidaan; pysyvä poisto vain asetuksista |
| `activityTypes` | Liikkumismuodot ja tehoprofiilit | Sisäänrakennetut luodaan siemendatasta; omia voi lisätä; arkistoidaan, ei poisteta |
| `estimates` | Perusarviot | Voimassaolo päivämäärillä; uusi arvio päättää vanhan |
| `templateItems` | Viikkopohjan rivit | Muokkaus koskee vain tulevia avoimia suunnitelmia |
| `plannedSessions` | Suunnitellut kerrat | Luodaan pohjasta tai käsin; tila `open` / `done` / `skipped` |
| `sessions` | Toteutuneet kerrat | Pysyviä; poisto palauttaa linkitetyn suunnitelman tilaan `open` |
| `footballDetails` | Jalkapallon lisätiedot | 1:1 `sessions`; poistuu kerran mukana |
| `dayFlags` | Sairaus- ja matkapäivät | Yksi per profiili ja päivä |
| `meta` | Skeemaversio, asetukset, viimeisin vienti, luontikirjanpito | Avain–arvo |
| settings | Synkronoitavat asetukset (yksi rivi) | Päivitetään paikallaan; synkronoituu kuten muutkin |

### TypeScript-tyypit

```ts
// ---------- perustyypit ----------
export type UUID = string;            // crypto.randomUUID()
export type ISODate = string;         // 'YYYY-MM-DD', paikallinen päivä
export type HHmm = string;            // '17:30'
export type Timestamp = string;       // ISO 8601 UTC, vain kirjanpitoon
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: 1 = ma
export interface YearMonth { year: number; month: number } // month 1–12

export type RecommendationGroup = 'early_years' | 'school_age' | 'adult';
export type Category =
  | 'hobby' | 'school_pe' | 'school_recess' | 'commute'
  | 'self_directed' | 'family' | 'other';
export type Context = 'organized' | 'self_directed' | 'everyday';
export type MovementGroup =
  | 'ball_games' | 'endurance' | 'wheels' | 'winter' | 'water'
  | 'jumping_gymnastics' | 'strength' | 'play' | 'varies' | 'other';
export type StrengthDefault = 'yes' | 'ask' | 'no';
export type Effort = -1 | 0 | 1;      // kevyempi | tavallinen | kovempi

export interface IntensityShares { light: number; moderate: number; vigorous: number } // 0–1, summa ≤ 1
export interface IntensityMinutes { light: number; moderate: number; vigorous: number }

// ---------- profiili ----------
export interface Profile {
  id: UUID;
  name: string;                  // lempinimi riittää
  kind: 'child' | 'adult';
  birthYear: number;
  birthMonth: number;            // 1–12; syntymäpäivää ei tallenneta
  schoolStart?: YearMonth;       // koulun aloitus, lapsilla
  groupOverride?: RecommendationGroup;
  color: string;
  sortOrder: number;
  archived: boolean;
  createdAt: Timestamp; updatedAt: Timestamp;
}

// ---------- liikkumismuoto ----------
export type FootballKind = 'training' | 'game' | 'tournament';

export interface ActivityType {
  id: UUID;
  key?: string;                  // sisäänrakennetuilla pysyvä avain, esim. 'football_training'
  name: string;
  icon: string;
  category: Category;
  movementGroup: MovementGroup;
  shares: IntensityShares;       // sovelluksen oletusarvio, muokattava
  muscleDefault: StrengthDefault;
  boneDefault: StrengthDefault;
  sport?: 'football';
  footballKind?: FootballKind;   // jalkapallon alalaji määräytyy lajista
  usesPlayedMinutes: boolean;    // peli ja turnaus
  builtIn: boolean;
  archived: boolean;
  sortOrder: number;
  updatedAt: Timestamp;
}

// ---------- kerros 1: perusarvio ----------
export interface Estimate {
  id: UUID; profileId: UUID;
  category: Category;
  label: string;                 // 'Välitunnit ja pihaleikit'
  weekdayMin: number;            // ma–pe
  weekendMin: number;            // la–su
  shares: IntensityShares;
  validFrom: ISODate; validTo?: ISODate;
  createdAt: Timestamp; updatedAt: Timestamp;
}

// ---------- kerros 2: suunnitelma ----------
export interface TemplateItem {
  id: UUID; profileId: UUID; activityTypeId: UUID;
  weekdays: Weekday[];
  startTime?: HHmm;
  durationMin: number;
  validFrom: ISODate; validTo?: ISODate;  // esim. syyskausi
  active: boolean;
  note?: string;
  createdAt: Timestamp; updatedAt: Timestamp;
}

export type PlannedStatus = 'open' | 'done' | 'skipped';
export type SkipReason = 'sick' | 'injured' | 'cancelled' | 'other_commitment' | 'other';

export interface PlannedSession {
  id: UUID; profileId: UUID; activityTypeId: UUID;
  date: ISODate; startTime?: HHmm;
  durationMin: number;           // suunniteltu; ei muutu kuitatessa
  templateItemId?: UUID;         // puuttuu, jos lisätty käsin
  status: PlannedStatus;
  skipReason?: SkipReason;
  sessionId?: UUID;              // kun status = 'done'
  createdAt: Timestamp; updatedAt: Timestamp;
}

// ---------- kerros 3: toteuma ----------
export interface Session {
  id: UUID; profileId: UUID; activityTypeId: UUID;
  date: ISODate; startTime?: HHmm;
  durationMin: number;
  playedMin?: number;            // peli ja turnaus
  effort: Effort;
  intensitySource: 'profile' | 'manual';
  sharesSnapshot?: IntensityShares; // käytetty profiili, kun source = 'profile'
  minutes: IntensityMinutes;     // tallennettu laskentatulos
  muscle: boolean;
  bone: boolean;
  plannedSessionId?: UUID;
  note?: string;
  createdAt: Timestamp; updatedAt: Timestamp;
}

export type FocusTag =
  | 'passing' | 'dribbling' | 'shooting' | 'one_v_one' | 'two_v_two' | 'small_sided'
  | 'goalkeeping' | 'game_understanding' | 'physical' | 'coordination' | 'other';

export interface FootballDetails {
  sessionId: UUID;               // pääavain, 1:1 Session; laji kertoo treeni/peli/turnaus
  attendance: 'full' | 'partial';
  team?: string;                 // oma joukkue, esim. 'P2018 Valkoinen'
  games?: GameResult[];          // turnauksen pelit
  focusTags: FocusTag[];
  parentRating?: 1 | 2 | 3 | 4 | 5;
  enjoyment?: 1 | 2 | 3;
  ratingNote?: string;
  opponent?: string;
  goalsFor?: number; goalsAgainst?: number;
  gamesCount?: number;           // turnaus
  eventName?: string;            // turnaus
  updatedAt: Timestamp;
}

export interface GameResult {    // yksi turnauksen peli
  opponent?: string;
  goalsFor?: number; goalsAgainst?: number;
  playedMin?: number;
}

// ---------- muut ----------
export interface DayFlag {
  id: UUID; profileId: UUID; date: ISODate;
  reason: 'sick' | 'travel' | 'other';
}

export interface MetaRow { key: string; value: unknown }
// laitekohtainen, ei synkronoidu: 'deviceId', 'deviceRole', 'schemaVersion',
// 'plannedThrough:<profileId>', 'lastExportAt', 'lastSyncAt', 'syncFolderHandle'
// Settings tallennetaan synkronoituvaan tauluun `settings` (id = 'settings', + SyncFields)

export interface Settings {
  vigorousDayMin: number;        // oletus 10
  primaryView: 'logged_plus_estimate' | 'logged';
  backupReminderDays: number;    // oletus 30
}
```

### Dexie-skeema (versio 1)

```ts
db.version(1).stores({
  profiles:        'id, archived, sortOrder',
  activityTypes:   'id, &key, category, archived',
  estimates:       'id, profileId, [profileId+category]',
  templateItems:   'id, profileId, active',
  plannedSessions: 'id, profileId, status, [profileId+date], &[templateItemId+date]',
  sessions:        'id, activityTypeId, [profileId+date], &plannedSessionId',
  footballDetails: 'sessionId',
  dayFlags:        'id, &[profileId+date]',
  settings:        'id',
  meta:            'key',
});
```

Yksilölliset indeksit `&[templateItemId+date]` ja `&plannedSessionId` estävät kaksoiskappaleet tietokantatasolla. Rivit, joilta avain puuttuu (käsin lisätyt suunnitelmat, suunnittelemattomat kerrat), eivät päädy indeksiin eivätkä siksi riko yksilöllisyyttä.

### Synkronointikentät ja johdetut tunnisteet

Sovellusta käytetään kahdella laitteella (PC ja puhelin), joiden tiedot yhdistetään tiedostosynkronoinnilla (osio 10). Siksi tietomalli on synkronointivalmis jo versiosta 1 alkaen. Näitä on vaikea lisätä jälkikäteen.

```ts
export type DeviceId = string;        // crypto.randomUUID(), luodaan laitteen ensikäynnistyksessä

export interface SyncFields {
  updatedAt: Timestamp;               // päivitetään JOKAISESSA muutoksessa, myös tilan vaihdossa
  updatedBy: DeviceId;                // laite, joka teki viimeisimmän muutoksen
  deletedAt?: Timestamp;              // poistomerkintä; tietuetta ei poisteta fyysisesti
}
// Kaikki synkronoitavat taulut laajentavat SyncFieldsiä:
// Profile, ActivityType, Estimate, TemplateItem, PlannedSession, Session,
// FootballDetails, DayFlag. Meta ei synkronoidu (laitekohtainen).
```

**Poistot ovat poistomerkintöjä.** Poisto asettaa `deletedAt`-arvon ja päivittää `updatedAt`-arvon. Muuten poisto ei siirtyisi toiselle laitteelle, ja tietue palaisi seuraavassa yhdistämisessä. Repositoriokerros suodattaa poistetut aina pois, eikä käyttöliittymä tai analytiikka koskaan lue tauluja suoraan.

**Johdetut tunnisteet.** Kun sama asia voi syntyä kahdella laitteella toisistaan tietämättä, tunniste johdetaan sisällöstä. Silloin molemmat laitteet tuottavat saman tietueen, joka yhdistyy itsestään eikä tuplaannu.

| Tietue | Tunniste | Miksi |
| --- | --- | --- |
| Sisäänrakennettu laji | `t:<key>`, esim. `t:football_training` | Siemendata luodaan kummallakin laitteella |
| Pohjasta luotu suunnitelma | `p:<templateItemId>:<date>` | Kumpikin laite ajaa `ensurePlanned`-funktion |
| Suunnitelman kuittauksesta syntyvä kerta | `s:<plannedSessionId>` | Sama suunnitelma voidaan kuitata molemmilla laitteilla |
| Jalkapallon lisätiedot | `sessionId` (ennallaan) | 1:1 kerran kanssa |
| Päivämerkintä | `f:<profileId>:<date>` | Yksi per profiili ja päivä |
| Kaikki muut | `crypto.randomUUID()` | Syntyvät vain käyttäjän toimesta yhdellä laitteella |

Kun poistettu kerta kuitataan uudelleen samasta suunnitelmasta, sama tunniste `s:<plannedSessionId>` herätetään henkiin (`deletedAt` tyhjennetään) uuden tietueen luomisen sijaan. Näin yksilöllinen indeksi `&plannedSessionId` ei esty.

Dexie-skeemaan lisätään jokaiseen synkronoitavaan tauluun indeksi `updatedAt` (muutosten haku ja odottavien kirjausten laskenta).

## 7. Analytiikan laskentasäännöt

Kaikki laskenta tehdään puhtaina funktioina hakemistossa `src/domain/`, ilman tietokanta- tai käyttöliittymäriippuvuuksia, ja jokaisella säännöllä on yksikkötesti. Laskenta etenee kolmessa vaiheessa: kerta → päivä → jakso.

### 7.1 Päiväkooste

Profiilille p ja päivälle d:

- **Kirjattu:** L, M ja V ovat päivän `Session.minutes`-arvojen summat (kevyt, reipas, rasittava). `muscle_d` on tosi, jos jokin kerta on merkitty lihaksia vahvistavaksi; `bone_d` vastaavasti.
- **Arvio:** jokaiselle kategorialle c, jolla ei ole päivälle kirjauksia, lisätään voimassa olevan `Estimate`-arvon minuutit (arki- tai viikonloppuarvo × sen tehoprofiili). Tuloksena saadaan E\_L, E\_M ja E\_V.
- **Yhdistetty:** L\* = L + E\_L, M\* = M + E\_M, V\* = V + E\_V.
- **MVPA** = M + V ja MVPA\* = M\* + V\*.

### 7.2 Jakso ja kelvolliset päivät

Jakso on ISO-viikko (ma–su), kalenterikuukausi, kausi tai vuosi. Kelvolliset päivät D ovat jakson päivät, jotka täyttävät kaikki ehdot:

- päivä ≤ tänään
- päivä ≥ seurannan alku (profiilin luontipäivä)
- päivälle ei ole `DayFlag`-merkintää.

N = |D|. Jos N = 0, vertailua ei tehdä.

### 7.3 Kouluikäiset (`school_age`)

```latex
\overline{MVPA} = \frac{1}{N}\sum_{d \in D} MVPA_d \qquad \text{täyttyy, kun } \overline{MVPA} \ge 60
```

| Mittari | Kaava | Tavoite | Peruste |
| --- | --- | --- | --- |
| Reipas ja rasittava, ka. | Σ MVPA\_d / N | ≥ 60 min/pv | Virallinen (keskiarvotulkinta) |
| Aktiiviset päivät | \|{d : MVPA\_d ≥ 60}\| / N | ei tavoitetta | Täydentävä tieto (UKK:n PAD-menetelmä) |
| Rasittavat päivät | \|{d : V\_d ≥ vigorousDayMin}\|, vain kirjattu | ≥ 3 / viikko | Virallinen määrä; minuuttiraja on sovelluksen oma |
| Lihaksia vahvistavat päivät | \|{d : muscle\_d}\| | ≥ 3 / viikko | Virallinen |
| Luustoa vahvistavat päivät | \|{d : bone\_d}\| | ≥ 3 / viikko | Virallinen |

MVPA-keskiarvo lasketaan kahdesti, kirjatuista (MVPA) ja yhdistetyistä (MVPA\*). Päivämäärämittarit lasketaan vain kirjatuista.

### 7.4 Alle kouluikäiset (`early_years`)

Suositus on päiväkohtainen:

```latex
\text{päivä täyttyy} \iff (L^*_d + M^*_d + V^*_d \ge 180) \wedge (M^*_d + V^*_d \ge 60)
```

Jaksolle näytetään täyttyneiden päivien osuus sekä kokonaisliikunnan ja vauhdikkaan liikunnan keskiarvot. Myös nämä lasketaan sekä kirjatuista että yhdistetyistä luvuista.

### 7.5 Aikuiset (`adult`)

```latex
W = \sum_{d \in D} M_d + 2 \sum_{d \in D} V_d \qquad \text{täyttyy, kun } W \ge 150 \cdot \tfrac{N}{7}
```

Kokonaisella viikolla (N = 7) raja on 150 min. Kesken olevalla viikolla näytetään tahti suhteessa osaviikon tavoitteeseen. Lihaskunnon ja liikehallinnan päiviä tarvitaan ≥ 2 viikossa.

### 7.6 Pidemmät jaksot

Viikkotavoitteet (esim. ≥ 3 rasittavaa päivää) arvioidaan viikoittain, ja kuukaudelle tai kaudelle näytetään "täyttyi 3/4 viikkona". Viikko otetaan mukaan, jos siinä on vähintään 4 kelvollista päivää. MVPA-keskiarvo lasketaan koko jakson kelvollisista päivistä.

### 7.7 Tila ja sanoitus

| Toteuma / tavoite | Tila | Esimerkkiteksti |
| --- | --- | --- |
| ≥ 100 % | `met` | "Suositus täyttyi" |
| 75–99 % | `near` | "Lähellä suositusta – puuttui noin 8 min/pv" |
| < 75 % | `below` | "Tällä viikolla vähemmän kuin suositus" |

Ylärajaa ei näytetä, koska suositus toteaa, ettei liikunnalle ole näyttöön perustuvaa enimmäismäärää.

### 7.8 Datan laatu

- **Kattavuus** = |{d ∈ D : päivällä vähintään yksi `Session`}| / N
- **Arvion osuus** = (MVPA\* − MVPA) / MVPA\*
- Jos kattavuus < 50 % eikä perusarvioita ole, tila näytetään himmennettynä tekstillä "Liian vähän kirjauksia luotettavaan vertailuun".

### 7.9 Suunnitelma vs. toteuma

Lasketaan jaksolta erikseen, eikä tulos vaikuta liikuntamääriin:

- suunniteltuja, tehtyjä, väliin jääneitä (syittäin) ja kuittaamattomia (`open` ja päivä < tänään)
- **toteutumisaste** = done / (done + skipped), jossa peruutettuja (`cancelled`) ei lasketa
- suunniteltu vs. toteutunut kesto linkitetyistä pareista.

### 7.10 Muut koosteet

- **Monipuolisuus:** eri liikuntaryhmien määrä viimeisen 28 päivän kirjauksissa.
- **Ohjatun osuus:** ohjatun kontekstin MVPA / kaikki kirjattu MVPA.
- **Jakauma kategorioittain:** minuutit ja MVPA kategoriaa kohti.

### 7.11 Funktiorajapinnat

```ts
computeSessionMinutes(type: ActivityType, input: { durationMin: number; playedMin?: number;
  effort: Effort; manual?: IntensityMinutes }): { minutes: IntensityMinutes; snapshot?: IntensityShares };
dayTotals(date: ISODate, sessions: Session[], estimates: Estimate[], types: Map<UUID, ActivityType>): DayTotals;
validDays(period: Period, profile: Profile, flags: DayFlag[], today: ISODate): ISODate[];
recommendationGroup(profile: Profile, on: ISODate): RecommendationGroup;
evaluatePeriod(group: RecommendationGroup, days: DayTotals[], settings: Settings): PeriodEvaluation;
planAdherence(planned: PlannedSession[], sessions: Session[]): AdherenceSummary;
```

## 8. Jalkapallon seuranta

Jalkapallotiedot jaetaan neljään erilliseen osaan, joita ei yhdistetä yhdeksi pisteluvuksi. Sovellus ei tee lahjakkuusarvioita, ennusteita eikä vertailuja muihin lapsiin.

| Osa | Mitä | Mistä | Luotettavuus |
| --- | --- | --- | --- |
| Osallistuminen ja peliaika | Treenit ja pelit, kokonaan/osittain, poissaolot syineen, pelatut minuutit | `PlannedSession`, `Session`, `FootballDetails.attendance`, `playedMin` | Hyvä: tosiasioita |
| Harjoittelun sisältö | Fokustagit (syöttely, kuljetus, laukaukset, 1v1, 2v2, pienpelit, maalivahti, pelikäsitys, fysiikka, koordinaatio) | `focusTags` | Kohtalainen: vanhempi ei aina tiedä treenin sisältöä |
| Vanhemman arvio | Suoritus 1–5, viihtyminen 1–3, vapaa huomio | `parentRating`, `enjoyment` | Subjektiivinen: vain trendiksi |
| Taitotestit (myöhempi vaihe) | Toistettavat mittaukset, esim. 20 m sprintti, pujottelurata, pompottelu | `SkillTest` | Hyvä, jos testi tehdään aina samalla tavalla |

### Arvioasteikot

Suoritusarvio ankkuroidaan lapsen **omaan tavalliseen tasoon**, ei muihin pelaajiin. Asteikon selite näkyy valitsimen alla:

| Arvo | Selite |
| --- | --- |
| 1 | Selvästi tavallista vaikeampi päivä |
| 2 | Hieman tavallista heikompi |
| 3 | Tavallinen oma taso |
| 4 | Hieman tavallista parempi |
| 5 | Selvästi tavallista parempi |

Viihtyminen: 1 = ei viihtynyt, 2 = ihan ok, 3 = viihtyi selvästi. Viihtyminen näytetään analyysissä ennen suoritusarviota, koska liikkumisen ilo on suosituksen mukaan pysyvien liikuntatottumusten perusta.

### Kirjaus

- Lisätiedot ovat valinnaisia. Kuittauksen jälkeen avautuu kevyt paneeli (tähdet, viihtyminen ja tagit), jonka voi ohittaa kohdasta "Myöhemmin".
- Pelissä kysytään pelatut minuutit (pikavalinnat) ja valinnaisesti tulos ja vastustaja.
- Turnaus on yksi kerta: tapahtuman kesto, pelien määrä ja pelatut minuutit yhteensä.
- Poissaolo kirjataan kuittaamalla suunniteltu kerta väliin jääneeksi ja valitsemalla syy (sairas, loukkaantunut, peruttu, muu meno, muu).

### Mittarit

| Mittari | Laskenta | Huomio |
| --- | --- | --- |
| Harjoitusmäärä | Treenien määrä ja minuutit / kk |  |
| Pelimäärä ja peliaika | Pelien määrä, pelatut min yhteensä ja keskiarvo per peli |  |
| Osallistumisaste | tehdyt / (tehdyt + väliin jääneet), ei peruttuja | Syyt eriteltyinä |
| Sisällön jakauma | Tagien osuudet kaudella | Vain tagitetuista kerroista |
| Arviotrendi | Viimeisten 8 arvioidun kerran mediaani | Näytetään vasta, kun arvioita ≥ 5; teksti "vanhemman arvio, ei mittaus" |
| Viihtymistrendi | Viimeisten 8 kerran mediaani | Lasku näytetään neutraalisti: "viihtyminen vähentynyt viime viikkoina" |
| Pelitulokset | Voitot, tasapelit ja tappiot | Valinnainen; ei vaikuta muihin mittareihin |

Arvioita ei keskiarvoisteta yli kausien eikä niistä lasketa "kehitysindeksiä". Mediaani kestää yksittäisiä poikkeuksia paremmin kuin keskiarvo.

### Pelit ja tulokset -näkymä

Kaikki pelit ja niiden tulokset kootaan yhteen näkymään (Analyysi → Jalkapallo → Pelit). Yhteenvedot lasketaan samasta listasta.

**Kirjaus**

- Pelissä kirjataan oma joukkue (esim. "P2018 Valkoinen"), vastustaja ja tulos. Kaikki kentät ovat valinnaisia.
- Turnaukseen voi lisätä pelit riveinä painikkeella "+ peli" (vastustaja, tulos, pelatut minuutit). Kun pelirivejä on, `gamesCount` = rivien määrä.
- Joukkueiden nimet täydentyvät aiemmista kirjauksista. Vertailussa kirjainkokoa ja ylimääräisiä välilyöntejä ei huomioida.

**Pelilista**

Rivillä näkyvät päivä, oma joukkue, vastustaja, tulos (esim. 3–1), merkintä V/T/H ja pelatut minuutit. Turnauksen pelit näkyvät turnauksen nimen alla. Listaa voi suodattaa kauden, vuoden, oman joukkueen ja vastustajan mukaan.

**Yhteenvedot valitulta jaksolta**

| Yhteenveto | Sisältö |
| --- | --- |
| Kokonaisuus | Pelit, voitot–tasapelit–häviöt, tehdyt–päästetyt maalit, maaliero |
| Oma joukkue | Sama joukkueittain, jos lapsi pelaa useammassa joukkueessa |
| Vastustajat | Pelit, V–T–H ja maalit vastustajittain, eniten pelatut ensin |
| Turnaukset | Turnauksittain pelit, V–T–H ja maalit |
| Kaudet ja vuodet | Kokonaisuus kausittain ja vuosittain rinnakkain |
| Peliaika | Pelatut minuutit yhteensä ja keskimäärin per peli |

**Laskentasäännöt**

- Peli on voitto, kun tehdyt > päästetyt, tasapeli kun yhtä suuret ja häviö kun pienemmät.
- V–T–H ja maalit lasketaan vain peleistä, joissa molemmat maalimäärät on kirjattu. Muut pelit lasketaan pelimäärään ja näkyvät merkinnällä "ei tulosta".
- Turnauksen pelit tulevat peliriveistä. Jos rivejä ei ole, turnaus näkyy yhtenä rivinä (`gamesCount` peliä, ei tulosta).
- Pelilistan voi viedä CSV:nä, yksi rivi per peli.

Tulokset ovat joukkueen tuloksia. Ne eivät vaikuta lapsen arvioihin eivätkä muihin mittareihin, eikä näkymässä ole sarjataulukoita tai lapsen henkilökohtaisia pisteitä.

## 9. Pitkän aikavälin analytiikka

Tavoitteena on lapsen liikunnallinen kokonaisprofiili usean vuoden ajalta: kuinka paljon, millä tavoin ja kuinka monipuolisesti hän liikkuu, ja miten se muuttuu iän ja kausien mukana. Koosteet lasketaan samoista päiväkoosteista kuin viikkoanalyysi; erillistä tallennettua tilastotaulua ei ole.

Oletuskaudet ovat kevät (tammi–touko), kesä (kesä–elo) ja syksy (syys–joulu). Ne muutetaan myöhemmin asetuksiin vastaamaan seuran kausia.

| Mittari | Taso | Näyttötapa |
| --- | --- | --- |
| Kokonaisliikunta (L+M+V) | kk, kausi, vuosi | Keskiarvo min/pv, kirjattu ja yhdistetty erikseen |
| Reipas ja rasittava | kk, kausi, vuosi | Keskiarvo min/pv vs. suositus; rasittavan osuus |
| Ohjattu vs. omaehtoinen | kk, kausi | Osuudet MVPA:sta |
| Monipuolisuus | kausi, vuosi | Eri liikuntaryhmien ja muotojen määrä |
| Lajikohtainen määrä | kk, kausi | Kerrat ja minuutit lajeittain |
| Harjoittelun sisältö | kausi | Jalkapallon tagijakauma |
| Kuormituksen muutos (vaihe 9) | viikko | Viikkokuorma vs. edellisten 4 viikon keskiarvo, % |
| Palautuminen (vaihe 9) | viikko | Vanhemman merkintä väsymyksestä 1–3 |
| Suositusten toteutuminen | kausi, vuosi | Viikkojen osuus, joilla kukin tavoite täyttyi |

### Mitä voi päätellä ja mitä ei

**Voi päätellä (kirjausten kattavuuden rajoissa):**

- kirjatun liikunnan määrän ja jakauman muutokset kausien ja vuosien välillä
- monipuolisuuden kaventumisen tai laajentumisen
- ohjatun ja omaehtoisen liikunnan suhteen muutoksen
- osallistumisaktiivisuuden ja harjoitusmäärän kehityksen.

**Ei voi päätellä:**

- todellista reippaan liikunnan määrää: se on arvio, jonka virhemarginaali on suuri
- kuntoa, terveyttä tai kehitystasoa
- urheilullista lahjakkuutta tai tulevaa menestystä
- vertailua muihin lapsiin.

Näkymässä on aina datan laatu (kattavuus ja arvion osuus). Jos kirjauskäytäntö muuttuu (esim. koulumatkoja aletaan kirjata), muutos voi näyttää liikunnan lisääntymiseltä, vaikka kyse on vain kattavammasta kirjauksesta. Siksi kattavuus näytetään trendin rinnalla.

### Periaatteet, jotka estävät liiallista suorittamista

- Ei putkia ("streak"), mitaleja, pisteitä eikä palkintoja minuuteista.
- Ei ylärajaa eikä "ennätysviikko"-korostusta.
- Monipuolisuus ja viihtyminen näytetään yhtä näkyvästi kuin minuutit.
- Kuormituksen kasvusta näytetään neutraali tieto ("tämä viikko +40 % neljän viikon keskiarvoon") ilman riski- tai suoritustulkintaa. Akuutti–krooninen-kuormitussuhdetta ei käytetä, koska sen näyttö vammariskin ennustajana on kiistanalainen.
- Sanoitus on kuvailevaa eikä arvostelevaa, myös silloin kun suositus ei täyty.

## 10. Tekninen arkkitehtuuri

Kevyt sovellus PC:lle ja puhelimelle: ei omaa palvelinta, ei verkkokutsuja ajon aikana, kaikki data IndexedDB:ssä.

| Osa | Valinta | Huomio |
| --- | --- | --- |
| Kieli ja käännös | TypeScript (strict) + Vite |  |
| Käyttöliittymä | React |  |
| Tyylit | Tailwind CSS | Mobiili edellä, 375 px |
| Tietokanta | Dexie.js + `dexie-react-hooks` | `useLiveQuery` päivittää näkymät |
| Validointi | `zod` | Tuonti ja lomakkeet |
| Päivämäärät | `date-fns` (fi-lokaali) | ISO-viikot; ei `Date`-olioita tietokannassa |
| Kaaviot | Recharts |  |
| PWA | `vite-plugin-pwa` (generateSW) | Kaikki resurssit esivälimuistiin |
| Testit | Vitest + `fake-indexeddb` | Domain-funktiot ja tietokantalogiikka |
| Julkaisu | Staattinen HTTPS-hosting (GitHub Pages / Netlify) | Vain koodi; data ei kulje julkaisupalvelimen kautta |

### Hakemistorakenne

```
src/
  domain/      tyypit, recommendations.ts, intensity.ts, aggregate.ts, adherence.ts,
               groups.ts, migrations.ts   ← puhtaita funktioita, ei riippuvuuksia
  db/          schema.ts, repositories, ensurePlanned.ts, backup.ts
  seed/        activityTypes.ts (sisäänrakennetut lajit, pysyvät avaimet)
  features/    week/, quick-add/, review/, football/, analysis/, settings/
  ui/          yhteiset komponentit
```

### Tietokannan versiohallinta

- Olemassa olevaa `db.version(n)`-määrittelyä ei koskaan muuteta. Muutos on aina uusi versio, jossa on `upgrade()`.
- Jokainen migraatio on puhdas funktio `migrateVnToVn1(data)` tiedostossa `domain/migrations.ts`. Samaa funktiota käyttävät sekä Dexien `upgrade()` että vanhan varmuuskopion tuonti.
- Jokaiselle versiolle tallennetaan testifixture (JSON), ja testi ajaa ketjun v1 → nykyinen.
- `meta.schemaVersion` kertoo nykyisen version.

### Viikkopohjan luonti

```ts
async function ensurePlanned(profileId: UUID, through: ISODate, today: ISODate) {
  await db.transaction('rw', db.templateItems, db.plannedSessions, db.meta, async () => {
    const done = await getPlannedThrough(profileId);          // meta 'plannedThrough:<id>'
    const from = maxDate(addDays(done, 1), addDays(today, -14)); // ei takautuvaa kasaa lomien jälkeen
    for (const item of await activeItems(profileId)) {
      for (const date of datesBetween(maxDate(from, item.validFrom), minDate(through, item.validTo))) {
        if (!item.weekdays.includes(isoWeekday(date))) continue;
        const exists = await db.plannedSessions.where('[templateItemId+date]').equals([item.id, date]).count();
        if (!exists) await db.plannedSessions.add(newPlanned(item, date));
      }
    }
    await setPlannedThrough(profileId, maxDate(done, through));
  });
}
```

- Kutsutaan käynnistyksessä ja viikkonavigoinnissa. Raja on nykyisen viikon +1 sunnuntai, tai selattavan tulevan viikon sunnuntai (enintään +8 viikkoa yhtenäisenä jaksona). Kauempana (yli +8 viikkoa) selattu viikko suunnitellaan erikseen vain sen osalta (ma–su), siirtämättä `plannedThrough`-merkintää (SPEC 16, käyttäjän havainto 13.11.2026).
- Kaksoiskappaleet estetään kahdesti: transaktion sisäisellä tarkistuksella ja yksilöllisellä indeksillä `&[templateItemId+date]`.
- **Pohjan muokkaus tai poisto:** samassa transaktiossa poistetaan rivin `open`-tilaiset suunnitelmat, joiden päivä ≥ tänään, ja luodaan ne uudelleen. Menneet ja kuitatut suunnitelmat eivät muutu. Poistettu rivi merkitään `active = false`, jotta vanhat linkit säilyvät.

### Kaksoismerkintöjen estäminen

- Kuittaus tehdään transaktiona: luodaan `Session` ja päivitetään `PlannedSession`. Yksilöllinen `&plannedSessionId` estää toisen kerran samasta suunnitelmasta. Toinen kuittaus avaa olemassa olevan kerran muokattavaksi.
- Pikalisäys varoittaa (ei estä), jos samalle profiilille, päivälle ja lajille on jo kerta tai avoin suunnitelma, ja tarjoaa vaihtoehdon "Kuittaa suunniteltu".

### Historian säilyminen

- `Session.minutes` ja `sharesSnapshot` tallennetaan, joten lajiprofiilin muutos ei muuta mennyttä.
- Lajit ja profiilit arkistoidaan eikä niitä poisteta, jos niihin viitataan.
- Kerran poisto pyytää vahvistusta ja tarjoaa kumoamisen 5 sekunnin ajan.

### Varmuuskopio

```json
{
  "format": "liikkumisseuranta-backup",
  "schemaVersion": 1,
  "appVersion": "0.1.0",
  "exportedAt": "2026-11-11T10:00:00Z",
  "checksum": "sha256:…",
  "data": { "profiles": [], "activityTypes": [], "estimates": [], "templateItems": [],
            "plannedSessions": [], "sessions": [], "footballDetails": [], "dayFlags": [], "meta": [] }
}
```

- `checksum` = SHA-256 (`crypto.subtle`) `data`-osan kanonisesta JSONista (avaimet aakkosjärjestyksessä).
- **Tuonti:** jäsennys → zod-validointi → tarkistussumma → migraatio nykyiseen versioon → kaikkien taulujen tyhjennys ja lisäys **yhdessä** `rw`-transaktiossa. Mikä tahansa virhe perii transaktion, eikä data muutu. Ennen tuontia ladataan automaattisesti varmuuskopio nykytilasta. Varmuuskopion tuonti korvaa aina kaiken; laitteiden välinen yhdistäminen hoidetaan synkronoinnilla (alla).
- **Muistutus:** jos edellisestä viennistä on yli 30 päivää (asetus), Viikko-näkymässä näytetään banneri.
- **CSV-vienti:** yksi rivi per kerta (profiili, päivä, laji, kategoria, kesto, kevyt, reipas, rasittava, lihas, luusto, jalkapallokentät). UTF-8 BOM:lla ja puolipiste-erottimella, jotta suomenkielinen Excel avaa tiedoston oikein.

### Synkronointi PC ↔ puhelin

PC on päälaite: suurin osa kirjauksista ja kuittauksista tehdään siellä. Puhelin saa PC:n tilanteen tiedostona ja lähettää omat kirjauksensa takaisin. Yhdistämissääntö on molempiin suuntiin sama; laitteen rooli vaikuttaa vain painikkeisiin ja muistutuksiin.

**Tiedostot pilvikansiossa.** OneDrive- tai iCloud Drive -kansio, joka näkyy molemmilla laitteilla:

| Tiedosto | Kirjoittaa | Lukee |
| --- | --- | --- |
| `liikkuminen-pc.json` | PC | puhelin |
| `liikkuminen-puhelin.json` | puhelin | PC |

Tiedostoja on kaksi, jotta kumpikaan laite ei koskaan ylikirjoita toisen kirjoittamaa tiedostoa. **Muutos (lisäys 16):** käytössä on yksi yhteinen tiedosto `liikkuminen.json`, jonka molemmat laitteet tallentavat samalla nimellä. Puhelin voi korvata tiedoston ("Korvaa") tai tallentaa rinnalle kopion ("Säilytä molemmat"; iPhonen Tiedostot tallentaa kopion usein kysymättä nimellä `liikkuminen 2.json`). PC lukee myös kopiot (`liikkuminen 2.json`, `liikkuminen (1).json`, `isSyncCopyName`), yhdistää toisen laitteen kopiot ja poistaa ne kansiosta, ettei kopioita kerry (käyttäjän palaute 13.11.2026); oman laitteen vanha kopio poistetaan, eikä muihin tiedostoihin kosketa. Turvallisuus säilyy, koska PC yhdistää tiedoston aina ennen kirjoitusta (jos sen on tallentanut toinen laite PC:n oman kirjoituksen jälkeen, tunnistus `deviceId`:stä ja muokkausajasta), ja yhdistäminen on viimeisin-voittaa-periaatteella idempotentti: korvauksessa pois jääneet PC:n muutokset palaavat tiedostoon PC:n seuraavassa synkronoinnissa. Oman laitteen tiedostoa ei yhdistetä. Vanha `liikkuminen-puhelin.json` luetaan edelleen siirtymää varten; vanhat tiedostot voi poistaa. Muoto on sama kuin varmuuskopiossa, mutta `"format": "liikkumisseuranta-sync"`, ja mukana ovat `deviceId` ja `deviceRole`. Tiedosto sisältää kaikki synkronoitavat taulut poistomerkintöineen täytenä tilannekuvana, koska dataa on vähän. Tarkistussumma ja skeemaversio toimivat kuten varmuuskopiossa.

**PC: "Synkronoi" (yksi painallus)**

1. Ensimmäisellä kerralla käyttäjä valitsee pilvikansion (`showDirectoryPicker`, Chrome ja Edge). Kansion kahva tallennetaan IndexedDB:hen. Selain voi myöhemmin pyytää käyttöoikeuden vahvistusta yhdellä napautuksella.
2. Jos `liikkuminen-puhelin.json` on muuttunut edellisen lukukerran jälkeen, se luetaan ja yhdistetään.
3. Ajetaan `ensurePlanned`.
4. `liikkuminen-pc.json` kirjoitetaan uudelleen tilannekuvana.
5. Näytetään yhteenveto.

Selaimessa, joka ei tue kansion käsittelyä, sama tehdään tiedoston valinnalla ja latauksella.

**Puhelin**

- **"Päivitä PC:ltä":** tiedostonvalitsin (`<input type="file">`) → `liikkuminen-pc.json` → yhdistäminen → yhteenveto.
- **"Lähetä PC:lle":** tiedoston jako Web Share API:lla (`navigator.share`) → "Tallenna Tiedostoihin" samaan kansioon nimellä `liikkuminen-puhelin.json`. Jos jakaminen ei ole tuettu, tiedosto ladataan.
- **Odottavat kirjaukset:** tietueet, joilla `updatedBy` = tämä laite ja `updatedAt` on myöhempi kuin edellinen "Lähetä PC:lle". Määrä näkyy Viikko-näkymässä.

**Yhdistämissääntö** (`mergeSnapshot`, puhdas funktio hakemistossa `domain/`):

```ts
function pickWinner<T extends SyncFields & { id: string }>(local: T | undefined, incoming: T): T | undefined {
  if (!local) return incoming;                                   // uusi tietue
  if (incoming.updatedAt > local.updatedAt) return incoming;     // uudempi voittaa
  if (incoming.updatedAt === local.updatedAt && incoming.updatedBy > local.updatedBy) return incoming; // tasapeli
  return undefined;                                              // paikallinen pysyy
}
```

- Poistomerkinnät ovat tavallisia tietueita: uudempi poisto voittaa vanhemman muokkauksen, ja uudempi muokkaus vanhemman poiston.
- Koko yhdistäminen tehdään yhdessä `rw`-transaktiossa. Mikä tahansa virhe perii sen, eikä data muutu.
- Yhdistäminen on idempotentti: saman tiedoston tuonti uudelleen ei muuta mitään.
- **Ristiriita** on tietue, jota on muokattu molemmilla laitteilla edellisen synkronoinnin jälkeen. Uudempi voittaa, ja yhteenveto nimeää ristiriitaiset kerrat (esim. "Ti 12.11. Jalkapallo – treeni: PC:n versio korvattiin puhelimen uudemmalla").
- Vertailu perustuu laitteiden kelloihin, jotka synkronoituvat automaattisesti. Pieni kelloero ei käytännössä haittaa, koska samaa tietuetta muokataan harvoin kahdella laitteella minuuttien sisällä.
- **Skeemaversio:** jos tuleva versio on uudempi, tuonti hylätään viestillä "Päivitä sovellus tällä laitteella ensin". Jos vanhempi, tiedosto migroidaan ensin.
- **Asetukset:** synkronoitavat asetukset (esim. rasittavan päivän raja) tallennetaan omaan synkronoituvaan tauluun `settings` (yksi rivi, tunniste `settings`). `meta` jää laitekohtaiseksi: `deviceId`, `deviceRole`, `schemaVersion`, `plannedThrough`, viimeisimmät vienti- ja synkronointiajat sekä kansion kahva.

**Muistutukset**

- Puhelimessa, jos edellisestä "Päivitä PC:ltä" on yli 7 päivää: "Tiedot PC:ltä 9 päivän takaa".
- PC:llä, jos kansiossa on lukematon uudempi puhelimen tiedosto: "Puhelimella on uusia kirjauksia – synkronoi".

**Myöhemmin:** jos kirjaus molemmilla laitteilla yleistyy, Dexie Cloud voidaan ottaa käyttöön ilman tietomallin muutoksia, koska tunnisteet, muokkausajat ja poistomerkinnät ovat jo valmiina.

### Offline ja tallennuksen pysyvyys

- Service worker esivälimuistittaa kaikki resurssit, eikä sovellus tee verkkokutsuja.
- Päivitys: `registerType: 'prompt'`. Ilmoitus "Uusi versio saatavilla" näytetään vain Viikko-näkymässä, ei kesken lomakkeen.
- Ensimmäisen tallennuksen yhteydessä kutsutaan `navigator.storage.persist()`. Asetuksissa näkyy, onko tallennus pysyvä, sekä käytetty tila (`navigator.storage.estimate()`).
- iPhonessa sovellus ohjeistetaan asentamaan kotinäytölle. Selaimessa ilman asennusta käytetyn sivuston tallennus voi tyhjentyä, joten varmuuskopio on tärkeä.

## 11. Tietosuoja

Sovellus käsittelee lapsen henkilö- ja liikuntatietoja, joten se kerää vain sen, mitä laskenta tarvitsee, eikä lähetä mitään mihinkään. Laitteelta lähtevät vain käyttäjän itse tallentamat synkronointi- ja varmuuskopiotiedostot.

- **Tietojen minimointi:** nimeksi riittää lempinimi. Syntymästä tallennetaan vain vuosi ja kuukausi. Sukupuolta, painoa, pituutta tai terveystietoja ei tallenneta. Profiili- ja joukkuekuva on vapaaehtoinen: se pienennetään laitteella (noin 256 px, JPEG) ja tallennetaan vain IndexedDB:hen sekä käyttäjän omiin varmuuskopio- ja synkronointitiedostoihin (lisäys 16).
- **Ei verkkoliikennettä:** ei analytiikkaa, virheraportointia, ulkoisia fontteja, CDN-skriptejä eikä kolmannen osapuolen palveluita. Sisältöturvakäytäntö (CSP) rajaa yhteydet omaan alkuperään (`default-src 'self'`).
- **Paikallinen tallennus:** data on laitteiden IndexedDB:ssä ja synkronointitiedostoissa käyttäjän omassa pilvikansiossa (OneDrive tai iCloud Drive). Kansiota ei kannata jakaa muille. Julkaisupalvelin jakaa ainoastaan sovelluksen koodin.
- **Vienti:** vientipainikkeen yhteydessä kerrotaan, että tiedosto sisältää lapsen tietoja ja se kannattaa säilyttää turvallisesti (esim. salattu pilvikansio).
- **Poisto:** asetuksissa on "Poista profiili ja kaikki sen tiedot" sekä "Tyhjennä kaikki tiedot", kummassakin kahden vaiheen vahvistus.
- **Lukitus:** sovellus luottaa puhelimen omaan näytön lukitukseen; erillistä PIN-koodia ei toteuteta MVP:ssä.
- **Tietosuojaseloste** (18.11.2026; `features/help/Privacy.tsx`): käyttäjälle kerrotaan selkokielellä, mitä tallennetaan, missä tiedot ovat, synkronoinnin ja varmuuskopioiden säilytys, verkkoliikenne (julkaisupalvelimen tekniset lokit, ei analytiikkaa, mainoksia tai evästeitä), kutsukoodi ja pikatesti, tietojen poisto ja yhteystieto. Se avautuu alkusivun alalaidasta ja ohjelman Ohjeesta. Päivityspäivä näkyy selosteessa; päivitä teksti, jos tietojen käsittely muuttuu.
- **Käyttötarkoitus:** perheen yksityinen käyttö. Tietoja ei jaeta valmentajille tai muille; mahdollinen raporttivienti on myöhempi vaihe ja aina käyttäjän käynnistämä.

## 12. Käyttöliittymä ja käyttöpolut

Kolme välilehteä: **Viikko**, **Analyysi** ja **Asetukset**. Yläreunassa ovat profiilisirut (valittu profiili muistetaan). Erillistä "Lisää"-välilehteä ei ole; lisäys tehdään Viikko-näkymän pyöreällä +-painikkeella.

### Aikabudjetit

| Toiminto | Tavoite | Napautuksia |
| --- | --- | --- |
| Uusi kerta (tänään, viimeksi käytetty laji) | < 15 s | 4: + → laji → kesto → Tallenna |
| Suunnitellun kuittaus "kuten suunniteltu" | < 2 s | 1 |
| Viikon läpikäynti (7 suunniteltua) | < 60 s | 7–10 |
| Viikon tilanteen näkeminen | heti | 0: Viikko-näkymän yläkortti |

### Viikko (aloitusnäkymä)

- **Yläkortti:** viikon pääluku suositusryhmän mukaan (esim. "Reipas ka. 52 / 60 min/pv"), rasittavat ja vahvistavat päivät (esim. "Rasittava 2/3 · Lihas 1/3 · Luusto 3/3") ja pieni laatumerkintä ("arviota 30 %").
- **Päivät ma–su** pystylistana. Tehdyt kerrat näkyvät täysvärisinä, avoimet suunnitelmat haaleina ja suunnitelmassa ✓- ja ✗-painikkeet. Päivän rivillä on pieni MVPA-palkki.
- **"Käy viikko läpi"** -painike näkyy, kun menneitä avoimia suunnitelmia on. Se avaa listan, jossa jokaisella rivillä on ✓ (kuten suunniteltu), ✗ (ei tehty → valinnainen syy) ja ✎ (muokkaa kestoa). Lisäksi on "Merkitse loput tehdyiksi", jonka voi kumota.
- Pyyhkäisy tai nuolet vaihtavat viikkoa.
- Pitkä painallus päivään → "Merkitse sairaaksi / matkapäiväksi".

### Pikalisäys (alapaneeli)

1. Laji: kuuden viimeksi käytetyn kuvakepainikkeet ja "Kaikki lajit".
2. Päivä (oletus tänään) näkyy ylimpänä. Kesto: pikavalinnat 15, 30, 45, 60, 75 ja 90 min sekä "Muu". Valinta ei vielä tallenna.
3. Samassa paneelissa voi valinnaisesti muuttaa tehoa (lajin arvio ja ponnistelu, "enimmäkseen kevyttä / reipasta / rasittavaa" tai oma jako), lihas- ja luustovalintaa (vain lajeille `yes` tai `ask`) ja muistiinpanoa.
3b. Alareunassa on aina näkyvä Tallenna-painike, jossa lukee valittu päivä ja kesto ("Tallenna · Ke 11.11. · 60 min"). Muutettu käyttäjän pyynnöstä 11.11.2026, jotta väärälle päivälle ei kirjata vahingossa.
4. Jalkapallossa tallennuksen jälkeen aukeaa lisätietopaneeli, jonka voi ohittaa ("Myöhemmin").

Tallennuksen jälkeen näkyy ilmoitus "Tallennettu · Kumoa". Erillisiä vahvistusdialogeja ei ole.

### Analyysi

- Jakson valinta: viikko, kuukausi, kausi tai vuosi. Valinnan alla lause siitä, mihin taso vastaa, ja jokaisella tasolla omat oletuskortit (ks. §16 "Analyysi selkeämmäksi").
- Ylimpänä tavoitekortit (sama sisältö kuin Viikko-näkymän yläkortissa, laajennettuna), jokaisessa kirjattu ja kirjattu + arvio erikseen.
- Kaaviot: päivittäinen MVPA (viikko) tai viikkokeskiarvot (pidemmät jaksot) ja suositusviiva, sekä jakauma kategorioittain.
- Jalkapallo-osio, jos profiililla on jalkapallokertoja.
- Datan laatu ja suunnitelma vs. toteuma.
- Linkki "Mihin luvut perustuvat" avaa suositukset, lähteet ja sovelluksen tehomallin.

### Asetukset

Profiilit (koulun aloitus, ryhmän ohitus), viikkopohja, perusarviot, liikkumismuodot ja tehoprofiilit (sekä "Laske uudelleen"), rasittavan päivän raja, varmuuskopio ja tuonti, tallennuksen tila, tietosuoja ja tietojen poisto, sekä tietoa suosituksista.

### Synkronointi

- **PC:** Viikko-näkymän yläpalkissa painike "Synkronoi" ja tila, esim. "Synkronoitu 10 min sitten".
- **Puhelin:** Viikko-näkymän yläpalkissa "Päivitä PC:ltä". Jos odottavia kirjauksia on, niiden määrä ja painike "Lähetä PC:lle".
- **Yhteenveto** ilmoituksena: "Yhdistetty: 8 uutta, 2 päivitettyä, 1 poistettu". Ristiriidat avautuvat listaksi.
- **Asetukset:** laitteen rooli, pilvikansion valinta (PC) sekä viimeisimmät synkronointi- ja lähetysajat.
- **Aikabudjetti:** puhelimen päivitys PC:ltä onnistuu alle 15 sekunnissa (painike → tiedosto → valmis).

### Ensikäynnistys

Enintään neljä näkymää, jotka voi ohittaa:

1. Profiili (nimi, syntymävuosi ja -kuukausi, koulun aloitus).
2. Viikkopohja (harrastukset ja koululiikunta).
3. Perusarvio (koulumatkat, välitunnit ja leikki; liukusäätimet arkipäivälle ja viikonlopulle).
4. Laitteen rooli (PC tai puhelin) ja kehotus asentaa sovellus kotinäytölle. Puhelimella voi valita "Tuo tiedot PC:ltä", jolloin vaiheet 1–3 ohitetaan.

## 13. MVP ja vaiheistus

MVP = vaiheet 1–6. Sen jälkeen sovellus vastaa alkuperäiseen tavoitteeseen: viikkopohja, kuittaus, arvio, jalkapallo ja suositusvertailu, eikä data katoa, ja tiedot kulkevat PC:n ja puhelimen välillä. Jokainen vaihe on itsenäisesti testattava ja käyttökelpoinen.

### MVP

1. **Perusta ja domain:** projektin pohja, PWA-asetukset, kaikki `domain/`-tyypit ja puhtaat funktiot (`computeSessionMinutes`, `recommendationGroup`, `dayTotals`, `validDays`, `evaluatePeriod`) testeineen, Dexie-skeema v1 synkronointikenttineen ja johdettuine tunnisteineen, siemenlajit ja profiilit.
2. **Kirjaus:** Viikko-näkymä, pikalisäys, kertojen muokkaus ja poisto, sairaus- ja matkapäivät.
3. **Viikkopohja ja kuittaus:** pohjan hallinta, `ensurePlanned`, kuittaus, ohitus syineen ja "Käy viikko läpi".
4. **Perusarvio ja suositusvertailu (viikko):** perusarvioiden hallinta, korvausperiaate, Viikko-näkymän yläkortti ja Analyysi-välilehden viikkonäkymä.
5. **Jalkapallo:** lisätietopaneeli, arvioasteikot, osallistuminen, peliaika ja jalkapallo-osio viikko- ja kuukausinäkymissä sekä Pelit ja tulokset -näkymä yhteenvetoineen.
6. **Varmuuskopio, synkronointi ja tietosuoja:** JSON-vienti ja -tuonti (tarkistussumma, transaktio, automaattinen varmuuskopio ennen tuontia), CSV-vienti, muistutusbanneri, PC ↔ puhelin -synkronointi (osio 10), `storage.persist`, poistotoiminnot ja ensikäynnistys.

### Myöhemmät vaiheet

7. **Pitkän aikavälin analytiikka:** kuukausi-, kausi- ja vuosinäkymät, monipuolisuus, ohjatun osuus ja trendit datan laatumerkinnöin.
8. **Taitotestit:** `SkillTest`-taulu, testikirjasto (omat testit) ja trendit ilman normeja.
9. **Kuormitus ja palautuminen:** valinnainen koettu rasitus (session-RPE, lapsille kuvallinen 0–10-asteikko), viikkokuorma, muutos 4 viikon keskiarvoon ja väsymysmerkintä. Ei riskitulkintoja.
10. **Raportit ja muistutukset:** kausiraportti PDF:nä ja sunnuntai-illan muistutus (Notifications API, jos laite tukee).
11. **Liikemittaridata:** mahdollinen tuonti (esim. CSV) omaksi kerroksekseen, joka syötetään päiväkoosteeseen korvausperiaatteella.
12. **Dexie Cloud** (valinnainen reaaliaikainen synkronointi, jos kirjaus molemmilla laitteilla yleistyy) ja kausien muokkaus.

### Ohje Claude Codelle

Vie tämä välilehti Markdownina tiedostoksi `SPEC.md` projektin juureen ja aloita näin:

```markdown
Lue SPEC.md kokonaan. Toteuta vain vaihe 1.
- Noudata osioiden 6 (tietomalli), 7 (laskentasäännöt) ja 10 (arkkitehtuuri) määrittelyjä tarkasti.
- Kirjoita domain-funktiot ensin ja testaa ne Vitestillä osion 14 kriteereillä A1–A16 ennen käyttöliittymää.
- Älä lisää riippuvuuksia, joita SPEC ei mainitse, kysymättä.
- Jos SPEC on ristiriitainen tai epäselvä, pysähdy ja kysy.
Kun vaihe on valmis, listaa mitä tehtiin, miten testaan sen puhelimella, ja odota ennen vaihetta 2.
```

## 14. Hyväksymiskriteerit

A- ja B-kriteerit ovat automaattisia testejä (Vitest; B-sarjassa `fake-indexeddb`). C-kriteerit testataan pääosin automaattisesti, D- ja E-kriteerit käsin puhelimella. F-kriteerit (synkronointi) ovat automaattisia F9:ää lukuun ottamatta.

### A. Laskenta (domain)

- [ ] **A1** Jalkapallotreeni 75 min, profiili 0,35/0,30/0,15, ponnistelu tavallinen → kevyt 26, reipas 23, rasittava 11.
- [ ] **A2** Sama, ponnistelu kovempi (e = 1,25) → kevyt 26, reipas 28, rasittava 14.
- [ ] **A3** Peli 90 min, pelattu 40 min, profiili 0,20/0,45/0,30 → kevyt 8, reipas 18, rasittava 12.
- [ ] **A4** Trampoliini 40 min, profiili 0,30/0,30/0,30, kovempi → kevyt 10, reipas 15, rasittava 15 (kevyt rajautuu osuuteen 0,25).
- [ ] **A5** Käsin syötetyt minuutit tallentuvat sellaisinaan; `intensitySource = 'manual'`, ei `sharesSnapshot`-arvoa.
- [ ] **A6** `school_age`, MVPA ma–su = 50, 70, 60, 80, 40, 65, 55 → keskiarvo 60,0, tila `met`, aktiivisia päiviä 4.
- [ ] **A7** Sama viikko, 40 min päivä merkitty sairaaksi → N = 6, keskiarvo 63,3, tila `met`.
- [ ] **A8** Kolme lihaksia vahvistavaa kertaa samana tiistaina, muina päivinä ei yhtään → lihaspäiviä 1.
- [ ] **A9** Rasittavat minuutit ma–su = 12, 9, 10, 0, 30, 5, 0, raja 10 → rasittavia päiviä 3, tila `met`.
- [ ] **A10** `early_years`: päivä 130/40/15 (kevyt/reipas/rasittava) → ei täyty (MVPA 55); päivä 120/45/20 → täyttyy (185 ja 65).
- [ ] **A11** `adult`, koko viikko: reipas 100 + rasittava 25 → W = 150, `met`; reipas 100 + rasittava 20 → W = 140, `near`.
- [ ] **A12** Ryhmä: syntynyt 2019/03, koulu alkaa 2026/08 → 15.7.2026 `early_years`, 1.8.2026 `school_age`. Syntynyt 2019/01 ilman koulun alkua → 1.2.2026 `school_age`. Syntynyt 2008/11 → 20.11.2026 `adult`.
- [ ] **A13** Korvausperiaate: välituntiarvio 60 min arkipäivälle, profiili 0,50/0,25/0,05. Keskiviikko ilman välituntikirjausta → +30/15/3. Torstaina kirjattu välituntikerta 40 min → torstain arvio ei ole käytössä.
- [ ] **A14** Arviosta tulevat rasittavat minuutit eivät tuota rasittavaa päivää eivätkä vahvistavaa päivää.
- [ ] **A15** Viikko, jossa on vain kolme avointa 90 min suunnitelmaa → kaikki liikuntaminuutit 0; suunnitelma vs. toteuma näyttää 3 kuittaamatonta.
- [ ] **A16** Kirjattu MVPA 200, yhdistetty 250 → arvion osuus 20 %.
- [ ] **A17** Pelit 3–1, 2–2, 0–1 sekä turnaus, jossa pelit 1–0 ja 0–3, ja yksi peli ilman tulosta → pelejä 6, V–T–H 2–1–2, maalit 6–7, maaliero −1.

### B. Tietokanta

- [ ] **B1** `ensurePlanned` kahdesti peräkkäin → suunnitelmien määrä ei kasva.
- [ ] **B2** Pohjan kesto muutetaan 90 → 75 min keskiviikkona → menneet ja kuitatut suunnitelmat pysyvät 90 min, avoimet tästä päivästä eteenpäin ovat 75 min.
- [ ] **B3** Kuittaus luo kerran suunnitellulla kestolla. Kun kerran kestoksi muutetaan 85 min, suunnitelma pysyy 90 min. Toinen kuittaus ei luo toista kertaa.
- [ ] **B4** Suunnitelmaan linkitetyn kerran poisto → suunnitelma palaa tilaan `open`, ja `FootballDetails` poistuu.
- [ ] **B5** Lajin tehoprofiilin muutos ei muuta olemassa olevien kertojen minuutteja. "Laske uudelleen alkaen X" muuttaa vain profiililla lasketut kerrat, joiden päivä ≥ X.
- [ ] **B6** Kuuden viikon tauon jälkeen `ensurePlanned` luo suunnitelmia enintään 14 päivää taaksepäin.
- [ ] **B7** Jokaiselle skeemaversiolle on fixture, ja migraatioketju vanhimmasta nykyiseen menee läpi (voimaan versiosta 2 alkaen).

### C. Varmuuskopio

- [ ] **C1** Vienti → kaikkien tietojen tyhjennys → tuonti → kaikki taulut ovat sisällöltään samat kuin ennen.
- [ ] **C2** Viety tiedosto, jonka yhtä lukua on muutettu käsin → tuonti hylätään tarkistussumman takia, eikä tietokanta muutu.
- [ ] **C3** Tuonnin aikana simuloitu virhe → tietokanta pysyy ennallaan.
- [ ] **C4** Ennen tuontia syntyy automaattinen varmuuskopio nykytilasta.
- [ ] **C5** CSV aukeaa suomenkielisessä Excelissä oikein sarakkeisiin, ja ä- ja ö-kirjaimet näkyvät oikein.

### D. Käytettävyys (käsin)

- [ ] **D1** Uusi kerta viimeksi käytetyllä lajilla vaatii 4 napautusta (+ → laji → kesto → Tallenna).
- [ ] **D2** Seitsemän suunnitellun kerran läpikäynti onnistuu alle 60 sekunnissa.
- [ ] **D3** Jalkapallon lisätietopaneelin voi ohittaa, ja kerta on silti tallessa.
- [ ] **D4** Jokainen tehomallista laskettu luku on käyttöliittymässä merkitty arvioksi.
- [ ] **D5** Kaikki näkymät toimivat 375 px leveydellä ilman vaakavieritystä.

### E. Offline ja tietosuoja

- [ ] **E1** Asennettu sovellus toimii lentotilassa kaikilta osin.
- [ ] **E2** Tuotantoversio ei tee verkkokutsuja muualle kuin omiin staattisiin tiedostoihinsa (DevTools Network ja CSP `default-src 'self'`).
- [ ] **E3** Profiilissa ei ole sukupuoli-, paino- eikä pituuskenttää; syntymästä tallentuu vain vuosi ja kuukausi. Vapaaehtoinen kuva tallentuu vain pienennettynä (≤ 256 px) eikä poistu laitteelta muuten kuin käyttäjän omissa tiedostoissa.
- [ ] **E4** "Tyhjennä kaikki tiedot" tyhjentää kaikki taulut.

### F. Synkronointi

- [ ] **F1** PC ja puhelin ajavat offline-tilassa `ensurePlanned`-funktion samalle viikolle (sama pohja, 3 riviä) → yhdistämisen jälkeen suunnitelmia on 3, ei 6.
- [ ] **F2** Samaa kertaa muokataan: PC asettaa kestoksi 80 min klo 10.00 ja puhelin 85 min klo 10.05 → yhdistämisen jälkeen molemmissa 85 min, ja yhteenveto näyttää 1 ristiriidan.
- [ ] **F3** PC poistaa kerran ja puhelin tuo PC:n tiedoston → kerta on piilossa myös puhelimessa, eikä puhelimen seuraava lähetys palauta sitä PC:lle.
- [ ] **F4** Puhelimella kirjataan 2 kertaa, ja ennen lähetystä tehdään "Päivitä PC:ltä" → kirjaukset säilyvät, ja näkyvissä on "2 odottaa siirtoa PC:lle".
- [ ] **F5** Saman tiedoston tuonti kahdesti → toisella kerralla 0 uutta, 0 päivitettyä ja 0 poistettua.
- [ ] **F6** Sisäänrakennetuilla lajeilla on samat tunnisteet molemmilla laitteilla, eikä yhdistäminen luo kaksoislajeja.
- [ ] **F7** Uudemman skeemaversion tiedosto hylätään viestillä "Päivitä sovellus tällä laitteella ensin", eikä data muutu.
- [ ] **F8** Yhdistämisen aikana simuloitu virhe → tietokanta pysyy ennallaan.
- [ ] **F9** (käsin) PC:n Chromessa tai Edgessä "Synkronoi" lukee puhelimen tiedoston, yhdistää ja kirjoittaa PC:n tiedoston yhdellä painalluksella.
- [ ] **F10** Sama suunnitelma kuitataan molemmilla laitteilla → yhdistämisen jälkeen kertoja on yksi (`s:<plannedSessionId>`).

## 15. Lähteet

Kaikki tarkistettu 11.11.2026.

| Lähde | Käyttö SPECissä |
| --- | --- |
| [Liikkumissuositus 7–17-vuotiaille lapsille ja nuorille, OKM 2021:50](https://ukkinstituutti.fi/wp-content/uploads/2022/03/OKM_2021_50.pdf) | 60 min keskiarvona, rasittava ja vahvistava ≥ 3 pv/vko, tehojen määritelmät, esimerkkiharjoitus (40 min reipasta / 90 min) |
| [Valtioneuvosto: Uusi lasten ja nuorten liikkumissuositus (7.4.2021)](https://valtioneuvosto.fi/-/1410845/uusi-lasten-ja-nuorten-liikkumissuositus-monipuolista-reipasta-ja-rasittavaa-liikkumista-vahintaan-tunti-paivassa) | Suosituksen ydinviesti |
| [UKK-instituutti: Liiku kaiken ikäisenä (mukaellen OKM 2016 ja 2021)](https://ukkinstituutti.fi/wp-content/uploads/2024/04/LiikuKaikenIkaisena-web-1.pdf) | Alle kouluikäisten 3 h / 1 h vauhdikasta, aikuisten määrät, tehojen puhetesti |
| [UKK-instituutti: Viikoittainen liikkumisen suositus 18–64-vuotiaille, diasarja](https://ukkinstituutti.fi/wp-content/uploads/2022/04/Diat-ryhmatoteutukseen-aikuiset-taydennetty.pdf) | Rasittavan liikunnan kerroin 2, lihaskunto ja liikehallinta 2 krt/vko |
| [Liikunta & Tiede 3/2021: Uusi suositus lapsille ja nuorille](https://www.lts.fi/liikunta-tiede/artikkelit/uusi-suositus-lapsille-ja-nuorille-tunti-paivassa-liikkumista.html) | Varhaisvuosien suositus (2016) voimassa alle kouluikäisille |
| [UKK-instituutti: Liikkumissuositusten toteutumisen arviointi tarkentuu (13.7.2026)](https://www.sttinfo.fi/tiedote/72163235/lasten-ja-nuorten-liikkumissuositusten-toteutumisen-arviointi-tarkentuu?lang=fi) | Keskiarvo, päivittäinen ja PAD-menetelmä |
| Iloa, leikkiä ja yhdessä tekemistä – Varhaisvuosien fyysisen aktiivisuuden suositukset, OKM 2016:21 | Alle kouluikäisten suosituksen alkuperäinen julkaisu (luvut UKK:n tiivistelmän kautta) |
| [Jayanthi ym. 2015, Am J Sports Med 43(4): Sports-specialized intensive training and the risk of injury in young athletes](https://europepmc.org/article/MED/25646361) (tiivistelmä tarkistettu 24.11.2026) | Viikon huomiot, vaihe 2: ohjatun urheilun viikkotunnit suhteessa ikään (tapaus-verrokkitutkimus, 7–18 v) |
| [AAP: Preventing Overuse Injuries in Young Athletes: AAP Policy Explained (Brenner & Watson, HealthyChildren.org)](https://www.healthychildren.org/English/health-issues/injuries-emergencies/sports-injuries/Pages/Preventing-Overuse-Injuries.aspx), tiivistelmä raportista Overuse Injuries, Overtraining, and Burnout in Young Athletes (Pediatrics 2024, doi 10.1542/peds.2023-065129); tarkistettu 24.11.2026 | Viikon huomiot, vaihe 2: enintään 5–6 harjoitus- tai pelipäivää viikossa, viikkokuorman lisäys enintään 10–20 %, 2–3 kk vuodessa taukoa samasta lajista, lajien vaihtelu |

## 16. Lisäykset käyttöönoton jälkeen (12.11.2026)

Käyttäjän pyynnöstä MVP:n jälkeen toteutetut muutokset. Tietomalli on nyt **skeemaversio 2** (`migrateV1ToV2`: uudet taulut, olemassa oleva data ei muutu; fixture `src/domain/fixtures/backup-v1.json`, B7).

- **Pelit-välilehti** (Viikko · Pelit · Analyysi · Asetukset): pelikalenteri, tulosta odottavat pelit, tulokset ja analyysi sekä omat joukkueet.
- **`teams`** (synkronoituva): oma joukkue `{ id, profileId, name, archived }` (myöhemmin myös pelimuoto, peliaika-arvio ja kuva; vanha `level` ks. alla).
- **`fixtures`** (synkronoituva, avain `plannedSessionId`): tulevan pelin tai turnauksen tiedot (joukkue, vastustaja, turnauksen nimi, pelien määrä, paikka, taso). Tuleva peli on käsin lisätty `PlannedSession` (laji peli tai turnaus), joten se näkyy viikolla ja kuitataan kuten muutkin suunnitelmat; kuittaus esitäyttää `FootballDetails`-tiedot.
- **Taso** `GameLevel` = Elite / Kilpa / Haaste tapahtumakohtaisesti (peli tai turnaus; joukkueen sarjataso poistettiin 13.11.2026, ks. alla). Taso säätää ponnistelun pelin tehoprofiiliin: Elite = kovempi, Kilpa = tavallinen, Haaste = kevyempi (sovelluksen oma tulkinta). `FootballDetails` saa kentät `teamId` ja `level`.
- **Uusi laji** `football_self` "Jalkapallo – omatoiminen": kevyt 50 / reipas 35 / rasittava 5 %, kategoria omaehtoinen, lasketaan jalkapallon harjoitusmäärään.
- **Tuonti** tunnistaa tiedoston sisällöstä: varmuuskopion tuontiin valittu synkronointitiedosto yhdistetään, ja "Päivitä PC:ltä" hyväksyy myös varmuuskopion. Puhelimella vienti käyttää jakovalikkoa ("Tallenna Tiedostoihin").
- **Suunnitelman muutos tälle kerralle** (kesto, kellonaika) myös etukäteen: `PlannedSession.overridden = true`, eikä viikkopohjan muokkaus palauta alkuperäistä. Kuittauksessa kestopikavalinnat (esim. 120 suunniteltu → "Tehty 60"); suunnitelman kesto säilyy vertailua varten.
- **Jalkapallo-välilehti** (aiemmin Pelit): Päiväkirja · Kalenteri · Tulokset · Joukkueet. Päiväkirja kokoaa kaikki jalkapallokerrat kuukausittain; kommentti (`FootballDetails.ratingNote`, rivinvaihdot säilyvät, enintään 1000 merkkiä) lisätään suoraan listasta, ja listaa voi hakea ja suodattaa (treenit / pelit / vain kommentoidut).
- **Turnauksen otteluohjelma:** `Fixture.games` = `{ time?, opponent?, location? }[]`; kuittaus luo niistä `FootballDetails.games`-rivit, joihin kirjataan tulos ja pelikohtainen kommentti (`GameResult.note`, myös `time` ja `location` säilyvät). Pelimäärä = rivien määrä.
- **Alkamispäivät:** perusarvion voi aloittaa menneestä päivästä, ja voimassa olevan arvion voi korjata koko voimassaoloajalle alkamispäivää myöten (aiemmat saman kategorian arviot väistyvät). Profiilin `trackingStart` (valinnainen) korvaa luontipäivän seurannan alkuna (7.2).
- **Kuvat:** `Profile.photo` ja `Team.photo` (valinnainen JPEG data URL, rajattu neliöksi ~256 px). Synkronoituvat ja kuuluvat varmuuskopioon; CSP sallii `img-src data:`.
- **Pikalisäys:** jalkapallon lajit (treeni, omatoiminen, peli, turnaus) näkyvät omana ryhmänään ennen muita lajeja.
- **Pelaajan tiedot peleistä:** `FootballDetails.playerGoals` (oman lapsen maalit; turnauksessa pelirivien `GameResult.playerGoals` summa), `positions` (maalivahti / puolustus / keskikenttä / hyökkäys, useita) ja `format` (3v3, 5v5, 7v7, 8v8, 9v9, 11v11). Pelimuodon oletus tulee joukkueelta (`Team.format`), ja tapahtuma voi ohittaa sen (`Fixture.format`). Tuloksissa yhteenvedot pelimuodoittain ja pelipaikoittain; CSV saa sarakkeet Omat maalit, Pelimuoto ja Pelipaikka.
- **Liikuntaa viikossa -mittari** (kouluikäiset): toteuman kokonaiskesto luokitellaan käyttäjän taulukolla: alle 7 h alle suosituksen, 7–10 h suosituksen mukainen, 10–12 h aktiivinen, 12–15 h erittäin aktiivinen, 15–20 h paljon liikuntaa, 20+ h erittäin suuri liikuntamäärä (`HOURS_BANDS`, raja kuuluu ylempään luokkaan). Viikon arvio näytetään merkkinä. Luokitus on kestoon perustuva lisänäkymä, eikä se muuta reippaan ja rasittavan suositusvertailua.
- **PC-asettelu:** sisällöllä ei ole enimmäisleveyttä; erittäin leveällä näytöllä (≥ 1536 px) Viikko-näkymässä on kolme saraketta (päivät · tilanne ja tavoitteet · mittari ja tunnit), Analyysissä kolme saraketta ja Tuloksissa yhteenvedot ja pelilista rinnakkain. Asetukset avaavat PC:llä suoraan ensimmäisen ryhmän.
- **Kellonajat 24 h:** selaimen `<input type="time">` näytti laitteen kieliasetuksen mukaan AM/PM-muodon, joten kellonaika valitaan omalla 24 h -valitsimella (tunnit 00–23, minuutit 5 min välein; aiempi poikkeava minuutti säilyy).
- **Visuaalinen uudistus (design system):** värit, pinnat, varjot, pyöristykset ja liike keskitetysti tokeneina (`src/index.css`): luonnonvalkoinen #F6F5F0, salvia #DCE8DC, metsänvihreä #244C3B, hiekka #DDA96E, hiilenharmaa #26342E, oma tumma tila. Fontit Manrope (teksti) ja Fraunces (otsikot ja tilastoluvut) sovelluksen mukana (`@fontsource-variable`, vain latin-osajoukko, ei verkkoliikennettä). Etusivu: sankarikortti edistymisrenkaalla, päiväkaavio, viikon rytmi (rasittava/lihas/luusto), tulevat ja viimeisimmät kerrat. Liike CSS:llä (porrastettu sisääntulo, renkaat, palkit, numerolaskuri, näkymänvaihto; 24.11.2026 alkaen ilman View Transitions -kuvia, ks. versio 1.1.48) ja `prefers-reduced-motion` poistaa animaatiot. Laskenta, tietomalli ja tallennus ennallaan.
- **Kokonaisliikunta näkyviin:** viikon tunnit ovat kokonaiskesto (myös kevyt). Pääkortissa "Liikuntaa yhteensä" ja siitä reippaan ja rasittavan osuus, päiväkorteissa päivän kokonaiskesto, päiväkaaviossa valinta "Reipas + rasittava / Kaikki liikunta". Tehomallin luvut merkitään sanalla "arvio", ja päivän "+N min" saa selitteen (perusarvio).
- **Väriteemat** (Asetukset → Ulkoasu, laitekohtainen): Metsä (oletus), Vuono, Kanerva, Grafiitti; jokaisella oma vaalea ja tumma versio, ja kaaviovärit on validoitu jokaiselle.
- **Analyysi:** kaksi palstaa (suositusvertailu, päiväkaavio ja tunnit · liikuntamäärä, kohokohdat ja jalkapallo), latausaikana luuranko, osa esiladataan. Uusi **Kohokohdat**-kortti viikolta, kuukaudelta tai kaudelta: kommentit (kerran muistiinpano, päiväkirja, turnauksen pelit), vanhemman tähtiarvioiden keskiarvo ja jakauma, yleisarvio (≥ 3,5 tavallista parempi, ≤ 2,5 tavallista heikompi, muuten tavallinen oma taso), suunta edelliseen jaksoon, viihtyminen, harjoitellut asiat ja omat maalit (`domain/highlights.ts`).
- **Mobiili:** etusivun ruudukon sarake ei enää veny sisällön levyiseksi (puhelin ei loitonna näkymää); +-painike väistyy vierityksen ajaksi.
- **Mobiilikorjaukset:** paneelit piirretään suoraan sivun päälle (portaali), joten alapalkki ei peitä niiden painikkeita; taustan vieritys lukitaan iPhonella toimivalla tavalla (body kiinnitetään paikalleen ja vierityskohta palautuu); kosketuslaitteilla lomakekenttien fontti vähintään 16 px (iOS ei zoomaa); +-painike, ilmoitukset ja sisällön alareuna huomioivat kotipalkin (safe area); pienet kosketuskohteet suurennettu.
- **Pienennettävät kortit** (Liikuntaa viikossa, Viikon liikuntatunnit, Tulevat kerrat, Viimeisimmät kirjaukset, Tarkemmat luvut), tila muistetaan laitteella. "Viikon liikuntatunnit" (arvio ja toteuma, kaikki liikunta kestona) on "Liikuntaa viikossa" -kortin alla; "Tarkemmat luvut" sisältää suositusvertailun.
- **Päiväkortti:** päivän kokonaisminuutit (kaikki liikunta) reippaan ja rasittavan mittarin yläpuolella, molemmissa selite.
- **Suunnitellun kerran poisto kokonaan** (`deletePlanned`, kumottavissa `restorePlanned`): kerta ei näy viikolla eikä toteutumassa; poistomerkintä saa `overridden`-tiedon, jotta viikkopohjan muokkaus ei luo sitä uudelleen; pelikalenterin tiedot poistuvat mukana. Kuitattua ei poisteta. Oletus on edelleen "Ei tehty".
- **Arvio koko viikolle (ennuste):** toteutunut + avoimet suunnitellut kerrat (tulevat ja kuittaamattomat) + arkiliikunnan arvio tulevina päivinä; "Ei tehty" ja poistetut putoavat pois, suunnittelemattomat kirjaukset tulevat mukaan (`WeeklyHours.forecast`). Viikkopohjan suunnitelma näkyy vertailuna.
- **Takautuvat kerrat:** viikkorytmin rivillä "Luo myös menneet kerrat" (alkupäivästä eiliseen, enintään 12 vk) kuitattaviksi.
- **Selitteet** termeille rasittava päivä, lihaksia vahvistava, luustoa vahvistava, reipas ja rasittava, arkiliikunta ja liikuntaa yhteensä (`ui/glossary.tsx`), hiirellä tai napautuksella.
- **Arkiliikunta kaavioissa:** päiväkohtaisesti vahvistettu arkiliikunta näkyy kaavioissa omana osanaan (täysi oranssi "Arkiliikunta"), vahvistamaton arvio samalla sävyllä vinoviivoitettuna ("Arkiliikunta (arvio)"), kerrat sinisenä ("Kerrat"). Tekstuuri erottaa arvion vahvistetusta (saman sävyn kaksi askelta ei läpäise palettitarkistusta). DayTotals.confirmedMvpa ja DayHours.confirmedMin. Tulevilla päivillä kaaviot näyttävät arkiliikunnan arvion (vinoviivoitus, himmeämpi) ja avoimet suunnitellut kerrat katkoviivalla ("Suunniteltu"): Kaikki liikunta -näkymässä koko kesto, Reipas + rasittava -näkymässä lajin tehoprofiilin mukainen reipas ja rasittava osuus (DayHours.openPlanMvpa, tavallinen ponnistelu). Ennuste ei sisälly suositusvertailun lukuihin. Päiväkaavion otsikko on vakiokokoinen: valitun päivän lukema ei purista näkymänappeja, ja arkiliikunnan erittely on omalla kiinteän korkuisella rivillään, joten kaavio ei hypi päivää tai näkymää vaihdettaessa.
- **Viikon liikuntatunnit selkeämmäksi:** kortissa vain toteutunut ja arvio koko viikolle, yksi palkki (kerrat, arkiliikunta, tulossa) arvoineen ja "% arviosta toteutunut · tulossa …"; laskentatapa selitteessä. Erittely (päivät, lajit, viikkopohja, tehomalli) on oma korttinsa "Tunnit päivittäin ja lajeittain": Viikossa oletuksena piilossa, Analyysissa näkyvissä.
- **Päivät taulukkona:** Päivät-otsikon vaihtokytkin Kortit / Taulukko (laitekohtainen, localStorage daysView). Taulukossa rivi per päivä: kerrat ja suunnitelmat pieninä nappeina (napautus avaa muokkauksen/suunnitelman), arkiliikunta "☀️ Arki" katkoviivalla (arvio / ✓), päivän kokonaisminuutit ja reipas+rasittava (+arvio); alarivillä viikon summat. Päivän nimestä päivän toiminnot. Pikatoiminnot: + (kirjaa kerta päivälle), ✓ suunnitelmalle (tehty kuten suunniteltu, menneet ja tämä päivä) ja ✓ arkiliikunnalle (vahvista arvio sellaisenaan, kumottavissa). Päivän alla suositusmerkit (rasittava, lihaksia ja luustoa vahvistava; ryhmän mukaan) ja alarivillä viikon n/tavoite. Reipas+-luvun alla palkki päivän tavoitteesta. Tulevilla päivillä Min-sarakkeessa ennuste (~), sairas- ja matkapäivät himmeinä. PC:llä valittavat lisäsarakkeet (kevyt/reipas/rasittava, jalkapallo: tulos, V–T–H, peliaika, omat maalit; kommentit), laitekohtainen dayTableCols; kapeassa palstassa taulukko vierii sivuttain. Summien yksikkö minuutit/tunnit (minuteUnit) koskee taulukon Min-saraketta, summarivejä ja Päivät-otsikon kestoa. Taulukkoon vaihdettaessa tämän päivän rivi vieritetään näkyviin.
- **Oletusulkoasu:** vaalea teema ja Vuono-väriteema; paneelien ohut vierityspalkki pyöristetyn paneelin sisällä, otsikko pysyy paikallaan.
- **Muokattava Viikko-näkymä:** "Muokkaa näkymää" (Kattava näkymä): kortit (Viikon tilanne, Päivittäinen kaavio, Viikon rytmi, Liikuntaa viikossa, Viikon liikuntatunnit, Tulevat kerrat, Päivät, Viimeisimmät kirjaukset, Tarkemmat luvut) piiloon/näkyviin ja järjestykseen; PC:llä lisäksi pää- tai sivupalsta. Päivät aina näkyvissä. Laitekohtainen (localStorage weekLayout); sama muokkauspaneeli kuin Analyysissa.
- **Arkiliikunta päivätasolla:** päiväkortissa oma "Arkiliikunta (arvio)" -rivi; vanhempi voi vahvistaa arvion, muuttaa minuutteja tai merkitä "Ei tänä päivänä" (0 min). Valinta tallentuu saman kategorian kirjauksena, jolloin korvausperiaatteen mukaan perusarviota ei sille päivälle käytetä. Päivän otsikossa "josta arvio N". Rivi näkyy katkoviivoin jokaisella päivällä (myös tulevilla, joilla arvio on mukana ennusteessa); tarkistus tehdään kyseisenä päivänä tai jälkikäteen. Vahvistettu arkiliikunta (kirjaus merkinnällä estimateConfirmed) jää riville näkyviin ("vahvistettu", esim. "välitunnit 30 min ✓") eikä näy erillisenä kertana; sen voi muuttaa, merkitä 0 min tai palauttaa arvioksi.
- **Tarkenne** (`label`, enintään 40 merkkiä) kerroille, viikkorytmin riveille ja niistä syntyville suunnitelmille (esim. Joukkuetreeni, Talenttitreeni, Taitokoulu, Futsal); aiemmat tarkenteet ehdotuksina.
- **Näkymä** (Asetukset → Ulkoasu): Kattava tai Yksinkertainen (Viikko: vain tilanne ja päivät).
- **Jalkapallo:** selkeä "Lisää kalenteriin" -osio (Tuleva peli / Tuleva turnaus selitteineen).
- **Analyysi muokattavissa:** käyttäjä valitsee näkyvät kortit ja järjestyksen (laitekohtainen); palstat täyttyvät ylhäältä alas.
- **Välilehdet** pysyvät muistissa ja siirtymä koskee vain sisältöaluetta.
- **Työpöytätila** (Asetukset → Laitteet ja varmuuskopio, laitekohtainen localStorage `desktop`): sovellus pidetään auki omassa ikkunassaan (asennettu PWA, myös pienennettynä). Ei palvelinta eikä verkkoliikennettä; suljettuna ilmoituksia ei tule. Ei uusia riippuvuuksia.
  - **Kuittaamattomat** (`domain/reminders.ts`): avoimet kerrat menneiltä päiviltä sekä tämän päivän kerrat, joiden päättymisaika (alku + kesto) on ohi; ilman kellonaikaa tämän päivän kerta vasta seuraavana päivänä. Sama määrä näkyy "Käy viikko läpi" -painikkeessa ja -paneelissa.
  - **Merkki** (oletus päällä): kuittaamattomien määrä sovelluskuvakkeessa (Badging API, asennettuna) ja välilehden otsikossa "(N) Liikkumisen seuranta".
  - **Ilmoitukset** (oletus pois, vaatii selaimen luvan): "Kerta päättyi" (kellonajalliset kerrat, jotka päättyvät sovelluksen ollessa auki) ja iltamuistutus kerran päivässä valittuna kellonaikana (oletus 20.00), jos kertoja on kuittaamatta tai tämän päivän arkiliikunta tarkistamatta. Klikkaus tuo sovelluksen eteen, valitsee profiilin, palaa kuluvaan viikkoon ja avaa tarvittaessa "Käy viikko läpi". "Kokeile ilmoitusta" -painike.
  - **Automaattinen synkronointi** (PC, oletus päällä): käynnistyessä, 5 min välein ja ikkunaan palatessa; vain jo annetulla kansion käyttöluvalla (ei kysy lupaa eikä kansiota). Puhelimen tallentama liikkuminen.json yhdistetään, ja tiedosto kirjoitetaan vain, jos jotain tuli tai PC:llä on muutoksia edellisen synkronoinnin jälkeen. Tuodusta tiedosta ilmoitus (ristiriidat "Näytä").
  - **Asennus:** "Asenna sovellus" -painike, kun selain tarjoaa asennuskehotteen; ohjeet tehtäväpalkkiin kiinnittämiseen ja käynnistykseen kirjauduttaessa (Edge: edge://apps).
- **Odottaa siirtoa PC:lle -luku tarkentuu tuonnissa:** kun puhelin tuo toisen laitteen synkronointitiedoston ("Päivitä PC:ltä"), puhelimen odottavat muutokset, jotka tiedostossa jo ovat (sama tai uudempi versio tai sama sisältö eri aikaleimoin, esim. molemmilla laitteilla luotu sama viikkorytmin kerta), kuitataan siirretyiksi: lastSentAt siirtyy eteenpäin enintään vanhimpaan muutokseen asti, jota toisella laitteella ei vielä ole. Yhdistämissääntö ei muutu.
- **Synkronoinnin tarkennukset (13.11.2026):** (1) Molemmilla laitteilla poistettu tietue kuitataan siirretyksi, vaikka poistoajat eroavat (esim. käynnistyksen välituntisiivous ajettu kummallakin laitteella). (2) Viikkorytmistä automaattisesti luotu kerta (`ensurePlanned`) saa aikaleiman ja tekijän pohjarivin versiosta, ei luontihetkestä: kumpikin laite tuottaa saman tietueen, luonti ei näy "odottaa siirtoa" -luvussa eikä voita toisella laitteella tehtyä muokkausta tai poistoa samaan kertaan. Pohjarivin muokkaus (`regenerateItem`) ja takautuvat kerrat leimataan edelleen muokkaushetkellä. (3) PC:n automaattinen synkronointi tarkistaa minuutin välein (aiemmin 5 min), ikkunan saadessa fokuksen sekä ikkunasta poistuttaessa; tiedosto kirjoitetaan vain, jos jotain muuttui. (4) Puhelimen "Päivitä PC:ltä" kertoo, milloin PC tallensi tiedoston ("PC tallensi tiedoston tänään klo 9.41"); jos tiedosto on sama kuin edellisellä tuonnilla eikä mitään muuttunut, viesti on "Ei uutta: tiedosto on sama kuin edellisellä kerralla…" ja ohjeena odottaa, että tiedosto ehtii päivittyä pilvikansioon. (5) Kuittaus on tietuekohtainen: lastSentAt siirtyy enintään vanhimpaan puuttuvaan asti, ja sen jälkeiset jo perillä olevat muutokset muistetaan laitekohtaisesti (meta `deliveredKeys`: taulu, avain ja versio; tyhjennetään "Lähetä PC:lle" -toiminnossa), joten yksi puuttuva muutos ei pidä myöhempiä odottamassa. Perillä on myös poisto tietueesta, jota toisella laitteella ei ole koskaan ollut (esim. puhelimen luoma ja käynnistyksen siivouksessa heti poistama kerta). (6) "N odottaa siirtoa PC:lle" -tekstin napautus avaa erittelyn (`PendingSheet`): tietuetyyppi, kuvaus (laji, nimi tai vastustaja, päivä), tila (uusi / muutettu / poistettu) ja muutosaika. Lisäksi näkyy, millainen sama tietue oli viimeksi tuodussa toisen laitteen tiedostossa ("PC:n tiedostossa: avoin / kuitattu / ohitettu / poistettu / eri versio / ei ole", muutosaika; laitekohtainen meta `pendingThere`). (8) **Kuitattu voittaa poiston:** suunnitelman kuitattu (done) versio voittaa yhdistämisessä avoimena poistetun version aikaleimoista riippumatta (kuitattua kertaa ei voi poistaa, joten poisto on tehty tietämättä kuittauksesta; profiilin poiston merkinnöissä ei ole tilaa, joten ne poistavat edelleen). (9) Välituntisiivouksen muutokset (kerta vahvistukseksi, avoimen kerran poisto) saavat johdetun aikaleiman (tietueen oma versio + 1 ms), joten siivous ei kumoa toisella laitteella myöhemmin tehtyä muokkausta eikä näy odottavana. (7) Välituntisiivous (`foldEstimateOnlySessions`) ajetaan käynnistyksen lisäksi jokaisen yhdistämisen jälkeen (PC:n Synkronoi ja automaattinen synkronointi, puhelimen Päivitä PC:ltä, tiedoston tuonti asetuksista), koska toisen laitteen tiedosto voi tuoda avoimen välituntikerran tai -rivin, jonka tämä laite on jo siivonnut.
- **Uudet ominaisuudet (käyttäjän valinnat 13.11.2026):**
  - **Viime viikko lyhyesti** (`features/week/LastWeekCard`, `domain/weekDigest`): tämän viikon näkymässä edellisen viikon kooste, kunnes käyttäjä sulkee sen (laitekohtainen localStorage `lastWeekSeen` profiileittain): suosituksen tila, pääluku isona, sekä isot ruudut liikuntaa yhteensä, jalkapallon treenit, pelit V–T–H ja pelaajan maalit (kertojen määrä ja kommentti poistettiin selkeyden vuoksi 13.11.2026). "Avaa viime viikko" siirtyy viikolle. Ei näy, jos viime viikolla ei ole kirjauksia tai viikko on ennen seurannan alkua. **Uusi ulkoasu (käyttäjän palaute 13.11.2026):** tiivis nauha ilman isoja harmaita laatikoita – pääluku ja tila, muutos edelliseen viikkoon (↑/↓), viikon päivät minipylväinä (reipas ja rasittava, katkoviiva = päivän tavoite, tavoitteen ylittäneet päivät korostusvärillä) ja poiminta "N/7 päivää tavoitteessa · paras päivä", sekä rivi tunnuslukuja (liikuntaa, treenit, pelit V–T–H, pelaajan maalit; ilman jalkapalloa rasittavat päivät ja lihas · luusto). "Avaa viikko ›" ja ✕ otsikkorivillä. **Sulkeminen synkronoituu:** ✕ tai "Avaa viikko" tallentaa viikon profiiliin (`Profile.digestSeenWeek`, vain uudempi viikko), joten kooste ei palaa toisella laitteella eikä tyhjentyneen selaimen muistin jälkeen (vanha laitekohtainen `lastWeekSeen` luetaan edelleen). Yhdistämisessä kenttä on "pehmeä" (`SOFT_FIELDS`): jos profiilin versiot eroavat vain siinä, ristiriitaa ei näytetä ja suurempi viikko säilyy.
  - **Vastustajan historia pelikalenterissa** (`opponentHistory` `domain/opponentLibrary`, `features/games/OpponentHistory`): tulevan pelin lomakkeessa vastustajan alla "Aiemmat kohtaamiset" (logo, pelit, V–T–H, maalit, pelaajan maalit; 5 viimeisintä peliä tuloksineen ja kommentteineen) ja saman seuran muut ryhmät erikseen (3 viimeisintä). Sama ryhmä = seura ja ryhmä samat, ikäluokka sama tai toisesta puuttuu. Kalenterin rivillä tiivistelmä "Aiemmin N peliä · V–T–H … · viimeksi 0–2", turnauksen otteluohjelmassa pelikohtaisesti.
  - **Pelipaikat ja peliaika kausittain** (`playSummary` `domain/football`; Jalkapallo → Tulokset, kortti "Pelipaikat ja peliaika", suodattimet koskevat myös sitä): kausittain (uusin ensin) pelipaikkojen jakauma (peli lasketaan jokaiselle merkitylle paikalle; osuus pelipaikan merkinneistä peleistä) yhden värin palkkeina ja suorina arvoina sekä peliaikaosuus = kentällä / pelin pituus (tarkat minuutit, "Koko pelin" = 100 %, "Ei pelannut" = 0 %; "Osan" ilman minuutteja ei ole osuudessa) ja montako peliä osuus kattaa. Pelin pituus: peli = kesto − lämmittely, turnaus = otteluohjelman pelin pituus (`GameRow.gameMin`, `GameRow.played`). Aiempi "Pelipaikka"-kortti on nyt "Tulokset pelipaikoittain".
  - **Automaattinen varmuuskopio (PC)** (`features/sync/autoBackup`): kun PC:llä on synkronointikansio, automaattinen ja käsin tehty synkronointi kirjoittaa kerran viikossa (edellisestä ≥ 7 vrk) täyden varmuuskopion kansion alikansioon `varmuuskopiot` nimellä `liikkumisseuranta-varmuuskopio-VVVV-KK-PP.json`; 8 uusinta säilytetään ja vanhemmat sovelluksen nimeämät poistetaan (muihin tiedostoihin ei kosketa). Onnistunut varmuuskopio päivittää `lastExportAt`-ajan (varmuuskopiomuistutus). Ajankohta `autoBackupAt` on laitekohtainen meta, jota ei tuoda varmuuskopiosta eikä synkronoida. Asetukset → Tiedot näyttää viimeisimmän ajan. Epäonnistuminen ei estä synkronointia.
  - **Lomajaksot** (`domain/holidays`, Asetukset → Arkiliikunta → Lomajaksot): nimetyt jaksot (alku–loppu mukaan luettuina, enintään 120 pv; nimiehdotukset syys-, joulu-, talvi-, pääsiäis- ja kesäloma), oletuksena kaikille profiileille tai rajattuna valittuihin (`profileIds`). Tallentuvat synkronoituvaan asetusriviin (`Settings.holidays`, ei skeemamuutosta). Lomapäivänä arkipäivän perusarvio lasketaan viikonlopun arvoilla (`estimateBaseMin`; päiväkooste, viikon tunnit, ennuste, arkiliikunnan tarkistus). Avoimet koululiikuntasuunnitelmat (kategoria school_pe) lomapäiviltä ohitetaan syyllä "Loma" (`SkipReason` holiday) automaattisesti: tallennettaessa, uusia suunnitelmia luotaessa, käynnistyksessä ja synkronoinnin jälkeen (`applyHolidaySkips`); jakson poisto tai lyhennys avaa lomalla ohitetut uudelleen. Treenit ja muut kerrat säilyvät. Muutoksen aikaleima ja tekijä johdetaan asetusrivistä (uudempi + 1 ms), jolloin laitteet tuottavat saman tietueen. "Loma" ei ole toteutumisasteen nimittäjässä (kuten "Peruttu"), lomalla ohitettu suunnitelma ei ole viikon arviossa, eikä syytä valita käsin. Viikkonäkymän päivärivillä merkki "Loma". Tuntematon ohitussyy (uudemman version tiedostosta) luetaan muotoon "Muu".
  - **Turnauspäivän pikakirjaus** (`features/games/TournamentDay`, `repo.recordTournamentGame`): Viikko-näkymän yläosassa turnauspäivänä (tämän päivän turnaussuunnitelma tai kirjattu turnaus) kortti "Turnauspäivä · pikakirjaus". Pelit otteluohjelmasta (aika, kenttä, vastustaja logoineen ja aiempien kohtaamisten rivi), muuten pelien määrän mukaan; "+ Lisää peli" lisää rivin. Pelille isot − / + -valitsimet omille ja vastustajan maaleille sekä oman pelaajan maaleille ja valinta Ei pelannut / Osan / Koko pelin; vastustajan voi antaa, jos ohjelmassa ei ole. Ensimmäinen tallennettu tulos kuittaa turnauksen (kuten kuittaus: pelirivit ohjelmasta, joukkue, taso), ilmoituksessa Kumoa; myöhemmät päivittävät saman kirjauksen pelirivin, ja muut lisätiedot (arviot, kommentit) säilyvät. Pelatut minuutit ja oman pelaajan maalit lasketaan pelirivien mukaan kuten lomakkeessa. Tallennuksen jälkeen avautuu seuraava kirjaamaton peli.
  - **Pitkän aikavälin analytiikka (vaihe 7, perustoteutus)** (`domain/longTerm`, `features/analysis/LongTermView`): Analyysi-välilehden jaksovalinta Viikko / Kuukausi / Kausi / Vuosi (muistetaan laitekohtaisesti, `analysisMode`); kaudet oletuskausina (kevät tammi–touko, kesä kesä–elo, syksy syys–joulu), selaus taaksepäin, ei tulevaan. Kortit: (1) reipas ja rasittava ka. min/pv kuukausittain (kuukaudella viikoittain), kirjattu + arkiliikunnan arvio pinottuna, suositusviiva, haalea palkki kun kattavuus < 50 %, työkaluvihjeessä päivät ja kattavuus, taulukkonäkymä; (2) vertailu edelliseen samanlaiseen jaksoon (edellinen kuukausi, kausi tai vuosi): MVPA (yhdistetty ja kirjattu), kaikki liikunta, rasittavan osuus, ohjatun osuus, kirjatut kerrat, liikuntaryhmät ja kattavuus sekä muutos neutraalisti ("ennallaan", ±); (3) ohjattu / omaehtoinen / arki osuuksina kirjatusta MVPA:sta (7.10) edellisen jakson arvoineen; (4) monipuolisuus: eri liikuntaryhmät (ei "vaihtelee"/"muu") ja lajit, lajeittain kerrat ja tunnit; (5) suositusten toteutuminen viikoittain (7.6: viikot, joilla ≥ 4 kelvollista päivää; kouluikäiset MVPA ka. yhdistetystä, rasittavat, lihas- ja luustopäivät kirjatuista; alle kouluikäiset päiväsuositus joka päivä; aikuiset painotettu 150 min ja lihaskunto); (6) datan laatu (vertailtavat päivät, kattavuus, arvion osuus, edellinen jakso) ja teksti siitä, mitä luvuista voi ja ei voi päätellä. Ei ennätyksiä, putkia eikä ylärajaa. Kauden rajojen asetus, kausi/vuosi-sarjat usealta vuodelta ja harjoittelun sisältö (tagit) kausitasolla jäävät myöhemmäksi.
  - **Jakson raportti PDF:ksi** (`features/analysis/SeasonReport`): kuukausi-, kausi- ja vuosinäkymän painike "Raportti (PDF)" avaa tulostettavan A4-raportin (vaalea paperi myös tummassa tilassa) ja "Tulosta / tallenna PDF" käyttää selaimen tulostusta (`window.print`, ei lisäkirjastoja eikä verkkoliikennettä; tiedostonimi sivun otsikosta "Liikuntaraportti <nimi> <jakso>"). Sisältö: yhteenveto (reipas ja rasittava, kaikki liikunta, kerrat ja lajit, kattavuus ja arvion osuus), kehitys kuukausittain/viikoittain palkkeineen ja suositusviivoineen, vertailu edelliseen jaksoon, ohjattu/omaehtoinen/arki, viikkotavoitteet, lajit ja liikuntaryhmät, jalkapallo (treenit, pelit V–T–H, maalit, oman pelaajan maalit, osallistuminen, peliaikaosuus, pelipaikat, treenien sisältö), enintään 6 uusinta kommenttia sekä tulkintaohje. Tulostuksessa näkyy vain raportti (`@media print`, `body.print-report-open`).
- **Turnauksen kesto otteluohjelmasta** (käyttäjän vahvistama 12.11.2026, `domain/tournamentTime.ts`): kesto = aktiivinen aika = pelien määrä × (lämmittely + pelin pituus) + loppuverryttely; pelien väliset odotukset eivät kasvata kestoa eivätkä siten tehoarviota. Lämmittely ennen jokaista peliä, oletus 15 min; loppuverryttely valinnainen, oletus 0. Pelin oletuspituus pelimuodon mukaan: 5v5 20 min (käyttäjän tieto), muut sovelluksen oletuksia (3v3 15, 7v7 25, 8v8 30, 9v9 30, 11v11 40 min); muutettavissa tapahtumakohtaisesti. Pelien määrä otteluohjelmasta tai Pelejä-kentästä. Saapumisaika (suunnitelman kellonaika) = 1. peli − 30 min (käyttäjän tieto 13.11.2026: paikalle aina 30 min ennen ensimmäistä peliä, alkuverryttely alkaa 15 min ennen peliä; aiemmin 1. peli − lämmittely), kun otteluohjelmassa on kellonajat; päättymisaika = viimeinen peli + pelin pituus + verryttely (käytetään myös työpöytätilan kuittausmuistutuksissa). "Laske kesto otteluohjelmasta" on oletuksena päällä; pois kytkettynä kesto annetaan käsin (Fixture.durationManual). Uudet valinnaiset kentät Fixture.gameLengthMin, warmupMin, cooldownMin, durationManual (synkronoituvat; vanhat tiedostot kelpaavat). Aiemmin tallennetut tapahtumat päivittyvät, kun ne avataan ja tallennetaan.
- **Peliaika-arvio ja pelin osat** (käyttäjän vahvistama 12.11.2026, `domain/intensity.ts` `footballParts`; korvaa pelin ja turnauksen osalta SPEC 5 vaiheen 1): pelaaja ei ole kentällä koko peliä, joten peli ja turnaus lasketaan osina:
  - **Lämmittely** (oletus 15 min / peli; turnauksessa pelien määrä × ottelun lämmittely) jalkapallotreenin tehoprofiililla, ponnistelu 0. Jos treenilajia ei ole, käytetään treenin lähtöoletusta 35/30/15 %.
  - **Pelattu aika** pelin tehoprofiililla ja tason ponnistelulla: kirjatut pelatut minuutit tai arvio (kesto − lämmittely) × peliaika-arvio.
  - **Vaihtopenkki ja tauot** eivät kerrytä liikuntaa. Jos pelattu + lämmittely ylittää keston, lämmittely lyhenee.
  - **Peliaika-arvio** oletus 70 % (esim. 5v5 ja noin 7 pelaajan ryhmä, junioreissa tasainen peluutus); joukkuekohtaisesti säädettävä 30–100 % (Joukkueet → Peliaika-arvio, `Team.playShare`). Kerta tallentaa käytetyn lämmittelyn ja osuuden (`Session.warmupMin`, `Session.playShare`), joten muokkaus ja uudelleenlaskenta antavat saman tuloksen.
  - **Tulosten kirjaus:** Pelasiko? Ei pelannut (0 min) / Osan (peliaika-arvio) / Koko pelin (kesto − lämmittely; turnauksessa pelin pituus), tai tarkat minuutit, jotka ohittavat valinnan. Turnauksessa valinta tehdään peleittäin, ja merkitsemätön peli lasketaan arviolla. Tallennus: `played` (peli `FootballDetails.played`, turnauksen pelirivi `GameResult.played`).
  - **Esimerkki A3** (peli 60 min, kilpa, ei pelattuja minuutteja): lämmittely 15 min + pelattu round(45 × 0,7) = 32 min → kevyt 13, reipas 23, rasittava 14 min. Vanhat kerrat säilyttävät minuuttinsa, kunnes niitä muokataan tai lasketaan uudelleen.
  - **Termi:** "Omat maalit" → "<Nimi>: maalit" (pelaajan nimi profiilista, ilman taivutusta; ilman nimeä ja CSV:ssä "Pelaajan maalit").
- **Synkronointi sivupalkissa (PC):** leveällä näytöllä (sivupalkki näkyvissä) PC:n "Synkronoi" on sivupalkin alaosassa Ohjeen yläpuolella: alarivillä "Synkronoitu N min sitten" (päivittyy minuutin välein) tai "Puhelimella uusia kirjauksia" ja merkkipiste kuvakkeessa. Ilman kansiotukea samassa kohdassa ovat "Tuo puhelimelta" ja "Lataa". Viikko-näkymän synkronointipalkki näkyy PC:llä vain kapeassa ikkunassa, jossa sivupalkkia ei ole; puhelimella palkki pysyy Viikko-näkymässä. (Muutettu 19.11.2026: alle 1024 px:n leveydellä synkronointi on yläpalkin kuvakkeessa, ks. Synkronointi yläpalkissa.)
- **Päivitys myös sivupalkissa (PC):** kun uusi versio on saatavilla, sivupalkin alaosaan (Synkronoi-painikkeen yläpuolelle) ilmestyy korostettu "Päivitä – Uusi versio saatavilla" -painike, joka ottaa uuden version käyttöön ja lataa sivun uudelleen. Viikko-näkymän ilmoitus säilyy; sen "Myöhemmin" piilottaa vain ilmoituksen, sivupalkin painike pysyy, kunnes päivitys tehdään. Service worker rekisteröidään kerran sovelluksen juuressa (`features/update/appUpdate.tsx`), joten uusi versio huomataan välilehdestä riippumatta (aiemmin vain Viikko-näkymässä).
- **Viimeistely ja "wow"-hetket** (käyttäjän pyytämät kohdat 1–8, 13.11.2026):
  - **Onnistumisen hetki** (`features/week/celebrate.tsx`): kun tämän viikon pääsuositus täyttyy, edistymisrengas hehkuu, sen ympärille lehahtaa kipinäpurske ja teksti "Hienoa – viikon suositus täyttyi" (puhelimessa lyhyt värinä). Kerran viikossa profiilia kohden (selaimen muisti, ei synkronoida). Tilapillerissä näkyy putki "· N vk putkeen", kun peräkkäisiä täyttyneitä viikkoja on vähintään 2 (enintään 12 viikkoa taaksepäin, sama raportti kuin etusivulla; ennen seurannan alkua oleva viikko katkaisee putken).
  - **Kuittauksen palaute** (`ui/fresh.ts`): ✓ painaa suunnitelman pois (240 ms), minkä jälkeen kirjattu kerta välähtää ja saa piirtyvän valintamerkin (myös pikalisäyksen ja "merkitse loput" -kuittauksen jälkeen). Päivän palkki kasvaa uuteen arvoon.
  - **PC-sovellus:** otsikkopalkki sulautuu sovellukseen (`display_override: window-controls-overlay`; ylälaidassa vetoalue, sivupalkin väri jatkuu ylös). Tehtäväpalkin kuvakkeen pikatoiminnot (`?action=add | sync | review`): Kirjaa liikunta, Synkronoi, Käy viikko läpi. Asennusikkunaan esikatselukuvat esimerkkiprofiililla (ei oikeita tietoja; eivät kuulu välimuistiin). Uusi asetus tulee voimaan asentamalla sovellus uudelleen.
  - **Pikanäppäimet ja komentovalikko** (`features/desktop/CommandPalette.tsx`, Ctrl+K tai sivupalkin "Haku ja komennot"): N = uusi kerta, L = läpikäynti, S = synkronoi, T = tämä viikko, ←/→ = viikko (Viikko-näkymässä), K = kauden kooste, 1–4 = näkymät, ? = valikko. Valikosta haetaan toiminnot, näkymät, profiilit, asetusten osiot, teeman vaihto ja tulevat pelit. Näppäimet eivät toimi kirjoitettaessa tai paneelin ollessa auki. Komennot kulkevat yhteistä väylää (`features/desktop/commands.ts`); käsittelemätön komento vanhenee 8 s:ssa.
  - **Kauden kooste** (`features/story`): kuluvan kauden (kevät 1–5, kesä 6–8, syksy 9–12) tarinakortit: kansi, liikunta yhteensä (josta reipas+rasittava, kertojen määrä), eniten aikaa vieneet lajit, paras viikko (kesto), jalkapallo (treenit, pelit, V–T–H, pelaajan maalit, kirjattu peliaika) ja harjoitellut asiat + viihtyminen, lopetus. Etenee itsestään 6 s välein (pysähtyy painettaessa ja "vähennä liikettä" -asetuksella), napautus/pyyhkäisy/nuolet vaihtavat. "Tallenna kuva" piirtää kortin 1080 × 1920 PNG:ksi laitteella; "Jaa" käyttää laitteen jakovalikkoa, jos se tukee tiedostoja. Avataan Jalkapallo-yläkortin "Kauden kooste" -painikkeesta tai komennolla.
  - **Joukkuekirjasto** (käyttäjän linjaukset 13.11.2026): joukkueen nimi kolmena osana – seura, ryhmä ja ikäluokka (esim. "FC Honka · Musta · 2018") – sekä vastustajille (peli, turnauksen otteluohjelma ja pelirivit) että omille joukkueille (`domain/opponent`, `TeamNameFields`). Nimi tallennetaan edelleen yhtenä tekstinä, joten vanha data säilyy: osat jäsennetään lukuhetkellä (erotin "/", "·" tai "|"; ikäluokka = vuosi, P2016, T12; oman joukkueen vanha nimi ilman erotinta on ryhmä). Pelkkä syntymävuosi näytetään muodossa "2018 syntyneet" (kenttä Ikäluokka (syntymävuosi)); tallennettu teksti ei muutu. Joukkueet-välilehden **Vastustajat**-osio kokoaa pelatut pelit ja tulevat pelit seuroittain automaattisesti (`domain/opponentLibrary`); seuran näkymässä logo, V–T–H ja maalit, oman pelaajan maalit, ryhmät ja ikäluokat peleineen (tulos, kommentti muokattavissa: yksittäisen pelin kommentti tai turnauksen pelirivin kommentti). Seuran nimen muutos ja ryhmän nimen korjaus muuttavat kaikki saman seuran/ryhmän nimet (pelit, kalenteri, omat joukkueet); saman nimen antaminen yhdistää. **Seuran logo** (skeema v3, taulu `clubs`, tunniste `club:<nimi pienellä>`, synkronoituu ja on varmuuskopiossa) yksi per seura, näkyy omissa joukkueissa ja vastustajissa; logo pienennetään laitteella kokonaisena (ei rajausta, PNG säilyttää läpinäkyvyyden) ja näytetään isompana pyöristettynä neliönä (`ui/TeamLogo`). Oman joukkueen lomakkeessa logo tallentuu seuralle, kun seura on annettu, muuten joukkueen kuvaksi. **Logon apuvälineet:** "Hae logo ↗" avaa kuvahaun (seuran nimi + "jalkapallo logo") selaimen uuteen välilehteen; sovellus ei itse tee verkkopyyntöjä. "Liitä kuva" lukee kuvan leikepöydältä (selain voi kysyä lupaa; jos lupaa ei saa, logoalueelle voi liittää Ctrl+V:llä / pitkällä painalluksella), ja koneella kuvatiedoston voi raahata logoalueelle. Vastustajat-osion yläosassa näkyy "N seuraa ilman logoa", ja "Lisää logot yksi kerrallaan" avaa logottomat seurat vuorotellen (Seuraava / Ohita / Lopeta; ohitettu seura ei palaa saman läpikäynnin aikana).
  - **Päiväkirjan taulukkonäkymä**: Kortit / Taulukko -valinta (laitekohtainen, kuten Viikko-näkymässä). Rivi per treeni, peli tai turnauksen peli: päivä, tapahtuma, vastustaja, tulos, oman pelaajan maalit, kesto/peliaika, arvio ja viihtyminen, kommentti. Haku ja suodattimet toimivat; rivin napautus avaa lisätiedot.
  - **Välitunnit vain arkiliikunnassa** (käyttäjän päätös 13.11.2026): kun profiililla on välituntien arkiliikunta-arvio, laji "Välitunnit" piilotetaan lajivalikoista (pikakirjaus, kerran muokkaus, viikkorytmi) ja asetusten Liikkumismuodot ja tehoprofiilit -listasta (lajiasetukset ovat yhteisiä: piilotetaan, jos jollakin profiililla on välituntiarvio; välituntien teho asetetaan arkiliikunnan arviossa); välitunnit vahvistetaan, muutetaan tai merkitään 0 min arkiliikunnan rivillä. Laji jää taustalle vahvistusten lajiksi. Käynnistyksessä aiemmat erikseen kirjatut välituntikerrat arviopäiviltä muutetaan vahvistuksiksi (`foldEstimateOnlySessions`, idempotentti): minuutit, tehot ja päivän luvut säilyvät, kerta näkyy arkiliikunnan rivillä eikä omana rivinään. Samalla viikkorytmin välituntirivit poistetaan käytöstä ja avoimet välituntisuunnitelmat arviopäiviltä poistetaan, jolloin välitunnit näkyvät myös tulevilla viikoilla vain arkiliikunnan arviona. Ilman arviota välitunteja voi kirjata kuten ennen. Koulumatkat pysyvät omina lajeinaan (kävely ja pyöräily eri tehoilla).
  - **Kortti → paneeli -morfi** (`ui/morph.ts`; 24.11.2026 korvattu kevyellä avauksella, ks. versio 1.1.48): päivän kerta- ja suunnitelmarivi (kortit ja taulukko) laajenee saumattomasti muokkauspaneeliksi (View Transitions): kuvia ei venytetä vaan paneeli paljastuu kasvavan, pyöristyksensä muuttavan kehyksen sisältä, napautettu rivi piilotetaan morfin ajaksi ja tumma tausta häivyttyy elävänä näkymän päällä (ei taustasumennusta, joka vaalensi näkymää välähtäen). Ilman tukea, liikettä vähennettäessä, toisen paneelin ollessa auki tai jos selain ei piirrä 300 ms:ssa, paneeli avautuu tavalliseen tapaan.
  - **Kuvitetut tyhjät tilat** (`ui/illustrations.tsx`): kalenteri, pelit (myös "Odottaa tulosta"), päiväkirja, analyysi (myös jakauma), harjoitellut asiat, viikkorytmi, arkiliikunnan arviot, joukkueet, profiilit ja haku; viiva teeman korostusvärillä, toimii vaaleassa ja tummassa teemassa.
  - **Kumoa kaikkialla:** kerran, suunnitelman, kalenterin pelin ja viikkorytmin rivin poisto tapahtuu heti ilman vahvistuskysymystä, ja ilmoituksessa on "Kumoa" (rivin kumoaminen palauttaa myös yksittäin muutetut tulevat kerrat). Profiilin ja joukkueen arkistointi on kumottavissa samoin.
  - **Korjauksia käyttäjän palautteesta (13.11.2026):**
    - **Seuran logo kutistuu**, kun logo on annettu: logovalikko näkyy yhtenä rivinä ("Seuran logo annettu" + "Vaihda logo"); avattuna "Valmis" sulkee sen ja kuvan valinta sulkee sen automaattisesti (`LogoPicker`, seuran näkymässä ilman toista logokuvaa).
    - **Suomenkielinen kalenteri** (`ui/DateInput`): selaimen oma päivävalitsin näkyy laitteen kielellä (esim. englanninkielisessä iPhonessa englanniksi), joten kaikki päivämääräkentät käyttävät sovelluksen omaa kalenteria: kuukausi suomeksi, viikko alkaa maanantaista, viikonpäivät ma–su, tämä päivä korostettuna, min/max-rajat, "Tänään" ja "Sulje"; Esc ja ulkopuolinen napautus sulkevat. Kellonaikakentät käyttävät edelleen laitteen omaa valitsinta.
    - **Oman joukkueen sarjataso poistettu:** taso on pelin/turnauksen asia, joten joukkueen lomakkeessa ei ole tasoa eikä joukkuelistassa tasomerkkiä, eikä pelin taso enää peri joukkueen tasoa (ilman tapahtuman tasoa = ei tasoa). Vanhojen joukkuerivien `level` ohitetaan lukiessa (skeemassa valinnainen, ei migraatiota) ja poistuu, kun joukkuetta muokataan.
    - **Saapuminen 30 min ennen peliä** (`ARRIVAL_LEAD_MIN`, `gameDaySchedule`): pelin ja turnauksen lomakkeessa näkyy aikataulu "Paikalla 13:30 · lämmittely alkaa 13:45 · (1.) peli 14:00"; yksittäisen pelin kellonaika on pelin alku (kenttä "Pelin alku"), ja kalenterissa näkyy "klo 14:00 (paikalla 13:30)", turnauksessa "paikalla 13:30". Jos lämmittely on yli 30 min, paikalle saavutaan lämmittelyn alkuun. Aiemmin tallennettujen kuittaamattomien turnausten saapumisaika (1. peli − lämmittely) siirretään uuteen sääntöön käynnistyksessä ja synkronoinnin jälkeen (`alignTournamentArrivals`, johdettu aikaleima; käsin annettua alkua ei muuteta). Kesto ja tehoarvio eivät muutu: odotus ennen lämmittelyä ei ole liikuntaa.
  - **Jalkapallo valinnaisena profiileittain** (käyttäjän päätös 13.11.2026; `Profile.football`, `features/football/useFootballEnabled`): profiilin lomakkeessa (myös aloituksessa) kysymys "Pelaako {nimi} jalkapalloa?" (Kyllä / Ei; uudella profiililla oletus Ei). Valinta synkronoituu profiilin mukana; puuttuessa (vanhat profiilit) se päätellään datasta: päällä, jos profiililla on seurajalkapallon kerta tai suunnitelma (treeni, peli, turnaus) tai joukkue (`hasFootballData`); omatoiminen jalkapallo ei ratkaise. Pois päältä piilotetaan: Jalkapallo-välilehti (myös komentovalikosta ja pikanäppäimestä 2; alanavigaatiossa kolme kohtaa), tulevat pelit komentovalikosta, jalkapallon lisätietopaneeli ja "Lisää tiedot" kerroilta, taulukkonäkymän jalkapallosarake, Analyysin Jalkapallo- ja Kohokohdat-kortit (myös näkymän muokkauksesta), jakson raportin jalkapallo-osio ja jalkapallon arviot, kauden koosteen jalkapallo- ja harjoitellut asiat -kortit sekä seurajalkapallon lajit lajivalikoista (pikakirjaus, kerran muokkaus, viikkorytmi; lajiasetuksista vain, jos millään profiililla ei ole jalkapalloa). "Jalkapallo – omatoiminen" näkyy aina tavallisena lajina. Viime viikko lyhyesti näyttää jalkapalloruutujen sijaan viikkonäkymän ruudut (liikuntaa yhteensä, rasittavat päivät, lihas · luusto). Kauden kooste avataan silloin Analyysista. Tiedot eivät katoa: kirjatut kerrat lasketaan liikuntaan, ja kaikki näkyy taas, kun valinta kytketään päälle.
  - **Päiväkortin +-painike** (käyttäjän toive 13.11.2026): Viikko-näkymän Kortit-tilassa jokaisen päivän otsikkorivillä on ⋯-valikon vieressä "+" (kuten taulukkonäkymän riveillä), joka avaa pikakirjauksen valmiiksi sille päivälle. Painike on pieni (28 px, kosketusalue suurempi).
  - **Suunniteltu kerta tulevalle päivälle** (käyttäjän toive 13.11.2026; `PlanOnceSheet`, `repo.createPlannedOnce`): tulevan päivän "+" (kortit ja taulukko) sekä ⋯-valikon "Suunnittele kerta tälle päivälle" avaavat paneelin, jolla lisätään yksittäinen tiedossa oleva tapahtuma (laji, päivä, valinnainen kellonaika, kesto, tarkenne). Se on tavallinen avoin suunnitelma ilman viikkorytmiä: näkyy viikolla "Suunniteltu", synkronoituu, ja kuitataan (✓) tai ohitetaan vasta kyseisenä päivänä (tulevaa ei voi kuitata); muokkaus ja poisto suunnitelman paneelista. Pelit ja turnaukset eivät ole lajilistassa, vaan ne lisätään Jalkapallo → Kalenteri.
  - **Korjaus: viikkorytmin kerrat kahdella laitteella** (käyttäjän havainto 13.11.2026; `db/ensurePlanned.ts`): toisella laitteella lisätty tai muokattu viikkorytmin rivi ei saanut kertoja päiville, jotka tämä laite oli jo suunnitellut (`plannedThrough`-merkintä), ja pohjan muokkaus saattoi poistaa toisen laitteen kauemmas suunnittelemat kerrat. Nyt ensurePlanned käy aina läpi päivät tästä päivästä eteenpäin (menneet edelleen merkinnän mukaan, enintään 14 pv): puuttuvat kerrat luodaan, järjestelmän (ei käyttäjän) poistamat herätetään, jos rivi haluaa päivän, ja tulevat avoimet, yksittäin muuttamattomat kerrat korjataan rivin nykyisen version mukaisiksi (poistettu rivi tai viikonpäivä poistaa, muuttunut laji, kesto, kellonaika tai tarkenne päivittyy). Kuitatut, ohitetut, yksittäin muutetut ja käyttäjän poistamat eivät muutu. Johdettu aikaleima (uudempi versioista + 1 ms) tuottaa molemmilla laitteilla saman tietueen. Pohjan muokkauksen (`regenerateItem`) väli kattaa myös rivin kauimmaiset olemassa olevat kerrat. Vanhat puuttuvat kerrat korjautuvat itsestään, kun viikko avataan.
  - **Korjaus: kaukaiset tulevat viikot** (käyttäjän havainto 13.11.2026; `farWeekPlanning`): suunnitelmat syntyivät enintään +8 viikon päähän, vaikka viikkoja voi selata pidemmälle, joten esim. tammikuun lopun viikko oli tyhjä. Nyt yli +8 viikon päässä selattu viikko saa viikkorytmin kerrat (vain se viikko, ei väliin jääviä, jotta synkronoitava tiedosto ei kasva turhaan).
  - **Äänet** (käyttäjän päätös 13.11.2026; `ui/sound.ts`, `features/week/GoalSound.tsx`, `db/localChange.ts`): lyhyet, hiljaiset äänet syntetisoidaan Web Audio -rajapinnalla (ei äänitiedostoja, ei riippuvuuksia, ei verkkoliikennettä). Kolme ääntä: **kuittaus** (nouseva kaksisävel) kun suunniteltu kerta kuitataan tehdyksi (päiväkortti, läpikäynti, "Merkitse loput tehdyiksi", pikalisäyksen suunnitelman kuittaus, pelikalenteri); **läpikäynti valmis** (kolmisointu) kun "Käy viikko läpi" -lista tyhjenee sen ollessa auki; **tavoite täyttyi** (pidempi nousu) kun oma kirjaus tai kuittaus nostaa kuluvan viikon tavoitepäivien määrää tai viikon suositus täyttyy. Tavoiteääni soi vain, jos tällä laitteella on tehty kirjaus, kuittaus tai ohitus edeltävien 8 sekunnin aikana (`noteLocalChange` repositorion kirjoitusfunktioissa), joten synkronoinnin tuomat muutokset eivät soi. Ei ääniä ohitukselle (✗), poistoille, virheille, synkronoinnille eikä navigoinnille. Asetukset → Ulkoasu → Äänet: laitekohtainen kytkin (localStorage `sounds`, oletus päällä) ja kuuntelupainikkeet. Äänet eivät soi sovelluksen ollessa taustalla; iPhonella `navigator.audioSession.type = 'ambient'`, joten äänetön tila hiljentää ne eikä musiikki keskeydy. Selain avaa äänikontekstin ensimmäisellä painalluksella.
  - **Korjaus: Jalkapallo-välilehden näkymävaihto ei hypi** (käyttäjän havainto 13.11.2026; `GamesTab`): Päiväkirja / Kalenteri / Tulokset / Joukkueet -vaihdossa uusi näkymä piirtyi hetken ilman tietoja, jolloin sivu lyheni ja selain veti vierityskohtaa ylös. Nyt kerran avatut näkymät pysyvät taustalla valmiina (piilotettuina), ja näkymäalue on vähintään näytön korkuinen, joten valitsin pysyy paikallaan myös lyhyemmässä näkymässä.
  - **Jaettava tuloskuva** (käyttäjän toive 13.11.2026; `domain/resultCard.ts`, `features/share/drawResult.ts`, `features/share/ResultShare.tsx`): pelin tai turnauksen tulokset kuvaksi esim. Instagramiin. Avataan Tulokset-listan jakopainikkeesta (turnauksen otsikkorivi, yksittäisen pelin rivi; vain kun vähintään yhdellä pelillä on tulos) tai lisätietojen tallennuksen ilmoituksesta "Jaa tulos". Esikatselussa valitaan muoto **Tarina 9:16** (1080 × 1920) tai **Julkaisu 4:5** (1080 × 1350) ja tyyli **Teema** (sovelluksen väriteema ja fontit) tai **Urheilu** (tumma yönsininen, viistot raidat, vihreä korostus); valinnat muistetaan laitteella. Sisältö: tunniste (Ottelu/Turnaus · taso · pelimuoto), turnauksen nimi tai päivä, oma joukkue logoineen. Turnaus: pelirivit (vastustajan logo, nimi, pelin numero ja kellonaika, tulos, V/T/H-merkki värillä ja kirjaimella) sekä yhteenveto (pelit, V–T–H, maalit). Yksittäinen peli: logo – tulos – logo ja tulossana (Voitto/Tasapeli/Tappio). Logot ovat käyttäjän Joukkueet-kohtaan lisäämiä seuran logoja (nimen seura-osan mukaan); puuttuessa seuran nimikirjaimet. **Lapsen nimi ja maalit** näkyvät vain valinnalla "Näytä nimi ja maalit", joka on joka kerta oletuksena pois (kuva on jaettaessa julkinen). Kuva piirretään laitteella canvasille; "Jaa" avaa laitteen jakovalikon (Web Share, esim. Instagram), muuten "Tallenna kuva" lataa PNG:n. Ei verkkoliikennettä eikä riippuvuuksia.
  - **Tervetulosivu ennen aloitusvaiheita** (käyttäjän toive 13.11.2026; `features/onboarding/Onboarding.tsx`): uusi käyttäjä näkee ensin tervetulosivun ja vasta sitten profiilin täytön. Sivulla: mitä sovellus tekee (kirjaa ja kuittaa viikkorytmin kerrat, vertailu suomalaisiin liikkumissuosituksiin, jalkapallo valinnaisena), tietosuoja (ei tiliä eikä palvelinta, tiedot vain laitteen selaimessa), **varmuuskopio pilveen** kolmena askeleena (Asetukset → Laitteet ja varmuuskopio → Vie varmuuskopio; tallennus omaan pilvikansioon kuten OneDrive, iCloud Drive tai Google Drive; palautus Tuo varmuuskopio -toiminnolla myös uudelle laitteelle) sekä huomio, että PC tekee synkronointikansioon automaattisen viikkovarmuuskopion, ja PC ↔ puhelin -synkronoinnin periaate. Painikkeet "Aloita" (vaihe 1) ja "Tuo tiedosto" (tuonti kuten ennen, ohittaa vaiheet 1–3) sekä "Ohita aloitus". PC:llä sivu ja vaiheet 1–4 käyttävät koko näytön leveyttä: tervetulosivu kahtena palstana, vaiheissa vaiheluettelo vasemmalla (tehty ✓, nykyinen kuvauksineen); puhelimella vaiheiden etenemispalkki. Tervetulosivu ja profiilivaihe mahtuvat PC:llä yhdelle näytölle ilman vieritystä (tarkistettu 1920 × 960 ja 1440 × 820; käyttäjän toive 14.11.2026): tiiviit tietokortit (Kirjaa ja kuittaa, Vertaa suosituksiin, Jalkapallo valinnaisena, PC ja puhelin) ja yksi korostettu kortti "Tiedot pysyvät sinulla – varmuuskopioi ne pilveen"; profiililomake (`ProfileForm wide`) kahtena palstana leveällä näytöllä.
  - **Aktiivisuuskartta** (käyttäjän toive 13.11.2026; `domain/heatmap.ts`, `features/analysis/HeatmapCard.tsx`): Analyysin viikkonäkymään oma kortti "Aktiivisuuskartta" (näkyvyys ja järjestys Muokkaa näkymää -valinnalla). Kortti vie aina koko leveyden ja katkaisee palstat järjestyksensä kohdalla. Ruudukko: sarakkeet ISO-viikkoja, rivit ma–su, kuukausiotsikot ja Ma/Ke/Pe/Su-otsikot (pysyvät näkyvissä, kun kartta vierii kapealla näytöllä; vieritys alkaa uusimmista viikoista). Jakso: viimeiset 12 kk (52 viikkoa + kuluva) tai kalenterivuosi (seurannan alkuvuodesta, enintään 5 vuotta; seuraava vuosi listassa, kun sille on avoimia suunniteltuja kertoja). Mittari valitaan: **Tavoite** = reipas + rasittava suhteessa päivän suositukseen (tasot: ei, alle 50 %, 50–99 %, tavoite, 150 %+), **Minuutit** = kaikki liikunta (1–30, 31–60, 61–90, yli 90 min), **Kerrat** = kirjatut kerrat (1, 2, 3, 4+). Tavoitteelle ja minuuteille valitaan **Vain kirjatut** (ilman arkiliikunnan arviota ja sen päiväkohtaisia vahvistuksia) tai **Arvio mukana** (yhdistetyt arvot korvausperiaatteella, lomapäivät viikonlopun arvoilla); kerroissa arvio ei koskaan ole kerta. Valinnat muistetaan laitteella. Päivät ennen seurannan alkua himmeinä. **Tulevat päivät** (huomisesta alkaen) näytetään suunnitelmana onttoina ruutuina, joiden reunaviiva on tason värinen: avoimet suunnitellut kerrat (viikkorytmi ja kertaluonteiset) lajin tyypillisellä teholla ja "Arvio mukana" -valinnalla myös arkiliikunnan arvio; tulevat päivät ilman mitään himmeinä. Päivän tiedoissa "suunniteltu" ja suunniteltujen kertojen määrä; selitteessä "suunniteltu". Tunnusluvut lasketaan vain toteutuneista päivistä (käyttäjän valinta 13.11.2026); tulevien päivien määrä näkyy erillisenä katkoviivaruutuna "Suunniteltu loppuvuodelle / vuodelle 2027 / loppuviikolle": +tunnit (kaikki liikunta) ja suunniteltujen kertojen määrä, "Arvio mukana" -valinnalla myös arkiliikunnan arvio. Värit teeman yksisävyisestä asteikosta (`--band-3…6`, tasolla 0 kaavion pohjaväri), tummalle teemalle omat sävynsä. Päivän osoitus tai napautus näyttää rivillä päivän tiedot (reipas ja rasittava, % suosituksesta, kaikki liikunta, kerrat, merkintä kuten Sairas, loma); merkityillä päivillä oranssi reunus. Selite Vähemmän…Enemmän ja asteikon rajat. Tunnusluvut: liikuntaa yhteensä (h; "Arvio mukana" -valinnalla eriteltynä "kirjatut X h + arkiliikunta Y h"), aktiivisia päiviä / päiviä, pisin putki (peräkkäiset aktiiviset päivät valitulla mittarilla), suositus täyttyi (pv). "Suurenna" avaa kartan koko näytölle (Esc tai ✕ sulkee). **Myös pitkillä jaksoilla** (käyttäjän toive 14.11.2026): kuukausi-, kausi- ja vuosinäkymässä kartta näkyy täysleveänä korttien alla, jos se on valittu Analyysin kortteihin. Vuosinäkymässä kartta näyttää valitun vuoden; kuukausi- ja kausinäkymässä 12 kk (tai jakson vuoden, jos jakso on vanhempi) ja valittu jakso korostetaan himmentämällä muut päivät ("Korostettuna: marraskuu 2026"). Kartan oma jaksovalinta toimii edelleen; tunnusluvut lasketaan kartan koko jaksolta. **Selitteet** (käyttäjän toive 14.11.2026): tunnuslukujen alla laskentajakso ("Laskettu 2.11.–14.11.2026 (13 päivää seurannan alusta tähän päivään)") ja avattava "Mistä luvut tulevat?" valittujen asetusten mukaan: kirjatut kerrat (kesto lajin tehon mukaan; pelissä peliaika ja lämmittely), arkiliikunta (arki- ja viikonloppuminuutit, lomat, korvausperiaate, päivän kuittaus, kuluva päivä kokonaisena), liikuntaa yhteensä, aktiivinen päivä ja pisin putki, suositus täyttyi (päivän suositus minuutteina), ruutujen värit sekä suunnitellut päivät.
  - **Muokattava jaksonäkymä ja viikon raportti** (käyttäjän toive 14.11.2026; `features/analysis/layout.ts`, `LongTermView.tsx`, `AnalysisView.tsx`, `domain/longTerm.ts`): kuukausi-, kausi- ja vuosinäkymässä on oma "Muokkaa näkymää" (laitekohtainen asetus `longTermLayout`): kortit Reipas ja rasittava (kehitys), Vertailu, Ohjattu ja omaehtoinen, Monipuolisuus ja lajit, Suositusten toteutuminen viikoittain, Datan laatu ja Aktiivisuuskartta (koko leveys järjestyksensä kohdalla) voi piilottaa ja järjestää. Aktiivisuuskartan näkyvyys pitkillä jaksoilla on tämän asetuksen mukainen (ei enää viikkonäkymän asetuksen). Viikkonäkymään "Raportti (PDF)" samalla raporttipohjalla kuin pitkät jaksot: otsikko "viikko 46/2026", päivittäiset palkit (ma 9.11. … su 15.11.), vertailu edelliseen viikkoon; painike näkyy, kun viikolla on vertailtavia päiviä.
  - **Korjaus: arkiliikunta näkyy myös tulevina viikonloppuina** (käyttäjän havainto 14.11.2026; `domain/hours.ts` `pendingEstimateMin`, `DayRow`, `DayTable`): jos tulevalle päivälle oli suunniteltu kerta samaan kategoriaan kuin arkiliikunnan arvio (esim. uinti, luistelu tai omatoiminen jalkapallo ovat omaehtoista liikuntaa kuten "Leikki ja oma liikkuminen"), päivän arkiliikuntarivi puuttui ja ilmestyi vasta päivän tullessa. Nyt rivi noudattaa kaikkina päivinä samaa sääntöä kuin kuluvana päivänä: vain kirjattu kerta korvaa saman kategorian arvion, suunnitelma ei. Viikon ennusteessa avoin suunnitelma korvaa edelleen saman kategorian arvion, ettei sitä lasketa kahdesti.
  - **Alle kouluikäisen 3 h kestona ja päiväkotipäivä** (käyttäjän havainto ja päätökset 14.11.2026; `domain/aggregate.ts` `earlyYearsDay`, `daycareDay`, `domain/dayTarget.ts` `dayGoalMet`, `domain/heatmap.ts`, `DailyChart`, `DayRow`, `DayTable`, `GoalCard`, `EstimatesSection`): alle kouluikäisen "3 h liikkumista" laskettiin tehominuuteista (kevyt + reipas + rasittava), jotka ovat tehoprofiilin takia vain 80–90 % kestosta – esim. 3 h leikki ≈ 2,5 h, joten päivä ei täyttynyt, vaikka tunteja näkyi 3. Nyt 3 h verrataan **liikuttuun kestoon** (`DayTotals.moving` / `movingCombined`: kirjattujen kertojen kesto + arkiliikunnan arvion minuutit, korvausperiaate ennallaan); vauhdikas 1 h lasketaan edelleen tehoprofiilista (reipas + rasittava). Samaa kaksiosaista ehtoa käyttävät nyt myös päivärivin ✓ Suositus -merkki ja päivätaulukon ✓-sarake (x/7), Päivittäin-kaavio (Vauhdikas-näkymässä 1 h -viiva, Kaikki liikunta -näkymässä 3 h -viiva ja ✓ täyttyneillä päivillä), aktiivisuuskartan Tavoite-taso ja "Suositus täyttyi" (heikompi kahdesta suhteesta), viime viikon kortti, tavoiteääni sekä pitkien jaksojen "Kaikki liikunta" (kestona). Uusi kategoria **Päiväkoti** (`daycare`, konteksti arki) ja laji **Päiväkotipäivä** (🧸, kevyt 67 % / reipas 25 % / rasittava 8 % → 2 h ≈ 40 min reipasta). Alle kouluikäiselle arkiliikunta ehdottaa välituntien ja koulumatkojen sijaan "Päiväkotipäivä" (ma–pe 120 min) ja "Leikki ja oma liikkuminen" (myös aloituksessa). Päiväkodin tavoite (Liikkuva varhaiskasvatus – henkilöstön käsikirja 2020: varhaiskasvatuspäivässä ≥ 2 h liikkumista, josta ≥ 40 min reipasta ja rasittavaa = kaksi kolmasosaa päivän suosituksesta) näkyy arvion lomakkeessa ja Suositusten toteutuminen -kortissa (päiväkotipäiviä x, joista tavoite täyttyi y); se ei ole osa päiväsuosituksen ehtoa.
  - **Omat ja piilotettavat lajit, lisää tehoprofiileja, välitunnit takaisin** (käyttäjän toive ja päätökset 14.11.2026; `ActivityTypesSection.tsx`, `repo.createActivityType`, `repo.setTypeHidden`, `useLoggableTypes.ts`, `ui/TypeGlyph.tsx`, `seed/activityTypes.ts`): Asetukset → Liikkumismuodot ja tehoprofiilit → **+ Uusi laji**: nimi (yksilöllinen), kuvake emojina (pikavalinnat tai oma emoji) tai **oma kuva** (`ActivityType.image`, pienennetty JPEG data URL; näytetään lajikuvakkeissa, valikoissa ja otsikoissa käytetään emojia), kategoria, liikkumismuoto, tehoprofiili sekä lihas- ja luustooletus. Oman lajin kaikkia tietoja voi muokata ja lajin voi poistaa valikoista (arkistointi; vanhat kerrat säilyvät). Sisäänrakennetun lajin nimi, kuvake ja kategoria pysyvät. **Piilotus on profiilikohtainen** (`Profile.hiddenTypeIds`, synkronoituu profiilin mukana): lajin muokkauksessa "Näkyy lajivalikoissa" -valinnat profiileittain; piilotettu laji ei näy profiilin kirjaus-, suunnittelu- ja viikkorytmivalikoissa (muokattavan kerran nykyinen laji säilyy valittavana), ja listassa näkyy "Piilotettu: …". Uudet sisäänrakennetut lajit (lähtöarvioita, kevyt/reipas/rasittava): Liikuntapuisto (esim. Superpark) 35/35/15, Leikkipuisto 50/30/10, Päiväkodin ulkoilu 50/35/10 (Päiväkoti), Pyöräily 30/55/10, Rullaluistelu ja rullalauta 35/50/10, Kiipeily 45/35/10, Mäenlasku ja lumileikit 45/35/10, Temppujumppa ja voimistelu 40/30/15, Tanssi 35/40/15, Salibandy 30/40/20, Jääkiekko 30/40/20 (harrastus) ja Retkeily ja metsäretki 65/30/5 (perhe). **Välitunnit ovat taas kirjattava laji** (kumoaa 13.11.2026 päätöksen "välitunnit vain arkiliikunnassa"): `ESTIMATE_ONLY_CATEGORIES` on tyhjä, joten välituntikerrat ja -rytmirivit eivät enää muutu arkiliikunnan vahvistuksiksi; kirjattu välituntikerta korvaa sen päivän välituntiarvion tavalliseen tapaan. Aiemmin muunnetut vahvistukset säilyvät sellaisinaan.
  - **Monta tekemistä yhdessä kerrassa – osat** (käyttäjän toive ja päätös 14.11.2026; `Session.parts`, `domain/intensity.ts` `supportsParts`, `partsShares`, `features/week/PartsEditor.tsx`, `QuickAdd`, `SessionEditor`, `DayRow`): liikuntapuiston (esim. Superpark) kerran voi jakaa osiin – "Mitä teit?" -kohdassa tekemiset ja niiden minuutit (pikavalinnat trampoliini, potkulauta, rullaluistelu ja -lauta, kiipeily, temppujumppa, vapaa leikki ym. tai mikä tahansa muu laji). Kerta on yksi kirjaus (kesto koko käynti, kategoria liikuntapuiston), ja sen tehoprofiili on osien lajien osuuksien kestolla painotettu keskiarvo koko kestosta; osien ulkopuolinen aika on taukoja ja siirtymiä (0 % teho). Esimerkki: 180 min, josta trampoliini 60, potkulauta 45 ja kiipeily 30 → tauot 45 min. Ponnistelu (kevyempi/kovempi) koskee osista laskettua profiilia; esiasetus tai oma jako korvaa osat. Osat näkyvät päivän kerran alla, ja muokkauksessa niitä voi lisätä, muuttaa ja poistaa (tyhjä lista palauttaa lajin oman profiilin). Osien summa ei saa ylittää kestoa; osana ei voi olla toista osiin jaettavaa lajia, peliä eikä turnausta. "Laske uudelleen" ei koske osiin jaettuja kertoja. Omalle lajille valinta "Monta tekemistä yhdessä kerrassa" (`ActivityType.multiActivity`). Alle kouluikäisen 3 h -suosituksessa kerran koko kesto on liikkumista (tauot mukaan, kuten muissakin kerroissa).
  - **Sama tapahtuma usealle profiilille** (käyttäjän toive ja päätös 14.11.2026; `features/week/Companions.tsx`, `QuickAdd`, `PlanOnceSheet`): kirjauksessa ja suunnitellussa kerrassa kohta **"Mukana myös"** – valitaan muut profiilit (esim. perheen ulkoilu, molemmat lapset mukana). Tallennus luo jokaiselle oman, erillisen kerran tai suunnitelman (sama laji, päivä, kellonaika, tarkenne, muistiinpano ja liikuntapuiston osat). Ennen tallennusta jokaiselle voi säätää keston (tyhjä = sama kuin pääkerralla), kirjauksessa myös ponnistelun (kevyempi/tavallinen/kovempi) sekä lihas- ja luustovalinnan. Esiasetus ("enimmäkseen …") koskee kaikkia; oma minuuttijako koskee vain pääprofiilia, muille lasketaan lajin arvio heidän omalla ponnistelullaan. Kerrat eivät ole linkitettyjä: myöhemmin kutakin muokataan, kuitataan ja poistetaan erikseen. "Kumoa" poistaa kaikki samalla tallennuksella luodut. Piilotettu laji ei estä valitsemasta profiilia mukaan.
  - **Seuran kansallisuus ja kotipaikkakunta** (käyttäjän toive ja päätös 14.11.2026; `Club.country`, `Club.city`, `repo.saveClub`, `ui/flags.ts`, `ui/Flag.tsx`, `TeamLibrary`, `GamesTab`): seuralle (oma ja vastustaja) valitaan maa ja kirjoitetaan kotipaikkakunta (esim. Espoo). Tiedot ovat seurakohtaisia kuten logo (`clubs`-taulu, synkronoituu ja on varmuuskopiossa; ei skeemamuutosta, kentät valinnaisia): näkyvät kaikissa seuran joukkueissa. Vastustajan tiedot annetaan seuran näkymässä (maa tallentuu heti, paikkakunta kentästä poistuttaessa), oman joukkueen lomakkeessa tallennuksen yhteydessä (seuraosa; ilman erotettua seuraa koko nimelle). Lippu ja paikkakunta näkyvät joukkuekirjaston riveillä, seuran näkymässä ja omien joukkueiden listassa. **Liput piirtää sovellus** (Windows ei näytä lippuemojeja): 50 maata yksinkertaistettuina muotoina 30 × 20 -ruudukossa (pohjoismaat, Baltia, Eurooppa, Englanti ja Skotlanti, sekä yleisimmät muut), sama kuvaus SVG:nä näytöllä ja canvasilla (`drawFlag`) jakokuvissa; vaakunat ja pienet yksityiskohdat jätetään pois. Maa valitaan suomenkielisestä listasta (Suomi ensin). Seuran uudelleennimeäminen siirtää maan ja paikkakunnan logon tavoin. Maakoodi on ISO 3166 -kaksikirjaiminen (Englanti GB-ENG, Skotlanti GB-SCT).
  - **Otteluennakko ja jakokuvien värit** (käyttäjän toive ja päätökset 14.11.2026; `domain/previewCard.ts`, `features/share/drawPreview.ts`, `PreviewShare.tsx`, `ShareSheet.tsx`, `shareColors.ts`): kalenterin tulevan pelin ja turnauksen rivillä on painike **Ennakko**, joka avaa jaettavan ennakkokuvan samalla pohjalla kuin tuloskuva (Tarina 9:16 / Julkaisu 4:5, tyylit Pehmeä ja Urheilu; tuloskuvan tyyli "Teema" on nyt nimeltään Pehmeä). **Ottelu:** "Otteluennakko · taso · pelimuoto", päivä, oma joukkue – VS – vastustaja logoineen, nimien alla seuran lippu ja kotipaikkakunta, laatikot Paikalla (30 min ennen, vähintään lämmittelyn verran) ja Peli alkaa sekä Paikka. **Turnaus:** "Turnausennakko", turnauksen nimi ja päivä, oma joukkue lippuineen ja otteluohjelma kellonajan mukaan (aika, vastustajan logo, nimi, lippu ja paikkakunta, poikkeava pelipaikka; ilman ohjelmaa pelien määrä tyhjinä riveinä) sekä laatikot Paikalla, 1. peli, Pelit ja Paikka (tapahtuman paikka tai kaikkien pelien yhteinen paikka). Oma joukkue on tapahtumalle valittu joukkue tai profiilin ainoa joukkue. Puuttuvasta logosta näkyvät seuran nimikirjaimet (nyt seuraosasta: "HJK · Valkoinen" → HJK). Myös **tuloskuvaan** tulevat liput ja kotipaikkakunnat (ottelussa nimien alla, turnauksessa oman joukkueen nimen alla ja pelirivien lisätiedoissa). **Värit:** sovelluksen värit (oletus), kahdeksan valmista teemaa (sininen, vaaleansininen, punainen, musta ja kulta, vihreä, violetti, oranssi, keltainen) tai oma väri selaimen värivalitsimella. Pehmeä-tyylissä väri on taustan liukuväri (vaalealla värillä teksti tummaa), Urheilu-tyylissä tumma pohja sävytetään värillä ja väri on korostus (reunaviiva, tunniste, VS). Valinta muistetaan joukkueittain oman joukkueen seuralle (`Club.shareColor`, synkronoituu; oman värin tallennus vasta, kun valinta on hetken paikallaan) ja koskee sekä ennakko- että tuloskuvia; muoto ja tyyli muistetaan laitteella kuten ennen. Kuvat piirretään laitteella, ei verkkoliikennettä eikä riippuvuuksia.
  - **Korjaus: oman joukkueen logo ja tiedot jakokuvissa** (käyttäjän havainto 14.11.2026; `findOwnTeam`, `MissingTeamInfo` tiedostossa `features/share/ShareSheet.tsx`): ennakko- ja tuloskuva hakivat oman joukkueen logon vain seuralta, vaikka joukkuelista näyttää varalla joukkueen oman kuvan (vanhemmissa joukkueissa logo on tallennettu joukkueen kuvaksi). Nyt kuvat käyttävät samaa järjestystä: seuran logo, muuten joukkueen kuva (tapahtuman joukkue tai profiilin samanniminen joukkue). Jos oman joukkueen seuralta puuttuu maa tai kotipaikkakunta, jakopaneelissa on suoraan kentät "{seura}: maa ja kotipaikkakunta kuvaan" (tallentuvat seuralle kuten Joukkueet-kohdassa, kuva päivittyy heti). Puuttuvista logoista ja vastustajien tiedoista kerrotaan tarkemmin: kenen logo puuttuu ja montako vastustajaa on ilman logoa, maata tai paikkakuntaa, ja mistä ne lisätään.
  - **Sarjataso selkeästi jakokuvissa** (käyttäjän toive 14.11.2026; `levelBadges` tiedostossa `features/share/drawResult.ts`): ennakko- ja tuloskuvan yläotsikossa on enää tapahtuman laji (Otteluennakko / Turnausennakko / Ottelu / Turnaus). Sarjataso ja pelimuoto näkyvät päivämäärän alla omina merkkeinään: taso täytettynä korostusvärillä isoin kirjaimin (esim. ELITE), pelimuoto ääriviivoin (esim. 5v5). Merkkien teksti on aina luettava: korostuksen päällä tumma, vaalealla taustalla (esim. keltainen) korostus on tumma ja teksti valkoinen. Ilman tasoa ja pelimuotoa merkkejä ei ole.
  - **Tuloskuva samalla mallilla kuin otteluennakko** (käyttäjän toive 14.11.2026; `drawMatchup`, `infoBoxes`, `placeBox` tiedostossa `features/share/drawResult.ts`): ottelun tuloskuva käyttää samaa asettelua kuin ennakko: logo – keskiosa – logo, nimet logojen alla (enintään 3 riviä) ja niiden alla lippu ja kotipaikkakunta; keskellä VS:n tilalla tulos ja tulossana. Alareunassa samat laatikot kuin ennakossa: "Peli alkoi" (kerran tai kalenteritapahtuman aloitusaika) ja "Paikka" (kalenteritapahtumasta, josta kerta kuitattiin), jos tiedossa; lapsen maalit (valinnainen) laatikoiden yläpuolella. Turnauksen tuloskuvassa otsikon välit ovat samat kuin ennakossa ja pelirivien yläpuolella on otsikko "Tulokset" (vrt. "Otteluohjelma").
  - **Viikkoraportti PDF:ksi** (käyttäjän toive 14.11.2026; `domain/weekReport.ts`, `features/analysis/WeekReport.tsx`): kun viikko on täysi (viikon sunnuntai on mennyt), Viikko-näkymän viikonvaihtimen vieressä on painike "Viikkoraportti". Analyysi-näkymän viikkoraportti avaa saman raportin myös kesken olevalle viikolle (merkintä "Viikko on vielä kesken"). Raportti tulostetaan tai tallennetaan PDF:ksi selaimen tulostuksella samalla pohjalla kuin jaksoraportti (A4, vain raportti näkyy; tiedostonimi "Viikkoraportti {nimi} vko {nro}-{vuosi}"). Sisältö:
    - otsikkonauha: profiilin nimi, viikko, päivämäärät ja liikunta yhteensä tunteina;
    - yhteenvetoruudut: liikuntaa yhteensä (kirjatut + arkiliikunta), reipas + rasittava tunteina (keskiarvo min/pv arvioiduilta päiviltä), josta rasittavaa, päivätavoite täyttyi x/y päivänä ja kertojen määrä;
    - pylväskaavio päivittäin: rasittava ja reipas pinottuna, päivän luku pylvään päällä, tavoite katkoviivana, päivän liikunta tunteina ja ✓ tavoitepäivälle; sairas- ja matkapäivät merkitään pylvään tilalle;
    - viikon tehojakauma (kevyt / reipas / rasittava, osuudet ja tunnit);
    - tapahtumataulukko päivittäin: päivän rivillä kesto, reipas + rasittava ja rasittava sekä merkinnät (✓ tavoite, sairas/matka); sen alla kerrat kellonajan mukaan (laji, oma nimi, jalkapallon tulos ja vastustaja tai turnauksen V–T–H, lihas- ja luustomerkintä) ja arkiliikunnan rivi (perusarvio tai päivän vahvistus). Arkiliikunnan rivi on päivän kokonaismäärän ja kirjattujen kertojen erotus, joten rivit summautuvat täsmälleen päivän lukuihin. Lopussa viikon summarivi tunteina;
    - lajit (kerrat ja tunnit) sekä vertailu edelliseen viikkoon (liikunta, reipas + rasittava, rasittava, kerrat, tavoitepäivät ja muutos).
    Sairas- ja matkapäivinä perusarvio ei ole mukana eikä päivää lasketa tavoitteisiin (kuten viikon tunneissa). Raportti on vaalea paperi myös tummassa tilassa; tapahtumataulukko saa jakautua sivuille päivän kohdalta. Ei uusia riippuvuuksia eikä verkkoliikennettä.
  - **Korjaus: päiväkortin merkit yhdelle riville** (käyttäjän havainto 14.11.2026; `features/week/DayRow.tsx`): kapealla sarakkeella "✓ Suositus" (alle kouluikäinen), sairas-/matkapäivän ja loman merkki rivittyivät kahdelle riville ja olivat eri kokoisia eri päivinä. Merkit pysyvät nyt aina yhdellä rivillä ja samankokoisina; tilan loppuessa päivän nimi lyhenee.
  - **Korjauksia ja pikkulisäyksiä 17.11.2026** (käyttäjän lista 17.11.2026, vaihe 1):
    - **iPhone: "Päivitä PC:ltä" ja jakotiedostot** (`features/sync/fileIO.ts`, `features/story/StoryViewer.tsx`): tiedostovalitsin liitetään sivulle ennen avaamista ja sen sulkeminen ilman valintaa tunnistetaan (`cancel`-tapahtuma tai paluu sivulle ilman tiedostoa), joten valinta onnistuu ensimmäisellä yrityksellä eikä edellinen kesken jäänyt valinta jumita. Jakoarkissa ei enää anneta otsikkoa (`title`): iOS tallensi sen tiedoston rinnalle erillisenä "text"-tiedostona (Tiedostot-sovellukseen kertyi "text 2…9"). Synkronoinnin toimintaan muutos ei vaikuta: PC yhdistää rinnakkaiset kopiot ("liikkuminen 2/3") ja poistaa ne, ja toimitetuksi merkitään vain toisen laitteen tiedosto.
    - **Viikon suositusviesti vasta täydestä viikosta** (`ui/statusText.ts`, `features/week/WeekSummary.tsx`, `features/analysis/GoalCard.tsx`, `features/week/GoalSound.tsx`, `features/week/celebrate.tsx`): "Suositus täyttyi", juhlinta, putki ja ääni vasta kun viikon kaikki 7 päivää ovat mukana (sunnuntaista alkaen). Kesken olevalla viikolla tila kertoo tahdin: "Tahdissa (suositukseen)", "Lähellä tahtia – puuttuu …" tai "Alle (suosituksen) tahdin". Sama koskee alle kouluikäisiä. Juhlinnan muistiavain vaihtui (`celebratedFullWeeks`), jotta täydet viikot juhlitaan kerran uuden säännön mukaan.
    - **Alle kouluikäisen "Viikon rytmi" piiloon** (`features/week/WeekView.tsx`, `ui/EditLayoutSheet.tsx`): kortti ei kuulu alle kouluikäisen suositukseen (päivittäinen 3 h, josta 1 h vauhdikasta; ei rasittavia eikä vahvistavia päiviä), joten se jätetään pois näkymästä ja asettelusta, eikä se enää varaa tyhjää tilaa kaavioiden vieressä. Asettelun muokkauksessa kortti näkyy himmennettynä syyn kanssa (kuten luokittelumittari muille kuin kouluikäisille).
    - **Raportit aina vaaleina, värit kuten sovelluksen kaaviot** (`features/analysis/reportPalette.ts`, `WeekReport.tsx`, `SeasonReport.tsx`): viikko- ja jaksoraportti pysyvät vaaleana paperina myös tummassa teemassa (värit annetaan suoraan, eivät tumman tilan muunnoksen kautta). Kirjatut kerrat valitun väriteeman värillä, arkiliikunta oranssina (vahvistamaton arvio vinoviivoitettuna) ja tehot teeman sävyinä vaaleasta tummaan; otsikkonauha ja summarivi teeman tummalla sävyllä. Viikkoraportin päiväkaavio pinoaa kirjattujen kertojen ja arkiliikunnan reippaan + rasittavan; yhteenvetoruutuihin on lisätty jako "kirjatut · arki" ja päivän keskiarvo.
    - **Sovelluskuvake Vuono-väreihin** (`scripts/generate-icons.mjs`, `public/favicon.svg`, `public/*.png`): kuvake piirretään sovelluksen tunnuksesta (rengas ja piste) Vuono-teeman väreillä (tumma sinivihreä pohja, persikka kaari). Kuvake on kiinteä; kotivalikon kuvake päivittyy, kun sovellus lisätään kotivalikkoon uudelleen.
    - **Liikuntapuisto** (`seed/activityTypes.ts`, `db/repositories.ts`, `features/week/LabelField.tsx`, `features/quick-add/QuickAdd.tsx`): laji "Liikuntapuisto (esim. Superpark)" on nyt "Liikuntapuisto" (vanha sisäänrakennettu nimi päivitetään käynnistyksessä, `BUILT_IN_RENAMES`). Lajille on oma valinnainen kenttä "Mikä liikuntapuisto?" (esim. Superpark, Hoplop, Flowpark), joka tallentuu kerran nimeksi ja ehdottaa aiempia; kenttä on kirjauslomakkeessa heti lajin alla.
    - **"Uusi peli" -lomake** (`features/games/TeamNameFields.tsx`, `GamesTab.tsx`): Ikäluokka-kenttä on samalla tasolla vierekkäisten kenttien kanssa, ja "Tuleva peli" -painikkeen kuvake on ⚽.
    - **Arvion kategorian vaihto koko historiaan** (`db/repositories.ts` `changeEstimateCategory`, `features/settings/EstimatesSection.tsx`): arvion muokkauksessa "Vaihda kategoria (koko historia)". Tarkoitettu tilanteeseen, jossa sama arki on kahdesti (esim. päiväkotiarvio tehty ensin Muu-kategoriaan ja myöhemmin Päiväkoti-kategoriaan, jolloin päiväkoti näkyi kahdesti). Siirretty arvio saa uuden kategorian alkamispäivästään lähtien. Jos kohdekategorialla on päällekkäinen arvio, uudempi alkamispäivä voittaa: vanhempi päättyy uudemman alkua edeltävään päivään (samana päivänä alkanut siirrettävä väistyy kokonaan). Siirretyn arvion vahvistukset siirtyvät kohdekategorian oletuslajiin minuutteineen; jos päivälle on jo kohdekategorian vahvistus, vanha päällekkäinen vahvistus poistetaan. Tavalliset kirjatut kerrat eivät muutu.
  - **Joukkueet: vastustajat käsin, tallennetut ryhmät ja "Tietoja puuttuu"** (käyttäjän lista 17.11.2026, vaihe 2):
    - **Vastustajan lisäys käsin** (`db/repositories.ts` `addOpponent`/`removeOpponentMark`, `domain/opponentLibrary.ts`, `features/games/TeamLibrary.tsx`): Jalkapallo → Joukkueet → Vastustajat → "+ Lisää vastustaja" (seura, valinnainen ryhmä ja ikäluokka). Seura merkitään vastustajaksi (`Club.opponent`), jolloin se näkyy listassa ennen ensimmäistä peliäkin ("Ei vielä pelejä"); logon, maan ja paikkakunnan voi lisätä heti avautuvassa seuran näkymässä. Turnausten ja pelien vastustajat tulevat listaan edelleen automaattisesti. Käsin lisätty seura, jolla ei ole pelejä eikä tulevia pelejä, voidaan poistaa vastustajista (logo ja muut tiedot säilyvät).
    - **Ryhmät seuroittain** (`Club.squads`, `saveClubSquad`/`removeClubSquad`, `features/games/TeamNameFields.tsx`): seuran näkymässä "Tallennetut ryhmät" (ryhmä ja/tai ikäluokka, lisäys ja poisto). Kun seuran nimi kirjoitetaan peliin, turnauksen otteluohjelmaan, tulokseen tai omaan joukkueeseen, seuran tunnetut ryhmät (tallennetut ja peleistä löytyvät) näkyvät kenttien alla valintasiruina; napautus täyttää ryhmän ja ikäluokan. Otteluohjelman tiiviillä rivillä sirut näkyvät, kunnes ryhmä on annettu. Seuran nimen muutos ja ryhmän korjaus siirtävät tallennetut ryhmät ja vastustajamerkinnän mukana. Kentät synkronoituvat seuran tietueen mukana (rivitason viimeisin muutos voittaa kuten muillakin seuran tiedoilla).
    - **"Tietoja puuttuu"** (`Fixture.infoMissing`, `Fixture.missingNote`; `FixtureSheet.tsx`, `GamesTab.tsx`, `week/DayRow.tsx`, `week/Dashboard.tsx`): tulevan pelin ja turnauksen lomakkeessa ruksi "Tietoja puuttuu" ja valinnainen kuvaus (esim. "kellonaika, otteluohjelma"). Merkki "⚠ Tietoja puuttuu: …" näkyy kalenterissa ja tulosta odottavissa sekä viikon suunnitelmarivillä ja "Tulevat kerrat" -listassa, kunnes ruksi poistetaan.
    - Pelilomakkeen tyyppivalinnan ja kalenterin pelin kuvake on ⚽ (kuten "Tuleva peli" -painike).
  - **Harjoituspelit** (käyttäjän lista 17.11.2026, vaihe 3; `seed/activityTypes.ts`, `domain/football.ts` `friendlyRows`, `db/repositories.ts`, `features/games/FixtureSheet.tsx`, `GamesTab.tsx`, `features/football/FootballPanel.tsx`, `GamesView.tsx`, `FootballSection.tsx`, `features/games/DiaryView.tsx`, `TeamLibrary.tsx`, `domain/weekReport.ts`):
    - Uusi sisäänrakennettu laji **"Jalkapallo – harjoituspeli"** 🤝 (`football_friendly`, jalkapallon alalaji `friendly`, kategoria harrastus). Tehoprofiili kevyt 25 % / reipas 40 % / rasittava 25 % on sovelluksen lähtöarvio pelin ja treenin väliltä. Koko varattu aika (alku–loppu) lasketaan liikunnaksi; peliaikalaskentaa (pelasiko / pelatut minuutit) ei ole. Taso säätää ponnistelua kuten peleissä (Elite kovempi, Haaste kevyempi).
    - Jalkapallo-näkymän "Lisää kalenteriin" -kohdassa on oma painike **"Tuleva harjoituspeli"**, ja kalenterilomakkeen tyypeissä on Peli / Harjoituspeli / Turnaus. Kentät: päivä, alku ja loppu (kesto lasketaan niistä; ilman molempia kesto annetaan käsin, oletus 90 min), oma joukkue, vastustajat 1…n (seura, ryhmä, ikäluokka; "+ vastustaja"), taso, pelimuoto, paikka, muistiinpano ja "Tietoja puuttuu". Kalenterissa rivi "Harjoituspeli · Oma joukkue – vastustajat", klo alku–loppu. Ennakkokuvaa harjoituspelille ei tehdä.
    - Kuittaus tekee vastustajista tulosrivit. Lisätiedoissa jokaiselle vastustajalle voi kirjata valinnaisen tuloksen, oman lapsen maalit ja kommentin.
    - **Ei V–T–H-tilastoon:** `gameRows` ei palauta harjoituspelejä, ja `summarizeGames` ohittaa `friendly`-rivit varmuuden vuoksi. Pelien määrä, V–T–H, maalit, peliaika, tuloskuva ja otteluhistoria eivät muutu. Harjoituspelit näkyvät omana rivinään:
      - Tulokset-näkymän kortti "Harjoituspelit" (samat suodattimet, tulos ilman V/T/H-merkkiä);
      - jalkapallon jaksoyhteenvedon rivi "Harjoituspelit (ei tilastoissa)" (kerrat ja minuutit);
      - päiväkirja (Ottelut-suodatin mukaan lukien);
      - viikon päivärivi ja viikkoraportti (vastustajat ja tulokset);
      - joukkuekirjasto: seuran ryhmän alla "Harjoituspeli" -rivinä ilman V/T/H-merkkiä, ja listassa "harjoituspelejä n".
  - **Omatoiminen verryttely treenin yhteydessä** (käyttäjän lista 17.11.2026, vaihe 4; `domain/football.ts` `isClubTraining`, `trainingSelfStart`, `trainingSelfLabel`; `domain/ids.ts` `trainingSelfId`; `db/repositories.ts` `setTrainingSelf`, `trainingsWithoutSelf`, `addTrainingSelfFrom`; `features/football/TrainingSelf.tsx`, `features/settings/TemplateSection.tsx`, `features/week/SessionEditor.tsx`, `features/games/DiaryView.tsx`):
    - Seuran jalkapallotreenille voi kirjata omatoimisen alku- ja loppuverryttelyn minuutteina ("ennen treeniä" / "treenin jälkeen", 0–180 min). Se tallentuu **erilliseksi, treeniin linkitetyksi "Jalkapallo – omatoiminen" -kerraksi** (kategoria omatoiminen liikunta, lajin oma tehoprofiili, ponnistelu normaali). Treenin kesto ja teho eivät muutu.
    - Tunniste on johdettu (`w:<treenin id>`), joten kerta on kaikilla laitteilla sama. Kentät `linkedTo`, `selfBeforeMin`, `selfAfterMin`. Nimi on "Alkuverryttely", "Loppuverryttely" tai "Alku- ja loppuverryttely". Alkuaika on treenin alku − ennen-minuutit, tai treenin loppu, jos alkuverryttelyä ei ole.
    - **Viikkorytmi:** treenirivillä on oletusminuutit (`TemplateItem.selfBeforeMin/selfAfterMin`). Kuittaus luo verryttelykerran automaattisesti. Rivilistassa näkyy "🥾 omatoiminen 10 min ennen · 5 min jälkeen".
    - **Kerran muokkaus:**
      - Treenin minuutteja voi muuttaa tai nollata; 0 + 0 poistaa verryttelykerran.
      - Treenin päivän tai kellonajan muutos siirtää verryttelyn mukana.
      - Treenin poisto ja kuittauksen kumoaminen poistavat verryttelyn, ja "Kumoa" palauttaa molemmat.
      - Verryttelykertaa voi muokata myös suoraan; uusi kesto jaetaan ennen- ja jälkeen-osiin.
    - **Menneet treenit:** Asetukset → Viikkorytmi -kohdan kortti "Omatoiminen verryttely menneille treeneille". Kortissa valitaan alkupäivä (oletus 4 viikkoa sitten) ja minuutit, joiden oletus tulee viikkorytmistä. Esikatselu näyttää treenien määrän ja aikavälin. Verryttely lisätään vain treeneille, joilla sitä ei vielä ole, ja lisäys on kumottavissa.
    - **Tilastot:** verryttely lasketaan liikuntaan omana omatoimisena kertanaan. Se ei kasvata treenien määrää (jalkapallon jaksoyhteenveto, kauden kooste, tarina) eikä näy "lisätiedot puuttuvat" -laskurissa. Päiväkirjassa se näkyy treenin rivillä, ei omana kirjauksenaan.
  - **Otteluennakon tyylit, laatikot ja kommentti** (käyttäjän lista 17.11.2026, vaihe 5; `features/share/drawResult.ts`, `drawPreview.ts`, `ShareSheet.tsx`, `PreviewShare.tsx`, `domain/previewCard.ts`, `db/repositories.ts` `setPreviewNote`):
    - Ennakkokuvalla on kuusi tyyliä. Pehmeän ja Urheilun lisäksi:
      - **Kenttä:** nurmen leikkuuraidat ja himmeät kentän viivat.
      - **Juliste:** tasainen joukkueen väri, rasteripisteet ja viistoraidat yläkulmassa.
      - **Selkeä:** vaalea pohja, tumma teksti ja värikaista.
      - **Tulostaulu:** musta LED-pisteruudukko, kehys ja tasalevyiset numerot.
    - Tyyli vaihtaa taustan, värit ja fontin; asettelu on sama. Valittu väri (joukkueen väri) toimii kaikissa tyyleissä. Tyylit valitaan näytteinä (3 tai 6 rivissä). Valinta ja kuvan muoto muistetaan laitteelle erikseen tuloskuvasta (`previewSharePrefs`). Tuloskuvassa ovat edelleen vain Pehmeä ja Urheilu.
    - **Laatikot kuvassa:** "Paikalla", "Peli alkaa" (turnauksessa "1. peli"), "Pelit" (turnaus) ja "Paikka" voi ottaa pois kuvasta. Valittavina ovat vain laatikot, joille on tieto. Valinta muistetaan laitteelle kaikille ennakoille (`previewHiddenBoxes`).
    - **Kommentti pelin alle** (valinnainen, enintään 140 merkkiä): näkyy kuvassa paneelina ottelun (turnauksessa otteluohjelman) ja laatikoiden välissä, enintään kolmella rivillä. Tallentuu tapahtumalle (`Fixture.previewNote`), synkronoituu ja säilyy, kun tapahtumaa muokataan kalenterissa.
    - Ennakkokuvaa ei tehdä harjoituspelille (ennallaan).
  - **Tehon selitykset** (käyttäjän lista 17.11.2026, vaihe 6; `domain/intensityNotes.ts`, `ui/glossary.tsx` termi `intensity`, `features/week/IntensityPicker.tsx`, `features/settings/ActivityTypesSection.tsx`, `features/help/HelpSheet.tsx`):
    - **Yleinen selitys** (ⓘ "Teho: kevyt, reipas, rasittava"). Se on kirjauksen ja muokkauksen Teho-otsikon vieressä sekä kohdassa Tavoitteet ja lajit (lajilistan esittely ja lajin tehoprofiili). Selitys kertoo:
      - mitä kevyt, reipas, rasittava ja paikallaanolo tarkoittavat;
      - että teho on arvio (kesto × lajin tehoprofiili);
      - että "Kevyempi"/"Kovempi" ponnistelu muuttaa reippaan ja rasittavan osuutta 25 %;
      - että pelissä peliaika lasketaan pelin teholla ja lämmittely treenin teholla;
      - että vaihtoehtoina ovat "Enimmäkseen …" ja oma jako.
    - **Lajikohtainen perustelu** jokaiselle sisäänrakennetulle lajille (32): miksi oletusjako on sellainen, esimerkiksi treenin ohjeet ja jonotus, pelin vaihtopenkki tai päiväkotipäivän suositus. Perustelu näkyy:
      - kirjauksessa "Lajin arvio" -tilassa selitteenä "Miksi tämä jako?";
      - lajilistassa jokaisen lajin alla;
      - lajin muokkauksessa tehoprofiilin yläpuolella.
    - Jos lajin tehoprofiilia on muutettu, perustelun perään kerrotaan, että se koskee oletusta (oletusosuudet näkyvät). Omille lajeille ei ole perustelua.
    - Ohjeessa on lisäksi paikallaanolo, ponnistelun vaikutus ja maininta lajikohtaisista perusteluista.
  - **Sovelluksen tausta** (käyttäjän lista 17.11.2026, vaihe 7; `ui/theme.ts` `useBackground`/`applyBackground`, `public/theme-init.js`, `index.css` "taustat", `features/settings/AppearanceSection.tsx`, `ui/image.ts` `resizeBackground`):
    - Asetukset → Ulkoasu → **Tausta**. Vaihtoehdot:
      - **Oletus:** nykyinen hento hehku.
      - Piirretyt **Nurmi** (leikkuuraidat ja kentän viivat), **Vuono** (vuorisiluetit ja persikkainen hehku), **Metsä** (kuusirivit), **Lumi** (lumihiutaleet ja kinokset), **Paperi** (paperin rakeisuus), **Revontulet** ja **Kenttävalot** (lisätty 19.11.2026, ks. Revontulet ja Kenttävalot -taustat).
      - **Oma kuva.**
    - Piirretyt taustat ovat CSS:ää ja SVG-data-URI:ta (ei verkkoa, CSP sallii). Jokaisella on vaalea ja tumma versio, joka seuraa teemaa. Kuviot ovat hillittyjä, jotta kortit ja kaaviot erottuvat.
    - Tausta piirretään kiinteään kerrokseen `body::before`; se toimii myös iOS:ssä, jossa `background-attachment: fixed` ei toimi. Valinta näkyy esikatselukuvina, joissa on sama kuvio.
    - **Oma kuva:** valitaan laitteelta, pienennetään (pisin sivu 1600 px, JPEG) ja tallennetaan vain tälle laitteelle (localStorage). Kuva ei siirry synkronoinnissa eikä varmuuskopiossa, eikä sitä lähetetä minnekään.
    - Kuva himmennetään taustavärillä: **Himmennys** 30–90 %, oletus 65 %, tummassa teemassa tummalla. Kuvan voi vaihtaa tai poistaa. Jos laitteen tila ei riitä, sovellus ilmoittaa siitä.
    - Valinta on laitekohtainen kuten teema. `theme-init.js` asettaa taustan ennen käynnistystä (ei välähdystä).
  - **Tuloskuvaan kaikki tyylit ja ennakkokuva harjoituspelille** (käyttäjän pyyntö 17.11.2026; `features/share/drawResult.ts` `ALL_SHARE_STYLES`, `ResultShare.tsx`, `domain/previewCard.ts`, `features/share/drawPreview.ts`, `PreviewShare.tsx`, `features/games/GamesTab.tsx`):
    - Tuloskuvassa on nyt samat kuusi tyyliä kuin ennakkokuvassa: Pehmeä, Urheilu, Kenttä, Juliste, Selkeä ja Tulostaulu. Valinta muistetaan laitteella kuten ennenkin (`resultSharePrefs`).
    - Kalenterin harjoituspelillä on nyt **Ennakko**-painike. Arkin otsikko kertoo lajin (harjoituspelin, ottelun tai turnauksen ennakko).
    - Harjoituspelin ennakkokuvan tunniste on "Harjoituspeli". Laatikot ovat **Alkaa**, **Päättyy** (alku + kesto, vain saman päivän puolella) ja **Paikka**. Paikalla-aikaa ei ole.
    - Yksi vastustaja: sama VS-asettelu kuin ottelulla. Useampi vastustaja: otsikko "Pelitälli", oma joukkue ja lista **Vastustajat** kalenterin järjestyksessä. Kommentti, tyylit, värit ja laatikoiden valinta toimivat kuten ottelun ennakossa.
    - Harjoituspeli ei edelleenkään tule tuloskuvaan, koska tulos ei mene tilastoihin.
  - **Taustojen hienosäätö** (käyttäjän palaute 17.11.2026; `index.css` "taustat"):
    - **Nurmi:** kentän viivat poistettu, koska ne häiritsivät. Jäljellä ovat vain hennot, pehmeäreunaiset leikkuuraidat ja valo ylhäältä.
    - **Vuono ja Metsä** on piirretty uudelleen pehmeinä, kerroksellisina siluetteina. Kulmikkaat kolmiot on korvattu käyrillä (Catmull-Rom → Bézier).
    - Kaukaiset kerrokset ovat vaaleampia, ja niiden väliin on lisätty usvaa (ilmaperspektiivi). Metsän puut ovat pyöreäkärkisiä, ja kaukaiset puurivit ovat hieman sumeita.
    - Siluetit säilyttävät mittasuhteensa kaikilla näytön leveyksillä (`slice`).
  - **Verryttely osaksi treeniä, Harjoituspeli-merkki ja vastustajan ryhmä talteen** (käyttäjän palaute 17.11.2026):
    - **Verryttely** (`domain/football.ts` `foldTrainingSelves`, `DayRow`, `DayTable`, `Dashboard`, `highlights`, `SessionEditor`, `WeekView`):
      - Alku- ja loppuverryttely ei ole enää oma tehtävä. Viikkonäkymän päivärivillä ja taulukossa se näkyy treenin rivillä (🥾 omatoiminen … min ennen/jälkeen), kuten päiväkirjassa.
      - Verryttelyä ei pyydetä täydentämään ("Lisätiedot"), arvioimaan eikä kommentoimaan. Se ei näy viimeisimmissä kerroissa eikä kohokohtien kertamäärässä.
      - Minuutit lasketaan edelleen omalla tehojaollaan, joten päivän ja viikon summat eivät muutu. Minuutit muutetaan treenin muokkauksesta.
    - **Kalenteri** (`GamesTab` `FixtureSummary`): harjoituspelin rivillä on korostettu HARJOITUSPELI-merkki ennen joukkueita.
    - **Vastustaja talteen** (`repositories` `rememberOpponents`, `createFixture`/`updateFixture`):
      - Kun kalenterin peli, harjoituspeli tai turnaus tallennetaan, vastustajaseura tulee Vastustajat-listaan ja uusi ryhmä/ikäluokka seuran valinnaksi heti, jo ennen pelin pelaamista.
      - Tallennus kirjoittaa vain, jos jotain puuttuu. Virhe ei estä pelin tallennusta.
  - **Mustavalkoiset jakokuvavärit** (käyttäjän toive 17.11.2026, esim. FC Lahti; `features/share/shareColors.ts`, `drawResult.ts`):
    - Värivalintaan on lisätty **Musta ja valkoinen** (musta pohja, valkoiset raidat ja korosteet) sekä **Valkoinen ja musta** (vaalea pohja, mustat raidat ja korosteet).
    - Valinta muistetaan joukkueelle kuten ennenkin, ja se toimii kaikissa tyyleissä sekä tulos- että ennakkokuvassa.
    - Urheilu- ja Kenttä-tyyli käyttävät tumman pohjavärin kanssa valitun värin korostusta, eivät enää kiinteää keltaista tai vaalennettua pohjaväriä.
  - **Pelin ja turnauksen päättymisaika: kokeiltu ja poistettu** (17.11.2026). Käyttäjän mielestä vanha tapa on parempi. Peleissä ja turnauksissa annetaan alku ja kesto (turnauksessa kesto voidaan laskea otteluohjelmasta). Vain harjoituspelillä on alku ja loppu.
  - **Tupla päiväkoti vanhoilla päivillä: ilmoitus ja korjaus** (käyttäjän havainto 17.11.2026; `db/repositories.ts` `daycareDoubles`/`mergeDaycareDoubles`, `features/settings/EstimatesSection.tsx`):
    - Syy: arviolista näytti vain tänään voimassa olevat arviot. Jos vanha muun kategorian päiväkotiarvio oli jo päättynyt ja Päiväkoti-arvio alkoi taaksepäin, vanhoilla päivillä oli voimassa molemmat. Vanhaa arviota ei kuitenkaan voinut valita, joten "Vaihda kategoria" ei ollut käytettävissä.
    - **Ilmoitus:** Asetukset → Arkiliikunta näyttää ilmoituksen "Päiväkoti näkyy osalla päivistä kahdesti" ja painikkeen **Yhdistä Päiväkotiin**, kun:
      - muussa kategoriassa on päiväkodiksi nimetty arvio (myös päättynyt; nimessä esim. päiväkoti tai varhaiskasvatus) tai sellaisia vahvistuksia
      - ja profiililla on Päiväkoti-kategorian arvio tai vahvistus.
    - **Yhdistäminen:** arviot siirretään Päiväkotiin koko historiaan samoin säännöin kuin kategorian vaihdossa (uudempi alkamispäivä voittaa, vahvistukset siirtyvät mukaan). Jäljelle jääneet muun kategorian päiväkotivahvistukset siirretään Päiväkotiin, tai ne poistetaan, jos päivälle on jo Päiväkoti-vahvistus. Tavalliset kirjatut kerrat eivät muutu.
    - **Aiemmat arviot:** päättyneet ja myöhemmin alkavat arviot näkyvät avattavana listana omine kausineen. Kunkin kategorian voi vaihtaa koko historiaan. Kategorian vaihdon päällekkäisyysilmoitus huomioi myös päättyneet arviot, jotka osuvat samalle ajalle.
  - **Tupla päiväkoti: korjaus myös päivän ikkunaan, ja "ei tänä päivänä" -merkinnät** (käyttäjän kuvakaappaus 17.11.2026; `EstimateDaySheet`, `repositories` `changeEstimateCategory`/`mergeDaycareDoubles`, `domain/aggregate.ts` `isDaycareLabel`):
    - Kun päivän Arkiliikunta-ikkunassa on sekä Päiväkoti-arvio että muun kategorian päiväkotiarvio, ikkunassa näkyy ilmoitus "Päiväkoti on tällä päivällä kahdesti" ja painike **Yhdistä Päiväkotiin**. Se tekee saman yhdistämisen kuin Asetukset → Arkiliikunta.
    - Tuplalle tehty "ei tänä päivänä" (0 min) poistetaan päivinä, joille Päiväkoti-arvio on voimassa. Sitä ei siirretä Päiväkotiin, joten Päiväkoti-arvio ei nollaudu. Sama sääntö koskee kategorian vaihtoa koko historiaan.
    - Päiväkotinimen tunnistus ei riipu siitä, miten ä-kirjain on tallennettu (NFC-normalisointi).
  - **Tehoarvion selkeämpi asettelu kerran muokkauksessa** (käyttäjän palaute 17.11.2026; `features/week/IntensityPicker.tsx`, `SessionEditor.tsx`):
    - Ponnistelun valinnan alla on yksi arviolaatikko kahden erillisen "arvio"-rivin sijaan:
      - otsikkorivillä "arvio"-merkki, laji (ja kovempi/kevyempi) sekä "Miksi tämä jako?"
      - minuutit kolmena lukuna (Kevyt / Reipas / Rasittava), kun kesto on tiedossa
      - "Reipasta ja rasittavaa yhteensä N min"
      - lajin prosenttijako pienellä.
    - Pikakirjauksessa laatikossa näkyy otsikkorivi ja jako.
  - **✓ Suositus -merkki myös kouluikäisille** (käyttäjän toive 17.11.2026; `DayRow` `schoolAge`, `WeekView`, `DayTable`, `domain/dayTarget.ts` `dayGoalMet`):
    - Viikkonäkymän päivärivillä näkyy kouluikäiselle **✓ Suositus**, kun päivän reipas + rasittava (kirjatut kerrat ja arkiliikunnan arvio) on vähintään 60 min.
    - Merkki ei näy tulevilla päivillä eikä sairas- tai matkapäivillä. Selite kertoo ehdon.
    - Päivätaulukossa kouluikäisellä on vastaava ✓-sarake (x/7).
    - Viikon suositus (keskimäärin 60 min/pv) ja sen juhlinta pysyvät ennallaan.
  - **Treenin verryttely lasketaan Harrastukseen** (käyttäjän kysymys ja valinta 17.11.2026; `domain/aggregate.ts` `sessionCategory`, `dayTotals`, `domain/hours.ts`):
    - Treeniin linkitetty alku- ja loppuverryttely (`linkedTo`, "Jalkapallo – omatoiminen") kuuluu treeniin, joten se lasketaan kategoriassa **Harrastus** treenin kanssa.
    - Aiemmin se laskettiin Omaehtoiseen. Silloin korvausperiaate pyyhki treenipäivinä päivän "Leikki ja oma liikkuminen" -arvion, ja viikon omaehtoinen liikunta näytti liian pientä.
    - Erillinen "Jalkapallo – omatoiminen" -kerta (ei linkitetty treeniin) pysyy Omaehtoisena. Se ei kuitenkaan korvaa arviota, katso alla.
    - Laji, tehot ja jalkapallon omatoimisen harjoittelun yhteenveto eivät muutu. Muutos koskee vain kategoriaa, eli päiväkoostetta, viikon tunteja ja kontekstijakoa.
    - Päivän Arkiliikunta-ikkuna käyttää samaa kategoriaa: treenipäivän verryttely ei näytä Leikki ja oma liikkuminen -arviota "kirjattuna" (korjattu käyttäjän kuvakaappauksesta 17.11.2026).
  - **Omatoiminen lajiharjoittelu tulee leikkiarvion päälle** (käyttäjän valinta 17.11.2026; `domain/aggregate.ts` `addsToEstimate`, `dayTotals`, `domain/hours.ts`, `domain/report.ts`, `EstimateDaySheet`):
    - Lajiharjoittelu on omaehtoinen laji, jolla on urheilulaji (nyt "Jalkapallo – omatoiminen", kun sitä ei ole linkitetty treeniin). Se on eri asia kuin leikki ja oma liikkuminen.
    - Poikkeus korvausperiaatteeseen: lajiharjoittelu ei korvaa päivän omaehtoisen arviota. Päivälle lasketaan kirjattu lajiharjoittelu ja arvio. Esimerkki: 20 min pallottelua ja 60 min leikkiarvio tekevät Omaehtoiseen 80 min.
    - Muut omaehtoiset kerrat (esim. vapaa leikki, trampoliini, pyöräily) korvaavat arvion kuten ennenkin. Jos päivälle on kirjattu sekä lajiharjoittelua että muuta omaehtoista, arvio väistyy.
    - Sama sääntö koskee viikon tunteja: arvio, toteuma, ennuste ja arkiliikuntarivi. Suunniteltu lajiharjoittelu ei korvaa arviota viikon arviossa.
    - Päiväkoosteessa kategoriaan tallentuu tällöin kirjattu osuus ja `addedEstimate` (arvion osuus). Jakson raportti laskee ne kirjattuun ja arvioon erikseen.
    - Arkiliikunta-ikkunassa arvio pysyy muokattavana. Lisäksi ikkuna kertoo, että lajiharjoittelua on kirjattu N min arvion päälle.
  - **Arkiliikunta-ikkunasta pois päivät, joille arvio on 0 min** (käyttäjän kysymys 17.11.2026; `EstimateDaySheet`):
    - Arvio on voimassa koko jakson. Koulumatkojen ja välituntien viikonlopun minuutit ovat 0, joten ikkuna näytti viikonloppuisin turhat 0 min rivit "Vahvista"- ja "Ei tänä päivänä" -painikkeineen.
    - Nyt rivi näkyy vain, jos arvion päivän minuutit ovat yli 0 tai rivillä on jo merkintä (vahvistus tai erillinen kirjaus). Päivän arkiliikuntarivi ja pikavahvistus ohittivat 0 min arviot jo aiemmin.
  - **Viikkonäkymän päivän nimi ilman katkaisua** (käyttäjän kysymys 17.11.2026; `DayRow`):
    - Päivän nimi katkesi kolmella pisteellä ("Sunnuntai…"), kun oikealla oli pitkä "min yhteensä" -teksti ja rivillä ✓ Suositus -merkki.
    - Nimi näkyy aina kokonaan (käyttäjän tarkennus: nimi ei saa jäädä pois). Jos tila ei riitä, oikean reunan yhteismäärä ja mittari siirtyvät nimen alle omalle rivilleen (flex-wrap). Nimi näkyy myös puhelimessa (käyttäjän valinta 17.11.2026). Kapealla näytöllä mittarit rivittyvät tarvittaessa nimen alle. (Muutettu 19.11.2026: luvut ovat kortin alalaidan tietorivillä, ks. Päiväkortin tiedot samassa kohdassa.)
    - Nimi on perusmuodossa ("Sunnuntai"), ei taivutettuna ("Sunnuntaina").
  - **Suomalaiset jalkapalloseurat valmiina** (käyttäjän toive 17.11.2026; `seed/finnishClubsData.ts`, `domain/finnishClubs.ts`, `TeamNameFields`, `repositories` `addOpponent`):
    - Sovelluksen mukana on Palloliiton jäsenseurojen luettelo, 955 seuraa. Lähde on Palloliiton tulospalvelu (Seurat ja Kunnat), haettu kerran 17.11.2026. Kultakin seuralta: lyhenne, virallinen nimi, kotikunta, Palloliiton alue (Eteläinen, Läntinen, Itäinen, Pohjoinen, Åland) ja tieto juniorijoukkueista.
    - Mukana ovat seurat, joilla on kotikunta. Erotuomarikerhot puuttuvat. Luettelo päivitetään käsin aina välillä.
    - Sovellus ei hae luetteloa verkosta. Luetteloa ei myöskään tallenneta tietokantaan eikä synkronoida. Seura tallentuu käyttäjän tiedoksi vasta, kun se valitaan peliin tai vastustajaksi.
    - Seurakentän ehdotuksissa ovat ensin omat ja peleistä tutut seurat. Sen jälkeen tulevat luettelon seurat tässä järjestyksessä: oman joukkueen kotikunnan seurat, oman alueen seurat ja muut. Kunkin ryhmän sisällä juniorijoukkueelliset tulevat ensin. Ehdotuksen selitteenä on virallinen nimi ja kotikunta, ja hakuun käy kumpi tahansa (esim. "Kuopion" → KuPS).
    - Näytettävä nimi on lyhenne (esim. KuPS, HJK, FC Lahti), jos se on virallista nimeä lyhyempi.
    - Uudelle vastustajalle tallentuu luettelosta maa (Suomi) ja kotikunta, jos niitä ei ole vielä annettu (käyttäjän valinta 17.11.2026). Näin jakokuvan lippu ja kotikunta ovat valmiina.
    - Jo tallennetut luettelon seurat täydennetään samoin kerran kullakin laitteella käynnistyksessä (`fillClubOrigins`, laitekohtainen merkintä `clubOriginsFilled`). Kirjoitus tehdään vain puuttuviin kenttiin, joten muutokset synkronoituvat tavalliseen tapaan.
    - Seuraa, jolle on valittu muu maa kuin Suomi, ei muuteta, eikä annettua maata tai kotikuntaa korvata. Käyttäjän myöhemmin poistama maa ei palaa.
  - **Erittelykortin kategoriat avautuvat: mistä tunnit koostuvat** (käyttäjän kysymys 17.11.2026, esim. "mitä on 8 h omaehtoinen"; `domain/hours.ts` `CategoryItem`, `features/week/HoursCard.tsx`):
    - "Tunnit päivittäin ja lajeittain" -kortin kategoriarivit ovat painikkeita (aria-expanded). Avattu rivi listaa toteuman sisällön suurin ensin:
      - kirjatut kerrat lajeittain (kuvake, laji, kertojen määrä, kesto)
      - treenin verryttely omana rivinään
      - vahvistettu arkiliikunta arvion nimellä (päiviä)
      - arkiliikunnan arvio arvion nimellä (päiviä, esim. "Leikki ja oma liikkuminen · arkiliikunnan arvio · 6 pv").
    - Sisältö lasketaan samassa silmukassa kuin toteuma, joten rivien summa on aina kategorian toteuma. Korvausperiaate ja lajiharjoittelun poikkeus pätevät.
    - Kesto alle tunnin näytetään minuutteina, muuten tunteina.
    - Logoja ei tuoda valmiiksi, koska ne ovat seurojen omaisuutta. Käyttäjä lisää logon itse.
  - **Laskennan johdonmukaisuus: tarkastuksen havainnot 1–5** (käyttäjän pyytämä tarkastus 17.11.2026; `domain/aggregate.ts`, `domain/hours.ts`, `domain/report.ts`, `domain/longTerm.ts`, `domain/weekReport.ts`, `domain/football.ts` `typeTotals`, `features/analysis/HeatmapCard.tsx`, `features/story/story.ts`, `db/repositories.ts`):
    - Määritelmät, joita kaikki näkymät nyt noudattavat:
      - **Vahvistettu arkiliikunta on kirjattua tietoa, mutta ei kerta.** Se on mukana kaikissa "Vain kirjatut" -luvuissa (suositusarvio, lämpökartta) ja näkyy kaavioissa omana osanaan "Arkiliikunta" kertojen ja arvion välissä. Kertamääriin sitä ei lasketa.
      - **Kaikki liikunta = kesto** (kertojen ja arkiliikunnan minuutit tauot mukaan lukien), kuten viikon tunneissa ja alle kouluikäisen 3 h -suosituksessa (päätös 14.11.2026). Kevyt + reipas + rasittava on tehoarvio kestosta, ei kokonaismäärä.
      - **Treenin verryttely (linkedTo) on osa treeniä**: ei oma kerta, ja sen minuutit lasketaan lajilistoissa treenin lajiin.
    - Havainto 1: lämpökartan "Vain kirjatut" sisältää vahvistetun arkiliikunnan kuten suositusarvio. Tuntikortin kategoriapalkki näyttää osat (kerrat, vahvistettu arkiliikunta, arvio) kuten päiväpylväät; uusi kenttä `CategoryHours.confirmed`.
    - Havainto 2: arkiliikunnan vahvistus lasketaan arvion omalla tehoprofiililla (`SessionInput.shares`, tallentuu snapshotiksi), joten vahvistus sellaisenaan ei muuta päivän reipasta ja rasittavaa. Minuuttien muutos säilyttää profiilin. "Laske uudelleen" ei koske vahvistuksia. Aiemmat vahvistukset korjataan kerran laitteella päivänä voimassa olleen arvion profiilille (`alignConfirmationShares`, meta `confirmationSharesAligned`); kesto ei muutu.
    - Havainto 3: kausikoosteen "Liikuntaa yhteensä" ja paras viikko, pitkän aikavälin "Kaikki liikunta (kesto)" kaikille ryhmille, kausiraportin "Kaikki liikunta", lämpökartan minuuttimittari ja "Liikuntaa yhteensä" sekä Analyysin "Jakauma kategorioittain" (suluissa) lasketaan kestona. Tulostettavan viikkoraportin tehojakaumaan tuli osa "Tauot ja paikallaanolo", joten osat summautuvat Yhteensä-lukuun.
    - Havainto 4: ohjattu / omaehtoinen / arki -jaossa näkyy kunkin osan kategoriat (`contextContents`, esim. "Omaehtoinen – kategoriat: Välitunnit, Omaehtoinen, Perhe"), koska konteksti on laajempi kuin samanniminen kategoria. Kiinteät, vanhentuneet selitteet poistettiin.
    - Havainto 5: `DayTotals.sessionCount` on liikuntakerrat ilman vahvistuksia ja verryttelyä; uusi `confirmations`. Kattavuus lasketaan kerroista ja vahvistuksista (`hasLoggedData`). Verryttely ei ole oma kerta lämpökartassa, kausikoosteessa, pitkän aikavälin ja kausiraportin lajilistoissa eikä viikkoraportissa (treenin rivillä "verryttely N min"). Viikon yhteenvedon ruutu "Kirjauksia" on nyt "Liikuntakertoja".
  - **Laskennan johdonmukaisuus: tarkastuksen havainnot 6–12** (17.11.2026; `domain/aggregate.ts`, `domain/dayTarget.ts`, `domain/hours.ts`, `domain/report.ts`, `domain/weekReport.ts`, `domain/heatmap.ts`, `features/week/HoursCard.tsx`, `LastWeekCard.tsx`, `features/analysis/HeatmapCard.tsx`, `LongTermView.tsx`, `SeasonReport.tsx`, `GoalCard.tsx`):
    - Havainto 6: ohjattu / omaehtoinen / arki -jako lasketaan edelleen kirjatusta reippaasta ja rasittavasta (7.10), mutta se kerrotaan nyt kortin otsikossa ("Kirjattu reipas ja rasittava"), selitteessä (kerrat ja vahvistettu arkiliikunta; vahvistamaton arvio ei ole mukana, joten välitunnit ja leikki voivat näkyä pienempinä) ja kausiraportissa ("Mistä kirjattu liikunta kertyy").
    - Havainto 7: aikuisen päivätavoite verrataan painotettuun lukuun reipas + 2 × rasittava (`dayGoalValue`), kuten viikon 150 min ja päivätavoite 150/7. Koskee päivämerkkejä (`dayGoalMet`), viime viikon minipylväitä, viikkoraportin tavoitetekstiä ja lämpökartan tavoitemittaria (`HeatDay.goal`).
    - Havainto 8: viikon tunneissa ei arkiliikunnan arviota seurannan alkua edeltäville päiville (`weeklyHours` `trackingStart`), kuten suositusarviossa.
    - Havainto 9: viikkoraportin lihas- ja luustopäivät eivät laske sairas- ja matkapäiviä, kuten suositusarvio. Tunneissa sairas- ja matkapäivien kirjatut kerrat ovat mukana (liikunnan määrä), arkiliikunnan arvio ei; tämä kerrotaan "Miten lasketaan" -selitteessä.
    - Havainto 10: rasittava päivä lasketaan vain kertojen rasittavasta (`DayTotals.sessionVigorous`, `isVigorousDay`); vahvistettu arkiliikunta ei tuota rasittavaa päivää, kuten ei arviokaan. Koskee suositusarviota, päivätaulukkoa ja Viikon rytmiä.
    - Havainto 11: kuluva päivä tulee suositusarvioon vasta, kun sille on kirjattu kerta tai arkiliikunnan vahvistus (`report.excluded.today`); muuten aamun tyhjä päivä laski viikon keskiarvoa. Tavoitekortti kertoo tämän ("tämä päivä tulee mukaan, kun sille on kirjattu jotain"). Tunnit ja lämpökartta näyttävät kuluvan päivän kuten ennen.
    - Havainto 12: erittelykortin kategoriariveillä on selite "toteutunut / arvio koko viikolle"; päättyneellä viikolla näkyy vain toteutunut. Palkin värit vastaavat selitettä (kerrat, arkiliikunta vahvistettu, arkiliikunnan arvio).
  - **Korjaus: valikko ja sisältö eivät välky profiilia vaihdettaessa** (käyttäjän havainto 17.11.2026, PC; `features/football/useFootballEnabled.ts`, `App.tsx`, `ui/settle.ts`, `features/analysis/useReport.ts`, `features/football/useFootball.ts`, `features/games/DiaryView.tsx`, `FootballHero.tsx`, `public/theme-init.js`):
    - Syy: jalkapallon tila haettiin vasta profiilin vaihtuessa, ja haun ajan (~200 ms) näkyi edellisen profiilin tila. Jalkapallo-välilehti ilmestyi tai katosi hetken päästä, ja valikon rivit siirtyivät.
    - Kaikkien profiilien jalkapallotila lasketaan kerralla (`useFootballStatusMap`) ja jaetaan kontekstilla (`FootballStatusContext`). Vaihto on välitön. Profiilin oma haku on sidottu profiiliin, joten edellisen profiilin tulos ei koskaan näy.
    - Käynnistyksessä käytetään viimeksi tiedettyä tilaa (laitekohtainen `footballTab`), ettei välilehti ilmesty profiilien latauduttua. Mitattu asettelusiirtymä käynnistyksessä 0,002 → 0.
    - Sisältö: raportti ja jalkapallodata on sidottu profiiliin ja jaksoon. Vaihdon aikana ei lasketa uuden profiilin nimellä tyhjää raporttia ("0 / 60 · Liian vähän kirjauksia"). Edellinen kokonainen tulos pysyy, kunnes uusi on valmis.
    - Kortit hakevat tietonsa erikseen, joten ne päivittyivät porrastetusti 3–4 vaiheessa. Sisältöalue piilotetaan vaihdon hetkellä ja häivytetään näkyviin, kun muutokset ovat rauhoittuneet (`hideUntilSettled`: 160 ms hiljaista, enintään 900 ms). Liikettä vähentäville ilman siirtymää.
    - Jalkapallo-välilehti: latauksen aikana näkyy paikanpitäjä, ei tyhjää tilaa ("Ei vielä jalkapallokertoja", "0 jalkapallokertaa", "Ei tulevia pelejä kalenterissa").
    - Tumma teema: selaimen ja PC-ikkunan yläpalkin väri asetetaan jo ennen sovelluksen latautumista, ettei se välähdä vaaleana.
  - **Korjaus: muut graafiset havainnot** (käyttäjän pyytämä analyysi 17.11.2026; `features/week/WeekView.tsx`, `ui/TabPanel.tsx`, `ui/settle.ts`, `App.tsx`, `features/games/GamesTab.tsx`, `features/football/GamesView.tsx`, `vite.config.ts`, `index.css`):
    - Viikon selaus: kortit päivittyivät 3–4 vaiheessa noin 0,5 sekunnin aikana, ja yhteenveto näytti hetken edellisen viikon lukuja. Kortit piilotetaan viikon vaihtuessa ja tuodaan näkyviin kerralla, kun uuden viikon tiedot ovat valmiit (sama `hideUntilSettled` kuin profiilin vaihdossa). Viikon otsikko vaihtuu heti.
    - Lataus ei ole tyhjä tila: Pelit-näkymän "Kalenteri on tyhjä", "Kaikki tulokset kirjattu" ja "Ei pelejä valinnoilla" näkyvät vasta, kun tiedot on haettu. Latauksen ajan näkyy paikanpitäjä.
    - Piilotetut välilehdet: kerran avattu välilehti pysyy muistissa, mutta piilossa sen haut ja laskenta pysähtyvät (React `Activity`). Tietokannan muutos ei enää laske uudelleen näkymättömiä välilehtiä, kuten raskasta Analyysiä. Palatessa sisältö näkyy heti, jos mikään ei muuttunut. Jos profiili vaihtui tai tietoja muutettiin välilehden ollessa piilossa, sisältö tuodaan näkyviin kerralla päivitettynä, eikä vanhoja lukuja näytetä.
    - Fontit esiladataan HTML:stä (`<link rel="preload">`, koontivaiheen oma pieni lisäosa, ei uusia riippuvuuksia). Ensimmäisellä käynnistyksellä teksti ei vaihdu varafontista sovelluksen fonttiin kesken näkymän.
    - Nopea toinen klikkaus kesken välilehden vaihdon verrataan viimeksi pyydettyyn välilehteen, ei vielä näkyvään. Paluu lähtövälilehdelle kesken siirtymän toimii. Ohitettu siirtymä ei enää tuota konsolivirhettä.
    - Ei korjattavissa: asennetun sovelluksen käynnistysruutu (splash) on aina vaalea, myös tummassa teemassa. Sen väri tulee manifestin `background_color`-kentästä, joka on yksi kiinteä arvo, eikä manifesti tue tummaa vaihtoehtoa. Sovellus itse vaihtuu tummaksi heti ensimmäisessä ruudussa.
  - **Pelin ja turnauksen linkki** (käyttäjän toive 17.11.2026; `domain/link.ts`, `ui/InfoLink.tsx`, `Fixture.link`, `FootballDetails.link`, `features/games/FixtureSheet.tsx`, `features/football/FootballPanel.tsx`, `GamesTab.tsx`, `GamesView.tsx`, `TournamentDay.tsx`):
    - Tulevan pelin, harjoituspelin tai turnauksen lomakkeessa sekä kirjatun pelin lisätiedoissa on kenttä "Linkki (valinnainen)". Siihen voi liittää esimerkiksi turnauksen sivun, otteluohjelman tai tulospalvelun osoitteen. Treenillä kenttää ei ole.
    - Osoitteen alku https:// lisätään, jos se puuttuu. Vain http- ja https-osoitteet hyväksytään (enintään 500 merkkiä); muuten lomake pyytää tarkistamaan linkin.
    - Kuittauksessa (myös turnauspäivän pikakirjauksessa) linkki siirtyy kalenterista kirjaukseen. Lisätiedoissa sen voi vaihtaa tai tyhjentää.
    - Linkki näkyy "Tiedot ↗" -painikkeena tai kuvakkeena kalenterin tulevissa ja tulosta odottavissa peleissä, turnauspäivän kortissa sekä Tulokset-listassa (yksittäinen peli, turnauksen ja harjoituspelin otsikko). Se avautuu selaimen uuteen välilehteen (`noopener noreferrer`).
    - Sovellus ei hae linkistä mitään eikä ota yhteyttä verkkoon (SPEC 11). Sivu avautuu vain käyttäjän napautuksesta. Linkki synkronoituu ja kuuluu varmuuskopioon kuten muutkin pelin tiedot.
  - **Ryhmä ja ikäluokka jakokuvissa** (käyttäjän toive 17.11.2026; `domain/shareNames.ts`, `features/share/ShareSheet.tsx` `TeamDetailChips`, `PreviewShare.tsx`, `ResultShare.tsx`):
    - Otteluennakon ja tuloskuvan paneelissa on valinta "Ryhmä ja ikäluokka kuvassa", erikseen **Oma joukkue** ja **Vastustaja(t)**. Pois valittuna kuvassa näkyy pelkkä seura, esim. "HJK · Musta · 2016" → "HJK".
    - Valinta näkyy vain, kun nimessä on ryhmä tai ikäluokka. Oletuksena kaikki näkyy, kuten ennen.
    - Valinta muistetaan laitteelle, ja se on yhteinen ennakko- ja tuloskuville. Se koskee vain kuvaa; tallennettu nimi, logo, maa ja paikkakunta eivät muutu.
    - Jos kuvassa on toinen joukkue samasta seurasta (esim. HJK · Valkoinen vastaan HJK · Musta), ryhmä jää erottamaan ne ja vain ikäluokka piilotetaan.
  - **Kommentin tausta, sarja ja koti/vieras jakokuvissa** (käyttäjän toive 18.11.2026; `domain/types.ts` `HomeAway`, `Fixture.series/homeAway`, `ScheduledGame.homeAway`, `GameResult.homeAway`, `FootballDetails.series/homeAway/shareNote`, `domain/football.ts` `HOME_AWAY_LABEL`, `cleanSeries`, `previewCard.ts`, `resultCard.ts`, `features/share/drawResult.ts`, `drawPreview.ts`, `PreviewShare.tsx`, `ResultShare.tsx`, `ShareSheet.tsx`, `features/games/HomeAway.tsx`, `FixtureSheet.tsx`, `features/football/FootballPanel.tsx`, `repo.setResultNote`):
    - **Kommentti:** tuloskuvaan tuli oma valinnainen kommentti (enintään 140 merkkiä). Se tallentuu pelille (`FootballDetails.shareNote`) ja synkronoituu, eikä lisätietolomakkeen tallennus poista sitä. Ennakko- ja tuloskuvassa on valinta "Kommentti harmaalla taustalla":
      - Päällä (oletus): paneeli korostusviivalla laatikoiden yläpuolella, kuten ennen.
      - Pois: pelkkä teksti heti pelin alla. Ottelussa teksti on keskitetty, turnauksessa ja pelitällissä listan alla.
    - **Sarja** (esim. P9, T12; valinnainen, enintään 20 merkkiä):
      - Kenttä on turnauksen nimen alla ja ottelun ja harjoituspelin lomakkeessa, sekä tulevalle että kirjatulle pelille. Aiemmin käytetyt sarjat tarjotaan ehdotuksina.
      - Kuittaus siirtää sarjan kalenterista kirjaukseen.
      - Kuvissa sarja näkyy ensimmäisenä merkkinä tason ja pelimuodon rinnalla (esim. P9 · ELITE · 8v8). Kalenterin ja tuloslistan riveillä se näkyy tekstinä.
    - **Koti/vieras** (valinnainen):
      - Ottelussa valitaan Koti tai Vieras vastustajan alla. Turnauksen otteluohjelmassa valinta on joka rivillä ajan alla kentän vieressä. Myös kirjatun pelin lisätiedoissa (turnauksessa pelikohtaisesti).
      - Kuittaus ja turnauspäivän pikakirjaus säilyttävät valinnan.
      - Kuvissa valinta "Koti/vieras" (oletus päällä, näkyy kun tieto on annettu):
        - ottelussa KOTI ja VIERAS nimien alla samalla rivillä, oma joukkue pysyy vasemmalla
        - turnauslistassa merkintä kentän vieressä (ennakko) tai kellonajan jälkeen (tulos).
    - Kuvavalinnat (kommentin tausta, koti/vieras) muistetaan laitteelle, ja ne ovat yhteiset ennakko- ja tuloskuville.
  - **Korjaus: viikkovalitsimen painikkeet puhelimella** (käyttäjän havainto 18.11.2026; `features/week/WeekView.tsx`): kun puhelimella selasi muuta kuin kuluvaa viikkoa, "Tämä viikko" -painike työnsi Muokkaa näkymää -painikkeen ruudun ulkopuolelle. Kapealla näytöllä (alle 640 px) viikon valitsin on nyt koko levyinen omalla rivillään. Sen alla ovat "Tämä viikko" vasemmalla sekä raportti ja Muokkaa näkymää oikealla. Nuolet pysyvät paikallaan viikkoa vaihdettaessa. Leveämmillä näytöillä asettelu on ennallaan.
  - **Harjoituspelin koti/vieras ja kommentin väli** (käyttäjän toive 18.11.2026; `repositories.ts`, `domain/football.ts` `friendlyRows`, `previewCard.ts`, `FixtureSheet.tsx`, `FootballPanel.tsx`, `drawPreview.ts`, `drawResult.ts`):
    - Harjoituspelillekin voi valita Koti tai Vieras vastustajien alla, sekä tulevalle että kirjatulle pelille. Valinta koskee koko tapahtumaa ja siirtyy kuittauksessa.
    - Ennakkokuvassa yhden vastustajan harjoituspelissä KOTI ja VIERAS näkyvät nimien alla. Pelitällissä merkintä on jokaisella vastustajarivillä.
    - Pelkkänä tekstinä näytettävä kommentti (ilman harmaata taustaa) on nyt kauempana joukkuetiedoista: väli on 60 px (tarina 76 px), aiemmin 24 px (tarina 32 px).
  - **Pelikalenterin kuukausinäkymä ja tuloste** (käyttäjän toive 18.11.2026, vaihe 1; `domain/monthCalendar.ts`, `features/games/MonthCalendar.tsx`, `CalendarPrint.tsx`, `useCalendarEvents.ts`, `GamesTab.tsx`, `FixtureSheet.tsx` `FixtureDraft.date`, `repo.calendarTrainings`, `ui/storedPref.ts`, `index.css` `@page calendar-landscape`):
    - **Lista | Kuukausi:** Jalkapallo → Kalenteri -kohdassa voi valita esitystavan. Valinta muistetaan laitteelle, ja lista on oletus. Kuukausinäkymässä tulosta odottavat ja väliin jääneet näkyvät ruudukon alla kuten ennen.
    - **Ruudukko:**
      - ma–su, vasemmalla ISO-viikkonumerot ja tämä päivä korostettuna
      - kuukautta vaihdetaan nuolilla, "Tämä kuukausi" -painikkeella tai puhelimella pyyhkäisemällä
      - merkit lajin mukaan: ⚽ ottelu, 🏆 turnaus, 🤝 harjoituspeli
    - **Tapahtumien tilat:**
      - tuleva: aika ja vastustaja tai tapahtuman nimi
      - pelattu: tulos, esim. "3–1 V", turnauksessa "2V 1T"; väri tuloksen mukaan
      - tulos puuttuu: keltainen
      - ei pelattu: yliviivattu
      - "Tietoja puuttuu": ⚠
    - **Kirjatut pelit** tulevat kirjauksista, joten mukana ovat myös suoraan Viikko-näkymässä kirjatut. Kuitatun suunnitelman paikka, sarja ja paikalla-aika säilyvät.
    - **Treenit:** "Treenit"-kytkin (oletus pois, muistetaan laitteelle) näyttää seuran jalkapallotreenit vaaleampina. Treenit tulevat suunnitelmista sekä viikkopohjasta niille tuleville päiville, joita ei ole vielä suunniteltu. Johdettuja kertoja ei tallenneta, eikä käyttäjän poistama kerta palaa.
    - **PC:llä** tapahtumat näkyvät ruuduissa tekstinä (vastustaja lyhyesti seura + ryhmä), ja painallus avaa:
      - tulevan tai tulosta odottavan pelin muokkauksen
      - kirjatun pelin lisätiedot
    - **Puhelimella** ruuduissa on merkit; pelatussa ottelussa näkyy tuloksen kirjain (V/T/H).
    - **Päivän valinta:** valitun päivän tapahtumat näkyvät ruudukon alla koko nimin ja tiedoin. Tulevalle päivälle on painikkeet "+ Peli", "+ Harjoituspeli" ja "+ Turnaus", jotka avaavat lomakkeen valmiiksi sille päivälle.
    - **Tulostus / PDF** (Tulosta-painike; `window.print`, ei kirjastoja eikä verkkoliikennettä; aina vaalea paperi teeman tummalla otsikkovärillä):
      - Muodot:
        - Kuukausikalenteri: kuukausi per A4-vaakasivu (nimetty `@page`).
        - Otteluohjelma: tiivis taulukko A4-pystysivulle. Sarakkeet: päivä, klo, paikalla, peli (sarja, koti/vieras, turnauksen ja pelitällin pelit riveinä), paikka ja tulos.
      - Jakso: alkukuukausi ja 1–6 kuukautta, tai kevätkausi (tammi–kesä) tai syyskausi (heinä–joulu) valittuna vuonna.
      - Valinnat: tulokset, paikat, paikalla-ajat, treenit ja lapsen nimi. Valinnat muistetaan laitteelle.
      - Otsikossa on joukkueen nimi ja seuran logo; lapsen nimi vain, jos se valitaan. Useammalla joukkueella valitaan joukkue tai "Kaikki joukkueet", jolloin riveillä näkyy joukkue.
      - PDF:n tiedostonimi tulee otsikosta, esim. "Otteluohjelma FC Testi · Sininen · 2017 Syyskausi 2026".
  - **Korjaus: kuukausikalenterin treenit** (käyttäjän havainto 18.11.2026 "9.11. ei ole treenimerkintää"; `repo.calendarTrainings`, `CalendarTraining`): kalenteri haki treenit vain suunnitelmista, joten pois jäivät suoraan Viikko-näkymässä kirjatut treenit ja päivät, joille viikkopohjasta ei ollut suunnitelmaa. Nyt kalenterissa näkyvät:
    - kirjatut seuran jalkapallotreenit (linkitetty omatoiminen verryttely ei näy omana treeninään)
    - avoimet suunnitelmat; jos samalle päivälle on kirjattu sama treeni suoraan, näkyy vain kirjaus
    - viikkopohjasta johdetut tulevat kerrat.
  - **Perhekalenteri ja vienti kalenteriin** (käyttäjän toive 19.11.2026, vaihe 2; `domain/monthCalendar.ts` `mergeProfileEvents`, `eventWindow`, `clashes`, `domain/ics.ts`, `features/games/MonthCalendar.tsx`, `CalendarPrint.tsx`, `IcsExport.tsx`, `calendarShared.tsx`, `useCalendarEvents.ts`, `useFootballProfiles`):
    - **Koko perhe** (kuukausinäkymän kytkin; näkyy, kun jalkapallo on käytössä vähintään kahdella profiililla; muistetaan laitteelle):
      - kaikkien jalkapalloprofiilien tapahtumat samassa kuukaudessa
      - jokaisella profiilin oma väri: PC:llä palkki tapahtuman reunassa, puhelimella piste merkin kulmassa, selite ruudukon alla
      - päällekkäisyys: kahden lapsen tapahtumat menevät tästä päivästä eteenpäin samaan aikaan (paikalla-ajasta loppuun). Päivässä näkyy ‼, ja valitun päivän kohdalla lukee esim. "Aino: ottelu 9.30–11.00 ja Eino: ottelu 10.00–11.30". Tapahtuma ilman kellonaikaa lasketaan koko päiväksi. Ei pelattuja eikä saman lapsen tapahtumia verrata.
      - toisen lapsen tapahtuma näkyy, mutta sitä muokataan hänen profiilissaan; lisäyspainikkeet lisäävät valitulle profiilille
    - **Tulosta ja Vie kalenteriin** ovat nyt Kalenteri-kohdan yläreunassa ja toimivat myös listanäkymässä. Kuukausinäkymässä alkukuukausi on näkyvä kuukausi.
    - **Perheen tuloste** (valinta "Koko perhe"): otsikkona "Perheen pelit", värillinen selite ja tapahtumissa värireuna. Rivillä on lapsen joukkue, ja lapsen nimi vain valinnalla "Lasten nimet". Ilman joukkuetta tunnisteena on "Pelaaja 1", "Pelaaja 2"…
    - **Vie kalenteriin (.ics)** (RFC 5545; muodostetaan laitteella, ei verkkoliikennettä eikä kirjastoja):
      - Jakso: 1–12 kuukautta tai kausi. Valinnat: tulokset, treenit, koko perhe ja lapsen nimi; muistetaan laitteelle.
      - "Lataa kalenteritiedosto" ja puhelimella lisäksi "Jaa…".
      - Tapahtuma alkaa paikalla-ajasta ja päättyy suunnitelman alku + kesto. Aikavyöhyke on Europe/Helsinki (VTIMEZONE mukana), ja ilman kellonaikaa tulee koko päivän tapahtuma.
      - Nimi esim. "⚽ PK-35 Valkoinen 2017 (vieras)", pelatussa tulos perässä. Perheessä alkuun tulee joukkue tai, valittaessa, lapsen nimi.
      - Paikka LOCATION-kenttään. Kuvaukseen paikalla- ja alkamisaika, sarja, taso, koti/vieras, turnauksen otteluohjelma, tulos, puuttuvat tiedot ja linkki (myös URL).
      - Ei pelattu = STATUS:CANCELLED.
      - Pysyvä UID (suunnitelman tai kerran tunniste) ja vientihetkestä kasvava SEQUENCE: uudelleenvienti voi päivittää aiemmin tuodut tapahtumat niissä kalentereissa, jotka tunnistavat UID:n. Ohjeessa kerrotaan, että kalenteri ei päivity itsestään.
  - **Ennakkovideo** (käyttäjän toive 19.11.2026; `features/share/videoTimeline.ts`, `previewVideo.ts`, `VideoShare.tsx`; `DrawOptions.mark`): otteluennakon jakoikkunassa on valinta **Kuva | Video**, ja kuva on aina oletus. Tuloskuvissa videota ei ole.
    - Video on samankokoinen kuin kuva (tarina 9:16 tai julkaisu 4:5) ja käyttää samoja valintoja: tyyli, väri, kommentti, koti/vieras, joukkuetiedot ja laatikot. Videon viimeinen kuva on sama kuin ennakkokuva.
    - Animaatio:
      - tausta ensin, sitten tunniste ja päivä liukuvat ylös
      - oma joukkue tulee vasemmalta ja vastustaja oikealta
      - "VS" ponnahtaa näkyviin
      - turnauksen ja pelitällin rivit tulevat yksi kerrallaan
      - lopuksi kommentti, ajat ja paikka
      - valmis kuva pysyy noin 3 s
      - kesto 7–13 s (ottelu noin 7 s), ei ääntä; tempoa hidastettiin käyttäjän palautteesta 19.11.2026 ("hieman liian nopea"), kaikki ajat ×1,6
    - Toteutus:
      - piirto merkitsee osien rajat (`mark`), ja osat leikataan omiksi kuvikseen
      - video tehdään kuva kerrallaan (30 kuvaa/s) piilossa olevalla kankaalla ja pakataan H.264-MP4:ksi selaimen WebCodecsilla; tiedoston kokoaa Mediabunny-kirjasto (päivitetty 19.11.2026, ks. alla)
      - varatie selaimille ilman WebCodecsia: kangas tallennetaan reaaliajassa MediaRecorderilla (`canvas.captureStream`, 30 kuvaa/s)
      - ei verkkoliikennettä
    - Muoto: MP4 (H.264), jos selain osaa; tämä toimii iPhonessa ja WhatsAppissa. Muuten tarjotaan WebM varoituksen kanssa. Jos tallennus ei onnistu lainkaan, ohjataan jakamaan kuva.
    - Esikatselu:
      - kankaalla toistuva animaatio, jonka voi toistaa uudelleen ("▶ Toista")
      - `<video>`-elementtiä ei käytetä, koska sisältöturvakäytäntö ei salli blob-mediaa
      - vähennetty liike: ei automaattista toistoa
    - Tekeminen:
      - "Tee video" tekee videon; edistyminen näkyy, ja teon voi perua. Kuva kerrallaan teko kestää yleensä muutaman sekunnin, varatiellä yhtä kauan kuin video.
      - valmiin videon jälkeen "Jaa video" (puhelimen jakovalikko) ja "Tallenna video" (lataus)
      - valintojen muutos hylkää valmiin videon
  - **Alkusivu ja kutsukoodi** (käyttäjän toive 18.11.2026; `features/landing/AccessGate.tsx`, `Landing.tsx`, `domain/invite.ts`, kuvat `public/landing/*.webp`):
    - **Kenelle:** uusi laite, jolla ei ole profiileja, näkee alkusivun ennen ohjelmaa. Laite, jolla on jo profiili (myös arkistoitu), avautuu suoraan eikä kysy koodia. Hyväksyntä muistetaan laitteelle (`localStorage` `inviteAccepted`).
    - **Alkusivu** (uusi ilme käyttäjän hyväksymän esimerkin mukaan 18.11.2026; aiempi tumma versio korvattu):
      - **Ilme:** vaalea paperisävy (`.lp-page`-paletti, ei riipu ohjelman väriteemasta; tummassa tilassa samat roolit tummina), otsikot Fraunces-fontilla, ohuet erotinviivat korttien sijaan.
      - **Yläpalkki:** nimi ja logo, osiolinkit (Ominaisuudet, Jalkapallo, Pikatesti, Tietosuoja; vain leveällä näytöllä) ja "Syötä kutsukoodi" (kapealla "Kutsukoodi"), joka vie koodikenttään.
      - **Ensimmäinen näkymä:**
        - otsikko "Tiedätkö, kuinka paljon lapsesi liikkuu?" ja johdanto käyttäjän omin sanoin (18.11.2026; edellinen "Treeni kuitattu sekunnissa. Viikko suhteessa suosituksiin." antoi epäselvän kuvan ohjelmasta): "Liikkumisen seuranta kokoaa lapsen treenit, pelit ja arkiliikunnan yhteen paikkaan. Näet helposti, kuinka paljon lapsesi liikkuu ja täyttyykö ikäryhmän liikkumissuositus. Lisää harrastukset kerran ja kuittaa treenit yhdellä napautuksella. Voit myös lisätä kommentteja, kuvata treenin sisältöä ja arvioida harjoituksen onnistumista. Otsikon kysymykseen vastaa heti alla oleva pikatestin painike
        - pikatestin painike ensimmäisenä ja selvästi näkyvänä ("Tee 1 minuutin pikatesti", korostusväri; käyttäjän toive 18.11.2026), alla lause siitä, ettei vastauksia lähetetä
        - erotinviivan alla "Onko sinulla kutsukoodi?", kenttä, "Avaa sovellus" ja yhteystieto
      - **Animoitu esittely PC- ja puhelinkehyksissä** ensimmäisen näkymän oikealla puolella (puhelimella tekstin alla), kahdeksan kohtausta noin 5 s välein (nopeutettu 7 s:sta käyttäjän toiveesta 18.11.2026):
        - liikuntakerran kirjaus (ensimmäisenä, tukee otsikkoa), viikko, analyysi, teemat ja taustat, pelit ja tulokset, koko perheen kalenteri, kauden kooste sekä ennakot
        - liike on rauhallinen (käyttäjän palaute 18.11.2026: "vähän tökkivä, ei niin vakuuttava"): uusi näkymä häivyttyy kummassakin laitteessa edellisen päälle pienellä nousulla, ja edellinen pysyy alla paikallaan, joten välissä ei näy tyhjää. Laitteet ja merkinnät eivät heilu eivätkä pomppaa ylitse. Seuraavan kohdan kuvat puretaan valmiiksi ennen vaihtoa.
        - kaksi merkintää häivyttyy näkyviin (esim. "Lähellä tahtia", "49 min / päivä")
        - alla tarinapalkki ja kuvateksti: kohdan voi valita, ja esittelyn voi pysäyttää
        - pysähtyy hiiren ollessa päällä, näppäimistöllä kohdistettaessa ja kun esittely ei ole näkyvissä
        - kuvan saa suureksi napauttamalla. Laitteet eivät kallistu hiiren mukaan eikä näkymä zoomaa hitaasti, koska 3D-kallistus ja skaalaus pehmensivät kuvia (käyttäjän palaute 18.11.2026: "hieman epätarkkoja")
      - **Tosiasiarivi:** kuittaus yhdellä napautuksella, ei tiliä eikä palvelinta, PC ja puhelin (toimii myös ilman verkkoa), koko perhe.
      - **Kolme ominaisuusosiota** tekstin ja kuvan vuorotellen: kirjaaminen (puhelin), analyysi (PC) ja jalkapalloperheille (perheen kalenteri PC:llä ja otteluennakko puhelimella). Jalkapallo-osio kertoo rehellisesti, että pelikalenteri ja tulokset on tehty jalkapalloon ja että muut lajit (esim. jääkiekko, salibandy, uinti, tanssi) kirjataan samalla tavalla ja lasketaan suosituksiin (18.11.2026; pelitoimintojen laajennus muihin joukkuelajeihin myöhemmin, ks. alla). Kuvat suurenevat napauttamalla ja liukuvat esiin vierittäessä.
      - **Tekijän sanat** kursiivilla: miksi sovellus syntyi (lapsen liikunnan määrä, jalkapalloon kuluva aika, treenien sisältö, turnaukset, ottelut ja tulokset yhdessä paikassa) ja allekirjoitus "Tuomas, sovelluksen tekijä" (18.11.2026 vaihdettu sanasta ohjelmistokehittäjä ja samana päivänä "ohjelman tekijä" → "sovelluksen tekijä" käyttäjän valinnasta). Teksti on käyttäjän omista sanoista.
      - **Pikatesti** iltamaiseman päällä sivun lopussa (ks. alla), sen jälkeen alalaita: nimi, versio, Tietosuoja, Yhteys (mailto) ja suositusten lähteet.
      - **Vähennetty liike:** esittely ei vaihdu itsestään eikä mikään liu'u; kohdat valitaan palkista.
    - **Kuvat:** esimerkkiprofiileista Aino ja Eino (ei oikeita tietoja), WebP-muodossa. PC-näkymä 1280×800 ja puhelinnäkymä 390×844 kuvataan tarkkoina (PC 2× = 2560 px, puhelin 3× = 1170 px leveä, WebP-laatu 90), ja niistä pienennetään perusversiot (PC 1280 px, puhelin 780 px). Selain valitsee `srcset`/`sizes`-tiedoilla näytön tarkkuuteen sopivan version; suurennos käyttää tarkkaa versiota (tiedostot `nimi.webp` ja `nimi-2x.webp` / `nimi-3x.webp`). Teemakuvissa Kanerva-väriteema nurmitaustalla (PC) ja tumma Metsä-teema (puhelin); perhe- ja pelikalenterissa Ainon ja Einon viikoittaiset treenit ja useita pelejä, joista yhdet päällekkäin (kuvattu uudelleen täydempänä 18.11.2026). Ne eivät kuulu service workerin esivälimuistiin.
    - **Kutsukoodi:**
      - Kirjainkoolla, väliviivoilla, välilyönneillä ja ä/ö-pisteillä ei ole väliä.
      - Koodi tarkistetaan laitteella SHA-256-tiivisteestä; itse koodia ei ole lähdekoodissa eikä testeissä.
      - Koodin vaihto: uusi tiiviste `INVITE_HASHES`-listaan ja vanha pois. Aiemmin hyväksytyt laitteet pysyvät auki.
      - Kevyt portti, ei tietoturvaa: tarkistuksen voi ohittaa, mutta käyttäjien tiedot ovat aina vain heidän omilla laitteillaan.
    - **Kutsulinkki** `…/#kutsu=KOODI`: avaa ohjelman suoraan. Koodi poistetaan osoitteesta heti, ettei se jää historiaan tai kirjanmerkkeihin. Väärästä koodista näytetään ilmoitus.
    - **Yhteystieto:** koodia pyydetään sovelluksen tekijältä sähköpostilla (mailto-linkki). Osoite kootaan vasta selaimessa, jottei se ole lähdekoodissa yhtenä merkkijonona.
    - **Aloitus:** koodin jälkeen jatketaan entiseen tapaan aloitukseen (SPEC 12).
  - **Alkusivun pikatesti** (käyttäjän toive 18.11.2026; `domain/quickCheck.ts`, `features/landing/QuickTest.tsx`):
    - **Tarkoitus:** kävijä saa noin minuutissa karkean arvion siitä, liikkuuko oma lapsi tarpeeksi. Lopuksi kehotus pyytää kutsukoodi ja seurata todellista viikkoa.
    - **Sijainti:** oma osio luottamusmerkkien alla (`#pikatesti`); ensimmäisessä näkymässä painike "Tee 1 minuutin pikatesti".
    - **Ulkoasu** (käyttäjän toiveet 18.11.2026): osio on pyöreäkulmainen paneeli rauhallisella taustalla: hämärä iltataivas liukuvärinä ja alareunassa metsäkaista (`public/landing/quiz-forest.svg`: lämmin kajo, kaukainen sumea metsänreuna, kumpuilevat etualan rinteet ja alareunaan tummuva häivytys; ei suoraa maarajaa) kiinteällä mittasuhteella (leveys vähintään 1100 px, keskitetty). Kun paneeli kasvaa vastausten myötä, vain taivas jatkuu ylöspäin; maisema ei veny eikä siirry, ja otsikko pysyy paneelin yläosassa (palaute 18.11.2026: "oudon näköinen kun palkki laajenee"). Ensimmäinen versio (kenttä, maali, pallo, aurinko ja tähdet) oli palautteen mukaan "liian AI-mainen" ja vei huomion; myös hidas liike oli tökkivä, joten tausta on paikallaan. Otsikko vaalealla tekstillä tummennuksen päällä, kysymykset valkoisella kortilla.
    - **Kysymykset** yksi kerrallaan, valinta vie eteenpäin; "← Edellinen" palaa:
      - kaikille: ikä (1–17 v), ohjatut harrastukset (enintään 3: laji, kertaa viikossa 1–7, kesto), koulu- tai päiväkotimatka (auto/kävellen/pyörällä ja 10/20/30/45 min päivässä molemmat suunnat), vapaa-ajan leikki (kolme tasoa)
      - **"Käykö lapsi jo koulua?"** vain, kun ikä ei ratkaise: koulu alkaa elokuussa sinä vuonna, jona lapsi täyttää 7, joten syksyllä (elo–joulu) osa 6-vuotiaista on koulussa ja keväällä (tammi–heinä) osa 7-vuotiaista vielä esikoulussa. Muuten 7 v täyttänyt on koululainen.
      - koululainen: välitunnit (enimmäkseen paikallaan / liikkuu jonkin verran / leikkii, juoksee ja pelaa), rasittavat päivät sekä hyppiminen, juoksu ja kiipeily päivinä viikossa (0–7)
      - alle kouluikäinen: onko päiväkodissa; matkakysymys vain päiväkotilaiselle
    - **Laskenta** (sovelluksen tulkinta, ei virallinen luku; tarkistettu rivi riviltä 18.11.2026):
      - viikon minuutit × ohjelman lajikohtaiset teho-osuudet (SPEC 5, `seed/activityTypes`), jaettuna seitsemällä; pyöristys vasta lopuksi
      - harrastukset vastaavan lajin osuuksilla (jalkapallo = treeni). "Muu ohjattu harrastus" = lajien keskitaso (kevyt 0,40, reipas 0,35, rasittava 0,15), koska ohjelman Muu-laji (0,2) aliarvioisi esim. kamppailulajit
      - koululainen: koululiikunta 2 × 45 min viikossa (koululiikunnan osuudet); välitunnit 5 × koulupäivä: paikallaan 30 min kevyttä oleilua (reipasta 0,1), jonkin verran 45 min välituntien osuuksin, leikkii ja pelaa 45 min ulkoleikin osuuksin
      - päiväkotipäivä 2 h päiväkotipäivän osuuksin (Liikkuva varhaiskasvatus); matkat 5 arkipäivänä kävelyn tai pyöräilyn osuuksin, autolla 0
      - leikki joka päivä ulkoleikin osuuksin: koululainen 20/60/120 min, päiväkotilainen 45/90/150 min, kotona hoidettava 90/180/240 min
      - erittelyn osat pyöristetään suurimman jäännöksen menetelmällä, joten niiden summa on aina pääluku
    - **Tulos:**
      - koululainen: reipas ja rasittava min/pv suhteessa 60 min:iin, lisäksi rasittavat sekä lihaksia ja luustoa vahvistavat päivät (tavoite 3)
      - alle kouluikäinen: kaikki liikkuminen suhteessa 3 h:iin ja vauhdikas suhteessa 1 h:iin; tila heikomman mukaan
      - tila samoin rajoin kuin ohjelmassa: täyttyy / lähellä (≥ 75 %) / alle
      - **vinkit** (enintään kaksi, suurimman lisäyksen mukaan): minuuttivinkit (matka, leikki, välitunnit) vain, kun pääsuositus ei täyty, ja lisäys lasketaan erotuksena nykytilanteesta (jo kävelevälle pyörä); alle 3 min lisäyksiä ei tarjota. Päivävinkit (rasittavat, lihakset ja luusto), kun päiväraja ei täyty. Pienelle lapselle yleisvinkki, jos muuta ei ole.
      - huomautus "karkea arvio, ei mittaus", oletukset ja suosituksen lähde
    - **Kehotus:** "Näe todellinen viikko" ja koodikenttä tuloksen vieressä; "Tee testi uudelleen".
    - **Tietosuoja:** kaikki lasketaan selaimessa; vastauksia ei lähetetä eikä tallenneta.
    - **Esitäyttö aloitukseen:** jos koodi syötetään samalla käynnillä, vastaukset (vain muistissa, katoavat sivun latauksessa) täyttävät aloituksen niin, että ohjelma laskee samoista tiedoista saman viikon kuin pikatesti (koululiikuntaa lukuun ottamatta, joka lisätään viikkorytmiin itse; testattu):
      - tervetulonäkymä kertoo, että vastaukset ovat valmiina
      - profiili: syntymävuosi (kuluva vuosi − ikä; koulukysymyksen tapauksissa tarkka), koulun aloitusvuosi (syntymävuosi + 7, elokuu) ja jalkapallo, jos se valittiin. Ohjelma valitsee näin saman suositusryhmän kuin pikatesti kaikilla iillä ja kuukausilla (testattu).
      - viikkorytmi: kortti "Pikatestin harrastukset", jossa ehdotetut treenipäivät kertamäärän mukaan; käyttäjä vaihtaa päivät ja lisää rivin. "Muu ohjattu harrastus" lisätään itse oikealla lajilla.
      - arkiliikunta: välitunnit, päiväkoti, matkat ja leikki liukusäätimiin valmiiksi; perusarvio tallennetaan vastauksen lajin osuuksin (esim. pyöräily kouluun, aktiivinen välitunti = ulkoleikki)
  - **Ammattimaisempi viimeistely** (käyttäjän pyyntö 18.11.2026: ohjelman ei pidä näyttää tekoälyllä tehdyltä; valinnat suositusten mukaan):
    - **Käyttöliittymän merkit** (`ui/icons.tsx` `IconPencil`, `IconWarning`, `IconOverlap`, `IconPlay`, `IconPause`, `IconComment`):
      - painikkeiden ja tilojen merkit (✓ ✗ ✕ ✎ ⚠ ‼ ▶ ☀️ 💬) ovat ohjelman omia SVG-ikoneita samalla viivalla kuin muutkin ikonit. Päällekkäisyydellä on oma ikoni (kaksi limittäistä ympyrää), joten se erottuu puuttuvista tiedoista muutenkin kuin värin perusteella.
      - painikkeista on poistettu nuolet (→, ←), tilamerkinnöistä ≈- ja ○-etumerkit sekä ✨-koristeet. Arvio sanotaan sanalla "noin".
      - jäävät: lajien emojit ja käyttäjän valitsemat lajikuvakkeet (sisältöä), fiilisnaamat ja arviotähdet, jakokuvat, tulostettavat raportit ja kalenteri, valikkopolut tekstissä (Asetukset → …), näppäinmerkit sekä trendinuolet tiiviissä tietoriveissä.
      - korttien yläotsikot säilyvät, koska ne kertovat mm. kenen lapsen tietoja kortti näyttää. Välipisteet jäävät vain tiiviisiin tietoriveihin.
      - alkusivun esittelyn merkinnät ovat ilman emojeja.
    - **Versio ja Mitä uutta** (`domain/version.ts` `APP_VERSION` = 1.0.0, `package.json`, `features/help/changelog.ts`, `HelpSheet.tsx`): Ohjeen alalaidassa versio ja julkaisupäivä sekä linkit Mitä uutta- ja Tietosuoja-näkymiin (samassa ikkunassa, "Takaisin ohjeeseen"). Mitä uutta -luetteloon lisätään rivi jokaisesta julkaisusta, jonka käyttäjä huomaa. Alkusivun alalaidassa nimi, versio ja Tietosuoja.
    - **Linkin esikatselu** (`index.html`, `public/og-image.png` 1200 × 630): Open Graph- ja Twitter-tiedot, joten WhatsAppissa, Teamsissa ja sähköpostissa jaettu linkki näyttää kuvan, nimen ja kuvauksen. Kuvan osoite on täydellinen (`https://tuumis.github.io/liikkumisen-seuranta/og-image.png`), joten se päivitetään, jos julkaisuosoite vaihtuu. Kuva ei kuulu service workerin esivälimuistiin.
    - **Alkusivun kuvat** otettiin uudelleen siivotusta ohjelmasta.
    - **Alkusivun uusi ilme** (käyttäjän hyväksymä esimerkki 18.11.2026): vaalea ja rauhallinen, pikatesti heti alussa, ominaisuusosiot kuvineen ja tekijän sanat. Kuvaus kohdassa Alkusivu ja kutsukoodi. Lainausta varten mukana Fraunces-fontin kursiivi (sama paketti, ei uutta riippuvuutta).
    - **Tervetulosivun tiedostontuonti** (käyttäjän toive 18.11.2026: "tiedostolle voisi olla kunnon selkeä nappi"; `Onboarding.tsx`, `ui/icons.tsx` `IconImport`): tekstilinkin tilalla oma painike "Tuo tiedosto" erotinviivan alla otsikolla "Onko tiedot jo toisella laitteella?" ja selitys, että kelpaa PC:n synkronointitiedosto tai varmuuskopio. Aloita pysyy pääpainikkeena. Tietokorttien emojit vaihdettu ohjelman omiin ikoneihin.
    - **Tervetulosivu alkusivun ilmeellä** (käyttäjän hyväksymä ehdotus 18.11.2026; `Onboarding.tsx` `Welcome`): sama vaalea `.lp-page`-paletti ja yläpalkki kuin alkusivulla, joten siirtymä koodista aloitukseen on yhtenäinen. Ominaisuuskortit poistettu, koska alkusivu esitteli ne jo. Vasemmalla otsikko "Aloitetaan lapsen tiedoista.", aloituksen neljä vaihetta numeroituna luettelona, Aloita ja sen alla tiedostontuonti. Oikealla "Tiedot pysyvät sinulla": varmuuskopion kolme vaihetta, PC ja puhelin sekä automaattinen viikkovarmuuskopio. Puhelimella osat allekkain.
    - **Pikatestin erittely selitetty** (käyttäjän kysymys 18.11.2026: "mitä tuo 7 min/pv harrastusta oikein tarkoittaa"; `domain/quickCheck.ts` `Part.basis`, `QuickTest.tsx`): "Mistä arvio koostuu" -otsikon alla kerrotaan, että luvut ovat viikon keskiarvoja päivää kohden (viikon minuutit jaettuna seitsemälle päivälle, myös viikonloput) ja että mukana on vain arvioitu liikkumisen osuus (koululaisella reippaan ja rasittavan), ei koko kestoa. Jokaisen rivin alla lukee, mistä luku tulee vastausten mukaan: harrastukset "Viikossa 3 × 90 min ja 2 × 60 min (yhteensä 390 min)", koulu "Liikuntatunnit 90 min viikossa ja välitunnit arkipäivisin", päiväkoti "Arkipäivisin noin 120 min liikkumista", matkat "Arkipäivisin 20 min", leikki "Joka päivä noin 60 min".
    - **Alkusivun painotus ja lajirajaus** (käyttäjän valinta 18.11.2026): otsikko ja johdanto painottavat nopeaa kirjausta ja kuittausta, esittely alkaa kirjauksesta ja tosiasiarivillä on "Kuittaus yhdellä napautuksella". Jalkapallo-osio kertoo, että muut lajit kirjataan samalla tavalla. **Myöhemmin (ei tehty):** pelitoimintojen laajennus joukkuelajeille (jääkiekko, salibandy): laji joukkueelle ja lajityypeille, lajikohtaiset pelimuodot, pelipaikat, painopisteet, pelien pituudet ja tehoarviot, välilehti "Pelit" ja alkusivu "Joukkuelajien perheille". Koripallo ei kuulu, koska siinä lasketaan pisteitä.
    - **Pikatestin ikäkysymys** (käyttäjän palaute 18.11.2026: "vuotta" oli hassussa paikassa ruudukon alla): yksikkö näkyy ruudukon yläpuolella otsikkona "Ikä vuosina", ja ruudukko on ryhmä tällä nimellä. Ruudunlukija lukee painikkeet muodossa "10 vuotta".
    - **Analyysi selkeämmäksi** (käyttäjän palaute 18.11.2026: valinta oli "melkoinen sekamelska ja pois luotaan työntävä", eikä ollut selvää, mitä katsoa viikko-, kuukausi-, kausi- ja vuositasolla; `features/analysis/layout.ts`, `AnalysisView.tsx`, `LongTermView.tsx`, `HighlightsCard.tsx`, `ui/EditLayoutSheet.tsx`, `ui/cardLayout.ts`):
      - **Tason esittely:** jaksovalinnan alla lause. Viikko "Täyttyikö suositus tällä viikolla ja mistä liikunta kertyi.", kuukausi "Mihin suuntaan ollaan menossa: kehitys viikoittain ja vertailu edelliseen kuukauteen.", kausi "Kausi kokonaisuutena: kehitys kuukausittain, suositusten toteutuminen ja lajit.", vuosi "Koko vuosi yhdellä silmäyksellä: aktiivisuuskartta, kehitys ja suositukset."
      - **Viikko ilman päällekkäisyyksiä:** oletuksena Suositus · {nimi} (entinen Tavoitteet), uusi **Päivät ja lajit** (päiväkaavio ja sen alla "Mistä liikunta kertyi"; korvaa erilliset Päivittäinen kaavio- ja Jakauma kategorioittain -kortit), Suunnitelma ja toteuma (näkyy vain, kun viikolla on suunnitelmia) ja Jalkapallo. Kohokohdat ja Tarkemmat luvut (Viikon liikuntatunnit, Tunnit päivittäin ja lajeittain, Liikuntaa viikossa, Aktiivisuuskartta, Datan laatu) ovat valittavissa mutta oletuksena piilossa.
      - **Jaksotasoilla omat oletukset ja asetukset** (`longLayout:month|season|year`): kuukausi Kehitys, Vertailu edelliseen, Lajit ja monipuolisuus, Kohokohdat; kausi Kehitys, Suositusten toteutuminen, Lajit ja monipuolisuus, Vertailu, Kohokohdat; vuosi Aktiivisuuskartta ensin, sitten Kehitys, Suositusten toteutuminen ja Lajit ja monipuolisuus. Muut kortit (Ohjattu ja omaehtoinen, Datan laatu jne.) valittavissa. Kohokohdat-kortti on nyt myös jaksotasoilla, ja se näyttää valitun jakson ilman omaa jaksovalintaa (vuodella "vuodelta"); viikolla kortin oma valinta säilyy. Ilman jalkapalloa Kohokohdat ei näy eikä ole valittavissa.
      - **Ohjattu valinta:** "Muokkaa näkymää" avaa paneelin "Mitä haluat nähdä viikosta / kuukaudesta / kaudesta / vuodesta?" ja aiheet valintaruutuina: viikolla Suositus, Päivät ja lajit, Suunnitelma, Jalkapallo, Kohokohdat ja Tarkemmat luvut; jaksoilla Kehitys, Suositukset, Lajit ja monipuolisuus, Kohokohdat ja Tarkemmat luvut. Aihe näyttää tai piilottaa kaikki korttinsa; osittain valittu aihe näkyy välitilana ("Osa näkyvissä 2/5"). Yksittäiset kortit ja järjestys ovat avattavassa kohdassa "Lisää vaihtoehtoja: yksittäiset kortit ja järjestys". Viikko-välilehden muokkaus säilyy ennallaan.
      - "Mihin luvut perustuvat" pysyy kaikilla tasoilla alimpana. Tallennusavaimet vaihtuivat (`analysisLayout2`), joten kaikki aloittavat uusista oletuksista; vanha `longTermLayout` jää käyttämättä.
    - **Epäjohdonmukaisuuksien korjaus** (käyttäjän pyyntö 18.11.2026 "löytyykö muita epäjohdonmukaisuuksia", kierros kaikilla välilehdillä PC:llä, puhelimella ja tummana; ei konsolivirheitä eikä ylivuotoja):
      - **Liikuntaa viikossa kesken viikon** (`HoursGauge.tsx`): luokitus tehdään koko viikon arviosta. Iso luku on "tähän mennessä", luokka näkyy arvion vieressä ("Koko viikon arvio 7,8 h · Suosituksen mukainen"), ja luokkalistassa korostuu arvion luokka merkinnällä "arvio" (toteuman luokka merkinnällä "nyt"). Aiemmin keskiviikon 4,8 h näkyi "Alle suosituksen", vaikka viikko oli tahdissa. Päättyneellä viikolla ennallaan.
      - **Yhtenäiset nimet:** Analyysin aihe "Tarkemmat luvut" kuten Viikko-näkymän kortti. Yhdistetystä luvusta käytetään kaikkialla nimeä "kirjattu + arkiliikunta" (suosituskortti, asetus Ensisijainen luku) ja osuudesta "arkiliikunnan arvio" (jakauma, datan laatu, Mihin luvut perustuvat). "Perusarvio" jää asetuksiin ja raportteihin tarkoittamaan arkiliikunnan oletusarviota erotuksena päivän vahvistuksesta.
      - **Nuolimerkit pois painikkeista:** "Avaa viikko", "Pelit ja tulokset", "Tee varmuuskopio" ja joukkueiden läpikäynnin "Seuraava"/"Ohita" ilman merkkiä; paluupainikkeissa (Asetukset, Analyysi), päivämäärävalitsimen kuukausiselauksessa ja joukkuelistan riveillä ohjelman omat nuoli-ikonit. Päivän arkiliikuntarivillä "(vahvistettu)" ✓-merkin sijaan.
      - **Synkronointi:** "Ei vielä synkronoitu" ja puhelimella "Ei vielä tietoja PC:ltä" (ei "Synkronoitu ei koskaan"); varmuuskopion "Edellinen varmuuskopio: ei vielä tehty".
      - **Puhelimen Viikko-näkymä:** muokkauspainikkeessa teksti "Muokkaa" (ennen pelkkä kuvake omalla rivillään).
      - **Ohje:** uusi aihe "Mitä Analyysissä katsotaan?" (tasot, Muokkaa näkymää, Mihin luvut perustuvat); arkiliikunnan selitykseen päiväkoti ja päiväkohtainen vahvistus; sanaston polku "Asetukset → Tavoitteet ja lajit".
      - **Analyysin Jalkapallo-kortti** näyttää valitun viikon; kortin oma Viikko/kuukausi-valinta poistettiin, koska jakso valitaan Analyysin ylälaidasta.
    - **Verryttely kuittauksen jälkeen** (käyttäjän toive 18.11.2026: "omatoimisen verryttelyn aikaa ei tiedä tarkkaan kuin vasta treenin jälkeen"; `FootballPanel.tsx`): seuran jalkapallotreenin Lisätiedot-ikkunassa (aukeaa kuittauksen jälkeen ja kerran "Lisää tiedot" -painikkeesta) on samat Omatoiminen verryttely -kentät kuin kerran muokkauksessa: "Ennen treeniä (min)" ja "Treenin jälkeen (min)", 0–180. Kentissä on valmiina jo kirjattu verryttely (viikkorytmin oletus kuittauksessa). Tallenna päivittää treeniin linkitetyn "Jalkapallo – omatoiminen" -kerran samoin säännöin (0 + 0 poistaa); koskematon kenttä ei muuta mitään, ja Myöhemmin ei tallenna. Ei näy verryttelykerralla eikä peleissä.
    - **Treenin sisältöön 2v2** (käyttäjän toive 18.11.2026; `FocusTag` `two_v_two`, `FOCUS_TAG_LABEL`, `focusTagLabel`): uusi valinta "2v2" heti 1v1:n jälkeen Lisätiedot-ikkunassa, päiväkirjassa ja harjoittelun sisällön jakaumissa. Tallennusmuoto ei muutu (tagit ovat merkkijonolista). Nimi haetaan nyt `focusTagLabel`-funktiolla, joka palauttaa tuntemattomalle tagille sen tunnisteen, joten myöhemmin lisätyt tagit eivät kaada vanhempaa versiota. Ennen versiota 1.1.3 oleva laite voi näyttää 2v2:n tyhjänä tai kaatua kausiraportissa, kunnes sovellus päivittyy (sivun uudelleenlataus).
    - **Tekstien yhtenäistys** (käyttäjän kysymys 18.11.2026 "onko tekstit yhdenmukaisia läpi ohjelman"):
      - **Viikkorytmi:** vanha nimi "viikkopohja" vaihdettu näkyvissä teksteissä Asetusten kohdan nimeen "viikkorytmi" (rivin lisäys, kerran muutos ja poisto, tuntikortit, synkronoinnin ristiriidat, aloitus, korttien kuvaukset). Koodin nimet (`templateItems`) ja SPECin vanhat kirjaukset ennallaan.
      - **Lisätiedot-painike:** Viikko-näkymän jalkapallokerran painike "+ tiedot" on nyt "Lisätiedot" plus-ikonilla, kuten päiväkirjassa.
      - **Sovellus, ei ohjelma** (käyttäjän valinta): sovellus viittaa itseensä kaikkialla sanalla "sovellus" (alkusivu, pikatesti, aloitus, tietosuojaseloste, Mitä uutta, tekijän allekirjoitus "Tuomas, sovelluksen tekijä", painike "Avaa sovellus"). "Otteluohjelma" ja muut pelien ohjelmat ennallaan.
      - **Lisäyspainikkeet:** tekstiin kirjoitetun "+"-merkin tilalla ohjelman oma plus-ikoni kaikissa lisäyspainikkeissa (Lisää kerta / Suunnittele kerta tälle päivälle, Uusi laji, Lisää lomajakso, arkiliikunnan ehdotukset, profiilin ja viikkorytmin Lisää, osat, vastustaja, ottelu, peli, joukkueet). Taulukon otsikko "+ arvio" on laskumerkki ja jää.
    - **Kuittaa-painike sivuvalikkoon** (käyttäjän palaute 18.11.2026: ilmoitus kuittaamattomasta kerrasta tuli, mutta kuittauspaikkaa ei löytänyt heti):
      - **PC:n sivuvalikko:** navigaation alla korostettu painike "Kuittaa kerrat", kun jollakin profiililla on kuittaamattomia kertoja (menneet avoimet ja tämän päivän jo päättyneet, sama joukko kuin "Käy viikko läpi"). Painikkeessa kokonaismäärä ja useammalla profiililla erittely ("Aino 3 · Eino 5"), yhdellä "N kertaa odottaa". Klikkaus avaa valitun profiilin kuittauksen, jos sillä on kuitattavaa, muuten ensimmäisen profiilin, jolla on; samalla Viikko-näkymä ja kuluva viikko.
      - **Profiilien numerot:** sivuvalikon profiileissa ja puhelimen profiilisiruissa kuittaamattomien määrä, kun se on yli 0.
      - **Puhelimen alavalikko:** Viikko-kuvakkeessa kuittaamattomien kokonaismäärä.
      - **Ilmoituksen klikkaus:** "Kerta päättyi" -ilmoitus ja iltamuistutus (kun kuitattavaa on) avaavat suoraan kuittausikkunan, eivät pelkkää Viikko-näkymää. Aiemmin kuittaus avautui vain menneistä päivistä.
      - Määrät päivittyvät minuutin välein ja heti kuittauksen jälkeen. Ei uutta tallennettavaa tietoa.
    - **Jakokuvien Kapea-tyyli** (käyttäjän toive 18.11.2026: ideoita seuran brändikirjasta ennakko- ja tuloskuviin; malli hyväksytty ennen toteutusta):
      - **Uusi tyyli "Kapea"** muiden kuuden rinnalle sekä tulos- että ennakkokuvassa (myös video). Asettelu on sama kuin muissa tyyleissä (päätös 17.11.2026: tyyli vaihtaa taustan, värit ja fontin).
      - **Fontit:** otsikot, päivä, tulos, VS, joukkueiden nimet ja laatikoiden arvot kapealla **Bebas Neue** -fontilla (vain isot kirjaimet, isot luvut noin 1,3-kertaisina, laatikoissa 1,1); pienet tunnisteet ja muu teksti **Work Sans** -fontilla. Molemmat ovat vapaita fontteja (SIL Open Font License) ja tulevat sovelluksen mukana: uudet riippuvuudet `@fontsource/bebas-neue` ja `@fontsource-variable/work-sans` (käyttäjän lupa 18.11.2026), vain latin-osajoukko, service worker esivälimuistittaa, ei verkkoliikennettä. Fontteja ei käytetä sovelluksen näkymissä, joten ne ladataan ennen kuvan piirtoa.
      - **Pohja ja värit:** tasainen lähes musta pohja #161616, korostus pystypalkkina vasemmassa yläkulmassa ja ohuena viivana alareunassa sekä tunnisteissa. Oletuskorostus vadelmanpunainen #E64773. Valittu väri: tumma väri sävyttää pohjan ja sen korostusväri käytetään, keskitumma väri (esim. sininen) vaalennetaan korostukseksi, vaalea väri (esim. keltainen) on korostus sellaisenaan.
      - **Uusi valmisväri** "Musta ja vadelma" (#161616 ja #E64773) jakokuvien väreihin.
      - Seurojen tunnuksia, nimiä tai logoja ei ole tyylissä; logot tulevat edelleen vain käyttäjän Joukkueet-kohtaan lisäämistä kuvista.
    - **Jakokuvien Brändi-tyyli** (käyttäjän valinta 18.11.2026 aiemmin näytetystä mallista; Kapea säilyy ennallaan):
      - **Uusi kahdeksas tyyli "Brändi"** tulos- ja ennakkokuviin (myös video). Poikkeuksena päätökseen 17.11.2026 tällä tyylillä on **oma asettelu** (`drawBrand.ts`); fontit, pohja ja korostusväri ovat samat kuin Kapeassa (Bebas Neue ja Work Sans, #161616, oletuskorostus #E64773).
      - **Ennakko (ottelu):** tunniste ja sarja ylhäällä korostusvärillä, alla iso päivä (esim. "SU 22.11."). Joukkueet allekkain logoineen, nimen alla lippu, lisätiedot sekä koti/vieras korostusvärillä, välissä korostusvärinen VS. Alareunassa ohuin viivoin jaettu ruudukko: kellonajat sarakkeina (pelin alku korostusvärillä) ja paikka isolla enintään kahdella rivillä. Kommentti ruudukon yläpuolella.
      - **Ennakko (turnaus, pelitälli):** otsikko isolla, päivä, oma joukkue, sitten vastustajat tai ottelut riveinä ohuin viivoin, lopuksi sama ruudukko.
      - **Tuloskuva (ottelu):** tunniste ja rivi "päivä · klo · paikka", sen alla iso korostusvärinen VOITTO / TASAPELI / TAPPIO ja jättikokoinen tulos (niin iso kuin leveyteen ja korkeuteen mahtuu). Joukkueet rinnakkain tuloksen alla, oma vasemmalla. Alareunassa pelaajan nimi isolla ja maalit korostusvärillä.
      - **Tuloskuva (turnaus):** otsikko, päivä, oma joukkue, "Tulokset"-rivit (vastustaja, tulos ja V/T/H-merkki), pelaajan maalit ja ruudukko: pelit, V–T–H korostusvärillä ja maalit.
      - Korostus on pystypalkki vasemmassa yläkulmassa otsikon kohdalla. Seurojen tunnuksia ei ole tyylissä.
    - **Ennakkovideon laatu** (käyttäjän palaute 19.11.2026: "videoiden laatu on heikko"):
      - **Syy:** video tallennettiin reaaliajassa toistamalla animaatiota ruudulla (MediaRecorder, 6 Mbit/s). Hitaalla laitteella kuvia jäi pois, ja laitteen pakkaaja sumensi tekstin reunoja varsinkin alussa.
      - **Korjaus:** video tehdään kuva kerrallaan. Jokainen kuva piirretään valmiiksi piilossa olevalle kankaalle ja pakataan WebCodecsin `VideoEncoder`illa H.264:ksi (16 Mbit/s, avainkuva 2 s välein); MP4-tiedoston kokoaa **Mediabunny** (uusi riippuvuus `mediabunny`, MPL-2.0, käyttäjän lupa 19.11.2026). Kirjasto ladataan vasta, kun videota tehdään, toimii kokonaan laitteella eikä tee verkkoliikennettä. Video on tasainen ja terävä laitteen nopeudesta riippumatta, ja teko kestää yleensä muutaman sekunnin.
      - **Varatie:** jos selain ei osaa tehdä H.264-videota WebCodecsilla, käytetään entistä reaaliaikaista tallennusta, nyt 12 Mbit/s.
      - Tuloskuvissa ei tuolloin ollut videota (lisätty 19.11.2026, ks. Tulosvideo).
    - **Päivänauha puhelimella ja tabletilla** (käyttäjän toive 19.11.2026: "varsinkin mobiililla joutuu scrollaamaan että löytää päivän jossa mennään"; malli hyväksytty ennen toteutusta):
      - **Koskee** alle 1024 px leveitä näyttöjä (puhelin, tabletti). Tietokoneella Viikko-näkymä on ennallaan.
      - **Päivänauha** korvaa viikon valitsimen samassa kohdassa: ylärivillä viikon numero, päivät ja nuolet edelliseen ja seuraavaan viikkoon; alla viikon seitsemän päivää (viikonpäivä ja päivämäärä). Tänään on valittuna oletuksena ja erottuu renkaalla, kun muu päivä on valittuna.
      - **Päivän merkki nauhassa:** valintamerkki = päivän tavoite täyttyi (sama sääntö kuin päiväkortin "Suositus"), haalea piste = liikuntaa kirjattu mutta tavoite vajaa, tyhjä rengas = avoin suunnitelma tänään tai tulevana päivänä. Oranssi luku kulmassa = kuittaamattomat suunnitelmat (sama laskenta kuin "Käy viikko läpi"). Korjaus 19.11.2026 (käyttäjän havainto): tulevalle päivälle ei näytetä valintamerkkiä eikä pistettä, koska arkiliikunnan arvio yksin voi täyttää tavoitteen etukäteen; tuleva päivä saa vain suunnitelman renkaan (kuten päiväkortin Suositus-merkki, joka näkyy vasta päivänä).
      - **Valitun päivän kortti** heti nauhan alla: sama päiväkortti kuin Päivät-listassa (kerrat, suunnitelmat Kuittaa- ja ohitusnappeineen, arkiliikunta, jalkapallon lisätiedot, +-painike ja ⋯-valikko). Kortin pyyhkäisy vaihtaa päivää; viikon rajalla myös viikko vaihtuu. Viikkoa vaihdettaessa valinta pysyy samassa viikonpäivässä, kuluvalle viikolle palattaessa tänään.
      - **Päivät-lista** (kortit ja taulukko) ei näy puhelimella eikä tabletilla, koska nauha korvaa sen. Muut viikon kortit näkyvät ennallaan nauhan alla.
      - **Paneelin avautuminen** (käyttäjän havainto 19.11.2026: turnauksen tietojen avautuminen ja taustan himmennys töksähtivät): avausanimaatio pidetään tauolla (`anim-hold`), kunnes paneeli on piirretty ensimmäisen kerran (kaksi ruudunpäivitystä, varmistus 400 ms), koska raskaan sisällön rakentaminen (mitattu noin 150 ms) söi animaation alun ja paneeli ilmestyi noin 70 % perillä. Taustan himmennys häivytetään läpinäkyvyydellä taustavärin sijaan, jolloin se liikkuu näytönohjaimella sulavasti. Koskee kaikkia alapaneeleja (`ui/Sheet.tsx`).
      - **+-painike** väistyy (häivytys kuten vieritettäessä), kun se peittäisi valitun päivän kortin painikkeita; kortin oma +-painike on silloin käytettävissä. Korjaus 19.11.2026 (käyttäjän havainto: painike välähti): peittävyys tarkistetaan myös vierityksen aikana ja ennen ruudun piirtoa, joten vierityksen pysähtyessä kortin kohdalle painike pysyy piilossa eikä välähdä näkyviin.
    - **Tulosvideo** (käyttäjän toive 19.11.2026: "voitko lisätä videon myös ottelutuloksiin"):
      - **Jaa tulos** -paneelissa sama Kuva | Video -valinta kuin ennakossa; kuva on oletus. Kaikki kahdeksan tyyliä ja molemmat koot (tarina 9:16, julkaisu 4:5), ottelu ja turnaus.
      - **Animaatio** samalla ajoituksella kuin ennakossa: tunniste, (turnauksen nimi), päivä, joukkueet sivuilta, tulos ja tulossana ponnahtaen (ottelu) tai tulosrivit yksi kerrallaan (turnaus), lopuksi kommentti, lapsen maalit, yhteenveto, ajat ja paikka. Valmis tuloskuva pysyy lopussa noin 3 s.
      - **Tekotapa** kuten ennakkovideossa: kuva kerrallaan H.264-MP4:ksi (WebCodecs + Mediabunny), varatienä reaaliaikainen tallennus.
      - **Laadun varmistus 19.11.2026** (Edge, kaikki tyylit × ottelu/turnaus × ennakko/tulos × molemmat koot, 48 videota): jokainen video purkautui ja oli 1080 × 1920 tai 1080 × 1350; teko noin 1 s; viimeisen ja animaation keskikohdan ruudun ero tarkkaan piirrettyyn kuvaan 39–48 dB (silmin erottamaton); kooderiasetuksista (bittinopeus, vakio/vaihtuva, laatutaso, laitteisto/ohjelmisto) nykyinen oli paras. Varatie testattiin poistamalla WebCodecs: MP4-video syntyi videon pituudessa.
    - **Paneelien sulkeminen puhelimella** (puhelinkäytön läpikäynti 19.11.2026, käyttäjän valitsemat kohdat 1–2):
      - **Takaisin-ele** (Androidin takaisin-painike tai -ele, selaimen takaisin) sulkee päällimmäisen paneelin tai koko ruudun näkymän eikä poistu sovelluksesta. Koskee kaikkia alapaneeleita sekä viikko- ja jaksoraporttia, kalenterin tulostusta, Kauden koostetta, aktiivisuuskartan koko ruudun näkymää ja päivävalitsinta. Päällekkäisistä suljetaan ensin päällimmäinen.
      - **Toteutus:** avattu näkymä lisää selaimen historiaan merkinnän samalla osoitteella (`ui/backClose.ts`); muuten suljettaessa (✕, tausta, Esc, tallennus) merkintä poistetaan, joten historiaan ei jää ylimääräisiä askelia. Paneelista toiseen vaihdettaessa uusi merkintä lisätään vasta, kun edellinen on poistettu. Ei tallennettavaa tietoa.
      - **Alas vetäminen:** paneelin yläosasta (kahva ja otsikkorivi) alas vetäminen siirtää paneelia sormen mukana; yli 110 px tai nopea veto sulkee, lyhyempi palauttaa paikalleen. Vain kosketuksella; Sulje-painike toimii ennallaan.
    - **Jakopaneelin painikkeet aina näkyvissä** (puhelinkäytön läpikäynti 19.11.2026, käyttäjän valitsema kohta 3): kuva- ja videojaon paneeleissa (ennakko, tulos, viikko- ja muut jakokuvat) Jaa- ja Tallenna-painikkeet sekä videon teko-, edistymis- ja valmis-tilat ovat paneelin alareunaan kiinnitetyllä rivillä, joka pysyy näkyvissä, kun tyylejä, värejä ja lisävalintoja vieritetään. Rivillä on paneelin taustaväri ja ohut yläreuna; koskee puhelinta ja PC:tä.
    - **Jalkapallo-sivu puhelimella** (puhelinkäytön läpikäynti 19.11.2026, käyttäjän valitsema kohta 4, malli hyväksytty): tavoite, että sivun valinnat näkyvät ensimmäisellä ruudulla.
      - **Tiivis yläkortti** (alle 640 px): otsikko ja Kauden kooste -painike samalla rivillä, viisi tunnuslukua yhdellä rivillä (lapsen maalien otsikkona vain nimi ja pallo), seuraava peli yhtenä rivinä lukujen alla. Tabletilla ja PC:llä kortti ennallaan.
      - **Lisää kalenteriin** (alle 1024 px): kolmen lisäyskortin osio korvautuu yhdellä Lisää kalenteriin -painikkeella, joka avaa alapaneelin samoilla valinnoilla (tuleva peli, harjoituspeli, turnaus) ja ohjetekstillä. Valinta sulkee paneelin ja avaa lisäyslomakkeen. PC:llä osio ennallaan.
      - **Välilehdet kiinni** (alle 1024 px): Päiväkirja | Kalenteri | Tulokset | Joukkueet -valitsin kiinnittyy vieritettäessä yläpalkin alle (läpikuultava tausta). Jos välilehteä vaihdetaan valitsimen ollessa kiinni, sivu siirtyy uuden näkymän alkuun. Yläpalkin korkeus luetaan muuttujaan `--mobile-header-h`.
    - **Kosketusalueet vähintään 44 × 44 px** (puhelinkäytön läpikäynti 19.11.2026, kohta 5): pienten painikkeiden (nuolet, ⋯, +, kuittauksen ✓/✕, avaa/pienennä, Lisää kommentti, Lisätiedot, Ennakko, Jaa tuloskuva, Kauden kooste, näkymävalitsimet, sirut, selitelinkit, Taulukko/Kaavio, Ohje) napautusalue laajenee näkymättömästi vähintään 44 × 44 px:iin (apuluokka `hit`); ulkoasu ei muutu. Profiilisirut yläpalkissa ovat 44 px korkeita. Päivän kortin + ja ⋯ ovat puhelimella hieman erillään, jotta niiden alueet eivät mene päällekkäin. Tarkistettu napauttamalla painikkeiden reunoilta (Viikko, Jalkapallo, Analyysi).
    - **Viikko-näkymän pienet tekstit** (puhelinkäytön läpikäynti 19.11.2026, kohta 6): alle 12 px:n tekstejä oli 133. Selittävä ja juokseva teksti (kaavioiden selitteet, tavoiterivit, tilannelauseet, Viimeksi-rivien arviot ym.) on nyt 12 px; lyhyet merkinnät (viikonpäivät, kaavioiden asteikot, merkit kuten "arvio" ja "nyt") vähintään 11 px. Isoin kirjaimin harvaan kirjoitetut otsakkeet ja alapalkin nimet pysyvät 11 px:ssä. Poikkeukset tilan vuoksi: päivälaatikon "tänään" 10,5 px ja yläkortin pienten ruutujen alarivit puhelimella 11 px (12 px leveämmällä näytöllä). Tarkistettu 360 px, 390 px ja PC.
    - **Kuittaus pyyhkäisemällä** (puhelinkäytön läpikäynti 19.11.2026, kohta 7): kosketusnäytöllä suunnitelmarivin voi pyyhkäistä Viikko-näkymän päiväkortissa ja päivälistassa sekä Käy viikko läpi -paneelissa.
      - **Oikealle = Tehty** (sama kuin ✓): vihreä "Tehty"-alue paljastuu rivin alta; yli 35 % rivin leveydestä (enintään 110 px) vedettynä kevyt värähdys ja päästettäessä kuittaus. Ilmoituksessa Kumoa kuten painikkeella; jalkapallokerralla avautuu lisätietopaneeli kuten ennen.
      - **Vasemmalle = Ei tehty** (sama kuin ✕): päiväkortissa avautuu suunnitelman paneeli, Käy viikko läpi -paneelissa syyn valinta.
      - Lyhyempi veto palauttaa rivin paikalleen; pystysuuntainen veto vierittää sivua normaalisti. Vedon jälkeen rivi ei avaudu napautuksena.
      - Ei tulevilla eikä jo ohitetuilla suunnitelmilla; niillä pyyhkäisy vaihtaa päivää kuten muualla kortissa. Suunnitelmarivin pyyhkäisy ei vaihda päivää.
      - Päiväkortin ohjeteksti mainitsee eleen. Painikkeet toimivat ennallaan (myös hiirellä ja ruudunlukijalla).
    - **Yläpalkki pienenee vieritettäessä** (puhelinkäytön läpikäynti 19.11.2026, kohta 8; puhelin ja tabletti, alle 1024 px):
      - Alaspäin vieritettäessä (yli 24 px yhtäjaksoisesti, kun sivun alusta on yli 80 px) sovelluksen nimirivi ja Ohje-painike piiloutuvat; profiilisirut jäävät näkyviin. Palkki noin 112 → 72 px (yhdellä profiililla pelkkä yläreunan tausta).
      - Ylöspäin vieritettäessä (yli 40 px) tai sivun alussa palkki palaa täyteen kokoon.
      - Sisältö ei siirry: palkin alle jää piilotetun rivin korkuinen tila. Kiinnittyvät osat (Jalkapallo-välilehdet) seuraavat palkin korkeutta.
      - Paneelin ollessa auki tila ei muutu. Kerralla yli 400 px:n siirto (ohjelman tekemä, esim. välilehden vaihto) ei muuta palkkia. Liikettä vähentävä asetus poistaa animaation.
    - **Synkronointi yläpalkissa** (puhelinkäytön läpikäynti 19.11.2026, kohta 9; alle 1024 px): Viikko-näkymän alussa ollut synkronointikortti siirtyi yläpalkin kuvakkeeksi Ohjeen viereen, joten päivänauha on heti otsikon alla.
      - **Merkki:** oranssi piste kuvakkeessa, kun jokin odottaa: puhelimella siirtämättömiä kirjauksia tai PC:n tiedot yli 7 päivää vanhoja, PC:llä puhelimen uudet kirjaukset kansiossa. Kuvakkeen nimessä (ruudunlukija, vihje) tila tekstinä.
      - **Napautus** avaa Synkronointi-paneelin: tilarivi (esim. "Tiedot PC:ltä 2 pv sitten · 3 odottaa siirtoa PC:lle", jälkimmäinen avaa listan) ja täysleveät painikkeet Päivitä PC:ltä / Lähetä PC:lle (puhelin) tai Synkronoi / Tuo puhelimelta + Lataa (PC ilman kansiotukea). Vanhentuneiden tietojen ja puhelimen uusien kirjausten ilmoitukset paneelin yläosassa.
      - Kuvake piiloutuu nimirivin mukana vieritettäessä. Leveällä näytöllä ennallaan (PC:n sivupalkki; puhelinroolissa Viikko-näkymän palkki).
    - **Päiväkortin tiedot samassa kohdassa** (käyttäjän palaute 19.11.2026: rivit olivat eri korteilla eri paikoissa; käyttäjän valinta "Alalaitaan"; `DayRow`):
      - **Otsikkorivi** on joka kortissa samanlainen: päivän pallo, nimi ja merkit (Suositus, lippu, Loma) nimen vieressä, oikealla + ja ⋯. Kapealla näytöllä merkki voi siirtyä nimen alle, mutta painikkeet pysyvät paikallaan.
      - **Tietorivi** kortin alalaidassa omana erottuvana palkkinaan (upotettu tausta ja ohut reunus), aina yksi rivi: vasemmalla minuutit yhteensä, oikealla reipas+rasittava-mittari ja luku (sekä arvio-merkki). Näkyy kuten ennenkin vain menneille ja tämän päivän korteille, joilla on kirjauksia tai arvio.
      - Kahden sarakkeen päivälistassa vierekkäiset kortit ovat yhtä korkeita, ja tietorivi on kortin pohjassa, joten rivit ovat vierekkäin samalla korkeudella.
      - Korjaus 19.11.2026 (käyttäjän havainto: puhelimella teksti meni palkin yli; käyttäjän toive: yksi yhtenäinen malli, rivit eivät saa hyppiä, PC:n yhden rivin malli ennallaan): puhelimella (alle 640 px) kokonaismäärä on pelkkä "135 min" – teksti "yhteensä" tai "josta arvio 60" näkyy vain leveällä näytöllä, ja arvion osuus selviää vihjeestä ja arvio-merkistä. Mittari kapenee tarvittaessa, joten rivi mahtuu aina palkkiin, myös 320 px:n näytöllä.
      - Korjaus 19.11.2026 (käyttäjän havainto: mittarin harmaa osa sulautui taustaan): tietorivin mittarin pohja on tummempi harmaa (oma väri upotetulle taustalle, vaalea ja tumma teema), joten täyttymätön osa erottuu.
    - **Revontulet ja Kenttävalot -taustat** (käyttäjän pyyntö 19.11.2026: tyylikäs tausta varsinkin tummalle teemalle, joka korostaa sovelluksen elementtejä; puhelin ensin, sitten PC; käyttäjä valitsi kolmesta ehdotuksesta A:n ja B:n; `index.css` "taustat", `ui/theme.ts` `BACKGROUNDS`, `public/theme-init.js`):
      - **Revontulet:** pehmeät, sumeat valonauhat (vihreä, sininen, violetti) ylhäällä ja alempana oikealla.
      - **Kenttävalot:** kaksi pehmeää valokeilaa yläkulmista ja hento keskiympyrä ja keskiviiva alhaalla.
      - **Pohja:** tummassa teemassa teeman taustaväriä selvästi tummempi (seuraa korostevärin sävyä), joten kortit erottuvat ja kuvio näkyy korttien väleissä. Vaaleassa teemassa vaalea, hennosti sävytetty versio.
      - **Mitoitus:** puhelimelle pystykuva, leveälle näytölle (vähintään 1024 px) oma vaakakuva, jossa kuviot on sijoitettu sisältöalueen mukaan. Hieno rae estää liukuvärien raidoittumisen.
      - Asetukset → Ulkoasu → Tausta -listassa on nyt yhdeksän vaihtoehtoa (3 × 3 -ruudukko puhelimella). Kuten muutkin piirretyt taustat: CSS ja SVG-data-URI, ei verkkoa.
    - **Treenin joukkue, vaihe 1: valinta** (käyttäjän pyyntö 19.11.2026: pelaaja treenaa ja pelaa usein useammassa joukkueessa; käyttäjä hyväksyi kaikki suositukset; vaihe 2 = raportit, ks. muistiinpano alla; `domain/types.ts` `Session.teamId`/`TemplateItem.teamId`/`PlannedSession.teamId`, `db/repositories.ts`, `features/football/TrainingTeam.tsx`, `TemplateSection`, `PlanOnceSheet`, `FootballPanel`, `GamesTab` `TeamsView`):
      - **Tieto:** seuran jalkapallotreenille (ei omatoiminen eikä verryttely) oma joukkue `Session.teamId` (Omat joukkueet). Pelien joukkue on edelleen lisätiedoissa (`FootballDetails.teamId`); treenillä joukkue on kerralla, jotta lisätietojen puuttuminen ja Lisätiedot-painike eivät muutu. Valinnainen kenttä, ei migraatiota.
      - **Treeniryhmät** (käyttäjän tarkennus 19.11.2026: esim. talentti- eli pienryhmäharjoittelu on erillistä, lisämaksullista toimintaa eikä osa joukkuetta; nimi on aina käyttäjän oma, ei kiinteää sanaa "Talentti"; käyttäjän valinta "Joukkueet ja treeniryhmät"; `Team.kind = 'group'`): Jalkapallo → Joukkueet -kortti on nyt "Omat joukkueet ja ryhmät". Lisättäessä ja muokattaessa valitaan **Joukkue** (pelit ja treenit) tai **Treeniryhmä** (vain treenit, esim. pienryhmävalmennus, taitokoulu, futsal-koulu; futsal-joukkue, joka pelaa pelejä, on joukkue). Ryhmällä on vain nimi ja valinnainen kuva, ei pelimuotoa, peliaikaa, seuraa eikä maata. Ryhmät listataan joukkueiden jälkeen merkinnällä "Treeniryhmä · vain treenit". Ryhmä ei näy pelien, kalenterin, tulostuksen eikä jakokuvien joukkuevalinnoissa (`listTeams` ilman `groups`). Treenin valinnan nimi on "Joukkue tai ryhmä", kun ryhmiä on, ja vaihtoehdot ovat ryhmiteltyinä (Joukkueet / Treeniryhmät). Joukkueen voi muuttaa ryhmäksi ja takaisin.
      - **Valinta kolmessa kohdassa:** viikkorytmin treenirivi ("Kuitattu treeni merkitään tälle joukkueelle"), yksittäinen suunniteltu treeni ja kirjatun treenin jalkapallon lisätiedot (ylimpänä, vaihdettavissa, myös "– ei joukkuetta –"). Viikkorytmissä ja suunnitelmassa valinta näkyy, kun aktiivisia joukkueita on vähintään kaksi; lisätiedoissa jo yhdellä.
      - **Kohta näkyy aina** (korjaus 19.11.2026, käyttäjän havainto: viikkorytmistä ei löytänyt joukkuevalintaa, koska se näkyi vasta kahdella joukkueella): viikkorytmissä ja suunnitelmassa ilman joukkueita ohje "Ei vielä joukkueita. … lisäät kohdassa Jalkapallo → Joukkueet", yhdellä joukkueella tai ryhmällä sen nimi ja tieto automaattisesta valinnasta sekä ohje toisen lisäämiseen, useammalla valinta. Lisätiedoissa ennallaan.
      - **Automaattisesti:** kuittaus käyttää yksittäisen suunnitelman tai viikkorytmin rivin joukkuetta; muuten ja suoraan kirjatulle treenille ainoa aktiivinen (ei arkistoitu) joukkue tai ryhmä, jos niitä on yhteensä täsmälleen yksi (joukkue + ryhmä → ei automaattista valintaa). Lajin vaihto muuksi poistaa joukkueen; muokkaus muuten säilyttää sen. Arkistoitu joukkue säilyy treenillä ja näkyy valinnassa merkinnällä "(arkistoitu)".
      - **Aiemmat treenit:** Jalkapallo → Joukkueet -kortissa "N treenillä ei ole joukkuetta" ja painike **Merkitse aiemmat treenit**: joukkue (ainoa valmiiksi valittuna), aikaväli (oletus ensimmäisestä merkitsemättömästä tähän päivään) ja määrä; koskee vain treenejä, joilta joukkue puuttuu. Ilmoituksessa Kumoa.
      - **Tarkenteen mukaan** (käyttäjän pyyntö 19.11.2026): paneelissa on aikavälin treenien tarkenteet pikavalintoina määrineen (yleisin ensin, "Ei tarkennetta" viimeisenä, Kaikki oletuksena), esim. vain "Talenttitreenit" treeniryhmälle. Vertailu ei huomioi kirjainkokoa eikä ylimääräisiä välilyöntejä (`labelKey`). Merkinnän jälkeen paneeli jää auki seuraavaa merkintää varten ja sulkeutuu, kun merkittäviä treenejä ei enää ole.
    - **Treenin joukkue, vaihe 2: raportit ja näkymät** (19.11.2026; joukkueet ja treeniryhmät erikseen; `domain/teamBreakdown.ts`, `features/football/TeamBreakdownCard.tsx`, `FootballSection`, `SeasonReport`, `story/story.ts`, `week/DayRow`, `WeekView`, `games/MonthCalendar`, `CalendarPrint`, `useCalendarEvents`, `calendarShared`, `repo.calendarTrainings`):
      - **Laskenta** (`teamBreakdown`): treenit (seuran treenit `isClubTraining` ilman verryttelyä; korjaus 19.11.2026: "Jalkapallo – omatoiminen" on lajityypiltään treeni, ja se laskettiin aluksi merkitsemättömäksi treeniksi) kerran joukkueesta `Session.teamId`, pelit lisätietojen joukkueesta (`FootballDetails.teamId`, vanhoille peleille saman niminen oma joukkue; treeniryhmä ei saa pelejä). Rivit: treenit, treeniaika, pelit, V–T–H, maalit ja pelaajan maalit; eniten toimintaa ensin. Arkistoitu näkyy vain, jos sillä on jaksolla toimintaa. Merkitsemättömät treenit ja pelit erikseen ("Ilman joukkuetta"). Erittely näytetään, kun joukkueita ja ryhmiä on yhteensä vähintään kaksi.
      - **Jalkapallo → Joukkueet:** kortti **Treeni- ja pelihistoria**, valinta Kausi / Vuosi / Kaikki; Joukkueet- ja Treeniryhmät-osiot erikseen, jokaisella rivillä pienet tunnusluvut (V–T–H ja maalit vain, kun tuloksia on). Alla ohje merkitsemättömille. Muutos 19.11.2026 (käyttäjän toive): kortti on Omat joukkueet ja ryhmät -kortin alla ja oletuksena suljettu (tila muistetaan laitteella); suljettuna otsikon alla yhteenveto, esim. "22 treeniä · 5 peliä · 3 joukkuetta ja ryhmää". Kortti näkyy jo yhdellä joukkueella tai ryhmällä (käyttäjän havainto: alle kouluikäisen yhden joukkueen profiililla kortti puuttui); Analyysin, raportin ja koosteen erittelyt vaativat edelleen vähintään kaksi. Merkitsemättömistä kerrotaan "N seuran treeniä ilman joukkuetta tai ryhmää" ja enintään kuuden treenin päivämäärät sekä "Omatoimiset harjoitukset eivät ole tässä mukana".
      - **Analyysin jalkapallokortti:** osio Joukkueittain valitulta viikolta (lyhyt nimi, treenit ja minuutit, pelit; "Ei merkitty" erikseen).
      - **Jakson raportti (tulostus):** Jalkapallo-osioon taulukko joukkue tai ryhmä · treenit (tunnit) · pelit · V–T–H · maalit.
      - **Kauden kooste:** jalkapallokortin jälkeen kortti **Joukkueittain** (enintään neljä palkkia: lyhyt nimi, treenit ja pelit), kun toimintaa on vähintään kahdessa.
      - **Viikko:** seuran treenin toisella rivillä ensin joukkueen tai ryhmän lyhyt nimi (`shortTeamName`: saman seuran joukkueilla ryhmä ja ikäluokka, esim. "Sininen 2016"; ryhmä omalla nimellään), kun niitä on vähintään kaksi. Suunnitellulla treenillä nimi tulee suunnitelmalta tai viikkorytmin riviltä, ja rivi on muotoa "Nimi · klo 16.00 · 60 min" (sana Suunniteltu jää pois, jotta aika mahtuu puhelimella). Muutos 19.11.2026 (käyttäjän havainto: "FC Lahti · 2018" näkyi pelkkänä "2018"): treenirivillä joukkueen koko nimi (`displayTeamName`, esim. "FC Lahti · 2018 syntyneet") omalla rivillään otsikon alla, myös suunnitellulla treenillä, jolloin kesto- ja aikarivi ("Suunniteltu klo 16.00 · 60 min") säilyy ennallaan. `shortTeamName` (Analyysi, Kauden kooste) ottaa seuran mukaan, kun ryhmää ei ole ("FC Lahti 2018").
      - **Yhden joukkueen profiili** (käyttäjän havainto 19.11.2026: alle kouluikäisen ja tämän päivän treenille nimi ei näkynyt; tarkistettu kaikki joukkueiden määrästä riippuvat kohdat):
        - Viikko-näkymän treenirivi, Tulevat kerrat ja Viimeisimmät kirjaukset näyttävät joukkueen tai ryhmän jo yhdellä joukkueella. Avoimelle suunnitelmalle nimi tulee suunnitelmalta, viikkorytmin riviltä tai ainoasta aktiivisesta joukkueesta tai ryhmästä (sama sääntö kuin kuitattaessa); kirjatulle kerralle vain tallennettu joukkue (vanhat merkitsemättömät kerrat ilman nimeä).
        - Kalenterin treenit saavat saman oletuksen (`calendarTrainings`), ja kuukausikalenterin päivän listassa nimi näkyy jo yhdellä joukkueella.
        - **Toinen joukkue tai ryhmä käyttöön** (uusi tai arkistosta palautettu, `keepSoleTeam`): aiemman ainoan joukkueen aikana ilman joukkuetta tallennetut aktiiviset viikkorytmin treenirivit ja avoimet yksittäiset treenisuunnitelmat merkitään sille joukkueelle, jotteivät tulevat treenit jää ilman joukkuetta.
        - **Pelit ja turnaukset** (käyttäjän toive 19.11.2026): päiväkortin pelin, harjoituspelin ja turnauksen rivillä oma joukkue omalla rivillään, kirjatulla kerralla lisätietojen joukkueesta (tai sen nimestä), tulevalla pelikalenterin tapahtuman joukkueesta; samoin Tulevat kerrat -kortissa.
        - **Viikkorytmin rivi ilman joukkuetta** (käyttäjän havainto 19.11.2026: tämän päivän treenissä ei näkynyt joukkuetta, koska rivi oli tallennettu ennen joukkuevalintaa ja joukkueita ja ryhmiä on kaksi): `inferTemplateTeams` (Viikko-näkymän avautuessa) antaa aktiiviselle seuran treenin riville joukkueen, jos sen viimeisimmät (enintään viisi) merkityt treenit, jotka on kuitattu riviltä (tai, jos sellaisia ei ole, joilla on sama tarkenne), ovat kaikki samaa joukkuetta tai ryhmää. Eri joukkueilla tai ilman merkittyjä treenejä rivi jää ennalleen, ja joukkueen voi valita viikkorytmissä.
        - Tarkoituksella vain vähintään kahdella: Analyysin Joukkueittain-osio, raportin taulukko, Kauden kooste -kortti (yhdellä joukkueella ne toistaisivat kokonaisluvut), tulosteen joukkuevalinta ja nimet tulosteen riveillä (otsikossa on joukkueen nimi).
      - **Kalenteri:** treenit tietävät joukkueensa (kerta, suunnitelma tai viikkorytmin rivi). Kuukausikalenterin päivän listassa treenin rivillä joukkueen tai ryhmän nimi, kun niitä on vähintään kaksi. Tulostuksessa itse valittu joukkue rajaa myös treenit (sen treenit ja treenit ilman joukkuetta); ainoa joukkue oletusvalintana ei rajaa treenejä, jottei treeniryhmän treenit katoa. Muiden joukkueiden ja ryhmien treeneissä on nimi edessä. Perheen tunnisteissa ja kalenteritiedoston nimessä käytetään vain joukkueita, ei ryhmiä.
      - **Asetukset → Viikkorytmi** (käyttäjän toive 19.11.2026): seuran treenin rivillä oma rivi joukkueelle (koko nimi) tai ryhmälle ("Ryhmä: nimi"; arkistoidulla "(arkistoitu)"). Ilman valintaa ainoa aktiivinen joukkue tai ryhmä näytetään valittuna, koska se tulee kuitatessa ja jää riville toisen lisäyksen yhteydessä; kun niitä on vähintään kaksi, keltaisella "Joukkue tai ryhmä valitsematta". Otsikkoriville merkki "päättynyt" (rivi himmeämpi) tai "alkaa d.M.", ja merkit rivittyvät puhelimella katkeamatta (`settings/TemplateSection.tsx`).
- **Viikon huomiot** (käyttäjän toive 20.11.2026: "faktaperusteinen ja järkevä ehdotus siitä mitä kannattaisi muuttaa", viikkoyhteenvedon yhteydessä; suunnitelma ja vaiheet 1–3 hyväksytty 20.11.2026). Päättyneeltä viikolta 1–2 lyhyttä huomiota omasta datasta; jokaisella lähde ja tarvittaessa yksi konkreettinen vaihtoehto. Puhdas funktio `domain/insights.ts`, kaikki laitteella.
  - **Pelisäännöt:**
    - Kolme lähdetasoa, aina näkyvissä: *Liikkumissuositus* (virallinen, §15), *Tutkimus* (kansainvälinen urheilulääketiede, havaintotutkimuksia: yhteys, ei syy) ja *Sovelluksen tulkinta*.
    - Huomio kertoo havainnon ja tarjoaa vaihtoehdon; ei käskyjä ("vähennä"), ei terveys- tai valmennusneuvoja, ei vertailuja muihin lapsiin eikä ennusteita (kuten §8). "Miksi?"-kohdasta näkee lähteen ja laskutavan.
    - Hyvästä viikosta sanotaan vain, että se oli hyvä; parannettavaa ei keksitä.
    - **Datan portti:** huomioita ei anneta kesken olevalta viikolta, kun viikolla on kuittaamattomia kertoja ("Kuittaa ensin …"), kun kirjauksia on liian vähän (`lowData`) tai kun vertailtavia päiviä on alle viisi (sairaus, loma; päivämäärätavoitteet eivät silloin ole reiluja).
  - **Vaihe 1: liikkumissuosituksen huomiot** (kaikki ryhmät; toteutettu 24.11.2026, versio 1.1.36: `domain/insights.ts`, `features/analysis/InsightsCard.tsx`, `week/LastWeekCard`, Analyysin kortti `insights` suosituksen jälkeen):
    - Koululainen 7–17 v: reippaan ja rasittavan keskiarvo alle 60 min (vajaat viikonpäivät nimettynä); keskiarvo täyttyi mutta vähintään kolme päivää jäi alle tunnin; rasittavia päiviä alle 3; lihaskuntoa tai luustoa vahvistavia päiviä alle 3.
    - Alle kouluikäinen: 3 h -tavoite täyttyi alle seitsemänä päivänä; kuvio arki vs. viikonloppu ("arkipäivinä täyttyi, viikonloppuna ei" tai päinvastoin); puuttuiko vajaina päivinä pääosin vauhdikas osuus vai liikkumisen kesto.
    - Aikuinen: painotettu viikkomäärä alle 150 min; lihaskuntopäiviä alle 2.
    - Toisto: sama vaje myös kahtena edellisenä viikkona → "kolmas viikko peräkkäin".
    - Konkreettinen vaihtoehto viikkorytmistä: harrastuksettomat viikonpäivät (aktiiviset viikkorytmin rivit, laji kategoriaa harrastus), esim. "Viikkorytmissä harrastuksettomia päiviä: ke, pe." Sama vaihtoehto näytetään vain ensimmäisessä huomiossa.
    - Järjestys: suosituksen pääluku, rasittavat päivät, vahvistavat päivät, päivittäiset vajeet. Viime viikko lyhyesti -koosteessa kaksi tärkeintä (ja "Kaikki huomiot Analyysissa"), Analyysin viikkonäkymässä uusi kortti **Huomiot** (kaikki; kesken olevalla viikolla "Huomiot tulevat, kun viikko on päättynyt").
  - **Vaihe 2: urheilun kuormitus** (toteutettu 24.11.2026, versio 1.1.37; lähdetaso Tutkimus; lapsilla, ei aikuisilla; `domain/sportLoad.ts`, `insights.ts`, `story/story.ts`). Lähteet tarkistettu 24.11.2026 alkuperäisestä: Jayanthi 2015 Europe PMC:n tiivistelmästä, AAP:n suositukset AAP:n omalta vanhemmille tarkoitetulta sivulta (Brenner & Watson, "AAP Policy Explained", Pediatrics 2024 -raportin tiivistelmä); AAP:n sivut ja PubMed estivät automaattisen haun.
    - **Ohjattu urheilu** = harrastus-kategorian kerrat (treenit, pelit, turnaukset), ei koululiikuntaa, omatoimista eikä treenin verryttelyä. Turnauksen kesto sisältää odottelun, joten luku voi olla todellista suurempi (sanotaan Miksi?-kohdassa).
    - **Ei vapaapäivää** (`no_rest_day`): ohjattua urheilua viikon kaikkina seitsemänä päivänä. AAP: lasta ei pitäisi vaatia harjoittelemaan tai pelaamaan useampana kuin 5–6 päivänä viikossa. Vapaapäivä tarkoittaa vapaata ohjatusta urheilusta, ei liikkumisesta.
    - **Tunnit yli iän** (`hours_vs_age`, 7 v alkaen): ohjatun urheilun viikkotunnit ylittävät iän vuosina (Jayanthi ym. 2015: 7–18-vuotiaat, tapaus-verrokkitutkimus, 1 190 urheilijaa; ikävuodet ylittävä viikkotuntimäärä yhteydessä vakaviin rasitusvammoihin, OR 2,07). Teksti sanoo, että tutkimus osoittaa yhteyden, ei syytä.
    - **Kasvu** (`load_spike`): viikon ohjattu urheilu yli 20 % ja vähintään tunnin yli edellisten neljän viikon keskiarvon (AAP: viikoittaista harjoitusmäärää lisätään kerralla enintään 10–20 %). Vertailu neljän viikon keskiarvoon on sovelluksen tulkinta (yksittäinen viikko vaihtelee peleistä ja turnauksista); vertailuviikkojen pitää olla seurannan ajalta.
    - Järjestys: suosituksen pääluku, sitten kuormitus (vapaapäivä, tunnit, kasvu), sitten muut suosituksen huomiot; kooste näyttää kaksi tärkeintä. Toisto lasketaan kuten vaiheessa 1 (haku: viikko ja kuusi edeltävää).
    - **Kauden kooste:** kortti **Tauot ja vaihtelu** (lapsilla, kun päälajin kertoja on vähintään neljä): päälajin (eniten ohjatun urheilun aikaa; saman lajin tyypit yhdessä) osuus, pisin yhtenäinen tauko lajista kauden seuratulta ajalta ("(jatkuu)", kun tauko on kesken), ohjattujen lajien määrä ja AAP:n tieto 2–3 kuukauden vuotuisesta tauosta samasta lajista (voi jakaa kuukauden jaksoihin).
    - Ei mukana: ohjattu urheilu enintään kaksi kertaa vapaan leikin verran (Jayanthi), koska vapaa leikki on sovelluksessa enimmäkseen arviota.
  - **Vaihe 3: asetukset ja toisto** (toteutettu 24.11.2026, versio 1.1.38; `ProfileForm`, `InsightsCard`, `insights.ts`):
    - **Profiilin asetukset** (Asetukset → Profiilit → Muokkaa, kohta Viikon huomiot): kytkimet *Liikkumissuositus* ja (lapsilla) *Urheilun kuormitus*. Synkronoituvat kentät `Profile.insightsRec` ja `insightsLoad`: vain `false` tallennetaan, puuttuva = päällä. Kuormitus pois piilottaa myös Kauden koosteen Tauot ja vaihtelu -kortin. Kun kaikki profiilin huomiot ovat pois (aikuisella suosituksen huomiot pois), kooste ei näytä osiota ja Analyysin kortti kertoo, mistä ne saa takaisin.
    - **Toisto lievempänä:** kun sama huomio toistuu kolmatta viikkoa peräkkäin, se näytetään kevyempänä rivinä (tunniste, merkki "Kolmas viikko peräkkäin" ja havainto; tarkenne, vaihtoehto ja Miksi? kohdasta Näytä tarkemmin) ja uusien huomioiden jälkeen, joten koosteen kaksi tärkeintä ovat ensisijaisesti uusia. Viikkorytmin vaihtoehto siirtyy ensimmäiseen näytettävään huomioon.
- **PC:n synkronoinnin jumi** (käyttäjän havainto 24.11.2026: "synkronointi jäi jumiin, pyörii mutta mitään ei tapahdu eikä uutta synkkiä tule"; PC, ei lupakysymystä; korjattu versiossa 1.1.39; `fileIO.ts`, `useSync.ts`): (1) kopiotiedostojen haku avaa vain synkronoinnin kopioiden nimiset tiedostot (`listFolderFiles(handle, isSyncCopyName)`); aiemmin kansion jokainen tiedosto avattiin, ja pilvikansion (OneDrive, Google Drive) lataamaton tiedosto saattoi jäädä odottamaan loputtomiin. (2) Jokaisella kansiovaiheella on aikaraja (`withTimeout`, 30 s; varmuuskopio 60 s, lupakysely 120 s): jumiin jäänyt vaihe päättyy virheeseen "Synkronointi keskeytyi: <vaihe> ei valmistunut N sekunnissa…", joten painike ei pyöri loputtomiin eikä automaattinen synkronointi jää pysyvästi kesken-tilaan; kesken latautuva kopio ohitetaan ja luetaan seuraavalla kerralla. (3) Käsin painettu ja automaattinen synkronointi eivät käsittele kansiota yhtä aikaa (`exclusive`-jono). Testit `folderSync.test.ts`.
  - **Jatko 1.1.40** (käyttäjän havainto 24.11.2026: versiossa 1.1.39 pyörii yhä yli 2 min, PC, yksi ikkuna): (1) Synkronoi-painikkeen alla näkyy meneillään oleva vaihe ("Synkronoidaan: liikkuminen.json luku…"; `useSyncStage`), ja keskeytyksen syy jää näkyviin painikkeen alle, kunnes synkronoidaan uudelleen. (2) Koko synkronoinnilla on aikaraja 2 min (`exclusive`), joka kattaa myös laitteen oman tietokannan vaiheet (yhdistäminen, kirjausten siivous, suunnitellut kerrat, tiedoston kokoaminen); viesti kertoo vaiheen, jossa synkronointi oli, ja jono vapautuu. (3) Kansion vaiheen aikakatkaisu keskeyttää koko synkronoinnin heti (ei jatketa muihin kansiovaiheisiin, jotka jäisivät yhtä lailla odottamaan); muut virheet (esim. puuttuva kopio) ohitetaan kuten ennen. Varmuuskopion aikaraja 30 s. (4) Kansion käyttölupa tarkistetaan 30 s:n aikarajalla ennen kyselyä (kysely 2 min).
  - **Syy ja korjaus 1.1.41** (24.11.2026): käyttäjän PC:llä synkronointi keskeytyi vaiheessa "kansion käyttölupa" (selain ei saanut vastausta tallennetulta kansioyhteydeltä 30 sekunnissa); saman pilvikansion valinta uudelleen (Asetukset → Vaihda pilvikansio) korjasi. Keskeytysviestin alla on nyt ohje "Jos sama toistuu, valitse sama pilvikansio uudelleen" ja painike **Valitse kansio uudelleen** (sivupalkki, kapean ikkunan palkki ja yläpalkin paneeli; vain PC ja kansiotuki), joka avaa kansion valinnan heti painalluksesta ja synkronoi uudella kansioyhteydellä (`pcSync(true)`). Viesti jää näkyviin, jos valinta perutaan; onnistunut synkronointi poistaa sen.
- **Kuittaus lisätiedoilla** (käyttäjän toive 24.11.2026: "treeni päättyy, haluan kuitata sen tehdyksi ja siinä samalla kertoa paljonko oli omatoimista verryttelyä, oliko treeni lajin arvon mukainen, reipas vai rasittava, tarvittaessa muuttaa lihas/luusto valintoja"; valinnat: ilmoitus avaa kerran lomakkeen, neljä tehoa, myös päiväkortista; versio 1.1.42; `features/review/ConfirmForm.tsx`, `repo.confirmPlanned(…, ConfirmDetails)`): lomake *Kuittaa tiedoilla*: toteutunut kesto (oletus suunniteltu), teho (Lajin arvio / Enimmäkseen kevyttä / reipasta / rasittavaa; esiasetus kuten kerran muokkauksessa, ponnistelukerroin 0), lihaksia ja luustoa vahvistava (lajin oletukset, näkyvissä kun laji sallii) ja seuran treenillä omatoiminen verryttely ennen ja jälkeen (esitäytetty viikkorytmistä; annettu arvo korvaa oletuksen, 0 ja 0 = ei verryttelyä). Painike *Kuittaa tehdyksi* luo kerran yhdellä transaktiolla. Paikat: (1) Käy viikko läpi -rivin kynä (aiemmin vain kesto); (2) päiväkortin suunnitelmapaneelin *Kuittaa tiedoilla (teho, lihas/luusto[, verryttely])* kestovaihtoehtojen alla; (3) työpöytätilan *päättyi*-ilmoituksen painallus avaa läpikäynnin niin, että päättyneen kerran lomake on auki ja rivi ensimmäisenä (`requestWeek(true, planId)`). ✓ kuten suunniteltu ja kestovaihtoehdot toimivat ennallaan.
- **24.11.2026 toiveet** (versio 1.1.43; valinnat: suosikkilajit, lihas/luusto aina näkyvissä, vaalea/tumma-painike):
  - **Suosikkilajit:** `ActivityType.favorite` (valinnainen, synkronoituu; laji on yhteinen kaikille profiileille). Asetukset → Liikkumismuodot ja tehoprofiilit: rivin tähti merkitsee tai poistaa suosikin. Suosikit näkyvät ensimmäisinä lajivalinnoissa (`visibleTypes` → `favoritesFirst`: viikkorytmi, kertaluonteinen suunnitelma, kerran muokkaus, jonka valikossa suosikilla ★) ja Lisää kerta -näkymän Muut lajit -ruudukossa ennen viimeksi käytettyjä (kaikki suosikit näkyvät, ruudukko täydennetään kolmella jaolliseksi, vähintään 6; painikkeessa ★).
  - **Lihas- ja luustovalinnat aina näkyvissä** (käyttäjän havainto: jalkapallotreenissä lihas ei ole esivalittu, pyöräilyssä valintoja ei näy): valinnat näkyvät kaikilla lajeilla kirjauksessa, kerran muokkauksessa ja kuittauksessa (`StrengthFields`). Lajin oletus on *Esivalittu* tai *Ei esivalittu* (vanha "Ei näytetä" = ei esivalittu). Kun valinta poikkeaa lajin oletuksesta, lomakkeessa on valinta *Tallenna lajin oletukseksi (laji)*, joka tallentaa sen lajin oletukseksi tallennuksen yhteydessä. Sisäänrakennettujen lajien lähtöoletukset pysyvät liikkumissuosituksen esimerkkien mukaisina (pallopelit = luusto).
  - **Teeman pikavalinta (PC):** sivupalkissa Ohjeen alla *Tumma teema* / *Vaalea teema* (kuu/aurinko) vaihtaa näkyvän teeman vastakkaiseksi; laitteen mukainen teema valitaan edelleen Asetukset → Ulkoasu. Asetusten valinta päivittyy samalla (`themechange`).
  - **Viikko-näkymän kortit:** kaikki kortit voi pienentää (lisätty Päivittäin-kaavio ja Viikon rytmi; tila muistetaan laitteella). Pienennetyn kortin tiivistelmä näkyy otsikon alla eikä sen vieressä (Liikuntaa viikossa, Viikon liikuntatunnit, Tulevat kerrat), joten kapeassa sivupalstassa tekstit eivät mene päällekkäin. Viikon pääkortin asettelu määräytyy kortin leveydestä (container query `@xl`): kapeassa pääpalstassa rengas ja lukulaatikot allekkain, eivät puristu.
- **24.11.2026 toiveet, vaihe 1** (versio 1.1.44; korjaukset yhdeksän kohdan erästä; valinnat: ilmoitus tuli PC:llä etukäteen kuitatusta kerrasta, viikon alussa suunnitelmarivi):
  - **Ilmoitus kuitatusta kerrasta:** `unconfirmedPlans` ohittaa kerran, jolla on elävä kirjaus (`plannedSessionId`), vaikka suunnitelman tila olisi synkronoinnissa palannut avoimeksi; uusi `repo.isPlanOpen(planId)` tarkistaa tilan suoraan tietokannasta juuri ennen "päättyi"-ilmoitusta. Näytetyt ilmoitukset muistetaan tunnisteittain (`plan-<id>`), ja kuitatun tai ohitetun kerran ilmoitus suljetaan (`closeNotification`, myös palvelutyön kautta näytetyt).
  - **Peliaika "Osan":** `gameRows` laskee pelin ja turnauksen pelin peliajan Pelasiko-valinnasta, kun tarkkoja minuutteja ei ole (`playedMinOf`: Koko pelin = pelin pituus, Ei = 0, Osan = pelin pituus × kerran peliaika-arvio). Arvio merkitään `playedEstimate`, näkyy tuloksissa muodossa "pelattu ~42 min" ja lasketaan peliaikaan; peliaikaosuuteen (`playSummary`) arvio ei vaikuta. Koskee myös aiemmin tallennettuja pelejä.
  - **Viikon alku:** pääkortti ilman arvioitavia päiviä näyttää viikon suunnitelman (`weekPlanText`: suunnitellut kerrat, niiden kesto, arvio koko viikolle ja ryhmän tavoite); "Viikko on vasta alussa" -viesti ja Lisää kerta -painike poistettu. Mennyt viikko ilman arvioitavia päiviä: "Viikolta ei ole arvioitavia päiviä."
- **24.11.2026 toiveet, vaihe 2** (versio 1.1.45):
  - **Jakopainikkeet:** tuloskuvan jako (Tulokset) on tekstipainike *Tuloskuva* ja kalenterin *Ennakko* samaa korostettua tyyliä (`SHARE_PILL`, ui/InfoLink.tsx). Pelin linkki (`InfoLink`) näyttää aina tekstin *Tiedot*; compact on vain matalampi. Tulosten pelirivillä painikkeet ovat omalla rivillään tuloksen alla.
  - **Joukkueen sarja:** `Team.series` (valinnainen, enintään 20 merkkiä, `cleanSeries`; ei treeniryhmällä). Jalkapallo → Joukkueet: kenttä *Sarja (oletus peleille ja turnauksille)*, näkyy joukkueen rivillä. Uuden tapahtuman lomake esitäyttää valitun joukkueen sarjan, kunnes käyttäjä muuttaa sarjaa itse; jälkikäteen kirjattavan pelin lisätiedot esitäyttävät sen joukkueen valinnasta. Kuittaus ja ennakkokuva käyttävät joukkueen sarjaa, kun tapahtumalla ei ole omaa.
  - **Väliin jääneen kerran kommentti:** `PlannedSession.skipNote` (enintään 200 merkkiä, välilyönnit siistitään). *Ei tehty* -valinnan yhteydessä kommenttikenttä (läpikäynti, päiväkortin suunnitelma, Jalkapallo → Kalenteri *Ei pelattu*); `repo.skipPlanned(planId, reason?, note?)` ja `repo.setSkipNote` (suunnitelman tiedoissa, tallentuu kentästä poistuttaessa). Näkyy päiväkortissa ja Viimeksi väliin jääneet -listassa. Palautus avoimeksi ja kuittaus poistavat kommentin.
  - **Brändi-tyylin tausta** on aina täysin musta (#000), myös videoissa; valittu väri näkyy korostuksissa.
- **24.11.2026 toiveet, vaihe 3** (versio 1.1.46; valinnat: tempo ja pituus; ilmoitus pelin jälkeen, pikakirjaus myös yksittäiselle pelille ja Jalkapallo-välilehdelle):
  - **Videon tempo ja pituus:** `videoTimeline(names, timing)`, `VideoTiming { tempo: slow|normal|fast; length: short|normal|long }`. Tempo kertoo animaatioiden ajat (`TEMPO_PACE` 2,1 / 1,6 / 1,1), pituus lopun pysäytyskuvan ja videon rajat (`LENGTH_HOLD`: lyhyt 1,5 s, 4–9 s; normaali 3 s, 7–13 s; pitkä 6 s, 10–20 s); yläraja on aina vähintään animaatio + 1 s, joten pitkä otteluohjelma ei katkea. Normaali/normaali = aiempi video. Valinnat (Segmented *Tempo* ja *Pituus*) ennen *Tee video* -painiketta, muistetaan laitteella (`localStorage videoTiming`); muutos laskee ajoituksen uudelleen ilman uutta piirtoa ja hylkää valmiin videon. Koskee ennakko- ja tulosvideota.
  - **Pelipäivän pikakirjaus** (`GameDayCard`, games/TournamentDay.tsx; aiemmin vain turnaukset): myös tämän päivän yksittäinen peli (kalenterin avoin suunnitelma tai kirjattu kerta): tulos, oman pelaajan maalit ja Pelasiko. `repo.recordGameResult(target, result, today)` kuittaa kalenterin pelin tarvittaessa ja säilyttää muut lisätiedot; peliaika Ei = 0, Koko pelin = kesto − lämmittely, Osan = arvio, ilman valintaa ennallaan. Yksittäisen pelin lomake avataan painikkeesta *Kirjaa tulos* (ei auki koko päivää). Kortti näkyy Viikko-näkymässä (kuluva viikko) ja Jalkapallo-välilehden yläosassa.
  - **Ilmoitus pelin päättymisestä (PC):** `gameSlots` (domain/gameReminders.ts): ottelu = alku + kesto, turnaus = jokainen peli otteluohjelman kellonajasta + pelin pituus (`gameLengthMin` tai pelimuodon oletus); kirjattu tulos tai ohitettu peli ei ilmoita. DesktopAgent näyttää ilmoituksen (asetus *Kerta päättyi*) tunnisteella `game-<planId>-<i>`; painallus avaa Viikko-näkymän ja pelin lomakkeen (`requestGameEntry` / `subscribeGameEntry`). Pelikohtaisten aikojen peleille ei näytetä erillistä "kerta päättyi" -ilmoitusta (turnaus ilman otteluohjelman aikoja: entinen ilmoitus). Ilmoitus suljetaan, kun tulos on kirjattu.
- **24.11.2026 harjoituspelin pikakirjaus** (versio 1.1.47; käyttäjän toive: pelien määrä ja pelin pituus selviävät vasta paikan päällä; valinnat: kesto = lämmittely + pelit × pituus, yhteinen pelin pituus, vastustaja kalenterin vastustajista):
  - **Kortti** `FriendlyEntry` (games/FriendlyDay.tsx) pelipäivän pikakirjauksen rinnalla (Viikko-näkymä ja Jalkapallo-välilehti): tämän päivän harjoituspeli (kalenterin avoin suunnitelma tai kirjattu kerta). Valitsimet *Pelejä* (1–20), *Pelin pituus* (5–120 min, oletus pelimuodosta) ja *Lämmittely* (0–60 min, oletus 15); rivi näyttää laskun (esim. 15 + 4 × 20 = 95 min) ja nykyisen keston. Kesto lasketaan vasta, kun pituutta tai määrää on muutettu (tai pituus on tallennettu aiemmin); siihen asti kesto pysyy kalenterin mukaisena. *Tallenna pelit ja kesto* ilman tulosta.
  - **Pelirivit:** vastustaja valitaan kalenterin vastustajista (vuorotellen esivalittuna) tai kirjoitetaan; tulos −/+ ja oman pelaajan maalit. Ensimmäinen tallennus kuittaa harjoituspelin (Kumoa); kortti säilyy samana kuittauksen yli (avain = suunnitelman tunniste).
  - **Tallennus** `repo.recordFriendlyDay(target, { gamesCount, gameLengthMin?, warmupMin?, games }, today)`: tulokset ja pelien määrä lisätietoihin; pituus ja lämmittely `FootballDetails.gameLengthMin` / uusi `warmupMin`; kerran kesto = lämmittely + pelit × pituus ja tehot lasketaan uudelleen (`updateSession`, esiasetus ja tarkenne säilyvät). Harjoituspelin pelirivien paikat säilyvät (`saveFootballDetails`: tyhjä peli välissä jää, lopun tyhjät pois, `gamesCount` vähintään rivien määrä); lisätietolomake täydentää rivit pelien määrään.
- **24.11.2026 animaatioiden tarkistus** (versio 1.1.48; käyttäjän havainto: päiväkortteja avatessa avausanimaatio tökkii, sekä PC:llä että puhelimella). Mittaus tuotantoversiolla Edge + CDP: pääsäikeen ruudut (rAF-välit, pitkät tehtävät) ja selaimen jäljitys (piirretyt ruudut, säikeet), PC sellaisenaan ja puhelin 390 × 844 suoritin 4× hidastettuna; kohteet: kerran ja suunnitelman avaus päiväkortista, päivän toiminnot, Uusi kerta, paneelin sulku, korttien pienennys ja avaus, päivän ja viikon vaihto, pikakirjaus, välilehdet sekä alkusivun esittely ja vieritys.
  - **Löydökset:** View Transitions -siirtymät (kortti → paneeli -morfi ja välilehden vaihto) kuvasivat koko sivun ennen ja jälkeen muutoksen ja morfin `html.morphing`-luokka laski kaikkien noin 1 100 elementin tyylit uudelleen: näkymä jähmettyi ennen liikettä puhelimella 120–180 ms ja PC:llä 30–107 ms. Viikon pääluvun laskuri (`useCountUp`) piirsi koko yhteenvetokortin uudelleen joka ruudulla; plus-painikkeen peittotarkistus mittasi asettelun jokaisen Viikko-näkymän piirron jälkeen (myös paneelia avattaessa); Uusi kerta- ja kerran muokkauspaneeli piirrettiin avautuessa kahdesti (tila alustettiin efektissä). Uuden kerran paneelin ja alkusivun pikatestin taustan ensimmäisen näytön noin 140 ms:n nykäys on näytönohjaimen varjostimien käännös: se toistuu vain ensimmäisellä kerralla samassa selaimessa (todennettu pysyvällä selainprofiililla), joten sitä ei korjata sovelluksessa. Korttien avaus ja pienennys, päivän vaihto ja alkusivun esittely olivat jo sulavia.
  - **Korjaukset:** `morphOpen` ei enää käytä View Transitions -rajapintaa: paneeli avautuu heti tavallisella animaatiolla, ja PC:llä (lg) se kasvaa napautetun rivin kohdalta (`transform-origin` rivin keskikohtaan, `@keyframes sheet-grow` scale 0,9 → 1 ja läpinäkyvyys; liike näytönohjaimella). Välilehden vaihto vaihtaa tilan heti ja `TabPanel` häivyttää uuden välilehden esiin Web Animations -rajapinnalla pelkällä läpinäkyvyydellä 200 ms (`markTabSwitch`; ei transformia, joka siirtäisi kiinteästi sijoitetut painikkeet; vaihtoon liittyvä piilotus `hideUntilSettled` ennallaan). Uusi `CountUp` (ui/CountUp.tsx) kirjoittaa luvun suoraan elementtiin ilman Reactin piirtoa (viikon pääluku, jalkapallon kauden luvut, kohokohtien arvosanojen keskiarvo). `checkFabCover` ei mittaa, kun päivän korttia ei ole tai paneeli on auki. QuickAdd ja SessionEditor alustavat tilansa piirron aikana (ei efektissä).
  - **Tulos** (sama mittaus): puhelimella kerran avaus 121–181 → 39–58 ms ennen ensimmäistä ruutua (ensimmäinen avaus 98 ms), välilehti 77–139 → 19–88 ms, viikon vaihdon pisin ruutu 87 → 39–47 ms; PC:llä kaikki mitatut toiminnot 8–35 ms. Välilehdelle palatessa kortit päivittävät tietonsa (React Activity) ja pääsäie voi olla varattuna, mutta häivytys liikkuu näytönohjaimella eikä nyi.
- **24.11.2026 paneelista toiseen ilman välähdystä** (versio 1.1.49; käyttäjän havainto PC:llä: Viikko-näkymästä tapahtumaa avatessa ruutu välähtää välillä). Ruudunkaappauksella (screencast, kirkkaus ruuduittain) todennettu: kun paneeli sulkeutui ja toinen avautui samassa päivityksessä (päivän toiminnot → Lisää kerta, suunnitelma → kerta, kerta → Lisätiedot, tallennus → jalkapallon lisätiedot), edellinen tumma tausta katosi heti ja uuden taustan häivytys alkoi läpinäkyvästä, joten sivu näkyi hetken täysin kirkkaana. Korjaus (`ui/Sheet.tsx`): sulkemishetki kirjataan asettelun vaiheessa (`lastCloseAt`), ja jos paneeli avautuu alle 300 ms edellisen sulkemisesta, sen tausta näytetään heti täysin tummana (`.scrim-instant`, ei häivytystä); paneeli itse avautuu tavallisella animaatiolla. Pelkkä avaus ja päällekkäiset paneelit ennallaan.
- **24.11.2026 paneeli katosi hetkeksi avauksen lopussa** (versio 1.1.50; käyttäjän näyttötallenne PC:ltä versiolla 1.1.49: ruutu välähtää edelleen, kun Viikko-näkymästä avaa kerran). Tallenteen ruutukohtainen kirkkausanalyysi: paneeli ja tumma tausta näkyivät avausanimaation ajan oikein, mutta noin 0,33 s avauksen jälkeen eli animaatioiden päättyessä (tausta 0,32 s, paneeli 0,35 s) yksi tai kaksi ruutua näytti sivun kokonaan ilman paneelia ja taustaa, minkä jälkeen paneeli palasi; samassa ruudussa paneelin sisältö päivittyi (live-kyselyjen tiedot saapuivat). Selitys: näytönohjaimella ajettu animaatio päättyi, ennen kuin kiireinen pääsäie ehti päivittää elementin lopputilan, ja selain piirsi välissä animaation alkuarvon (läpinäkyvä; animaatiot alkavat pysäytettyinä `anim-hold`). Testiselaimen kuvakaappauksessa ilmiö ei toistunut edes kuormitetulla pääsäikeellä, joten korjaus perustuu tallenteeseen.
  - **Korjaus:** `.scrim`- ja `.anim-sheet`-animaatioiden täyttö `backwards` → `both`: animaatio pitää loppuarvonsa (läpinäkyvyys 1, ei siirtoa) päättymisen jälkeenkin, joten väliruutua ei synny. Koska pidetty animaatio ohittaisi elementin oman `transform`-tyylin, alas vetäminen (puhelin) asettaa paneelille `animation: none` vedon alkaessa. Todennettu: lyhyt veto palauttaa paneelin, pitkä sulkee; paneelista toiseen siirtyminen pitää taustan tummana (PC ja puhelin).
- **24.11.2026 esimerkkitila** (versio 1.1.51; käyttäjän pyyntö: kattava esimerkkiprofiili, jolla uusi käyttäjä tutustuu ominaisuuksiin ja joka pysyy ajan tasalla sovelluksen muuttuessa). Käyttäjän valinnat: pääsy vasta kutsukoodin jälkeen (aloitusnäkymän painike Tutustu esimerkkiin ja Asetusten kortti Esimerkkitila; alkusivu pysyy kutsukoodin takana), erillinen tila, kaksi lasta.
  - **Erillinen tila** (`demo/demoMode.ts`): välilehtikohtainen merkintä (sessionStorage `demoMode`) luetaan käynnistyksessä, ja `db/schema.ts` avaa silloin oman tietokannan `liikkumisseuranta-esimerkki`; omaan tietokantaan ei kosketa. `enterDemo` tallentaa omat näkymäasetukset (localStorage) talteen, poistaa vanhan esimerkkitietokannan (enintään 1,5 s, jos toinen välilehti pitää sitä auki) ja lataa sivun; `exitDemo` palauttaa asetukset ja lataa sivun omilla tiedoilla. Kutsukoodin tarkistus ohitetaan esimerkkitilassa (sinne pääsee vain koodin jälkeen). Näkymän yläreunassa palkki "Esimerkkitila … Poistu" (`demo/DemoBanner.tsx`). Synkronointi (sivupalkki, yläpalkki, Viikko), varmuuskopiomuistutus ja PC:n ilmoitukset (`DesktopAgent`) eivät ole esimerkissä käytössä; Asetusten Laitteet ja varmuuskopio -kohta kertoo sen.
  - **Aineisto** (`demo/seedDemo.ts`, ladataan vain esimerkkitilassa): luodaan ensimmäisellä käynnistyksellä (`seedDemoOnce`, kerran myös kahdesti ajetussa käynnistyksessä) tämän päivän mukaan samoilla tallennusfunktioilla kuin tavallinen käyttö, toistettavalla satunnaisluvulla. Aino (koululainen, jalkapallo): seura, joukkue sarjalla ja treeniryhmä, viikkorytmi (joukkuetreeni ma ja ke omatoimisella alkuverryttelyllä, taitotreeni pe ryhmän kanssa, koululiikunta ti ja to) yhdeksän viikkoa taaksepäin kuitattuna (osa kovempana, osa lihas- ja luustoliikuntana), treenien arviot (fokus, arvosana, viihtyminen), sairausviikko, peruttu treeni, lomaviikko, kuittaamatta eilinen ja toissapäivä, omat kerrat (liikuntapuisto osineen, käsin syötetty teho, omatoiminen pallottelu), neljä sarjapeliä tuloksineen, turnaus pelikohtaisine tuloksineen ja kommentteineen, harjoituspeli pikakirjauksella sekä tulevat peli (ennakkoteksti), turnaus (otteluohjelma) ja harjoituspeli (tietoja puuttuu). Eino (alle kouluikäinen): päiväkoti ja leikki arkiliikuntana, uimakoulu la (päällekkäin Ainon pelin kanssa) ja temppujumppa ke, matkapäivä, leikkipuisto, potkulauta, perheretket, luistelu kovempana; piilotettu laji ja suosikkilajit.
  - **Kattavuustesti** (`demo/seedDemo.test.ts`): aineisto syntyy virheettä eri viikonpäivinä ja vuodenvaihteessa, jokaisessa tietokannan taulussa on rivejä (uusi taulu ilman esimerkkiä kaatuu testiin), ja ominaisuuslista (noin 50 tarkistusta) on katettu. **Jatkossa:** uuden ominaisuuden tiedot lisätään seedDemo.ts:ään ja tarkistus testiin.
- **24.11.2026 alkusivun kuvat esimerkkitilasta ja tekstien päivitys** (versio 1.1.52; käyttäjän pyyntö: alkusivun tiedot vastaamaan uusimpia päivityksiä ja päivittymään sovelluksen muuttuessa).
  - **Kuvausskripti** `scripts/landing-shots.mjs` (`npm run shots`, kehityspalvelin käynnissä; ei lisäriippuvuuksia: Edge tai Chrome näkymättömänä, ohjaus DevTools-protokollalla Noden omalla WebSocketilla, Node 22+, selaimen polku tarvittaessa ympäristömuuttujasta BROWSER). Skripti avaa tuoreen selainprofiilin, siirtyy esimerkkitilaan (aineisto luodaan kuvauspäivän mukaan), piilottaa esimerkkitilan palkin (`data-demo-banner`) ja animaatiot ja kuvaa samat 14 näkymää kuin ennen (PC 2560 px ja puhelin 1170 px; perusversiot 1280 ja 780 px pienennetään niistä selaimessa) kansioon public/landing. Kuvat otetaan uudelleen, kun käyttöliittymä muuttuu näkyvästi.
  - **Esittelyn merkinnät** eivät enää sisällä kuvien lukuja (esim. maalimäärät), joten ne pysyvät oikeina uusissa kuvissa. Kohdat: kuittaus, viikko ja huomiot, kehitys, ulkoasu, pelit ja tulokset, perheen kalenteri, kauden kooste, ennakot.
  - **Tekstit:** Kirjaaminen (suosikkilajit, kuittaa tiedoilla), Analyysi (viikon huomiot ja kuormitus), Jalkapallo (joukkueet ja treeniryhmät sarjoineen, pelipäivän pikakirjaus, tulos myös videona), tosiasioissa PC:n ilmoitukset, kutsukoodin kohdalla maininta esimerkkitilasta. Ohjeeseen kohta esimerkkitilasta sekä pikakirjaus, peli-ilmoitukset, sarja ja jakovideot.
  - **Esimerkkiaineisto:** Einolle joukkue (5v5), futiskoulu tiistaisin, mennyt peli tuloksineen ja tuleva peli samana päivänä kuin Ainon turnaus (perheen kalenterin päällekkäisyys); kattavuustestiin tarkistus sisarusten peleistä samana päivänä.
- **24.11.2026 paneelin avauksen korjaus** (versio 1.1.53; käyttäjän video PC:ltä: versiossa 1.1.50 tehty välähdyksen korjaus johti siihen, että tapahtuman paneeli jäi välillä avautumatta kokonaan tai näkymättömäksi tumman taustan alle, ja välähdys ilmeni edelleen).
  - **Syy:** paneelin CSS-animaatio pidettiin ensin pysäytettynä (anim-hold) ja jätettiin lopuksi voimaan (täyttö both). Näytönohjaimen ja pääsäikeen tilat pääsivät eroamaan, jolloin paneeli saattoi jäädä animaation alkutilaan (läpinäkyväksi).
  - **Korjaus** (`ui/Sheet.tsx`): paneelin ja taustan avausanimaatio käynnistetään JavaScriptillä (Web Animations, ei lisäriippuvuuksia). Animaatio alkaa vasta ensimmäisen piirretyn ruudun jälkeen (raskas sisältö ei vie alkua), pitää loppuarvon, kunnes pääsäie ehtii mukaan (ei välähdystä lopussa), ja poistetaan sitten kokonaan. Varmistus: jos animaatio ei ole käynnistynyt 0,7 sekunnissa (esim. ikkuna piilossa), se viedään loppuun, joten paneeli ja tausta näkyvät aina. Paneelista toiseen siirryttäessä tausta pysyy tummana ilman uutta häivytystä. Puhelimen alas veto peruu kesken olevan animaation. PC:llä kortista avattu paneeli kasvaa edelleen napautetun rivin kohdalta.
  - **CSS:** poistettu anim-sheet, anim-hold, scrim-instant, will-change ja paneelin avainkehykset; komentopaletin tausta häivyttyy edelleen CSS:llä (täyttö backwards).
- **24.11.2026 loukkaantumisjakso** (versio 1.1.54; käyttäjän valinta jalkapalloideoista: loukkaantuminen päivämerkintänä, paluupäivä näkyviin). Käyttäjän valinnat: merkintä jaksona, jakson suunnitellut kerrat poissaoloksi automaattisesti.
  - **Tietomalli:** päivämerkinnän uusi syy `injured` (DayFlagReason). Jakso = yhtenäiset loukkaantumispäivät (`domain/injury.ts`, `injuryRunAt`), paluupäivä = viimeistä seuraava päivä; enintään 180 päivää. Lukija muuttaa tuntemattoman syyn muuksi poissaoloksi (`.catch('other')`), joten myöhemmät uudet syyt eivät kaada tuontia. **Huom:** versiota 1.1.54 vanhempi sovellus ei hyväksy synkronointitiedostoa, jossa on loukkaantumispäivä (päivitys tulee kaikille laitteille automaattisesti avattaessa).
  - **Tallennus** (`repo.setInjury(profileId, jakso, aiempi)`): jakson päivät merkitään (muu merkintä korvautuu), aiemman jakson päivät, jotka eivät kuulu uuteen, vapautetaan. `repo.injuryAt(profileId, päivä)` hakee päivän jakson.
  - **Suunnitellut kerrat** (`applyInjurySkips`): avoimet kerrat (treenit, koululiikunta, pelit) loukkaantumispäiviltä ohitetaan syyllä Loukkaantunut ja merkinnällä `autoSkipped`; sovelluksen näin ohittamat avataan uudelleen, kun päivä ei enää kuulu jaksoon. Käsin ohitettuihin ja kuitattuihin ei kosketa; käsin ohitus tai avaus poistaa merkinnän. Aikaleima johdetaan päivämerkinnästä (molemmat laitteet tuottavat saman tietueen). Ajetaan käynnistyksessä, synkronoinnin jälkeen ja uusien kertojen luonnin jälkeen yhdessä lomaohitusten kanssa (`applyAutoSkips`: ensin loukkaantuminen, sitten loma).
  - **Käyttöliittymä:** päivän valikossa (⋯) Merkitse loukkaantuneeksi tai Muuta loukkaantumisjaksoa (paneeli `InjurySheet`: alkaen, arvioitu paluu, pikavalinnat 1, 2, 4 ja 6 vk, Poista jakso; Kumoa-ilmoitus). Kuluvalla viikolla kortti "Loukkaantunut · Arvioitu paluu …" (`InjuryNotice`): Palasi jo (jakso päättyy eiliseen, myöhemmät kerrat avataan) ja Muuta paluupäivää. Päivän merkintä "Loukkaantunut" päivälistassa ja analyysin kalenterissa; analyysin tekstit mainitsevat loukkaantumispäivät sairas- ja matkapäivien rinnalla. Ohjeeseen kohta sairaudesta, matkasta ja loukkaantumisesta.
  - **Esimerkkitila:** Ainolle loukkaantumisjakso viikolla -7 (ti–pe), kattavuustestiin tarkistukset jaksosta ja automaattisesti ohitetuista kerroista. Testit: `db/injury.test.ts`.
- **24.11.2026 jalkapallon osuus kaikesta liikunnasta** (versio 1.1.55; käyttäjän valinta jalkapalloideoista). Käyttäjän valinnat: osuus kirjatusta liikunnasta, neutraali huomio vähintään 80 %:n osuudella.
  - **Laskenta** (`domain/longTerm.ts`, `LongTermSummary.football`): jalkapallolajien (ActivityType.sport = football: treeni, peli, turnaus, harjoituspeli, omatoiminen) minuutit kaikkien kirjattujen kertojen minuuteista samoista luvuista kuin lajilista (vertailtavat päivät, ei arkiliikunnan vahvistuksia, treenin verryttely treenin lajiin). null, kun jalkapalloa ei ole kirjattu.
  - **Näkymä:** Analyysin Monipuolisuus ja lajit -kortin (kuukausi, kausi, vuosi) yläosassa "Jalkapallon osuus" prosentteina, palkkina ja tunteina (jalkapallo / kaikki) sekä edellisen jakson osuus. Kauden raportissa (PDF) sama rivi Lajit ja monipuolisuus -kohdassa.
  - **Huomio** (`FOOTBALL_HEAVY_SHARE` 0,8, `FOOTBALL_HEAVY_NOTE`): "Lähes kaikki kirjattu liikunta on jalkapalloa. Liikkumissuositus kannustaa liikkumaan monipuolisesti." Havainto, ei terveysneuvo eikä vertailu muihin. Ohjeen Analyysi-kohtaan selitys.
- **24.11.2026 puhelimen lisäyspainike** (versio 1.1.56; käyttäjän pyyntö: siistimpi ja sirompi +-painike; käyttäjä valitsi kolmesta mallista vaihtoehdon B). Painike pysyy samassa paikassa alapalkin yläpuolella oikealla ja piiloutuu vierittäessä kuten ennen, mutta se on pyöreä ja 52 px (ennen 64 px, pyöristetty neliö), ja korostevärin hehkuva varjo on vaihdettu hillittyyn varjoon ja ohueen reunaan. Hylätyt vaihtoehdot: A (pyöreä painike alapalkin rinnalla; välilehdet olisivat kaventuneet 81 px:stä 62 px:iin 360 px:n puhelimella) ja C (ei kelluvaa painiketta, Lisää-painike päiväkortissa). Viikko-näkymän ohjetekstit mainitsevat nyt myös loukkaantumispäivän.
- **24.11.2026 pelit Viikko-näkymästä suoraan muokkaukseen** (versio 1.1.57; käyttäjän pyyntö).
  - **Tuleva avoin peli, turnaus tai harjoituspeli** (päivä tämän päivän jälkeen) avautuu Viikko-näkymän päivärivistä, työpöydän taulukosta, puhelimen päiväkortista ja Tulossa-kortista pelikalenterin paneeliin (`FixtureSheet`, otsikko Muokkaa peliä / turnausta / harjoituspeliä). Paneelin alalaidan linkki "Ei osallistu tai peruttu: merkitse poissaolo" (`onAbsence`) avaa kuittauspaneelin syineen. Kuluvan viikon tiedot ovat valmiina (avausanimaatio lähtee kortista), muiden viikkojen tiedot haetaan (`listFixtures`).
  - **Pelipäivän, menneen tai ohitetun tapahtuman** kuittauspaneelissa (`PlanSheet`) on tiivistelmä (vastustaja tai tapahtuma, koti/vieras, pelien määrä, taso, paikka, "Tietoja puuttuu") ja Muokkaa tapahtumaa -painike. Suunnitelman muutos (kesto, kellonaika) on korvattu tapahtuman muokkauksella. Pelattua tapahtumaa ei muokata kalenterista (tiivistelmä näkyy ilman painiketta).
  - Vain kun jalkapallo on profiilissa käytössä; muuten kuittauspaneeli kuten ennen.
- **24.11.2026 viime viikon kooste kolmena lukukorttina** (versio 1.1.58; käyttäjän valinta, vaihtoehto A). Koosteen yläosa näyttää vain pääluvut:
  - **Pääkortti** (korostettu suosituksen tilan mukaan: täyttyi / lähellä / alle): pääluku (`weekModel.main`, esim. reipas ja rasittava keskimäärin min/pv), palkki suhteessa tavoitteeseen, tila ja tavoite sekä muutos edelliseen viikkoon.
  - **Liikuntaa yhteensä** (tunnit) ja muutos edelliseen viikkoon (0,1 h tarkkuudella).
  - **Jalkapallotreenit**: treenien määrä ja yhteisaika (`footballPeriodSummary.training`) sekä muutos edelliseen viikkoon määränä ja aikana ("↓ 1 treeni · ↓ 20 min edelliseen viikkoon"). Kun jalkapallo ei ole profiilissa käytössä, kortin paikalla viikkonäkymän toinen tunnusluku.
  - Muutoksia ei näytetä, jos edellinen viikko on ennen seurannan alkua. Nousu korostetaan, lasku neutraalina. Päiväpylväät, "x/7 päivää tavoitteessa", pelien V–T–H ja maalit poistettiin koosteesta. Puhelimella pääkortti koko leveydellä, muut kaksi rinnakkain. Viikon huomiot ennallaan.

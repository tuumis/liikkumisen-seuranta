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
  | 'passing' | 'dribbling' | 'shooting' | 'one_v_one' | 'small_sided'
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
| Harjoittelun sisältö | Fokustagit (syöttely, kuljetus, laukaukset, 1v1, pienpelit, maalivahti, pelikäsitys, fysiikka, koordinaatio) | `focusTags` | Kohtalainen: vanhempi ei aina tiedä treenin sisältöä |
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

- Kutsutaan käynnistyksessä ja viikkonavigoinnissa. Raja on nykyisen viikon +1 sunnuntai, tai selattavan tulevan viikon sunnuntai (enintään +8 viikkoa).
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

Tiedostoja on kaksi, jotta kumpikaan laite ei koskaan ylikirjoita toisen kirjoittamaa tiedostoa. Muoto on sama kuin varmuuskopiossa, mutta `"format": "liikkumisseuranta-sync"`, ja mukana ovat `deviceId` ja `deviceRole`. Tiedosto sisältää kaikki synkronoitavat taulut poistomerkintöineen täytenä tilannekuvana, koska dataa on vähän. Tarkistussumma ja skeemaversio toimivat kuten varmuuskopiossa.

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

- Jakson valinta: viikko, kuukausi, kausi tai vuosi.
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

## 16. Lisäykset käyttöönoton jälkeen (12.11.2026)

Käyttäjän pyynnöstä MVP:n jälkeen toteutetut muutokset. Tietomalli on nyt **skeemaversio 2** (`migrateV1ToV2`: uudet taulut, olemassa oleva data ei muutu; fixture `src/domain/fixtures/backup-v1.json`, B7).

- **Pelit-välilehti** (Viikko · Pelit · Analyysi · Asetukset): pelikalenteri, tulosta odottavat pelit, tulokset ja analyysi sekä omat joukkueet.
- **`teams`** (synkronoituva): oma joukkue `{ id, profileId, name, level, archived }`.
- **`fixtures`** (synkronoituva, avain `plannedSessionId`): tulevan pelin tai turnauksen tiedot (joukkue, vastustaja, turnauksen nimi, pelien määrä, paikka, taso). Tuleva peli on käsin lisätty `PlannedSession` (laji peli tai turnaus), joten se näkyy viikolla ja kuitataan kuten muutkin suunnitelmat; kuittaus esitäyttää `FootballDetails`-tiedot.
- **Taso** `GameLevel` = Elite / Kilpa / Haaste joukkueelle (sarjataso) ja tapahtumakohtaisesti. Taso säätää ponnistelun pelin tehoprofiiliin: Elite = kovempi, Kilpa = tavallinen, Haaste = kevyempi (sovelluksen oma tulkinta). `FootballDetails` saa kentät `teamId` ja `level`.
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
- **Visuaalinen uudistus (design system):** värit, pinnat, varjot, pyöristykset ja liike keskitetysti tokeneina (`src/index.css`): luonnonvalkoinen #F6F5F0, salvia #DCE8DC, metsänvihreä #244C3B, hiekka #DDA96E, hiilenharmaa #26342E, oma tumma tila. Fontit Manrope (teksti) ja Fraunces (otsikot ja tilastoluvut) sovelluksen mukana (`@fontsource-variable`, vain latin-osajoukko, ei verkkoliikennettä). Etusivu: sankarikortti edistymisrenkaalla, päiväkaavio, viikon rytmi (rasittava/lihas/luusto), tulevat ja viimeisimmät kerrat. Liike CSS:llä (porrastettu sisääntulo, renkaat, palkit, numerolaskuri, näkymänvaihto View Transitions -rajapinnalla) ja `prefers-reduced-motion` poistaa animaatiot. Laskenta, tietomalli ja tallennus ennallaan.
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
- **Päivät taulukkona:** Päivät-otsikon vaihtokytkin Kortit / Taulukko (laitekohtainen, localStorage daysView). Taulukossa rivi per päivä: kerrat ja suunnitelmat pieninä nappeina (napautus avaa muokkauksen/suunnitelman), arkiliikunta "☀️ Arki" katkoviivalla (arvio / ✓), päivän kokonaisminuutit ja reipas+rasittava (+arvio); alarivillä viikon summat. Päivän nimestä päivän toiminnot. Pikatoiminnot: + (kirjaa kerta päivälle), ✓ suunnitelmalle (tehty kuten suunniteltu, menneet ja tämä päivä) ja ✓ arkiliikunnalle (vahvista arvio sellaisenaan, kumottavissa). Päivän alla suositusmerkit (rasittava, lihaksia ja luustoa vahvistava; ryhmän mukaan) ja alarivillä viikon n/tavoite. Reipas+-luvun alla palkki päivän tavoitteesta. Tulevilla päivillä Min-sarakkeessa ennuste (~), sairas- ja matkapäivät himmeinä. PC:llä valittavat lisäsarakkeet (kevyt/reipas/rasittava, jalkapallo: tulos, V–T–H, peliaika, omat maalit; kommentit), laitekohtainen dayTableCols; kapeassa palstassa taulukko vierii sivuttain. Summien yksikkö minuutit/tunnit (minuteUnit) koskee taulukon Min-saraketta, summarivejä ja Päivät-otsikon kestoa. Taulukkoon vaihdettaessa tämän päivän rivi vieritetään näkyviin.
- **Oletusulkoasu:** vaalea teema ja Vuono-väriteema; paneelien ohut vierityspalkki pyöristetyn paneelin sisällä, otsikko pysyy paikallaan.
- **Muokattava Viikko-näkymä:** "Muokkaa näkymää" (Kattava näkymä): kortit (Viikon tilanne, Päivittäinen kaavio, Viikon rytmi, Liikuntaa viikossa, Viikon liikuntatunnit, Tulevat kerrat, Päivät, Viimeisimmät kirjaukset, Tarkemmat luvut) piiloon/näkyviin ja järjestykseen; PC:llä lisäksi pää- tai sivupalsta. Päivät aina näkyvissä. Laitekohtainen (localStorage weekLayout); sama muokkauspaneeli kuin Analyysissa.
- **Arkiliikunta päivätasolla:** päiväkortissa oma "Arkiliikunta (arvio)" -rivi; vanhempi voi vahvistaa arvion, muuttaa minuutteja tai merkitä "Ei tänä päivänä" (0 min). Valinta tallentuu saman kategorian kirjauksena, jolloin korvausperiaatteen mukaan perusarviota ei sille päivälle käytetä. Päivän otsikossa "josta arvio N". Rivi näkyy katkoviivoin jokaisella päivällä (myös tulevilla, joilla arvio on mukana ennusteessa); tarkistus tehdään kyseisenä päivänä tai jälkikäteen. Vahvistettu arkiliikunta (kirjaus merkinnällä estimateConfirmed) jää riville näkyviin ("vahvistettu", esim. "välitunnit 30 min ✓") eikä näy erillisenä kertana; sen voi muuttaa, merkitä 0 min tai palauttaa arvioksi.
- **Tarkenne** (`label`, enintään 40 merkkiä) kerroille, viikkorytmin riveille ja niistä syntyville suunnitelmille (esim. Joukkuetreeni, Talenttitreeni, Taitokoulu, Futsal); aiemmat tarkenteet ehdotuksina.
- **Näkymä** (Asetukset → Ulkoasu): Kattava tai Yksinkertainen (Viikko: vain tilanne ja päivät).
- **Jalkapallo:** selkeä "Lisää kalenteriin" -osio (Tuleva peli / Tuleva turnaus selitteineen).
- **Analyysi muokattavissa:** käyttäjä valitsee näkyvät kortit ja järjestyksen (laitekohtainen); palstat täyttyvät ylhäältä alas.
- **Välilehdet** pysyvät muistissa ja siirtymä koskee vain sisältöaluetta.

// Tehon selitykset (käyttäjän lista 17.11.2026, vaihe 6): miksi lajin tehoprofiili on sellainen kuin on.
// Selitykset koskevat sovelluksen lähtöoletuksia; jos käyttäjä muuttaa lajin profiilia, se kerrotaan erikseen.

import type { ActivityType, IntensityShares } from './types';

/** Lajikohtainen perustelu sisäänrakennetun lajin oletusprofiilille (avain = lajin pysyvä avain). */
export const INTENSITY_NOTES: Readonly<Record<string, string>> = Object.freeze({
  football_training:
    'Treenissä on ohjeiden kuuntelua, jonottamista ja tekniikkaharjoitteita, joten noin puolet ajasta on kevyttä tai paikallaanoloa. Pelit ja kilpailuharjoitteet nostavat sykkeen: reipasta noin kolmannes ja rasittavaa 15 %.',
  football_game:
    'Kentällä ollessa liikutaan lähes koko ajan, ja pelissä on paljon juoksua ja kamppailuja: reipasta 45 % ja rasittavaa 30 % peliajasta. Lämmittely lasketaan treenin teholla ja vaihtopenkillä oloa ei lasketa liikunnaksi.',
  football_tournament:
    'Jokainen peli lasketaan kuten yksittäinen peli (peliaika pelin teholla, lämmittely treenin teholla). Pelien väliset tauot ja odottelu eivät kerrytä liikuntaa.',
  football_friendly:
    'Harjoituspeli on pelin ja treenin väliltä: pelataan, mutta mukana on enemmän vaihtoja, ohjeita ja taukoja kuin sarjapelissä. Koko varattu aika lasketaan, joten osuudet ovat pelin osuuksia pienemmät.',
  football_self:
    'Omatoiminen pallottelu ja verryttely on enimmäkseen kevyttä tai reipasta: kuljetusta, syöttelyä ja laukomista ilman kovaa pelitilannetta.',
  school_pe:
    'Liikuntatunnista osa kuluu vaihtamiseen, ohjeisiin ja vuoron odottamiseen. Teho vaihtelee lajin mukaan, joten oletus on maltillinen: reipasta 30 % ja rasittavaa 10 %.',
  school_recess:
    'Välitunnilla osa leikkii ja juoksee, osa seisoskelee. Arvio on, että puolet ajasta on kevyttä ja neljännes reipasta.',
  commute_walk: 'Kävely on enimmäkseen kevyttä; reipas tahti, ylämäet ja kiire nostavat osan reippaaksi.',
  commute_bike: 'Pyöräily on tasaisesti reipasta liikuntaa; liikennevalot ja alamäet ovat kevyempiä hetkiä.',
  kick_scooter: 'Potkulaudalla potkiminen on kevyttä tai reipasta; vauhdin ottaminen ja mäet ovat reippaimmat hetket.',
  outdoor_play: 'Ulkoleikissä vuorottelevat juoksuleikit ja rauhallisemmat hetket, kuten hiekkalaatikko tai keinu.',
  trampoline: 'Hyppiminen hengästyttää nopeasti, mutta siinä pidetään myös taukoja: kolmannes kutakin.',
  swimming: 'Vesileikeissä ja uinnissa on sekä rauhallista polskimista että reipasta uintia; altaan reunalla oloa ei lasketa.',
  skating: 'Luistelu on enimmäkseen reipasta; kaatumiset, tauot ja rauhallinen liukuminen ovat kevyitä.',
  skiing: 'Hiihto on kestävyyslaji, jossa liikutaan koko ajan: enimmäkseen reipasta, ylämäet rasittavia.',
  family_walk: 'Retki ja kävely ovat enimmäkseen kevyttä; reippaat osuudet ja mäet nostavat osan reippaaksi.',
  running: 'Juoksu on jatkuvaa ja hengästyttävää: reipasta tai rasittavaa koko ajan.',
  gym: 'Kuntosalilla sarjojen välissä levätään, joten suurin osa ajasta on kevyttä. Lihaskunto on tärkein hyöty (lihaksia vahvistava).',
  other: 'Tuntemattomalle lajille käytetään varovaista oletusta: enimmäkseen kevyttä. Teho kannattaa valita kirjauksessa.',
  daycare_day:
    'Liikkuva varhaiskasvatus -suositus: päiväkotipäivään kuuluu noin 2 tuntia liikkumista, josta 40 min reipasta. Osuudet on laskettu siitä.',
  activity_park:
    'Liikuntapuistossa (trampoliinit, temppuradat, kiipeily) vauhdikkaat suoritukset vuorottelevat jonotuksen ja tauon kanssa.',
  playground: 'Leikkipuistossa kiipeillään, juostaan ja keinutaan; välillä istutaan tai odotetaan vuoroa.',
  daycare_outdoor: 'Päiväkodin ulkoilussa leikitään vapaasti: enimmäkseen kevyttä, kolmannes reipasta.',
  cycling: 'Pyöräretki on enimmäkseen reipasta; alamäet ja pysähdykset kevyitä, mäet rasittavia.',
  inline_skating: 'Rullaluistelu ja rullalauta ovat enimmäkseen reipasta; vauhdin ottaminen ja temput vaihtelevat.',
  climbing: 'Kiipeilyssä yritykset ovat lyhyitä ja niiden välissä levätään. Tärkein hyöty on lihaskunto.',
  sledding: 'Mäenlaskussa ylös kävely on reipasta ja lasku kevyttä; lumileikit vaihtelevat.',
  gymnastics: 'Temppujumpassa on ohjeita ja vuoron odottamista; suoritukset ovat lyhyitä ja vauhdikkaita.',
  dance: 'Tanssitunnissa harjoitellaan liikkeitä (kevyttä) ja tanssitaan koreografioita (reipasta).',
  floorball: 'Salibandytreenissä on harjoitteita ja pelejä; vaihtojen ja ohjeiden aikana ollaan paikallaan.',
  ice_hockey: 'Jääkiekossa vaihdot ovat lyhyitä ja kovia, ja niiden välissä istutaan vaihtopenkillä.',
  hiking: 'Metsäretki on rauhallista kulkemista; mäet ja kantaminen tekevät osasta reipasta.',
});

/** Lajikohtainen selitys: sisäänrakennetun lajin perustelu, tai omalle lajille ei mitään. */
export function intensityNoteFor(type: Pick<ActivityType, 'key' | 'builtIn'>): string | undefined {
  return type.builtIn && type.key ? INTENSITY_NOTES[type.key] : undefined;
}

/** Onko profiili muutettu lähtöoletuksesta (selitys koskee oletusta). */
export function sharesDiffer(a: IntensityShares, b: IntensityShares): boolean {
  return Math.abs(a.light - b.light) > 0.004 || Math.abs(a.moderate - b.moderate) > 0.004 || Math.abs(a.vigorous - b.vigorous) > 0.004;
}

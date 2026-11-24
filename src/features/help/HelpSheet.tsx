// Ohje: miten sovellus toimii ja mitä termit tarkoittavat, lyhyesti ja selkokielellä.

import { useState } from 'react';
import { APP_VERSION } from '../../domain/version';
import { Sheet } from '../../ui/Sheet';
import { CHANGELOG } from './changelog';
import { PrivacyContent } from './Privacy';

const TOPICS: { q: string; a: string[] }[] = [
  {
    q: 'Miten kirjaan liikuntaa?',
    a: [
      'Paina Viikko-näkymässä +, valitse laji ja kesto ja paina Tallenna. Päivän voi vaihtaa ylhäältä.',
      'Toistuvat treenit kannattaa lisätä Viikkorytmiin (Asetukset). Ne näkyvät viikolla valmiina, ja ne kuitataan yhdellä painalluksella. Kynästä (tai päiväkortin kohdasta Kuittaa tiedoilla) saa kuitatessa samalla kirjattua toteutuneen keston, tehon, lihas- ja luustovalinnat sekä treenin omatoimisen verryttelyn. Lihas- ja luustovalinnan voi tallentaa lajin oletukseksi, ja suosikkilajit (tähti kohdassa Asetukset → Liikkumismuodot ja tehoprofiilit) näkyvät lajivalinnoissa ensimmäisinä.',
    ],
  },
  {
    q: 'Entä sairaus, matka tai loukkaantuminen?',
    a: [
      'Päivän kolmen pisteen valikosta (⋯) päivän voi merkitä sairaaksi, matkapäiväksi tai muuksi poissaoloksi. Merkittyä päivää ei lasketa mukaan suositusvertailuun, ja päivän kirjaukset säilyvät.',
      'Loukkaantuminen merkitään jaksona: Merkitse loukkaantuneeksi, alkupäivä ja arvioitu paluupäivä. Jakson päivät eivät ole mukana suositusvertailussa, ja jakson suunnitellut treenit ja pelit merkitään poissaoloksi (syy: loukkaantunut). Viikko-näkymässä näkyy arvioitu paluu: Palasi jo avaa myöhemmät kerrat uudelleen, ja paluupäivää voi muuttaa.',
    ],
  },
  {
    q: 'Mitä kevyt, reipas ja rasittava tarkoittavat?',
    a: [
      'Kevyt: ei hengästytä (esim. rauhallinen kävely).',
      'Reipas: hengästyttää, mutta puhuminen onnistuu (esim. pyöräily, pallopelit).',
      'Rasittava: puhuminen on hankalaa hengästymisen takia (esim. juoksu, kova peli).',
      'Paikallaanolo (tauot, ohjeiden kuuntelu, vuoron odotus, vaihtopenkki) ei kerrytä liikuntaa.',
    ],
  },
  {
    q: 'Miksi luvut ovat arvioita?',
    a: [
      'Treenissä on myös taukoja, ohjeita ja kevyttä liikettä. Sovellus arvioi lajin tyypillisen tehon perusteella, kuinka suuri osa kestosta on reipasta tai rasittavaa. Esimerkiksi 60 minuutin jalkapallotreenistä noin 27 min.',
      'Kirjauksessa "Kevyempi" tai "Kovempi" ponnistelu muuttaa reippaan ja rasittavan osuutta 25 %. Pelissä peliaika lasketaan pelin teholla ja lämmittely treenin teholla.',
      'Jokaisella lajilla on lyhyt perustelu oletusjaolle: kirjauksessa "Miksi tämä jako?" ja kohdassa Asetukset → Tavoitteet ja lajit.',
      'Tehon voi valita itse kirjauksessa ("Enimmäkseen reipasta" jne.), ja lajien oletuksia voi muuttaa kohdassa Tavoitteet ja lajit.',
    ],
  },
  {
    q: 'Mikä on arkiliikunta (perusarvio)?',
    a: [
      'Arvio tavallisesta liikkumisesta, jota ei kirjata joka päivä: päiväkoti, välitunnit, koulumatkat ja leikki. Arvio lasketaan mukaan vain päivinä, joille samaa asiaa ei ole kirjattu, ja se näkyy aina erikseen kirjatusta.',
      'Arvion voi vahvistaa tai korjata päiväkohtaisesti, ja oletusminuutit muutetaan kohdassa Asetukset → Arkiliikunta.',
    ],
  },
  {
    q: 'Mitkä ovat tavoitteet?',
    a: [
      '7–17-vuotiaat: reipasta ja rasittavaa vähintään 60 min päivässä keskimäärin, rasittavaa sekä lihaksia ja luustoa vahvistavaa vähintään 3 päivänä viikossa (OKM 2021).',
      'Alle kouluikäiset: 3 tuntia liikkumista päivässä, josta 1 tunti vauhdikasta.',
      'Aikuiset: reipasta 150 min viikossa (rasittava minuutti lasketaan kahdesti) ja lihaskuntoa 2 kertaa viikossa.',
      'Liikunnalle ei ole ylärajaa, eikä sovellus kilpailuta tai palkitse.',
    ],
  },
  {
    q: 'Mitä Analyysissä katsotaan?',
    a: [
      'Valitse ylhäältä taso. Viikko: täyttyikö suositus ja mistä liikunta kertyi. Kuukausi: mihin suuntaan ollaan menossa. Kausi: kausi kokonaisuutena. Vuosi: koko vuosi yhdellä silmäyksellä.',
      'Muokkaa näkymää -painikkeesta valitaan, mitä aiheita näytetään. Jokaisella tasolla on omat valintansa; yksittäiset kortit ja niiden järjestys löytyvät kohdasta Lisää vaihtoehtoja.',
      'Sivun alalaidan "Mihin luvut perustuvat" kertoo suositukset, lähteet ja sovelluksen omat tulkinnat.',
      'Monipuolisuus ja lajit -kortissa näkyy jalkapallon osuus kirjatusta liikunnasta (treenit, pelit ja omatoiminen jalkapallo kaikista kirjatuista kerroista, ei arkiliikunnan arvioita) ja edellisen jakson osuus. Kun osuus on vähintään 80 %, kortti muistuttaa, että liikkumissuositus kannustaa liikkumaan monipuolisesti.',
      'Huomiot-kortti kertoo päättyneeltä viikolta, mikä liikkumissuosituksesta jäi vajaaksi, ja ehdottaa viikkorytmin vapaita päiviä. Kohdasta Miksi? näkee laskutavan ja lähteen. Kaksi tärkeintä huomiota näkyy myös Viikko-näkymän viime viikon koosteessa. Huomioita ei anneta, ennen kuin viikon kerrat on kuitattu. Lapsilla huomiot kertovat myös ohjatun urheilun määrästä (vapaapäivät, tunnit suhteessa ikään, nopea kasvu) kansainvälisen tutkimustiedon pohjalta; ne on merkitty sanalla Tutkimus. Huomiot voi kytkeä pois profiilikohtaisesti kohdassa Asetukset → Profiilit → Muokkaa. Kolmatta viikkoa toistuva huomio näytetään lyhyesti.',
    ],
  },
  {
    q: 'Jalkapallo',
    a: [
      'Jalkapallo-välilehdellä ovat päiväkirja (kommentit treeneistä), pelikalenteri, tulokset ja joukkueet. Tulevat pelit näkyvät myös viikolla, ja pelin jälkeen kirjataan tulos.',
      'Kun napautat Viikko-näkymässä tulevaa peliä, turnausta tai harjoituspeliä, sen tiedot avautuvat suoraan muokattaviksi (sama kuin pelikalenterissa). Paneelin alalaidan "Ei osallistu tai peruttu" merkitsee poissaolon. Pelipäivän ja peruttujen tapahtumien kuittauksessa on tiivistelmä tapahtumasta ja Muokkaa tapahtumaa -painike.',
      'Pelipäivänä Viikko-näkymässä ja Jalkapallo-välilehden yläosassa on pikakirjauksen kortti: tulos, oman pelaajan maalit ja peliaika suoraan, turnauksessa peli kerrallaan ja harjoituspelissä pelien määrä, pituus ja lämmittely. PC:llä ilmoitus tulee jokaisen pelin päätyttyä, ja sitä painamalla pikakirjaus avautuu.',
      'Joukkueelle voi antaa sarjan (esim. P9) kohdassa Jalkapallo → Joukkueet: se esitäytetään uusiin peleihin ja näkyy jakokuvissa. Otteluennakon ja tuloksen voi jakaa kuvana tai videona (Jaa-painike pelin kohdalla).',
      'Jos pelaaja treenaa useammassa joukkueessa tai ryhmässä, valitse treenin joukkue tai ryhmä viikkorytmissä tai treenin lisätiedoissa. Treeniryhmä (esim. pienryhmävalmennus tai taitokoulu) lisätään Joukkueet-näkymässä omalla nimellä, eikä se näy peleissä. Jos joukkueita ja ryhmiä on yhteensä yksi, treenit merkitään sille automaattisesti. Aiemmat treenit voi merkitä kerralla kohdassa Jalkapallo → Joukkueet. Samassa näkymässä Treeni- ja pelihistoria kertoo treenit ja pelit joukkueittain ja ryhmittäin.',
      'Jalkapallo on valinnainen profiileittain: Asetukset → Profiilit → Muokkaa → "Pelaako … jalkapalloa?". Pois päältä välilehti, joukkueet, pelit ja jalkapallon lisätiedot piilotetaan; kirjatut kerrat säilyvät ja lasketaan liikuntaan.',
    ],
  },
  {
    q: 'Voinko kokeilla sovellusta esimerkillä?',
    a: [
      'Kyllä: Asetukset → Esimerkkitila → Tutustu esimerkkiin (tai aloitusnäkymän painike). Esimerkissä on kaksi keksittyä lasta, koululainen jalkapalloilija ja alle kouluikäinen sisarus, ja heidän viikkonsa, pelinsä ja analyysinsä.',
      'Esimerkki on erillään omista tiedoistasi: voit kokeilla kaikkea, eikä mikään muutu omissa tiedoissa. Yläreunan Poistu-painike palaa omiin tietoihin. Esimerkki luodaan joka kerta uudelleen tämän päivän mukaan. Synkronointi, varmuuskopiointi ja PC:n ilmoitukset eivät ole esimerkissä käytössä.',
      'Esimerkki näyttää samalta kuin oma sovelluksesi: Viikko-näkymän korttien järjestys ja valinnat, väriteema, tausta, vaalea tai tumma tila, pääkortin teema, viikon huomioiden valinnat ja laskenta-asetukset tulevat omista asetuksistasi esimerkkiin siirryttäessä.',
    ],
  },
  {
    q: 'Missä tiedot ovat ja miten ne siirtyvät?',
    a: [
      'Kaikki tiedot ovat vain tämän laitteen selaimessa; sovellus ei lähetä mitään mihinkään. Tee välillä varmuuskopio (Asetukset → Laitteet ja varmuuskopio).',
      'PC:n ja puhelimen tiedot yhdistetään tiedostolla omassa pilvikansiossa (OneDrive tai iCloud).',
    ],
  },
];

type View = 'help' | 'privacy' | 'news';
const VIEW_TITLE: Record<View, string> = { help: 'Ohje', privacy: 'Tietosuoja', news: 'Mitä uutta' };

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [view, setView] = useState<View>('help');
  const close = () => {
    onClose();
    setView('help');
  };
  const latest = CHANGELOG[0];
  return (
    <Sheet open={open} onClose={close} title={VIEW_TITLE[view]}>
      {view !== 'help' && (
        <button type="button" onClick={() => setView('help')} className="mb-3 min-h-9 rounded-lg px-1 text-sm font-semibold text-green-800 hover:underline">
          Takaisin ohjeeseen
        </button>
      )}
      {view === 'privacy' && <PrivacyContent />}
      {view === 'news' && (
        <ol className="space-y-5">
          {CHANGELOG.map((r) => (
            <li key={r.version}>
              <div className="text-sm font-semibold text-slate-900">
                Versio {r.version} <span className="font-normal text-slate-500">{r.date}</span>
              </div>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {r.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {view === 'help' && (
      <>
      <ul className="space-y-2">
        {TOPICS.map((t, i) => (
          <li key={t.q} className="rounded-xl ring-1 ring-slate-200">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm font-medium text-slate-900"
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              aria-expanded={openIdx === i}
            >
              {t.q}
              <span className="text-slate-400" aria-hidden>
                {openIdx === i ? '−' : '+'}
              </span>
            </button>
            {openIdx === i && (
              <div className="space-y-2 px-3 pb-3 text-sm text-slate-700">
                {t.a.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 pt-4 text-sm">
        <span className="text-slate-500">
          Versio {APP_VERSION}, julkaistu {latest.date}
        </span>
        <button type="button" onClick={() => setView('news')} className="min-h-9 font-semibold text-green-800 hover:underline">
          Mitä uutta
        </button>
        <button type="button" onClick={() => setView('privacy')} className="min-h-9 font-semibold text-green-800 hover:underline">
          Tietosuoja
        </button>
      </div>
      </>
      )}
    </Sheet>
  );
}

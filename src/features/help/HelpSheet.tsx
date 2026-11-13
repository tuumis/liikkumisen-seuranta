// Ohje: miten sovellus toimii ja mitä termit tarkoittavat, lyhyesti ja selkokielellä.

import { useState } from 'react';
import { Sheet } from '../../ui/Sheet';

const TOPICS: { q: string; a: string[] }[] = [
  {
    q: 'Miten kirjaan liikuntaa?',
    a: [
      'Paina Viikko-näkymässä +, valitse laji ja kesto ja paina Tallenna. Päivän voi vaihtaa ylhäältä.',
      'Toistuvat treenit kannattaa lisätä Viikkorytmiin (Asetukset). Ne näkyvät viikolla valmiina, ja ne kuitataan yhdellä ✓-painalluksella.',
    ],
  },
  {
    q: 'Mitä kevyt, reipas ja rasittava tarkoittavat?',
    a: [
      'Kevyt: ei hengästytä (esim. rauhallinen kävely).',
      'Reipas: hengästyttää, mutta puhuminen onnistuu (esim. pyöräily, pallopelit).',
      'Rasittava: puhuminen on hankalaa hengästymisen takia (esim. juoksu, kova peli).',
    ],
  },
  {
    q: 'Miksi luvut ovat arvioita (≈)?',
    a: [
      'Treenissä on myös taukoja, ohjeita ja kevyttä liikettä. Sovellus arvioi lajin tyypillisen tehon perusteella, kuinka suuri osa kestosta on reipasta tai rasittavaa. Esimerkiksi 60 minuutin jalkapallotreenistä noin 27 min.',
      'Tehon voi valita itse kirjauksessa ("Enimmäkseen reipasta" jne.), ja lajien oletuksia voi muuttaa kohdassa Tavoitteet ja lajit.',
    ],
  },
  {
    q: 'Mikä on arkiliikunta (perusarvio)?',
    a: [
      'Arvio tavallisesta liikkumisesta, jota ei kirjata joka päivä: välitunnit, koulumatkat ja leikki. Se täyttää vain ne päivät, joilta kirjaus puuttuu, ja näkyy aina erikseen.',
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
    q: 'Jalkapallo',
    a: [
      'Jalkapallo-välilehdellä ovat päiväkirja (kommentit treeneistä), pelikalenteri, tulokset ja joukkueet. Tulevat pelit näkyvät myös viikolla, ja pelin jälkeen kirjataan tulos.',
      'Jalkapallo on valinnainen profiileittain: Asetukset → Profiilit → Muokkaa → "Pelaako … jalkapalloa?". Pois päältä välilehti, joukkueet, pelit ja jalkapallon lisätiedot piilotetaan; kirjatut kerrat säilyvät ja lasketaan liikuntaan.',
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

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <Sheet open={open} onClose={onClose} title="Ohje">
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
    </Sheet>
  );
}

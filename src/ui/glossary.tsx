// Sanasto: lyhyet selitteet termeille, jotka näkyvät sovelluksessa. Term-komponentti näyttää
// selitteen hiiren ollessa päällä (PC) tai napautuksella (puhelin). Lähde: OKM 2021 -suositukset.

import type { ReactNode } from 'react';
import { InfoTip } from './InfoTip';

export type TermId = 'vigorous_day' | 'muscle' | 'bone' | 'mvpa' | 'estimate' | 'total' | 'intensity';

export function termText(id: TermId, vigorousMin = 18): { title: string; body: ReactNode } {
  switch (id) {
    case 'vigorous_day':
      return {
        title: 'Rasittava päivä',
        body: (
          <>
            Päivä, jolle on kirjattu vähintään <strong>{vigorousMin} min rasittavaa</strong> liikuntaa – niin kovaa, että puhuminen on hengästymisen takia hankalaa (esim. juoksu, kova peli, kilpailu).
            Kouluikäisille suositellaan rasittavaa liikuntaa vähintään 3 päivänä viikossa. Minuuttiraja on sovelluksen oma tulkinta iän mukaan (Asetukset → Tavoitteet ja lajit), eikä arkiliikunnan arvio koskaan
            tee päivästä rasittavaa.
          </>
        ),
      };
    case 'muscle':
      return {
        title: 'Lihaksia vahvistava',
        body: (
          <>
            Liikunta, jossa lihakset tekevät tavallista enemmän työtä: esim. kiipeily, roikkuminen, punnerrukset ja muut oman kehon painolla tehtävät liikkeet, kuntopiiri, voimistelu, painiminen, uinti.
            Valitse, jos kerrassa oli tällaista. Suositus kouluikäisille: 3 päivänä viikossa.
          </>
        ),
      };
    case 'bone':
      return {
        title: 'Luustoa vahvistava',
        body: (
          <>
            Liikunta, jossa on hyppyjä, iskuja ja nopeita suunnanmuutoksia: esim. juoksu, hypyt, hyppynaru, pallopelit kuten jalkapallo, tanssi. Pyöräily ja uinti eivät juuri kuormita luustoa.
            Suositus kouluikäisille: 3 päivänä viikossa.
          </>
        ),
      };
    case 'mvpa':
      return {
        title: 'Reipas ja rasittava',
        body: (
          <>
            Reipas liikunta hengästyttää, mutta puhuminen onnistuu; rasittava hengästyttää niin, että puhuminen on hankalaa. Kouluikäisille suositus on keskimäärin 60 min päivässä. Minuutit ovat arvio lajin
            tyypillisestä tehosta.
          </>
        ),
      };
    case 'estimate':
      return {
        title: 'Arkiliikunta (perusarvio)',
        body: (
          <>
            Arvio tavallisesta liikkumisesta, jota ei kirjata joka päivä: välitunnit, koulumatkat, pihaleikit. Se lasketaan päivälle vain, jos sille ei ole kirjattu saman kategorian liikuntaa. Voit
            vahvistaa, muuttaa tai poistaa sen päiväkohtaisesti (päivän Arkiliikunta-rivi).
          </>
        ),
      };
    case 'intensity':
      return {
        title: 'Teho: kevyt, reipas, rasittava',
        body: (
          <>
            <strong>Kevyt</strong>: liikettä ilman hengästymistä (kävely, rauhallinen leikki). <strong>Reipas</strong>: hengästyttää, mutta puhuminen onnistuu (pyöräily, pallopelit).{' '}
            <strong>Rasittava</strong>: puhuminen on hankalaa (juoksu, kova peli). <strong>Paikallaanolo</strong> (tauot, ohjeet, vuoron odotus) ei kerrytä liikuntaa.
            <span className="mt-1.5 block">
              Sovellus ei mittaa tehoa vaan arvioi sen: kesto kerrotaan lajin tehoprofiililla (osuudet kestosta). "Kevyempi" tai "Kovempi" ponnistelu muuttaa reippaan ja rasittavan osuutta 25 %.
              Pelissä peliaika lasketaan pelin teholla ja lämmittely treenin teholla. Teho voi olla myös "Enimmäkseen …" tai oma jako minuutteina.
            </span>
          </>
        ),
      };
    case 'total':
      return {
        title: 'Liikuntaa yhteensä',
        body: <>Kaikki liikunta kestona: kevyt, reipas ja rasittava. Sisältää kirjatut kerrat ja arkiliikunnan arvion päiville, joilta kirjaus puuttuu.</>,
      };
  }
}

/** Termi, jonka selite aukeaa hiirellä tai napautuksella. */
export function Term({ id, children, vigorousMin, className = '', align }: { id: TermId; children?: ReactNode; vigorousMin?: number; className?: string; align?: 'left' | 'right' }) {
  const t = termText(id, vigorousMin);
  return (
    <InfoTip
      className={`underline decoration-dotted decoration-slate-400 underline-offset-[3px] ${className}`}
      align={align}
      tip={
        <>
          <strong className="mb-1 block text-[13px]">{t.title}</strong>
          {t.body}
        </>
      }
    >
      {children ?? t.title}
    </InfoTip>
  );
}

/** Pieni ⓘ-painike selitteelle (esim. valintasirujen viereen). */
export function TermInfo({ id, vigorousMin, align = 'left' }: { id: TermId; vigorousMin?: number; align?: 'left' | 'right' }) {
  const t = termText(id, vigorousMin);
  return (
    <InfoTip
      align={align}
      className="text-slate-400 hover:text-slate-700"
      tip={
        <>
          <strong className="mb-1 block text-[13px]">{t.title}</strong>
          {t.body}
        </>
      }
    >
      <span className="flex size-6 items-center justify-center rounded-full ring-1 ring-current text-[11px] font-bold" aria-label={`Mitä tarkoittaa: ${t.title}`}>
        i
      </span>
    </InfoTip>
  );
}

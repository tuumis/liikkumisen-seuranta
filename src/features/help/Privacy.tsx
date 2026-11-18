// Tietosuojaseloste: sama sisältö alkusivulla (kutsukoodin takana olevalle kävijälle) ja ohjelman Ohjeessa.

import { useEffect, useState } from 'react';
import { contactAddress } from '../landing/contact';
import { Sheet } from '../../ui/Sheet';

export const PRIVACY_UPDATED = '18.11.2026';

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: 'Lyhyesti',
    p: [
      'Ohjelma ei kerää, lähetä eikä tallenna tietojasi palvelimelle. Kaikki, mitä syötät, tallentuu vain käyttämäsi laitteen selaimeen. Tekijä ei näe tietojasi eikä pääse niihin käsiksi.',
    ],
  },
  {
    h: 'Mitä ohjelmaan tallennetaan',
    p: [
      'Syötät tiedot itse: profiilien nimet tai kutsumanimet, syntymävuosi ja koulun aloitus, liikuntakerrat ja arkiliikunnan arviot, jalkapallon pelit, tulokset ja päiväkirja sekä itse lisäämäsi kuvat. Asetukset, kuten teema, tallentuvat selaimen paikalliseen tallennustilaan.',
    ],
  },
  {
    h: 'Synkronointi ja varmuuskopiot',
    p: [
      'Jos otat synkronoinnin käyttöön, ohjelma kirjoittaa tiedoston valitsemaasi kansioon, esimerkiksi OneDriveen tai iCloud Driveen. Tiedostoa säilyttää valitsemasi palvelu omien ehtojensa mukaan. Varmuuskopio tallentuu sinne, minne sen itse tallennat.',
    ],
  },
  {
    h: 'Verkkoliikenne',
    p: [
      'Ohjelma ladataan GitHub Pages -palvelusta. Kuten verkkopalvelimet yleensä, GitHub voi kirjata sivun latauksesta teknisiä tietoja, kuten IP-osoitteen. Ohjelma ei tee muita verkkopyyntöjä, eikä siinä ole analytiikkaa, mainoksia tai evästeitä.',
      'Itse avaamasi linkit, kuten suositusten lähteet tai logon haku, avautuvat kyseiseen palveluun. Jakaminen tapahtuu laitteesi jakotoiminnolla siihen sovellukseen, jonka valitset.',
    ],
  },
  {
    h: 'Kutsukoodi ja pikatesti',
    p: ['Kutsukoodi tarkistetaan selaimessa, eikä sitä lähetetä minnekään. Pikatestin vastaukset lasketaan selaimessa, eikä niitä lähetetä tai tallenneta.'],
  },
  {
    h: 'Tietojen poistaminen',
    p: ['Kaikki tiedot poistuvat kohdasta Asetukset → Laitteet ja varmuuskopio → Tyhjennä kaikki tiedot tai tyhjentämällä tämän sivuston tiedot selaimen asetuksista.'],
  },
];

export function PrivacyContent() {
  const [address, setAddress] = useState<string>();
  useEffect(() => setAddress(contactAddress()), []);
  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-700">
      {SECTIONS.map((s) => (
        <section key={s.h}>
          <h3 className="font-semibold text-slate-900">{s.h}</h3>
          {s.p.map((p) => (
            <p key={p} className="mt-1">
              {p}
            </p>
          ))}
        </section>
      ))}
      <section>
        <h3 className="font-semibold text-slate-900">Yhteystiedot</h3>
        <p className="mt-1">
          Kysymykset ja kutsupyynnöt sähköpostilla{address ? ': ' : '.'}
          {address && (
            <a className="font-semibold text-green-800 underline underline-offset-2" href={`mailto:${address}`}>
              {address}
            </a>
          )}
          . Viestejä käytetään vain niihin vastaamiseen.
        </p>
      </section>
      <p className="text-xs text-slate-500">Päivitetty {PRIVACY_UPDATED}</p>
    </div>
  );
}

export function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Tietosuoja">
      <PrivacyContent />
    </Sheet>
  );
}

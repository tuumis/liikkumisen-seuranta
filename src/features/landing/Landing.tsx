// Alkusivu uusille käyttäjille (18.11.2026, rauhallisempi ilme): vaalea paperisävy, selkeä otsikko,
// pikatestin painike ja kutsukoodi heti alussa sekä esittely, jossa PC:n ja puhelimen näkymät vaihtuvat
// itsestään. Sen alla lyhyet tosiasiat, kolme ominaisuusosiota kuvineen, tekijän sanat ja pikatesti.
// Kuvat ovat esimerkkitilasta (Aino ja Eino, src/demo/seedDemo.ts), eivät oikeista tiedoista: ne kuvataan
// uudelleen komennolla npm run shots (scripts/landing-shots.mjs), kun näkymät muuttuvat.

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from 'react';
import { checkInvite } from '../../domain/invite';
import { APP_VERSION } from '../../domain/version';
import { PrivacySheet } from '../help/Privacy';
import { contactAddress } from './contact';
import { QuickTest } from './QuickTest';
import { IconClock, IconClose, IconLock, IconMoon, IconPause, IconPlay, IconSun } from '../../ui/icons';
import { useIsDark, useThemeChoice } from '../../ui/theme';

type ShotName =
  | 'pc-week'
  | 'pc-analysis'
  | 'pc-calendar'
  | 'pc-football'
  | 'pc-theme'
  | 'pc-family'
  | 'pc-story'
  | 'phone-week'
  | 'phone-add'
  | 'phone-analysis'
  | 'phone-football'
  | 'phone-preview'
  | 'phone-theme'
  | 'phone-family'
  | 'phone-story';

const SHOTS: Record<ShotName, { w: number; h: number; alt: string }> = {
  'pc-week': { w: 1280, h: 800, alt: 'Viikkonäkymä PC:llä: viime viikon kooste ja viikon huomiot' },
  'pc-analysis': { w: 1280, h: 800, alt: 'Analyysi PC:llä: kehitys kuukausittain ja lajit' },
  'pc-calendar': { w: 1280, h: 800, alt: 'Pelikalenterin kuukausinäkymä PC:llä: treenit ja pelit' },
  'pc-theme': { w: 1280, h: 800, alt: 'Viikkonäkymä PC:llä Kanerva-väriteemalla ja nurmitaustalla' },
  'pc-family': { w: 1280, h: 800, alt: 'Koko perheen kalenteri PC:llä: sisarusten treenit ja pelit väreittäin' },
  'pc-story': { w: 1280, h: 800, alt: 'Kauden kooste PC:llä: paras viikko' },
  'pc-football': { w: 1280, h: 800, alt: 'Jalkapallo PC:llä: seuraava peli laskurilla, tulevat pelit, kauden tilastot ja päiväkirja' },
  'phone-week': { w: 390, h: 844, alt: 'Viikkonäkymä puhelimella' },
  'phone-add': { w: 390, h: 844, alt: 'Uuden kerran kirjaus puhelimella' },
  'phone-analysis': { w: 390, h: 844, alt: 'Analyysi puhelimella: reipas ja rasittava liikunta kuukausittain' },
  'phone-football': { w: 390, h: 844, alt: 'Jalkapallo puhelimella: seuraava peli laskurilla ja kauden tilastot' },
  'phone-preview': { w: 390, h: 844, alt: 'Otteluennakon jakokuva puhelimella' },
  'phone-theme': { w: 390, h: 844, alt: 'Ulkoasuasetukset puhelimella: tumma teema ja väriteemat' },
  'phone-family': { w: 390, h: 844, alt: 'Koko perheen pelikalenteri puhelimella, päällekkäiset pelit merkitty' },
  'phone-story': { w: 390, h: 844, alt: 'Kauden kooste puhelimella: liikuntaa yhteensä' },
};
const src = (n: ShotName) => `./landing/${n}.webp`;
/** Tarkat versiot: PC 1280 ja 2560 px, puhelin 780 ja 1170 px leveä (2x/3x-näytöille). */
const srcSet = (n: ShotName) =>
  n.startsWith('pc-') ? `./landing/${n}.webp 1280w, ./landing/${n}-2x.webp 2560w` : `./landing/${n}.webp 780w, ./landing/${n}-3x.webp 1170w`;

interface Scene {
  phone: ShotName;
  pc: ShotName;
  title: string;
  text: string;
  chips: [string, string];
}

// Esittelyn kohtaukset. Merkinnät eivät sisällä kuvien lukuja, joten ne pysyvät oikeina, kun kuvat otetaan
// uudelleen esimerkkitilasta (päivät ja luvut muuttuvat kuvauspäivän mukaan).
const SCENES: Scene[] = [
  { phone: 'phone-week', pc: 'pc-week', title: 'Kuittaus yhdellä napautuksella', text: 'Viikon harrastukset ovat valmiina. Tehty treeni kuitataan, poissaolo merkitään syineen.', chips: ['Kuittaa', 'Viikkorytmi'] },
  { phone: 'phone-add', pc: 'pc-week', title: 'Viikko ja huomiot', text: 'Näet heti, täyttyykö liikkumissuositus, ja huomiot kertovat, mikä muuttui. Muu liikunta: laji ja kesto.', chips: ['Viikon huomiot', 'Suosikkilajit ensin'] },
  { phone: 'phone-analysis', pc: 'pc-analysis', title: 'Kehitys kuukausittain', text: 'Kaudet, lajit ja suositusten toteutuminen. Raportit PDF:nä.', chips: ['Kausi kerralla', 'Raportti PDF:nä'] },
  { phone: 'phone-theme', pc: 'pc-theme', title: 'Oman näköinen', text: 'Vaalea tai tumma teema, neljä väriteemaa, kolme fonttia ja taustat, myös oma kuva.', chips: ['4 väriteemaa', 'Tumma teema'] },
  { phone: 'phone-football', pc: 'pc-football', title: 'Pelit ja tulokset', text: 'Seuraava peli laskurilla, pelikalenteri, turnaukset ja kauden tilastot.', chips: ['Seuraava peli', 'Omat maalit'] },
  { phone: 'phone-family', pc: 'pc-family', title: 'Koko perheen kalenteri', text: 'Sisarusten menot samassa kalenterissa. Päivät, joilla menot osuvat päällekkäin, korostuvat.', chips: ['Päällekkäin', 'Vienti kalenteriin'] },
  { phone: 'phone-story', pc: 'pc-story', title: 'Kauden kooste', text: 'Kauden kohokohdat tarinakortteina. Tallenna kuvana tai jaa.', chips: ['Paras viikko', 'Jaa kuvana'] },
  { phone: 'phone-preview', pc: 'pc-calendar', title: 'Ennakot jakoon', text: 'Otteluennakko kuvana tai videona joukkueen WhatsApp-ryhmään.', chips: ['Kuva tai video', 'Jaa ryhmään'] },
];
const SCENE_MS = 5000;

const FACTS = [
  ['Kuittaus yhdellä napautuksella', 'Viikon treenit ovat valmiina kirjattuina.'],
  ['Ei tiliä eikä palvelinta', 'Tiedot tallentuvat vain omalle laitteellesi.'],
  ['PC ja puhelin', 'Synkronointi oman pilvikansion kautta. PC:llä ilmoitukset treenien ja pelien jälkeen.'],
  ['Koko perhe', 'Jokaiselle lapselle oma profiili ja suositus.'],
] as const;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollToId = (id: string, block: ScrollLogicalPosition = 'start') =>
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block });

export function Landing({ onUnlock, linkFailed }: { onUnlock: () => void; linkFailed: boolean }) {
  const [zoom, setZoom] = useState<ShotName>();
  const [privacy, setPrivacy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const quizCodeRef = useRef<HTMLInputElement>(null);
  const goToCode = () => {
    scrollToId('kutsukoodi', 'center');
    window.setTimeout(() => codeRef.current?.focus({ preventScroll: true }), 450);
  };
  const address = useAddress();

  return (
    <div className="lp-page">
      <header className="lp-top">
        <div className="lp-wrap flex h-[68px] items-center gap-3 min-[481px]:gap-7">
          {/* Kapealla puhelimella pienempi merkki ja nimi, jotta nimi mahtuu teemapainikkeen kanssa (27.11.2026). */}
          <span className="flex min-w-0 items-center gap-2 min-[400px]:gap-2.5">
            <img src="./favicon.svg" alt="" className="size-[26px] shrink-0 min-[400px]:size-[30px]" />
            <span className="truncate font-display text-[14.5px] font-semibold min-[400px]:text-[17px] sm:text-[19px]">Liikkumisen seuranta</span>
          </span>
          <nav className="ml-auto hidden gap-6 text-[15px] text-[var(--lp-ink-2)] min-[900px]:flex" aria-label="Alkusivun osiot">
            <button type="button" className="lp-navlink" onClick={() => scrollToId('ominaisuudet')}>
              Ominaisuudet
            </button>
            <button type="button" className="lp-navlink" onClick={() => scrollToId('jalkapallo')}>
              Jalkapallo
            </button>
            <button type="button" className="lp-navlink" onClick={() => scrollToId('pikatesti')}>
              Pikatesti
            </button>
            <button type="button" className="lp-navlink" onClick={() => setPrivacy(true)}>
              Tietosuoja
            </button>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 min-[481px]:gap-2 min-[900px]:ml-0">
            <ThemeToggle />
            <button type="button" onClick={goToCode} className="lp-btn lp-btn-line h-[38px] shrink-0 px-3 text-sm min-[481px]:h-11 min-[481px]:px-[18px] min-[481px]:text-[15px]">
              <span className="hidden min-[481px]:inline">Syötä kutsukoodi</span>
              <span className="min-[481px]:hidden">Kutsukoodi</span>
            </button>
          </div>
        </div>
      </header>

      <section className="pb-10 pt-10 min-[900px]:pt-[72px]" aria-labelledby="landing-title">
        <div className="lp-wrap grid items-center gap-9 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] min-[900px]:gap-14">
          <div>
            <h1 id="landing-title" className="font-display text-[clamp(36px,4.3vw,54px)] font-medium leading-[1.08] tracking-[-0.015em]">
              Tiedätkö, kuinka paljon lapsesi liikkuu?
            </h1>
            <p className="mt-[22px] max-w-[34em] text-[17px] leading-relaxed text-[var(--lp-ink-2)] sm:text-[19px]">
              Liikkumisen seuranta kokoaa lapsen treenit, pelit ja arkiliikunnan yhteen paikkaan. Näet helposti, kuinka paljon lapsesi liikkuu ja täyttyykö ikäryhmän liikkumissuositus. Lisää harrastukset kerran ja kuittaa treenit yhdellä napautuksella. Voit myös lisätä kommentteja, kuvata treenin sisältöä ja arvioida harjoituksen onnistumista.
            </p>
            <button type="button" onClick={() => scrollToId('pikatesti')} className="lp-btn lp-btn-quiz mt-[30px]">
              <IconClock size="1.25rem" />
              Tee 1 minuutin pikatesti
            </button>
            <p className="mt-2.5 text-sm text-[var(--lp-ink-3)]">Karkea arvio lapsen liikkumisesta muutamalla kysymyksellä. Vastaukset eivät lähde sivulta.</p>
            <InviteForm inputRef={codeRef} onUnlock={onUnlock} linkFailed={linkFailed} address={address} />
          </div>
          <Showcase onZoom={setZoom} />
        </div>
      </section>

      <div className="lp-facts">
        <ul className="lp-wrap grid grid-cols-2 min-[900px]:grid-cols-4" aria-label="Lyhyesti">
          {FACTS.map(([t, d]) => (
            <li key={t} className="lp-fact">
              <b className="block text-[15px] font-bold">{t}</b>
              <span className="mt-0.5 block text-sm leading-snug text-[var(--lp-ink-2)]">{d}</span>
            </li>
          ))}
        </ul>
      </div>

      <main>
        <Feature
          id="ominaisuudet"
          kicker="Kirjaaminen"
          title="Viikkorytmi kerran, sen jälkeen pelkkä kuittaus"
          text="Lisää lapsen säännölliset harrastukset kerran. Viikon treenit ovat sen jälkeen valmiina, ja tehty kerta kuitataan yhdellä napautuksella. Ylimääräinen liikuntakerta kirjataan valitsemalla laji ja kesto, suosikkilajit ensimmäisinä."
          points={[
            'Arkiliikunta, kuten välitunnit ja koulumatkat, arvioidaan kerran ja lasketaan mukaan',
            'Kuittaa tiedoilla: toteutunut kesto, teho ja omatoiminen verryttely samalla kertaa',
            'Sekuntikello: kellota treenin tai lenkin todellinen aika, ja kerta kirjautuu valmiiksi',
            'Poissaolot ja peruutukset merkitään syineen',
            'Muut menot, kuten hammaslääkäri tai mummolan kyläily, kalenterimerkintöinä viikolle ja pelikalenteriin',
          ]}
        >
          <Shot name="phone-add" onZoom={setZoom} className="lp-solo-phone" />
        </Feature>

        <Feature
          flip
          kicker="Analyysi"
          title="Arvio perustuu lajin tehoon, ei pelkkään kestoon"
          text="Puolentoista tunnin treenistä vain osa on reipasta liikuntaa. Sovellus arvioi jokaisen kerran tehon lajin tyypillisen profiilin perusteella ja näyttää, miten viikko, kuukausi ja kausi vertautuvat suositukseen."
          points={[
            'Kouluikäisillä 60 minuuttia reipasta ja rasittavaa liikuntaa päivässä',
            'Alle kouluikäisillä kolme tuntia liikkumista päivässä',
            'Viikon huomiot: suosituksen toteutuminen ja ohjatun urheilun kuormitus tutkimustiedon valossa',
            'Raportti kaudesta PDF-tiedostona',
            'Jaa valmentajalle: kooste koko liikunnasta ja kuormituksesta viikoittain',
          ]}
        >
          <Shot name="pc-analysis" onZoom={setZoom} className="lp-pc" />
        </Feature>

        <Feature
          id="jalkapallo"
          kicker="Jalkapalloperheille"
          title="Pelit, tulokset ja koko perheen kalenteri"
          text="Pelikalenteri ja tulokset on tehty jalkapalloperheen tarpeisiin. Turnaukset, ottelut ja tulokset ovat yhdessä paikassa, ja kausikortista näet seuraavan pelin laskureineen. Sisarusten treenit, pelit ja muut menot näkyvät samassa kalenterissa omilla väreillään, ja päällekkäiset menot huomaa heti. Otteluennakon ja tuloksen voi jakaa kuvana tai videona joukkueen WhatsApp-ryhmään."
          points={[
            'Joukkueet ja treeniryhmät sarjoineen, tilastot joukkueittain',
            'Kausikortti: seuraava peli laskurilla, tulevat pelit, voitot, tasapelit ja häviöt sekä maalit',
            'Pelipäivän pikakirjaus: tulos, omat maalit ja peliaika suoraan kortista, myös turnauksessa peli kerrallaan',
            'Loukkaantumisjakso: paluupäivä, ja jakson treenit merkitään poissaoloiksi',
            'Muut lajit, kuten jääkiekko, salibandy, uinti ja tanssi, kirjataan samalla tavalla ja lasketaan mukaan suosituksiin',
          ]}
        >
          <div className="relative pb-[10%]">
            <Shot name="pc-family" onZoom={setZoom} className="lp-pc w-[88%]" />
            <Shot name="phone-preview" onZoom={setZoom} className="lp-phone absolute bottom-0 right-0 w-[30%]" />
          </div>
        </Feature>

        <Reveal as="section" className="pt-20 min-[900px]:pt-[104px]" aria-label="Tekijältä">
          <div className="lp-wrap">
          <figure className="lp-reveal mx-auto max-w-[712px]">
            <blockquote className="font-display text-[clamp(18px,1.75vw,21px)] font-normal italic leading-[1.55] text-[var(--lp-ink-2)]">
              Minulta kysyttiin kerran, paljonko lapseni liikkuu viikossa, enkä osannut vastata tarkasti. Samalla tajusin, että halusin tietää muutakin: paljonko aikaa jalkapalloon oikeasti kuluu ja mitä treeneissä on tehty. Turnaukset ja ottelut piti saada yhteen selkeään paikkaan ja niiden tulokset talteen, vähän kuin oma tulospalvelu lapseni peleille. Niistä tarpeista syntyi tämä sovellus.
            </blockquote>
            <figcaption className="mt-[18px] text-[15px] text-[var(--lp-ink-3)]">Tuomas, sovelluksen tekijä</figcaption>
          </figure>
          </div>
        </Reveal>

        {/* Pikatesti iltamaiseman päällä (taivas liukuvärinä; public/landing/quiz-forest.svg metsäkaistana alareunassa kiinteällä mittasuhteella, joten paneelin kasvu ei venytä maisemaa). */}
        <div className="lp-wrap mt-20 min-[900px]:mt-[104px]">
          <section
            id="pikatesti"
            className="relative scroll-mt-[84px] overflow-hidden rounded-[1.5rem] bg-[#0c2230] px-4 py-9 sm:px-8 lg:rounded-[2rem] lg:px-14 lg:py-16"
            aria-labelledby="quiz-title"
          >
            <div
              className="absolute inset-0"
              style={{ background: 'url(./landing/quiz-forest.svg) center bottom / max(100%, 1100px) auto no-repeat, linear-gradient(180deg, #0f2833, #1d4652)' }}
              aria-hidden
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(8_26_36/0.55),rgb(8_26_36/0.1)_50%,transparent)] lg:bg-[linear-gradient(90deg,rgb(8_26_36/0.72),rgb(8_26_36/0.15)_55%,transparent)]" aria-hidden />
            <div className="relative z-10">
              <QuickTest
                intro={
                  <div className="max-w-2xl lg:pt-8">
                    <p className="text-sm font-bold text-[var(--hero-accent)]">Ei vielä kutsukoodia? Tee pikatesti, se vie noin minuutin.</p>
                    <h2 id="quiz-title" className="mt-2 font-display text-3xl font-medium leading-tight tracking-tight text-[var(--hero-ink)] sm:text-4xl lg:text-5xl">
                      Liikkuuko oma lapsesi tarpeeksi?
                    </h2>
                    <p className="mt-3 text-base leading-relaxed text-[var(--hero-ink-soft)] sm:text-lg">
                      Muutama kysymys arjesta, ja saat arvion suhteessa suomalaisiin liikkumissuosituksiin sekä vinkit helpoimpiin lisäyksiin.
                    </p>
                    <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-[var(--hero-ink)] ring-1 ring-white/15">
                      <IconLock size="0.95rem" /> Vastauksesi eivät lähde tältä sivulta.
                    </p>
                  </div>
                }
                invite={<InviteForm dark idPrefix="quiz" inputRef={quizCodeRef} onUnlock={onUnlock} linkFailed={false} address={address} />}
              />
            </div>
          </section>
        </div>
      </main>

      <footer className="lp-wrap flex flex-wrap items-baseline gap-x-7 gap-y-3 pb-14 pt-10 text-sm text-[var(--lp-ink-3)]">
        <span className="font-display text-base font-semibold text-[var(--lp-ink)]">Liikkumisen seuranta</span>
        <span>Versio {APP_VERSION}</span>
        <span className="flex gap-5 min-[900px]:ml-auto">
          <button type="button" onClick={() => setPrivacy(true)} className="lp-footlink">
            Tietosuoja
          </button>
          {address && (
            <a className="lp-footlink" href={mailto(address)}>
              Yhteys
            </a>
          )}
        </span>
        <span className="basis-full text-[13px]">
          Suositusten lähteet: Suomalaiset fyysisen aktiivisuuden suositukset 7–17-vuotiaille (OKM 2021), Varhaisvuosien fyysisen aktiivisuuden suositukset (OKM 2016).
        </span>
      </footer>

      <PrivacySheet open={privacy} onClose={() => setPrivacy(false)} />
      {zoom && <Zoom name={zoom} onClose={() => setZoom(undefined)} />}
    </div>
  );
}

/** Ominaisuusosio: teksti ja kuva vierekkäin (PC), allekkain (puhelin). flip = kuva vasemmalla. */
function Feature({ id, flip, kicker, title, text, points, children }: { id?: string; flip?: boolean; kicker: string; title: string; text: string; points?: string[]; children: ReactNode }) {
  return (
    <Reveal as="section" className="scroll-mt-4 pt-16 min-[900px]:pt-24" id={id} aria-label={kicker}>
      <div className="lp-wrap grid items-center gap-9 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] min-[900px]:gap-16">
        <div className={`lp-reveal ${flip ? 'min-[900px]:order-2' : ''}`}>
          <p className="text-sm font-bold text-[var(--lp-kicker)]">{kicker}</p>
          <h2 className="mt-2 font-display text-[clamp(28px,3vw,38px)] font-medium leading-[1.15] tracking-[-0.015em]">{title}</h2>
          <p className="mt-4 leading-relaxed text-[var(--lp-ink-2)]">{text}</p>
          {points && (
            <ul className="mt-5 border-t border-[var(--lp-line)]">
              {points.map((p) => (
                <li key={p} className="border-b border-[var(--lp-line)] py-2.5 text-[15px] text-[var(--lp-ink-2)]">
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="lp-reveal" style={{ '--i': 1 } as CSSProperties}>
          {children}
        </div>
      </div>
    </Reveal>
  );
}

/** Kuva laitteen kehyksessä; napautus suurentaa. */
function Shot({ name, onZoom, className }: { name: ShotName; onZoom: (n: ShotName) => void; className: string }) {
  const s = SHOTS[name];
  const pc = name.startsWith('pc-');
  return (
    <button type="button" onClick={() => onZoom(name)} className={`block ${className}`} aria-label={`Suurenna: ${s.alt}`}>
      <img
        src={src(name)}
        srcSet={srcSet(name)}
        sizes={pc ? '(min-width: 900px) 600px, 92vw' : '(min-width: 900px) 300px, 70vw'}
        width={s.w}
        height={s.h}
        alt=""
        loading="lazy"
        decoding="async"
      />
    </button>
  );
}

/** Animoitu esittely: PC ja puhelin, näkymät vaihtuvat itsestään; tarinapalkki, tauko ja valinta. */
function Showcase({ onZoom }: { onZoom: (n: ShotName) => void }) {
  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState<number>();
  const [userPaused, setUserPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [visible, setVisible] = useState(true);
  const [auto] = useState(() => !reducedMotion());
  const root = useRef<HTMLDivElement>(null);
  const paused = !auto || userPaused || hover || !visible;
  const scene = SCENES[idx];

  const go = (n: number) => {
    setPrev(idx);
    setIdx((n + SCENES.length) % SCENES.length);
  };

  // Seuraavan kohdan kuvat puretaan valmiiksi, ettei vaihto nyki ensimmäisellä kerralla.
  useEffect(() => {
    const next = SCENES[(idx + 1) % SCENES.length];
    root.current?.querySelectorAll<HTMLImageElement>('.lp-slide img').forEach((img) => {
      if (img.currentSrc.includes(`/${next.pc}`) || img.currentSrc.includes(`/${next.phone}`)) img.decode?.().catch(() => {});
    });
  }, [idx]);

  // Esittely pysähtyy, kun se ei ole näkyvissä (ei kulu taustalla).
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const state = (i: number) => (i === idx ? 'active' : i === prev ? 'prev' : 'idle');
  const pcShots = [...new Set(SCENES.map((s) => s.pc))];

  return (
    <div
      ref={root}
      className={`w-full min-[900px]:ml-auto min-[900px]:max-w-[620px] ${paused ? 'lp-paused' : ''}`}
      role="region"
      aria-roledescription="esittely"
      aria-label="Kuvia sovelluksesta"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={() => setHover(false)}
      // Näppäimistöllä kohdistettu esittely pysähtyy; hiiren napautus ei pysäytä pysyvästi.
      onFocus={(e) => e.target.matches(':focus-visible') && setHover(true)}
      onBlur={() => setHover(false)}
    >
      <div className="relative mx-auto aspect-[100/108] w-full max-w-[620px] min-[900px]:aspect-[100/94]">
        {/* PC taustalla */}
        <button type="button" onClick={() => onZoom(scene.pc)} className="lp-pc absolute left-0 top-[4%] w-[86%] min-[900px]:w-[84%]" aria-label={`Suurenna: ${SHOTS[scene.pc].alt}`}>
          <span className="lp-pc-bar" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="relative isolate block aspect-[1280/800] overflow-hidden">
            {pcShots.map((n) => (
              <span key={n} className="lp-slide" data-state={n === scene.pc ? 'active' : prev !== undefined && n === SCENES[prev].pc ? 'prev' : 'idle'} aria-hidden={n !== scene.pc}>
                <img src={src(n)} srcSet={srcSet(n)} sizes="(min-width: 900px) 520px, 86vw" width={1280} height={800} alt="" decoding="async" />
              </span>
            ))}
          </span>
        </button>

        {/* Puhelin edessä */}
        <button
          type="button"
          onClick={() => onZoom(scene.phone)}
          className="lp-phone absolute right-[2%] top-[13%] w-[46%] min-[900px]:right-[3%] min-[900px]:top-[12%] min-[900px]:w-[38%]"
          aria-label={`Suurenna: ${SHOTS[scene.phone].alt}`}
        >
          <span className="relative isolate block aspect-[390/844] overflow-hidden rounded-[19px] bg-[var(--lp-paper)] min-[900px]:rounded-[24px]">
            {SCENES.map((s, i) => (
              <span key={s.phone} className="lp-slide" data-state={state(i)} aria-hidden={i !== idx}>
                <img src={src(s.phone)} srcSet={srcSet(s.phone)} sizes="(min-width: 900px) 236px, 44vw" width={390} height={844} alt="" decoding="async" />
              </span>
            ))}
          </span>
        </button>

        {/* Merkinnät */}
        <div key={idx} aria-hidden>
          <span className="lp-chip lp-chip-light absolute left-[18%] top-[31%] z-10 min-[900px]:left-[28%] min-[900px]:top-[25%]" style={{ '--d': '500ms' } as CSSProperties}>
            {scene.chips[0]}
          </span>
          <span className="lp-chip lp-chip-accent absolute bottom-[10%] right-0 z-10" style={{ '--d': '1100ms' } as CSSProperties}>
            {scene.chips[1]}
          </span>
        </div>
      </div>

      {/* Tarinapalkki ja kuvateksti */}
      <div className="mt-[18px] flex items-center gap-2.5">
        <div className="flex flex-1 gap-1.5" role="tablist" aria-label="Esittelyn kohdat">
          {SCENES.map((s, i) => (
            <button key={s.title} type="button" role="tab" aria-selected={i === idx} aria-label={s.title} onClick={() => go(i)} className="group flex h-6 flex-1 items-center">
              <span className="relative block h-1 w-full overflow-hidden rounded-full bg-[var(--lp-line)] group-hover:bg-[var(--lp-line-strong)]">
                <span
                  key={i === idx ? `run-${idx}` : `idle-${i}`}
                  className="lp-fill absolute inset-0 rounded-full bg-[var(--lp-deep)]"
                  style={{ '--dur': `${SCENE_MS}ms` } as CSSProperties}
                  data-run={i === idx && auto ? '' : undefined}
                  data-done={i < idx || (i === idx && !auto) ? '' : undefined}
                  onAnimationEnd={() => i === idx && go(idx + 1)}
                />
              </span>
            </button>
          ))}
        </div>
        {auto && (
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            className="press flex size-[34px] shrink-0 items-center justify-center rounded-full border border-[var(--lp-line)] bg-[var(--lp-raised)] text-[var(--lp-ink)]"
            aria-label={userPaused ? 'Jatka esittelyä' : 'Pysäytä esittely'}
          >
            {userPaused ? <IconPlay size="0.85rem" /> : <IconPause size="0.85rem" />}
          </button>
        )}
      </div>
      <div key={idx} className="lp-caption mt-2.5 min-h-[4.5rem]" aria-live={auto && !userPaused ? 'off' : 'polite'}>
        <div className="font-display text-[21px] font-medium leading-tight">{scene.title}</div>
        <p className="mt-1 text-[15px] leading-snug text-[var(--lp-ink-2)]">{scene.text}</p>
      </div>
    </div>
  );
}

/** Vierityksessä esiin: ryhmä saa luokan is-in, kun se tulee näkyviin; lapset (.lp-reveal) porrastetusti. */
function Reveal({ as = 'div', className = '', children, ...aria }: { as?: 'div' | 'section'; className?: string; children: ReactNode; id?: string; 'aria-label'?: string; 'aria-labelledby'?: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const props = { ref: (el: HTMLElement | null) => void (ref.current = el), className: `${className} ${inView ? 'is-in' : ''}`, ...aria };
  if (as === 'section') return <section {...props}>{children}</section>;
  return <div {...props}>{children}</div>;
}

/** Kutsuosoite kootaan vasta selaimessa (contact.ts). */
function useAddress() {
  const [address, setAddress] = useState<string>();
  useEffect(() => setAddress(contactAddress()), []);
  return address;
}
const mailto = (address: string) => `mailto:${address}?subject=${encodeURIComponent('Kutsukoodi: Liikkumisen seuranta')}`;

/**
 * Vaalea / tumma teema alkusivun yläpalkissa (27.11.2026). Sama laitekohtainen valinta kuin sovelluksen
 * Ulkoasu-asetuksissa, joten se säilyy myös sovellukseen siirryttäessä.
 */
function ThemeToggle() {
  const dark = useIsDark();
  const [, setChoice] = useThemeChoice();
  const label = dark ? 'Vaihda vaaleaan teemaan' : 'Vaihda tummaan teemaan';
  return (
    <button
      type="button"
      onClick={() => setChoice(dark ? 'light' : 'dark')}
      className="lp-btn lp-btn-line size-[38px] shrink-0 p-0 min-[481px]:size-11"
      aria-label={label}
      title={label}
    >
      {dark ? <IconSun size="1.15rem" /> : <IconMoon size="1.15rem" />}
    </button>
  );
}

/** Kutsukoodin kenttä. Vaalea alkusivun yläosassa, dark = pikatestin tuloksen yhteydessä tummalla taustalla. */
function InviteForm({
  inputRef,
  onUnlock,
  linkFailed,
  address,
  dark,
  idPrefix = '',
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onUnlock: () => void;
  linkFailed: boolean;
  address?: string;
  dark?: boolean;
  idPrefix?: string;
}) {
  const ids = (n: string) => (idPrefix ? `${idPrefix}-${n}` : n);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError('Kirjoita kutsukoodi.');
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(undefined);
    const ok = await checkInvite(code).catch(() => false);
    setBusy(false);
    if (ok) onUnlock();
    else {
      setError('Koodi ei kelpaa. Tarkista kirjoitusasu tai pyydä uusi koodi.');
      inputRef.current?.select();
    }
  }

  const link = address ? (
    <a className={`font-semibold underline underline-offset-2 ${dark ? 'text-[var(--hero-ink)] decoration-[var(--hero-accent)]' : 'text-[var(--lp-ink-2)]'}`} href={mailto(address)}>
      {address}
    </a>
  ) : (
    '…'
  );

  return (
    <form
      id={ids('kutsukoodi')}
      onSubmit={submit}
      className={dark ? 'max-w-xl rounded-[1.4rem] bg-white/[0.07] p-4 ring-1 ring-white/15 sm:p-5' : 'mt-[30px] max-w-[440px] border-t border-[var(--lp-line)] pt-[22px]'}
      noValidate
    >
      <label htmlFor={ids('invite-code')} className={`block text-sm font-bold ${dark ? '' : 'text-[var(--lp-ink-2)]'}`}>
        {dark ? 'Kutsukoodi' : 'Onko sinulla kutsukoodi?'}
      </label>
      {linkFailed && !error && (
        <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-950" role="status">
          Kutsulinkin koodi ei kelpaa. Kirjoita koodi tai pyydä uusi.
        </p>
      )}
      <div className={`mt-2.5 flex gap-2.5 ${dark ? '' : 'max-[480px]:flex-col'}`}>
        <input
          ref={inputRef}
          id={ids('invite-code')}
          className={
            dark
              ? 'block min-h-12 w-full min-w-0 flex-1 rounded-[10px] border-0 bg-white/95 px-4 text-base text-[#1c2b24] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[color-mix(in_oklab,var(--hero-accent)_55%,transparent)]'
              : 'lp-input'
          }
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(undefined);
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="SANA-SANA-12"
          aria-invalid={!!error}
          aria-describedby={error ? ids('invite-error') : ids('invite-help')}
        />
        <button type="submit" disabled={busy} className={`lp-btn h-12 shrink-0 px-5 disabled:opacity-70 ${dark ? 'lp-btn-accent' : 'lp-btn-dark'}`}>
          {busy ? 'Hetki…' : dark ? 'Avaa' : 'Avaa sovellus'}
        </button>
      </div>
      {error ? (
        <p id={ids('invite-error')} className={`mt-2 text-sm font-semibold ${dark ? 'text-[#ffd4c4]' : 'text-[var(--lp-error)]'}`} role="alert">
          {error}
        </p>
      ) : (
        <p id={ids('invite-help')} className={`mt-3 text-sm ${dark ? 'text-[var(--hero-ink-soft)]' : 'text-[var(--lp-ink-3)]'}`}>
          {dark ? 'Ei koodia? Pyydä kutsu: ' : 'Sovellus on toistaiseksi kutsupohjainen. Pyydä kutsu: '}
          {link}
          {dark ? null : '. Koodin jälkeen voit tutustua esimerkkiin ennen omien tietojen lisäämistä.'}
        </p>
      )}
    </form>
  );
}

/** Suurennettu kuva koko näytölle; sulkeutuu napautuksella tai Esc-näppäimellä. */
function Zoom({ name, onClose }: { name: ShotName; onClose: () => void }) {
  const s = SHOTS[name];
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={s.alt} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <img src={src(name)} srcSet={srcSet(name)} sizes="92vw" width={s.w} height={s.h} alt={s.alt} className="h-auto max-h-[92dvh] w-auto max-w-full rounded-xl shadow-2xl" />
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="press absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex size-11 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow"
        aria-label="Sulje kuva"
      >
        <IconClose size="1.2rem" />
      </button>
    </div>
  );
}

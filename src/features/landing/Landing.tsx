// Alkusivu uusille käyttäjille (18.11.2026, selkeytetty versio): ensimmäinen näkymä kertoo heti, mistä on
// kyse. Iso otsikko, koodikenttä ja animoitu esittely, jossa PC:n ja puhelimen näkymät vaihtuvat itsestään.
// Sen alla vain lyhyet luottamusmerkit, kuusi ominaisuutta ja kutsu. Kuvat ovat esimerkkiprofiileista
// (Aino ja Eino), eivät oikeista tiedoista.

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from 'react';
import { checkInvite } from '../../domain/invite';
import { APP_VERSION } from '../../domain/version';
import { PrivacySheet } from '../help/Privacy';
import { contactAddress } from './contact';
import { QuickTest } from './QuickTest';
import { IconBall, IconBolt, IconChart, IconClock, IconClose, IconDevices, IconLock, IconPause, IconPlay, IconShare, IconUser, IconWeek } from '../../ui/icons';

type ShotName =
  | 'pc-week'
  | 'pc-analysis'
  | 'pc-calendar'
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
  'pc-week': { w: 1280, h: 800, alt: 'Viikkonäkymä PC:llä' },
  'pc-analysis': { w: 1280, h: 800, alt: 'Analyysi PC:llä: kehitys kuukausittain ja lajit' },
  'pc-calendar': { w: 1280, h: 800, alt: 'Pelikalenterin kuukausinäkymä PC:llä' },
  'pc-theme': { w: 1280, h: 800, alt: 'Viikkonäkymä PC:llä Kanerva-väriteemalla ja nurmitaustalla' },
  'pc-family': { w: 1280, h: 800, alt: 'Koko perheen pelikalenteri PC:llä: sisarusten pelit väreittäin' },
  'pc-story': { w: 1280, h: 800, alt: 'Kauden kooste PC:llä: paras viikko' },
  'phone-week': { w: 390, h: 844, alt: 'Viikkonäkymä puhelimella' },
  'phone-add': { w: 390, h: 844, alt: 'Uuden kerran kirjaus puhelimella' },
  'phone-analysis': { w: 390, h: 844, alt: 'Analyysi puhelimella: reipas ja rasittava liikunta kuukausittain' },
  'phone-football': { w: 390, h: 844, alt: 'Jalkapallon kausi puhelimella: treenit, pelit ja maalit' },
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

// Esittelyn kohtaukset; merkinnät vastaavat kuvien esimerkkitietoja.
const SCENES: Scene[] = [
  { phone: 'phone-week', pc: 'pc-week', title: 'Viikko yhdellä silmäyksellä', text: 'Näet heti, täyttyykö ikäryhmän liikkumissuositus.', chips: ['Lähellä tahtia', '49 min / päivä'] },
  { phone: 'phone-add', pc: 'pc-week', title: 'Liikuntakerta sekunneissa', text: 'Laji, kesto ja tallenna. Viikon harrastukset tulevat valmiiksi.', chips: ['Treeni 90 min', 'Tallennettu'] },
  { phone: 'phone-analysis', pc: 'pc-analysis', title: 'Kehitys kuukausittain', text: 'Kaudet, lajit ja suositusten toteutuminen. Raportit PDF:nä.', chips: ['+9 min / pv syyskuusta', '6 lajia'] },
  { phone: 'phone-theme', pc: 'pc-theme', title: 'Oman näköinen', text: 'Vaalea tai tumma teema, neljä väriteemaa ja taustat – myös oma kuva.', chips: ['4 väriteemaa', 'Tumma teema'] },
  { phone: 'phone-football', pc: 'pc-calendar', title: 'Pelit ja tulokset', text: 'Pelikalenteri, turnaukset ja kauden tilastot koko perheelle.', chips: ['Kausi 2–1–1', 'Aino: 3 maalia'] },
  { phone: 'phone-family', pc: 'pc-family', title: 'Koko perheen kalenteri', text: 'Sisarusten pelit väreittäin samassa kalenterissa. Päällekkäiset pelit näkyvät heti.', chips: ['Päällekkäin', 'Vienti kalenteriin'] },
  { phone: 'phone-story', pc: 'pc-story', title: 'Kauden kooste', text: 'Kauden kohokohdat tarinakortteina. Tallenna kuvana tai jaa.', chips: ['96,3 h liikuntaa', 'Paras viikko'] },
  { phone: 'phone-preview', pc: 'pc-calendar', title: 'Ennakot jakoon', text: 'Otteluennakko kuvana tai videona joukkueen WhatsAppiin.', chips: ['Kuva tai video', 'Jaa ryhmään'] },
];
const SCENE_MS = 7000;


const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Landing({ onUnlock, linkFailed }: { onUnlock: () => void; linkFailed: boolean }) {
  const [zoom, setZoom] = useState<ShotName>();
  const [privacy, setPrivacy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const quizCodeRef = useRef<HTMLInputElement>(null);
  const goToQuiz = () => document.getElementById('pikatesti')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  const goToCode = () => {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    window.setTimeout(() => codeRef.current?.focus({ preventScroll: true }), 400);
  };

  return (
    <div className="min-h-dvh">
      <section className="lp-hero rounded-b-[2.5rem] lg:rounded-b-[3.5rem]" aria-labelledby="landing-title">
        <div className="lp-blob -left-24 top-1/3 size-[28rem] bg-[rgb(120_200_175/0.18)]" aria-hidden />
        <div className="lp-blob -right-20 -top-24 size-[30rem] bg-[rgb(230_180_120/0.2)] [animation-delay:-6s]" aria-hidden />

        <div className="relative z-10 mx-auto max-w-[1240px] px-4 pb-14 pt-[max(1rem,env(safe-area-inset-top))] lg:px-10 lg:pb-20">
          <header className="flex items-center justify-between gap-3 py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <img src="./favicon.svg" alt="" className="size-8 shrink-0 rounded-lg ring-1 ring-white/15" />
              <span className="truncate font-display text-[17px] font-semibold">Liikkumisen seuranta</span>
            </div>
            <span className="hidden shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[var(--hero-ink-soft)] ring-1 ring-white/15 lg:inline">Kutsupohjainen</span>
            {/* Puhelimella koodikenttä on esittelyn alla: pikalinkki sinne. */}
            <button
              type="button"
              onClick={() => {
                document.getElementById('kutsukoodi')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
                window.setTimeout(() => codeRef.current?.focus({ preventScroll: true }), 450);
              }}
              className="press shrink-0 rounded-full bg-[var(--hero-accent)] px-3.5 py-1.5 text-sm font-bold text-[#1c2b24] shadow lg:hidden"
            >
              Syötä koodi
            </button>
          </header>

          <div className="mt-6 grid items-center gap-x-12 gap-y-8 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]">
            <div className="lp-enter lg:col-start-1 lg:row-start-1 lg:self-end">
              <h1 id="landing-title" className="font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl xl:text-[4.2rem]">
                Liikkuuko lapsi tarpeeksi? <span className="text-[var(--hero-accent)]">Nyt sen näkee.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--hero-ink-soft)] sm:text-lg">
                Kirjaa liikuntakerrat sekunneissa ja näe viikko suhteessa suomalaisiin liikkumissuosituksiin. Jalkapalloperheille myös pelit, tulokset ja jaettavat ennakot.
              </p>
              <button
                type="button"
                onClick={goToQuiz}
                className="press mt-6 inline-flex min-h-12 items-center gap-2.5 rounded-full bg-white/10 py-2 pl-2 pr-5 text-left text-[15px] font-semibold text-[var(--hero-ink)] ring-1 ring-white/25 backdrop-blur-sm hover:bg-white/15"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--hero-accent)] text-sm text-[#1c2b24]" aria-hidden>
                  <IconClock size="1.05rem" />
                </span>
                <span>
                  Tee 1 minuutin pikatesti
                </span>
              </button>
            </div>

            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <Showcase onZoom={setZoom} />
            </div>

            <div className="lp-enter lg:col-start-1 lg:row-start-2 lg:self-start" style={{ '--d': '150ms' } as CSSProperties}>
              <InviteForm inputRef={codeRef} onUnlock={onUnlock} linkFailed={linkFailed} />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1240px] px-4 pb-14 lg:px-10">
        <Reveal as="ul" className="relative z-10 -mt-7 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4" aria-label="Lyhyesti">
          {(
            [
              [IconLock, 'Tiedot vain sinulla', 'Ei palvelinta, ei tiliä'],
              [IconDevices, 'PC ja puhelin', 'Tiedot kulkevat pilvikansiosi kautta'],
              [IconUser, 'Koko perhe', 'Oma profiili jokaiselle'],
              [IconBolt, 'Toimii ilman verkkoa', 'Asentuu kotinäytölle'],
            ] as const
          ).map(([Icon, t, d], i) => (
            <li key={t} className="lp-reveal card flex items-start gap-3 p-3.5 sm:p-4" style={{ '--i': i } as CSSProperties}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-800">
                <Icon size="1.1rem" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight text-slate-900">{t}</span>
                <span className="mt-0.5 block text-xs leading-snug text-slate-500">{d}</span>
              </span>
            </li>
          ))}
        </Reveal>

        {/* Pikatesti iltamaiseman päällä (taivas liukuvärinä; public/landing/quiz-forest.svg metsäkaistana alareunassa kiinteällä mittasuhteella, joten paneelin kasvu ei venytä maisemaa). */}
        <section id="pikatesti" className="relative mt-16 scroll-mt-4 overflow-hidden rounded-[2rem] bg-[#0c2230] px-4 py-9 sm:px-8 lg:mt-24 lg:rounded-[2.5rem] lg:px-14 lg:py-16" aria-labelledby="quiz-title">
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--hero-accent)]">Pikatesti · noin minuutti</p>
            <h2 id="quiz-title" className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight text-[var(--hero-ink)] sm:text-4xl lg:text-5xl">
              Liikkuuko oma lapsesi tarpeeksi?
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--hero-ink-soft)] sm:text-lg">
              Muutama kysymys arjesta, ja saat arvion suhteessa suomalaisiin liikkumissuosituksiin sekä vinkit helpoimpiin lisäyksiin.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-[var(--hero-ink)] ring-1 ring-white/15 backdrop-blur-sm">
              <IconLock size="0.95rem" /> Vastauksesi eivät lähde tältä sivulta.
            </p>
          </div>
            }
            invite={<InviteForm idPrefix="quiz" inputRef={quizCodeRef} onUnlock={onUnlock} linkFailed={false} />}
          />
          </div>
        </section>

        <Reveal as="section" className="mt-16 lg:mt-24" aria-labelledby="features-title">
          <h2 id="features-title" className="lp-reveal max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">
            Kaikki liikunta yhdessä paikassa
          </h2>
          <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {(
              [
                [IconWeek, 'Viikkonäkymä', 'Suositus ja edistyminen heti näkyvissä.'],
                [IconBolt, 'Nopea kirjaus', 'Viikkorytmi valmiina, kuittaus yhdellä napautuksella.'],
                [IconChart, 'Analyysi ja raportit', 'Kuukaudet, kaudet ja lajit. Raportit PDF:nä.'],
                [IconBall, 'Jalkapallo', 'Pelikalenteri, tulokset, turnaukset ja päiväkirja.'],
                [IconShare, 'Jakokuvat ja video', 'Ennakot ja tulokset joukkueen kanavaan.'],
                [IconUser, 'Koko perhe', 'Oma suositus ja väri jokaiselle, perheen pelit samassa kalenterissa.'],
              ] as const
            ).map(([Icon, t, d], i) => (
              <li key={t} className="lp-reveal card flex items-start gap-3.5 p-5" style={{ '--i': i + 1 } as CSSProperties}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(150deg,var(--hero-from),var(--hero-to))] text-[var(--hero-accent)] shadow-sm">
                  <Icon size="1.25rem" />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-lg font-semibold leading-tight text-slate-900">{t}</span>
                  <span className="mt-1 block text-sm leading-snug text-slate-600">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal as="section" className="mt-16 lg:mt-24" aria-labelledby="join-title">
          <div className="lp-reveal lp-hero rounded-[2rem] px-6 py-9 sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:py-12">
            <div className="relative z-10">
              <h2 id="join-title" className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
                Pääse mukaan kutsulla
              </h2>
              <ol className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--hero-ink-soft)]">
                {['Pyydä koodi', 'Luo profiili', 'Asenna kotinäytölle'].map((t, i) => (
                  <li key={t} className="inline-flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 ring-1 ring-white/15">
                    <span className="flex size-6 items-center justify-center rounded-full bg-[var(--hero-accent)] text-xs font-bold text-[#1c2b24]">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative z-10 mt-6 shrink-0 lg:mt-0 lg:text-right">
              <button
                type="button"
                onClick={goToCode}
                className="press inline-flex min-h-12 items-center rounded-full bg-[var(--hero-accent)] px-7 text-base font-bold text-[#1c2b24] shadow-lg hover:brightness-105"
              >
                Syötä kutsukoodi
              </button>
              <p className="mt-3 text-sm text-[var(--hero-ink-soft)]">
                <Contact dark />
              </p>
            </div>
          </div>
        </Reveal>
      </main>

      <footer className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-200 px-4 py-6 text-sm text-slate-500 lg:px-10">
        <span className="font-display font-semibold text-slate-700">Liikkumisen seuranta</span>
        <span>Versio {APP_VERSION}</span>
        <button type="button" onClick={() => setPrivacy(true)} className="min-h-9 font-semibold text-slate-700 underline-offset-2 hover:underline">
          Tietosuoja
        </button>
      </footer>

      <PrivacySheet open={privacy} onClose={() => setPrivacy(false)} />
      {zoom && <Zoom name={zoom} onClose={() => setZoom(undefined)} />}
    </div>
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
      className={`lp-enter ${paused ? 'lp-paused' : ''}`}
      style={{ '--d': '250ms' } as CSSProperties}
      role="region"
      aria-roledescription="esittely"
      aria-label="Kuvia ohjelmasta"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={() => setHover(false)}
      // Näppäimistöllä kohdistettu esittely pysähtyy; hiiren napautus ei pysäytä pysyvästi.
      onFocus={(e) => e.target.matches(':focus-visible') && setHover(true)}
      onBlur={() => setHover(false)}
    >
      <div className="relative mx-auto aspect-[100/108] w-full max-w-[640px] sm:aspect-[100/94]">
        {/* PC taustalla */}
        <button
          type="button"
          onClick={() => onZoom(scene.pc)}
          className="absolute left-0 top-[4%] w-[86%] overflow-hidden rounded-xl bg-[var(--surface-raised)] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.55)] ring-1 ring-white/15 sm:w-[84%]"
          aria-label={`Suurenna: ${SHOTS[scene.pc].alt}`}
        >
          <span className="flex h-4 items-center gap-1 bg-[var(--surface-sunk)] px-2.5 sm:h-6" aria-hidden>
            <span className="size-1.5 rounded-full bg-red-400/80 sm:size-2" />
            <span className="size-1.5 rounded-full bg-amber-400/80 sm:size-2" />
            <span className="size-1.5 rounded-full bg-green-500/80 sm:size-2" />
          </span>
          <span className="relative isolate block aspect-[1280/800] overflow-hidden">
            {pcShots.map((n) => (
              <span key={n} className="lp-slide" data-state={n === scene.pc ? 'active' : prev !== undefined && n === SCENES[prev].pc ? 'prev' : 'idle'} aria-hidden={n !== scene.pc}>
                <img src={src(n)} srcSet={srcSet(n)} sizes="(min-width: 640px) 540px, 86vw" width={1280} height={800} alt="" decoding="async" />
              </span>
            ))}
          </span>
        </button>

        {/* Puhelin edessä */}
        <div className="absolute right-[2%] top-[13%] w-[46%] sm:right-[3%] sm:top-[12%] sm:w-[38%]">
          <button
            type="button"
            onClick={() => onZoom(scene.phone)}
            className="relative block w-full rounded-[1.7rem] bg-[#121a16] p-[5px] shadow-[0_40px_70px_-20px_rgb(0_0_0/0.7)] ring-1 ring-white/20 sm:rounded-[2.2rem] sm:p-[7px]"
            aria-label={`Suurenna: ${SHOTS[scene.phone].alt}`}
          >
            <span className="relative isolate block aspect-[390/844] overflow-hidden rounded-[1.35rem] bg-[var(--bg)] sm:rounded-[1.75rem]">
              {SCENES.map((s, i) => (
                <span key={s.phone} className="lp-slide" data-state={state(i)} aria-hidden={i !== idx}>
                  <img src={src(s.phone)} srcSet={srcSet(s.phone)} sizes="(min-width: 640px) 245px, 44vw" width={390} height={844} alt="" decoding="async" />
                </span>
              ))}
            </span>
          </button>
        </div>

        {/* Ponnahtavat merkinnät */}
        <div key={idx} aria-hidden>
          <span className="lp-chip absolute left-[22%] top-[30%] z-10 sm:left-[30%] sm:top-[24%]" style={{ '--d': '700ms' } as CSSProperties}>
            <span className="whitespace-nowrap rounded-full bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-bold text-slate-900 shadow-xl ring-1 ring-black/5 sm:px-3.5 sm:py-2 sm:text-sm">
              {scene.chips[0]}
            </span>
          </span>
          <span className="lp-chip absolute bottom-[8%] right-0 z-10 sm:bottom-[10%]" style={{ '--d': '1300ms' } as CSSProperties}>
            <span className="whitespace-nowrap rounded-full bg-[var(--hero-accent)] px-3 py-1.5 text-xs font-bold text-[#1c2b24] shadow-xl sm:px-3.5 sm:py-2 sm:text-sm">{scene.chips[1]}</span>
          </span>
        </div>
      </div>

      {/* Kuvateksti ja tarinapalkki */}
      <div className="mx-auto mt-5 max-w-[640px]">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1.5" role="tablist" aria-label="Esittelyn kohdat">
            {SCENES.map((s, i) => (
              <button key={s.title} type="button" role="tab" aria-selected={i === idx} aria-label={s.title} onClick={() => go(i)} className="group flex h-6 flex-1 items-center">
                <span className="relative block h-1 w-full overflow-hidden rounded-full bg-white/20 group-hover:bg-white/30">
                  <span
                    key={i === idx ? `run-${idx}` : `idle-${i}`}
                    className="lp-fill absolute inset-0 rounded-full bg-[var(--hero-accent)]"
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
              className="press flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-[var(--hero-ink)] ring-1 ring-white/15 hover:bg-white/15"
              aria-label={userPaused ? 'Jatka esittelyä' : 'Pysäytä esittely'}
            >
              {userPaused ? <IconPlay size="0.85rem" /> : <IconPause size="0.85rem" />}
            </button>
          )}
        </div>
        <div key={idx} className="lp-caption mt-2.5 min-h-[4.5rem]" aria-live={auto && !userPaused ? 'off' : 'polite'}>
          <div className="font-display text-xl font-semibold leading-tight sm:text-2xl">{scene.title}</div>
          <p className="mt-1 text-sm leading-snug text-[var(--hero-ink-soft)] sm:text-base">{scene.text}</p>
        </div>
      </div>
    </div>
  );
}

/** Vierityksessä esiin: ryhmä saa luokan is-in, kun se tulee näkyviin; lapset (.lp-reveal) porrastetusti. */
function Reveal({ as = 'div', className = '', children, ...aria }: { as?: 'div' | 'section' | 'ul'; className?: string; children: ReactNode; 'aria-label'?: string; 'aria-labelledby'?: string }) {
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
  if (as === 'ul') return <ul {...props}>{children}</ul>;
  return <div {...props}>{children}</div>;
}

function InviteForm({ inputRef, onUnlock, linkFailed, idPrefix = '' }: { inputRef: RefObject<HTMLInputElement | null>; onUnlock: () => void; linkFailed: boolean; idPrefix?: string }) {
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

  return (
    <form id={ids('kutsukoodi')} onSubmit={submit} className="max-w-xl rounded-[1.6rem] bg-white/[0.07] p-4 ring-1 ring-white/15 backdrop-blur-sm sm:p-5" noValidate>
      <label htmlFor={ids('invite-code')} className="block text-sm font-semibold">
        Kutsukoodi
      </label>
      {linkFailed && !error && (
        <p className="mt-2 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-950" role="status">
          Kutsulinkin koodi ei kelpaa. Kirjoita koodi tai pyydä uusi.
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <input
          ref={inputRef}
          id={ids('invite-code')}
          className="block min-h-12 w-full min-w-0 flex-1 rounded-full border-0 bg-white/95 px-4 text-base text-[#1c2b24] shadow-inner placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[color-mix(in_oklab,var(--hero-accent)_55%,transparent)]"
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
        <button
          type="submit"
          disabled={busy}
          className="press inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[var(--hero-accent)] px-5 text-base font-bold text-[#1c2b24] shadow-lg hover:brightness-105 disabled:opacity-70 sm:px-7"
        >
          {busy ? 'Hetki…' : 'Avaa'}
        </button>
      </div>
      {error ? (
        <p id={ids('invite-error')} className="mt-2 text-sm font-semibold text-[#ffd4c4]" role="alert">
          {error}
        </p>
      ) : (
        <p id={ids('invite-help')} className="mt-2.5 text-sm text-[var(--hero-ink-soft)]">
          <Contact dark />
        </p>
      )}
    </form>
  );
}

function Contact({ dark }: { dark?: boolean }) {
  const [address, setAddress] = useState<string>();
  useEffect(() => setAddress(contactAddress()), []);
  return (
    <>
      Ei koodia? Pyydä kutsu:{' '}
      {address ? (
        <a
          className={`inline-block font-semibold underline underline-offset-2 ${dark ? 'text-[var(--hero-ink)] decoration-[var(--hero-accent)]' : 'text-green-800'}`}
          href={`mailto:${address}?subject=${encodeURIComponent('Kutsukoodi: Liikkumisen seuranta')}`}
        >
          {address}
        </a>
      ) : (
        '…'
      )}
    </>
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

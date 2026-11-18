// Alkusivu uusille käyttäjille (18.11.2026): ohjelman perustiedot, kuvakollaasi ominaisuuksista PC:ltä ja
// puhelimesta sekä kutsukoodi. Kuvat ovat esimerkkiprofiileista (Aino ja Eino), eivät oikeista tiedoista.

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { checkInvite } from '../../domain/invite';
import { inputClass } from '../../ui/components';
import { IconClose } from '../../ui/icons';

type ShotName = 'pc-week' | 'pc-analysis' | 'pc-calendar' | 'phone-week' | 'phone-add' | 'phone-football' | 'phone-preview';

const SHOTS: Record<ShotName, { w: number; h: number; alt: string }> = {
  'pc-week': { w: 1280, h: 800, alt: 'Viikkonäkymä PC:llä: viikon liikunta suhteessa suositukseen ja edellinen viikko päivittäin' },
  'pc-analysis': { w: 1280, h: 800, alt: 'Analyysi PC:llä: kuukausittainen kehitys ja lajien monipuolisuus kauden ajalta' },
  'pc-calendar': { w: 1280, h: 800, alt: 'Pelikalenterin kuukausinäkymä PC:llä: ottelut, turnaus, harjoituspeli ja treenit' },
  'phone-week': { w: 390, h: 844, alt: 'Viikkonäkymä puhelimella' },
  'phone-add': { w: 390, h: 844, alt: 'Uuden kerran kirjaus puhelimella: lajit kuvakkeina' },
  'phone-football': { w: 390, h: 844, alt: 'Jalkapallon kausi puhelimella: treenit, pelit, voitot ja maalit' },
  'phone-preview': { w: 390, h: 844, alt: 'Otteluennakon jakokuva puhelimella' },
};
const src = (n: ShotName) => `./landing/${n}.webp`;

// Osoite kootaan vasta selaimessa, jottei se ole lähdekoodissa yhtenä merkkijonona (vähemmän roskapostia).
const flip = (s: string) => s.split('').reverse().join('');
const contactAddress = () => `${flip('44nenotsumt')}@${flip('moc.liamg')}`;

export function Landing({ onUnlock, linkFailed }: { onUnlock: () => void; linkFailed: boolean }) {
  const [zoom, setZoom] = useState<ShotName>();
  const codeRef = useRef<HTMLInputElement>(null);
  const goToCode = () => {
    document.getElementById('kutsukoodi')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => codeRef.current?.focus({ preventScroll: true }), 350);
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] px-4 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl lg:px-10">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="./favicon.svg" alt="" className="size-8 shrink-0" />
            <span className="truncate font-display text-[17px] font-semibold text-slate-900">Liikkumisen seuranta</span>
          </div>
          <button type="button" onClick={goToCode} className="press shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold text-green-800 ring-1 ring-[var(--line)] hover:bg-green-50">
            <span className="sm:hidden">Koodi</span>
            <span className="hidden sm:inline">Minulla on koodi</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 pb-16 lg:px-10">
        {/* Esittely ja kutsukoodi | kollaasi */}
        <section className="grid items-center gap-8 pt-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:pt-12" aria-labelledby="landing-title">
          <div className="anim-rise">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-green-800">Lapsen ja perheen liikunta</p>
            <h1 id="landing-title" className="mt-3 font-display text-[2.4rem] font-semibold leading-[1.04] tracking-tight text-slate-900 sm:text-5xl">
              Liikkumisen seuranta
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Kirjaa liikunta muutamalla napautuksella ja näe, miten viikko vertautuu suomalaisiin liikkumissuosituksiin. Jalkapalloilijalle mukana pelikalenteri, tulokset, turnaukset ja
              jaettavat otteluennakot.
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {['Vertailu ikäryhmän suositukseen', 'Koko perhe: oma profiili jokaiselle', 'PC ja puhelin yhdessä', 'Tiedot vain omilla laitteillasi'].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-[11px] font-bold text-green-800" aria-hidden>
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <InviteForm inputRef={codeRef} onUnlock={onUnlock} linkFailed={linkFailed} />
          </div>

          <div className="hero anim-rise relative overflow-hidden px-4 pb-6 pt-6 sm:px-8 sm:pb-10 sm:pt-8" aria-label="Kuvia ohjelmasta">
            <div className="relative z-10">
              <Desktop name="pc-week" onZoom={setZoom} eager />
              <div className="-mt-[34%] ml-auto mr-[-2%] w-[30%] sm:mr-[2%] sm:w-[26%]">
                <Phone name="phone-week" onZoom={setZoom} eager />
              </div>
            </div>
          </div>
        </section>

        {/* Kollaasi ominaisuuksista */}
        <section className="mt-16 lg:mt-24" aria-labelledby="features-title">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-green-800">Ominaisuudet</p>
          <h2 id="features-title" className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Mitä ohjelmalla tehdään
          </h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3 lg:gap-5">
            <Feature wide media={<Desktop name="pc-analysis" onZoom={setZoom} />} title="Analyysi viikoista ja kausista">
              Reipas ja rasittava liikunta kuukausittain, suositusten toteutuminen viikoittain ja lajien monipuolisuus. Viikko- ja kausiraportti myös PDF:nä.
            </Feature>
            <Feature media={<Phone name="phone-add" onZoom={setZoom} />} title="Kirjaus muutamassa sekunnissa">
              Laji kuvakkeesta, kesto ja tallenna. Viikkorytmin harrastukset tulevat valmiiksi, ja ne kuitataan tehdyiksi yhdellä napautuksella.
            </Feature>
            <Feature media={<Phone name="phone-football" onZoom={setZoom} />} title="Jalkapallo: kausi ja tulokset">
              Treenit, pelit, voitot, maalit ja lapsen omat maalit. Päiväkirja, tähtiarviot ja kommentit sekä kauden kooste.
            </Feature>
            <Feature wide media={<Desktop name="pc-calendar" onZoom={setZoom} />} title="Pelikalenteri koko perheelle">
              Ottelut, turnaukset ja harjoituspelit kuukausinäkymässä, halutessa koko perheen pelit väreittäin ja päällekkäisyysvaroitus. Tulostus PDF:ksi ja vienti puhelimen
              kalenteriin.
            </Feature>
            <Feature media={<Phone name="phone-preview" onZoom={setZoom} />} title="Ennakot ja tulokset jakoon">
              Otteluennakko ja tuloskuva valmiina tarinaan tai julkaisuun, joukkueiden logoilla ja väreillä. Ennakon saa myös lyhyeksi videoksi.
            </Feature>
            <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2 lg:gap-5">
              <TextCard icon="🔄" title="PC ja puhelin yhdessä">
                PC on päälaite, puhelimella kirjataan kentän laidalla. Laitteet vaihtavat tiedot oman pilvikansiosi kautta (OneDrive, iCloud tai Google Drive). Yksikin laite riittää.
              </TextCard>
              <TextCard icon="🔒" title="Tiedot pysyvät sinulla">
                Ei tiliä, ei mainoksia eikä palvelinta. Tiedot ovat vain laitteidesi selaimessa, eikä ohjelma lähetä niitä minnekään. Varmuuskopio tallennetaan omaan pilveesi.
              </TextCard>
              <TextCard icon="📱" title="Asennus kuin sovellus">
                Ohjelma toimii selaimessa ja asentuu kotinäytölle tai tehtäväpalkkiin. Toimii myös ilman verkkoyhteyttä.
              </TextCard>
              <TextCard icon="👨‍👩‍👧" title="Koko perhe">
                Oma profiili jokaiselle lapselle ja aikuiselle, jokaisella oma ikäryhmän suositus ja väri. Vaihto yhdellä napautuksella.
              </TextCard>
            </div>
          </div>
        </section>

        {/* Alkuun pääsy */}
        <section className="mt-16 lg:mt-24" aria-labelledby="start-title">
          <h2 id="start-title" className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Näin pääset alkuun
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ['Pyydä kutsukoodi', 'Ohjelma on toistaiseksi kutsutuille. Koodin saa ohjelman tekijältä sähköpostilla.'],
              ['Avaa ja luo profiili', 'Nimi ja syntymävuosi riittävät. Aloitus vie muutaman minuutin, ja kaiken voi muuttaa myöhemmin.'],
              ['Asenna kotinäytölle', 'Puhelimella "Lisää kotivalikkoon", PC:llä asennuspainike osoiterivillä. Ohjeet löytyvät ohjelmasta.'],
            ].map(([t, d], i) => (
              <li key={t} className="card p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-green-700 text-sm font-bold text-white">{i + 1}</span>
                <h3 className="mt-3 font-display text-lg font-semibold text-slate-900">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={goToCode} className="press inline-flex min-h-12 items-center rounded-full bg-green-700 px-6 text-sm font-bold text-white hover:bg-green-800">
              Syötä kutsukoodi
            </button>
            <Contact />
          </div>
        </section>
      </main>

      {zoom && <Zoom name={zoom} onClose={() => setZoom(undefined)} />}
    </div>
  );
}

function InviteForm({ inputRef, onUnlock, linkFailed }: { inputRef: React.RefObject<HTMLInputElement | null>; onUnlock: () => void; linkFailed: boolean }) {
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
      setError('Koodi ei kelpaa. Tarkista kirjoitusasu (isoilla kirjaimilla ja väliviivoilla ei ole väliä) tai pyydä uusi koodi.');
      inputRef.current?.select();
    }
  }

  return (
    <form id="kutsukoodi" onSubmit={submit} className="card mt-7 scroll-mt-24 p-5" noValidate>
      <label htmlFor="invite-code" className="block font-display text-lg font-semibold text-slate-900">
        Kutsukoodi
      </label>
      <p className="mt-0.5 text-sm text-slate-600">Ohjelmaan pääsee koodilla. Koodi kysytään tällä laitteella vain kerran.</p>
      {linkFailed && !error && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200" role="status">
          Kutsulinkin koodi ei kelpaa. Kirjoita koodi alle tai pyydä uusi.
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          id="invite-code"
          className={`${inputClass} sm:flex-1`}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(undefined);
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="esim. SANA-SANA-12"
          aria-invalid={!!error}
          aria-describedby={error ? 'invite-error' : undefined}
        />
        <button
          type="submit"
          disabled={busy}
          className="press inline-flex min-h-11 items-center justify-center rounded-xl bg-green-700 px-5 text-sm font-bold text-white hover:bg-green-800 disabled:bg-slate-300"
        >
          {busy ? 'Tarkistetaan…' : 'Avaa ohjelma'}
        </button>
      </div>
      {error && (
        <p id="invite-error" className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 text-sm text-slate-600">
        <Contact />
      </div>
    </form>
  );
}

function Contact() {
  const [address, setAddress] = useState<string>();
  useEffect(() => setAddress(contactAddress()), []);
  return (
    <span className="text-sm text-slate-600">
      Ei koodia? Pyydä se ohjelman tekijältä:{' '}
      {address ? (
        <a className="inline-block font-semibold text-green-800 underline underline-offset-2" href={`mailto:${address}?subject=${encodeURIComponent('Kutsukoodi: Liikkumisen seuranta')}`}>
          {address}
        </a>
      ) : (
        '…'
      )}
    </span>
  );
}

function Feature({ media, title, children, wide }: { media: ReactNode; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <article className={`card flex flex-col overflow-hidden ${wide ? 'lg:col-span-2' : ''}`}>
      <div className={`flex justify-center bg-[var(--surface-sunk)] px-4 pt-5 sm:px-6 sm:pt-6 ${wide ? 'pb-5 sm:pb-6' : 'max-h-[400px] overflow-hidden'}`}>
        <div className={`w-full ${wide ? '' : 'max-w-[230px]'}`}>{media}</div>
      </div>
      <div className="p-5">
        <h3 className="font-display text-xl font-semibold leading-tight text-slate-900">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{children}</p>
      </div>
    </article>
  );
}

function TextCard({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <article className="card p-5">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-green-50 text-lg" aria-hidden>
        {icon}
      </span>
      <h3 className="mt-3 font-display text-lg font-semibold leading-tight text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{children}</p>
    </article>
  );
}

/** PC-ikkunan kehys: yläpalkki pisteineen ja kuva. */
function Desktop({ name, onZoom, eager }: { name: ShotName; onZoom: (n: ShotName) => void; eager?: boolean }) {
  const s = SHOTS[name];
  return (
    <button type="button" onClick={() => onZoom(name)} className="press block w-full overflow-hidden rounded-xl bg-[var(--surface-raised)] text-left shadow-2xl ring-1 ring-black/10" aria-label={`Suurenna kuva: ${s.alt}`}>
      <span className="flex h-6 items-center gap-1.5 bg-[var(--surface-sunk)] px-3" aria-hidden>
        <span className="size-2 rounded-full bg-red-400/80" />
        <span className="size-2 rounded-full bg-amber-400/80" />
        <span className="size-2 rounded-full bg-green-500/80" />
      </span>
      <img src={src(name)} width={s.w} height={s.h} alt={s.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" className="block h-auto w-full" />
    </button>
  );
}

/** Puhelimen kehys: tumma reunus ja pyöristetty näyttö. */
function Phone({ name, onZoom, eager }: { name: ShotName; onZoom: (n: ShotName) => void; eager?: boolean }) {
  const s = SHOTS[name];
  return (
    <button type="button" onClick={() => onZoom(name)} className="press block w-full rounded-[1.6rem] bg-[#16201b] p-[5px] shadow-2xl ring-1 ring-black/20 sm:rounded-[2rem] sm:p-[7px]" aria-label={`Suurenna kuva: ${s.alt}`}>
      <img src={src(name)} width={s.w} height={s.h} alt={s.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" className="block h-auto w-full rounded-[1.3rem] sm:rounded-[1.6rem]" />
    </button>
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
      <img src={src(name)} width={s.w} height={s.h} alt={s.alt} className={`h-auto max-h-full w-auto max-w-full rounded-xl shadow-2xl ${s.w < s.h ? 'max-h-[92dvh]' : ''}`} />
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

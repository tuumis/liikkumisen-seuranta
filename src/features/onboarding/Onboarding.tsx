// Ensikäynnistys (SPEC 12, 16): tervetulosivu perustietoineen ja sen jälkeen enintään neljä ohitettavaa
// vaihetta: 1 profiili, 2 viikkopohja, 3 perusarvio, 4 laitteen rooli ja asennusohje.
// "Tuo tiedot" ohittaa vaiheet 1–3 (vahvistettu tulkinta). PC:llä koko näytön levyinen asettelu.

import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { activityTypeId } from '../../domain/ids';
import type { Category, Profile } from '../../domain/types';
import { mergeAnyFile } from '../../db/backup';
import { repo, type DeviceRole } from '../../db/repositories';
import { db } from '../../db/schema';
import { requestPersistentStorage } from '../../db/storage';
import { ESTIMATE_DEFAULT_TYPE_KEY, ESTIMATE_SUGGESTIONS } from '../../seed/activityTypes';
import { Button, Card } from '../../ui/components';
import { today } from '../../ui/today';
import { ProfileForm } from '../settings/ProfileForm';
import { TemplateSection } from '../settings/TemplateSection';
import { InstallHint } from '../settings/InstallHint';
import { pickTextFile } from '../sync/fileIO';
import { summaryText } from '../sync/useSync';

type Step = 0 | 1 | 2 | 3 | 4;

const STEPS: { n: Exclude<Step, 0>; title: string; text: string }[] = [
  { n: 1, title: 'Profiili', text: 'Nimi ja syntymävuosi: niistä valitaan ikäryhmän liikkumissuositus.' },
  { n: 2, title: 'Viikkorytmi', text: 'Toistuvat harrastukset ja koululiikunta. Niistä tulee suunniteltuja kertoja, jotka kuittaat viikolla.' },
  { n: 3, title: 'Arkiliikunta', text: 'Arvio välitunneista, koulumatkoista ja leikistä, joita ei kirjata kerta kerralta.' },
  { n: 4, title: 'Laite', text: 'PC vai puhelin, ja miten sovellus asennetaan kotinäytölle.' },
];

export function Onboarding({ onDone }: { onDone: (profileId?: string) => void }) {
  const [step, setStep] = useState<Step>(0);
  const [profile, setProfile] = useState<Profile>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function finish() {
    await repo.setMeta('onboarded', true);
    onDone(profile?.id);
  }

  async function importFromPc() {
    setError(undefined);
    await repo.setDeviceRole('phone');
    const f = await pickTextFile();
    if (!f) return;
    try {
      const s = await mergeAnyFile(db, f.text, await repo.deviceId());
      setMessage(`Tiedot tuotu PC:ltä. ${summaryText(s)}.`);
      const first = (await repo.listProfiles())[0];
      if (first) setProfile(first);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (step === 0) return <Welcome onStart={() => setStep(1)} onImport={importFromPc} onSkip={finish} error={error} />;

  const current = STEPS[step - 1];
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-10 lg:py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-slate-900 lg:text-2xl">Liikkumisen seuranta</h1>
          <p className="text-xs text-slate-500">
            Aloitus · vaihe {step}/4 · {current.title}
          </p>
        </div>
        <Button variant="ghost" onClick={finish}>
          Ohita kaikki
        </Button>
      </div>
      {/* Puhelin: etenemispalkki; PC: vaiheluettelo vasemmalla. */}
      <div className="mt-3 flex gap-1.5 lg:hidden" aria-hidden>
        {STEPS.map((x) => (
          <span key={x.n} className={`h-1.5 flex-1 rounded-full ${x.n <= step ? 'bg-green-700' : 'bg-slate-200'}`} />
        ))}
      </div>

      <div className="mt-5 lg:mt-5 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside className="hidden lg:block">
          <ol className="space-y-1" aria-label="Aloituksen vaiheet">
            {STEPS.map((x) => {
              const done = x.n < step;
              const on = x.n === step;
              return (
                <li key={x.n} className={`flex gap-3 rounded-2xl p-3 ${on ? 'bg-[var(--surface-raised)] shadow-sm ring-1 ring-slate-200' : ''}`} aria-current={on ? 'step' : undefined}>
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-green-700 text-white' : on ? 'bg-slate-900 text-white' : 'bg-[var(--surface-sunk)] text-slate-500'}`}
                  >
                    {done ? '✓' : x.n}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${on ? 'text-slate-900' : 'text-slate-600'}`}>{x.title}</span>
                    {on && <span className="mt-0.5 block text-xs leading-snug text-slate-500">{x.text}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 px-3 text-xs leading-snug text-slate-500">Kaikki vaiheet voi ohittaa ja tehdä myöhemmin Asetuksissa.</p>
        </aside>

        <div className="min-w-0 space-y-4">
      {step === 1 && (
        <Card title="Kenen liikkumista seurataan?">
          <ProfileForm
            wide
            onSubmit={async (v) => {
              const p = await repo.createProfile(v);
              void requestPersistentStorage();
              setProfile(p);
              setStep(2);
            }}
            onCancel={() => setStep(2)}
          />
          <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
            Onko tiedot jo PC:llä?{' '}
            <button type="button" className="font-medium text-green-800 underline" onClick={importFromPc}>
              Tuo tiedot PC:ltä
            </button>
            {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          </div>
        </Card>
      )}

      {step === 2 &&
        (profile ? (
          <>
            <TemplateSection profile={profile} />
            <StepNav onNext={() => setStep(3)} />
          </>
        ) : (
          <Skipped text="Viikkopohja lisätään profiilille. Voit tehdä sen myöhemmin Asetuksissa." onNext={() => setStep(3)} />
        ))}

      {step === 3 &&
        (profile ? (
          <EstimatesStep profile={profile} onNext={() => setStep(4)} />
        ) : (
          <Skipped text="Perusarviot lisätään profiilille. Voit tehdä sen myöhemmin Asetuksissa." onNext={() => setStep(4)} />
        ))}

      {step === 4 && <DeviceStep message={message} onDone={finish} />}
        </div>
      </div>
    </div>
  );
}

/** Tervetulosivu: mitä sovellus tekee, missä tiedot ovat ja miten ne varmuuskopioidaan. PC:llä yhdellä näytöllä. */
function Welcome({ onStart, onImport, onSkip, error }: { onStart: () => void; onImport: () => void; onSkip: () => void; error?: string }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1500px] flex-col px-4 py-5 lg:px-10 lg:py-6">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-lg font-semibold text-slate-900">Liikkumisen seuranta</span>
        <Button variant="ghost" onClick={onSkip}>
          Ohita aloitus
        </Button>
      </div>

      <div className="mt-4 grid flex-1 gap-4 lg:mt-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] lg:gap-6">
        <section className="hero anim-rise flex flex-col justify-between p-7 lg:p-9" aria-labelledby="welcome-title">
          <div className="relative z-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--hero-accent)]">Tervetuloa</p>
            <h1 id="welcome-title" className="mt-3 font-display text-4xl font-semibold leading-[1.05] tracking-tight xl:text-5xl">
              Liikkumisen seuranta
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--hero-ink-soft)]">
              Lapsen ja perheen liikunta yhdessä paikassa. Kirjaa kerrat muutamalla napautuksella ja näe, miten viikko vertautuu suomalaisiin liikkumissuosituksiin.
            </p>
          </div>
          <div className="relative z-10 mt-8 space-y-3">
            <button
              type="button"
              onClick={onStart}
              className="press inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--hero-accent)] px-8 text-base font-bold text-[#1c2b24] shadow-lg hover:brightness-105 sm:w-auto"
            >
              Aloita <span aria-hidden>→</span>
            </button>
            <p className="text-sm text-[var(--hero-ink-soft)]">Aloitus vie muutaman minuutin. Kaiken voi muuttaa myöhemmin Asetuksissa.</p>
            <p className="text-sm text-[var(--hero-ink-soft)]">
              Onko tiedot jo toisella laitteella?{' '}
              <button type="button" onClick={onImport} className="font-semibold text-[var(--hero-ink)] underline underline-offset-2">
                Tuo tiedosto
              </button>
            </p>
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
          </div>
        </section>

        <div className="grid content-start gap-4 sm:grid-cols-2">
          <Info icon="📝" title="Kirjaa ja kuittaa">
            Lisää kerta +-painikkeella. Viikkorytmin harrastukset tulevat valmiiksi, ja kuittaat ne tehdyiksi yhdellä napautuksella.
          </Info>
          <Info icon="📈" title="Vertaa suosituksiin">
            Viikko suhteessa ikäryhmän suositukseen: reipas ja rasittava liikunta sekä lihaksia ja luustoa vahvistavat päivät.
          </Info>
          <Info icon="⚽" title="Jalkapallo valinnaisena">
            Pelikalenteri, tulokset, turnaukset ja päiväkirja, jos lapsi pelaa. Muille lajeille tavallinen kirjaus riittää.
          </Info>
          <Info icon="🔄" title="PC ja puhelin">
            PC on päälaite. Yhteisen pilvikansion kautta laitteet vaihtavat tiedot: puhelimella kirjaat ja painat "Lähetä PC:lle". Yksikin laite riittää.
          </Info>
          <div className="card anim-rise p-5 ring-1 ring-green-700/25 sm:col-span-2">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-lg" aria-hidden>
                🔒
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold leading-tight text-slate-900">Tiedot pysyvät sinulla – varmuuskopioi ne pilveen</h2>
                <p className="mt-1 text-sm leading-snug text-slate-600">
                  Ei tiliä eikä palvelinta: tiedot ovat vain tämän laitteen selaimessa, eikä sovellus lähetä niitä minnekään. Ne katoavat, jos selaimen tiedot tyhjennetään tai laite
                  vaihtuu, joten tee varmuuskopio:
                </p>
                <ol className="mt-3 grid gap-2 text-sm leading-snug text-slate-700 sm:grid-cols-3">
                  <li className="rounded-xl bg-[var(--surface-sunk)] p-3">
                    <span className="block text-xs font-bold text-green-800">1</span>
                    Asetukset → Laitteet ja varmuuskopio → <strong>Vie varmuuskopio</strong>
                  </li>
                  <li className="rounded-xl bg-[var(--surface-sunk)] p-3">
                    <span className="block text-xs font-bold text-green-800">2</span>
                    Tallenna tiedosto <strong>pilvikansioon</strong>: OneDrive, iCloud Drive tai Google Drive
                  </li>
                  <li className="rounded-xl bg-[var(--surface-sunk)] p-3">
                    <span className="block text-xs font-bold text-green-800">3</span>
                    Palauta samasta kohdasta: <strong>Tuo varmuuskopio</strong>, myös uudelle laitteelle
                  </li>
                </ol>
                <p className="mt-2.5 text-xs leading-snug text-slate-500">
                  Kun PC:lle valitaan synkronoinnin pilvikansio, sinne tehdään myös automaattinen varmuuskopio kerran viikossa. Tiedosto sisältää lapsen tietoja: säilytä se omassa
                  pilvessäsi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="card anim-rise p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-sunk)] text-lg" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-tight text-slate-900">{title}</h2>
          <p className="mt-1 text-sm leading-snug text-slate-600">{children}</p>
        </div>
      </div>
    </div>
  );
}

function StepNav({ onNext, label = 'Seuraava' }: { onNext: () => void; label?: string }) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onNext}>
        Ohita
      </Button>
      <Button onClick={onNext}>{label}</Button>
    </div>
  );
}

function Skipped({ text, onNext }: { text: string; onNext: () => void }) {
  return (
    <Card>
      <p className="text-sm text-slate-600">{text}</p>
      <div className="mt-3">
        <StepNav onNext={onNext} />
      </div>
    </Card>
  );
}

function EstimatesStep({ profile, onNext }: { profile: Profile; onNext: () => void }) {
  const types = useLiveQuery(() => repo.listActivityTypes(), []);
  const [values, setValues] = useState<Record<string, { weekday: number; weekend: number }>>(() =>
    Object.fromEntries(ESTIMATE_SUGGESTIONS.map((s) => [s.category, { weekday: 0, weekend: 0 }])),
  );

  async function save() {
    for (const s of ESTIMATE_SUGGESTIONS) {
      const v = values[s.category];
      if (!v.weekday && !v.weekend) continue;
      const shares = types?.find((t) => t.id === activityTypeId(ESTIMATE_DEFAULT_TYPE_KEY[s.category as Category]))?.shares;
      if (shares) await repo.saveEstimate(profile.id, { category: s.category, label: s.label, weekdayMin: v.weekday, weekendMin: v.weekend, shares }, today());
    }
    onNext();
  }

  const slider = (cat: string, k: 'weekday' | 'weekend', label: string) => (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="tabular-nums">{values[cat][k]} min/pv</span>
      </span>
      <input
        type="range"
        min={0}
        max={180}
        step={5}
        value={values[cat][k]}
        onChange={(e) => {
          const n = Number(e.target.value);
          setValues((cur) => ({ ...cur, [cat]: { ...cur[cat], [k]: n } }));
        }}
        className="w-full accent-green-700"
      />
    </label>
  );

  return (
    <Card title="Tavallinen arkiliikkuminen">
      <p className="mb-3 text-sm text-slate-600">
        Arvioi liikkuminen, jota et kirjaa kerta kerralta. Perusarvio täyttää kategorian vain päivinä, joille siinä ei ole kirjauksia, ja se näytetään aina erikseen.
      </p>
      <div className="space-y-4">
        {ESTIMATE_SUGGESTIONS.map((s) => (
          <div key={s.category}>
            <div className="mb-1 text-sm font-medium text-slate-800">{s.label}</div>
            {slider(s.category, 'weekday', 'Arkipäivä (ma–pe)')}
            {slider(s.category, 'weekend', 'Viikonloppu (la–su)')}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <StepNav onNext={save} label="Tallenna ja jatka" />
      </div>
    </Card>
  );
}

function DeviceStep({ message, onDone }: { message?: string; onDone: () => void }) {
  const role = useLiveQuery(() => repo.getDeviceRole(), []);
  return (
    <Card title="Mikä laite tämä on?">
      {message && <p className="mb-3 rounded-xl bg-green-50 p-3 text-sm text-green-900 ring-1 ring-green-200">{message}</p>}
      <p className="mb-2 text-sm text-slate-600">PC on päälaite. Puhelin saa PC:n tilanteen tiedostona ja lähettää omat kirjauksensa takaisin.</p>
      <div className="grid grid-cols-2 gap-2">
        {(['pc', 'phone'] as DeviceRole[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => repo.setDeviceRole(r)}
            aria-pressed={role === r}
            className={`min-h-12 rounded-xl text-sm font-medium ring-1 ${role === r ? 'bg-green-700 text-white ring-green-700' : 'bg-[var(--surface-sunk)] text-slate-800 ring-slate-200'}`}
          >
            {r === 'pc' ? 'PC (päälaite)' : 'Puhelin'}
          </button>
        ))}
      </div>
      <InstallHint />
      <div className="mt-4 flex justify-end">
        <Button onClick={onDone}>Valmis</Button>
      </div>
    </Card>
  );
}

// Ensikäynnistys (SPEC 12, 16): tervetulosivu perustietoineen ja sen jälkeen enintään neljä ohitettavaa
// vaihetta: 1 profiili, 2 viikkopohja, 3 perusarvio, 4 laitteen rooli ja asennusohje.
// "Tuo tiedot" ohittaa vaiheet 1–3 (vahvistettu tulkinta). PC:llä koko näytön levyinen asettelu.

import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { activityTypeId } from '../../domain/ids';
import type { Category, Profile, Weekday } from '../../domain/types';
import type { QuickPrefill } from '../../domain/quickCheck';
import { getQuickPrefill, setQuickPrefill } from '../landing/quickPrefill';
import { useToast } from '../../ui/Toast';
import { mergeAnyFile } from '../../db/backup';
import { repo, type DeviceRole } from '../../db/repositories';
import { db } from '../../db/schema';
import { requestPersistentStorage } from '../../db/storage';
import { ESTIMATE_DEFAULT_TYPE_KEY, estimateSuggestions } from '../../seed/activityTypes';
import { recommendationGroup } from '../../domain/groups';
import { Button, Card } from '../../ui/components';
import { today } from '../../ui/today';
import { ProfileForm } from '../settings/ProfileForm';
import { TemplateSection } from '../settings/TemplateSection';
import { InstallHint } from '../settings/InstallHint';
import { pickTextFile } from '../sync/fileIO';
import { summaryText } from '../sync/useSync';
import { IconCheck, IconImport, IconLock, IconSync } from '../../ui/icons';

type Step = 0 | 1 | 2 | 3 | 4;

const STEPS: { n: Exclude<Step, 0>; title: string; text: string }[] = [
  { n: 1, title: 'Profiili', text: 'Nimi ja syntymävuosi: niistä valitaan ikäryhmän liikkumissuositus.' },
  { n: 2, title: 'Viikkorytmi', text: 'Toistuvat harrastukset ja koululiikunta. Niistä tulee suunniteltuja kertoja, jotka kuittaat viikolla.' },
  { n: 3, title: 'Arkiliikunta', text: 'Arvio päiväkodista, välitunneista, koulumatkoista ja leikistä, joita ei kirjata kerta kerralta.' },
  { n: 4, title: 'Laite', text: 'PC vai puhelin, ja miten sovellus asennetaan kotinäytölle.' },
];

export function Onboarding({ onDone }: { onDone: (profileId?: string) => void }) {
  const [step, setStep] = useState<Step>(0);
  const [profile, setProfile] = useState<Profile>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  // Alkusivun pikatestin vastaukset (vain muistissa): ikä, harrastukset ja arkiliikunta valmiiksi.
  const [prefill] = useState(getQuickPrefill);

  async function finish() {
    setQuickPrefill(undefined);
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

  if (step === 0) return <Welcome onStart={() => setStep(1)} onImport={importFromPc} onSkip={finish} error={error} fromQuiz={!!prefill} />;

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
                    {done ? <IconCheck size="1rem" strokeWidth={2.5} /> : x.n}
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
          {prefill && <QuizNote>Syntymävuosi, koulun aloitusvuosi ja jalkapallo on täytetty pikatestin vastauksista. Lisää nimi ja tarkista tiedot.</QuizNote>}
          <ProfileForm
            wide
            defaults={prefill ? { birthYear: prefill.birthYear, schoolStartYear: prefill.schoolStartYear, football: prefill.football } : undefined}
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
            {prefill && prefill.hobbies.length > 0 && <QuizHobbies profile={profile} hobbies={prefill.hobbies} />}
            <TemplateSection profile={profile} />
            <StepNav onNext={() => setStep(3)} />
          </>
        ) : (
          <Skipped text="Viikkopohja lisätään profiilille. Voit tehdä sen myöhemmin Asetuksissa." onNext={() => setStep(3)} />
        ))}

      {step === 3 &&
        (profile ? (
          <EstimatesStep profile={profile} prefill={prefill?.estimates} onNext={() => setStep(4)} />
        ) : (
          <Skipped text="Perusarviot lisätään profiilille. Voit tehdä sen myöhemmin Asetuksissa." onNext={() => setStep(4)} />
        ))}

      {step === 4 && <DeviceStep message={message} onDone={finish} />}
        </div>
      </div>
    </div>
  );
}

/** Tervetulosivu kutsukoodin jälkeen (18.11.2026, alkusivun ilme): mitä aloituksessa tehdään, Aloita, tiedostontuonti sekä
 *  missä tiedot ovat ja miten ne varmuuskopioidaan. Ominaisuuksia ei esitellä uudelleen, koska alkusivu kertoi ne jo. */
function Welcome({ onStart, onImport, onSkip, error, fromQuiz }: { onStart: () => void; onImport: () => void; onSkip: () => void; error?: string; fromQuiz?: boolean }) {
  return (
    <div className="lp-page">
      <header className="lp-top">
        <div className="lp-wrap flex h-[68px] items-center justify-between gap-4">
          <span className="flex min-w-0 items-center gap-2.5">
            <img src="./favicon.svg" alt="" className="size-[30px] shrink-0" />
            <span className="truncate font-display text-[17px] font-semibold sm:text-[19px]">Liikkumisen seuranta</span>
          </span>
          <button type="button" onClick={onSkip} className="lp-navlink min-h-11 shrink-0 text-[15px] font-semibold text-[var(--lp-ink-2)]">
            Ohita aloitus
          </button>
        </div>
      </header>

      <div className="lp-wrap grid gap-10 pb-12 pt-10 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-[900px]:gap-16 min-[900px]:pb-10 min-[900px]:pt-12">
        <section className="anim-rise" aria-labelledby="welcome-title">
          <p className="text-sm font-bold text-[var(--lp-kicker)]">Tervetuloa</p>
          <h1 id="welcome-title" className="mt-2 font-display text-[clamp(34px,4vw,50px)] font-medium leading-[1.08] tracking-[-0.015em]">
            Aloitetaan lapsen tiedoista.
          </h1>
          <p className="mt-4 max-w-[34em] text-[17px] leading-relaxed text-[var(--lp-ink-2)]">
            {fromQuiz
              ? 'Pikatestin vastaukset ovat valmiina: ikä, harrastukset ja arkiliikunta. Tarkistat ne vaiheissa.'
              : 'Aloitus vie muutaman minuutin. Vaiheet voi ohittaa ja kaiken voi muuttaa myöhemmin Asetuksissa.'}
          </p>
          <ol className="mt-7 max-w-[34em] border-t border-[var(--lp-line)]" aria-label="Aloituksen vaiheet">
            {STEPS.map((x) => (
              <li key={x.n} className="flex gap-4 border-b border-[var(--lp-line)] py-3 min-[900px]:py-2.5">
                <span className="w-4 shrink-0 font-display text-lg font-medium leading-6 text-[var(--lp-kicker)]">{x.n}</span>
                <span className="min-w-0">
                  <b className="block text-[15px] font-bold leading-6">{x.title}</b>
                  <span className="block text-sm leading-snug text-[var(--lp-ink-2)]">{x.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <button type="button" onClick={onStart} className="lp-btn lp-btn-dark press mt-7 h-[54px] w-full px-12 text-base font-bold sm:w-auto">
            Aloita
          </button>

          <div className="mt-9 max-w-[34em] border-t border-[var(--lp-line)] pt-5">
            <p className="text-sm font-bold text-[var(--lp-ink-2)]">Onko tiedot jo toisella laitteella?</p>
            <button type="button" onClick={onImport} className="lp-btn lp-btn-line press mt-3 h-12 w-full px-5 text-[15px] sm:w-auto">
              <IconImport size="1.15rem" />
              Tuo tiedosto
            </button>
            <p className="mt-2.5 text-sm text-[var(--lp-ink-3)]">PC:n synkronointitiedosto tai varmuuskopio. Tiedot siirtyvät tälle laitteelle.</p>
            {error && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900" role="alert">
                {error}
              </p>
            )}
          </div>
        </section>

        <aside className="anim-rise self-start rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-raised)] p-6 sm:p-8" aria-labelledby="welcome-data">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--lp-paper-2)] text-[var(--lp-kicker)]" aria-hidden>
            <IconLock size="1.15rem" />
          </span>
          <h2 id="welcome-data" className="mt-4 font-display text-[26px] font-medium leading-tight">
            Tiedot pysyvät sinulla
          </h2>
          <p className="mt-3 leading-relaxed text-[var(--lp-ink-2)]">
            Ei tiliä eikä palvelinta: tiedot ovat vain tämän laitteen selaimessa, eikä ohjelma lähetä niitä minnekään. Ne katoavat, jos selaimen tiedot tyhjennetään tai laite vaihtuu,
            joten tee varmuuskopio.
          </p>
          <ol className="mt-5 border-t border-[var(--lp-line)] text-[15px] leading-snug text-[var(--lp-ink-2)]" aria-label="Varmuuskopion teko">
            {[
              <>
                Asetukset → Laitteet ja varmuuskopio → <strong className="text-[var(--lp-ink)]">Vie varmuuskopio</strong>
              </>,
              <>
                Tallenna tiedosto <strong className="text-[var(--lp-ink)]">pilvikansioon</strong>: OneDrive, iCloud Drive tai Google Drive
              </>,
              <>
                Palauta samasta kohdasta: <strong className="text-[var(--lp-ink)]">Tuo varmuuskopio</strong>, myös uudelle laitteelle
              </>,
            ].map((t, i) => (
              <li key={i} className="flex gap-4 border-b border-[var(--lp-line)] py-3">
                <span className="w-4 shrink-0 font-display text-lg font-medium leading-5 text-[var(--lp-kicker)]">{i + 1}</span>
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ol>
          <h3 className="mt-7 flex items-center gap-2 text-[15px] font-bold">
            <IconSync size="1.05rem" className="text-[var(--lp-kicker)]" />
            PC ja puhelin
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--lp-ink-2)]">
            PC on päälaite. Yhteisen pilvikansion kautta laitteet vaihtavat tiedot: puhelimella kirjaat ja painat "Lähetä PC:lle". Yksikin laite riittää.
          </p>
          <p className="mt-5 text-[13px] leading-snug text-[var(--lp-ink-3)]">
            Kun PC:lle valitaan synkronoinnin pilvikansio, sinne tehdään myös automaattinen varmuuskopio kerran viikossa. Tiedosto sisältää lapsen tietoja, joten säilytä se omassa
            pilvessäsi.
          </p>
        </aside>
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

function EstimatesStep({ profile, prefill, onNext }: { profile: Profile; prefill?: QuickPrefill['estimates']; onNext: () => void }) {
  const types = useLiveQuery(() => repo.listActivityTypes(), []);
  // Alle kouluikäiselle päiväkotipäivä ja leikki; koululaiselle välitunnit, koulumatkat ja leikki.
  const suggestions = estimateSuggestions(recommendationGroup(profile, today()));
  const [values, setValues] = useState<Record<string, { weekday: number; weekend: number }>>(() =>
    Object.fromEntries(
      suggestions.map((s) => {
        const p = prefill?.find((x) => x.category === s.category);
        return [s.category, p ? { weekday: p.weekdayMin, weekend: p.weekendMin } : { weekday: s.weekdayMin ?? 0, weekend: 0 }];
      }),
    ),
  );

  async function save() {
    for (const s of suggestions) {
      const v = values[s.category];
      if (!v.weekday && !v.weekend) continue;
      // Pikatestin arvio tuo oman lajinsa (esim. pyöräily kouluun), muuten kategorian oletuslaji.
      const key = prefill?.find((x) => x.category === s.category)?.typeKey ?? ESTIMATE_DEFAULT_TYPE_KEY[s.category as Category];
      const shares = types?.find((t) => t.id === activityTypeId(key))?.shares;
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
      {prefill && <QuizNote>Arvot on täytetty pikatestin vastauksista. Tarkista ne.</QuizNote>}
      <p className="mb-3 text-sm text-slate-600">
        Arvioi liikkuminen, jota et kirjaa kerta kerralta. Perusarvio täyttää kategorian vain päivinä, joille siinä ei ole kirjauksia, ja se näytetään aina erikseen.
      </p>
      <div className="space-y-4">
        {suggestions.map((s) => (
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

function QuizNote({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 flex items-start gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-900 ring-1 ring-green-200">
      <span>{children}</span>
    </p>
  );
}

const DAY_LABELS = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];
/** Ehdotetut treenipäivät kertamäärän mukaan; käyttäjä vaihtaa ne ennen lisäämistä. */
const SUGGESTED_DAYS: Record<number, Weekday[]> = { 1: [2], 2: [2, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7] };

/** Pikatestin harrastukset viikkorytmiin: valitse päivät ja lisää. */
function QuizHobbies({ profile, hobbies }: { profile: Profile; hobbies: QuickPrefill['hobbies'] }) {
  const toast = useToast();
  const [days, setDays] = useState<Weekday[][]>(() => hobbies.map((h) => SUGGESTED_DAYS[Math.min(7, Math.max(1, h.perWeek))]));
  const [added, setAdded] = useState<boolean[]>(() => hobbies.map(() => false));

  async function add(i: number) {
    const h = hobbies[i];
    if (days[i].length === 0) return;
    await repo.createTemplateItem(
      profile.id,
      { activityTypeId: activityTypeId(h.typeKey), weekdays: [...days[i]].sort(), durationMin: h.minutes, validFrom: today(), note: '', label: '' },
      today(),
    );
    setAdded((a) => a.map((x, j) => (j === i ? true : x)));
    toast(`${h.label} lisätty viikkorytmiin`, undefined, 'success');
  }

  return (
    <Card title="Pikatestin harrastukset">
      <p className="text-sm text-slate-600">Valitse treenipäivät, niin harrastus tulee joka viikolle valmiiksi kuitattavaksi. Kellonajan voi lisätä myöhemmin.</p>
      <ul className="mt-3 space-y-3">
        {hobbies.map((h, i) => (
          <li key={h.typeKey + i} className="rounded-2xl bg-[var(--surface-sunk)] p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-900">
                {h.icon} {h.label} <span className="text-sm font-normal text-slate-600">· {h.perWeek} × {h.minutes} min viikossa</span>
              </span>
              {added[i] ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-700 px-3 py-1 text-xs font-bold text-white">
                  <IconCheck size="0.8rem" strokeWidth={3} /> Lisätty
                </span>
              ) : h.typeKey === 'other' ? null : (
                <Button onClick={() => add(i)} disabled={days[i].length === 0}>
                  Lisää viikkorytmiin
                </Button>
              )}
            </div>
            {h.typeKey === 'other' && (
              <p className="mt-1.5 text-sm text-slate-600">Lisää tämä alta kohdasta "+ Lisää" ja valitse oikea laji, niin teho vastaa lajia.</p>
            )}
            {!added[i] && h.typeKey !== 'other' && (
              <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label={`${h.label}: treenipäivät`}>
                {DAY_LABELS.map((l, d) => {
                  const wd = (d + 1) as Weekday;
                  const on = days[i].includes(wd);
                  return (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDays((all) => all.map((x, j) => (j === i ? (on ? x.filter((y) => y !== wd) : [...x, wd]) : x)))}
                      className={`min-h-10 min-w-11 rounded-xl text-sm font-semibold ring-1 ${on ? 'bg-green-700 text-white ring-green-700' : 'bg-[var(--surface-raised)] text-slate-700 ring-slate-200'}`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

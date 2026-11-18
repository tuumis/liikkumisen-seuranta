// Alkusivun pikatesti (18.11.2026): muutama nopea kysymys ja karkea arvio suhteessa liikkumissuositukseen.
// Lopuksi kehotus pyytää kutsukoodi; vastaukset esitäyttävät ohjelman aloituksen (vain muistissa).

import { useState, type ReactNode } from 'react';
import { computeQuick, prefillFromQuick, QUICK_HOBBIES, quickGroup, schoolQuestionNeeded, type Commute, type HobbyKey, type Level, type QuickAnswers, type QuickResult } from '../../domain/quickCheck';
import { RECOMMENDATIONS } from '../../domain/recommendations';
import { today } from '../../ui/today';
import { setQuickPrefill } from './quickPrefill';
import { IconCheck, IconClose } from '../../ui/icons';

type StepId = 'age' | 'school' | 'daycare' | 'hobbies' | 'commute' | 'recess' | 'play' | 'vigorous' | 'strength';

const START: QuickAnswers = { age: 0, hobbies: [], commute: 'car', commuteMin: 0, recess: 1, daycare: true, play: 1, vigorousDays: 0, strengthDays: 0 };

function stepsFor(a: QuickAnswers, month: number): StepId[] {
  if (!a.age) return ['age'];
  const head: StepId[] = schoolQuestionNeeded(a.age, month) ? ['age', 'school'] : ['age'];
  if (quickGroup(a.age, a.inSchool) === 'school_age') return [...head, 'hobbies', 'commute', 'recess', 'play', 'vigorous', 'strength'];
  return a.daycare ? [...head, 'daycare', 'hobbies', 'commute', 'play'] : [...head, 'daycare', 'hobbies', 'play'];
}

/** Kuluva vuosi ja kuukausi (koulukysymys ja syntymävuosi). */
function nowYm(): [number, number] {
  const t = today();
  return [Number(t.slice(0, 4)), Number(t.slice(5, 7))];
}

const MINUTES = [30, 45, 60, 75, 90, 120];

/** intro = otsikko ja esittely: kysymysten aikana vierellä (PC), tuloksen aikana yläpuolella. */
export function QuickTest({ intro, invite }: { intro: ReactNode; invite: ReactNode }) {
  const [a, setA] = useState<QuickAnswers>(START);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<QuickResult>();
  const [year, month] = nowYm();
  const steps = stepsFor(a, month);
  const id = steps[step];
  const school = a.age ? quickGroup(a.age, a.inSchool) === 'school_age' : true;
  // Kysymysten määrä näytetään vasta, kun ikä tiedetään (koululaisella 7, pienemmällä 4–5).
  const total = a.age ? steps.length : 7;

  function next(patch: Partial<QuickAnswers> = {}) {
    const n = { ...a, ...patch };
    setA(n);
    const s = stepsFor(n, month);
    if (step + 1 >= s.length) {
      setResult(computeQuick(n));
      setQuickPrefill(prefillFromQuick(n, year, month));
    } else setStep(step + 1);
  }

  function restart() {
    setA(START);
    setStep(0);
    setResult(undefined);
    setQuickPrefill(undefined);
  }

  if (result)
    return (
      <>
        {intro}
        <div className="mt-6">
          <Result r={result} invite={invite} onRestart={restart} />
        </div>
      </>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)] lg:items-start lg:gap-12">
    {intro}
    <div className="card overflow-hidden p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-green-700' : 'bg-slate-200'}`} />
          ))}
        </div>
        <span className="text-xs font-semibold tabular-nums text-slate-500">
          {step + 1}/{total}
        </span>
      </div>

      <div key={id} className="lp-caption mt-5">
        {id === 'age' && (
          <Question title="Kuinka vanha lapsi on?" hint="Ikä valitsee suosituksen: alle kouluikäisillä kaikki liikkuminen, koululaisilla reipas ja rasittava liikunta.">
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9">
              {Array.from({ length: 17 }, (_, i) => i + 1).map((n) => (
                <Choice key={n} on={a.age === n} onClick={() => next({ age: n, inSchool: undefined })} compact>
                  {n}
                </Choice>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">vuotta</p>
          </Question>
        )}

        {id === 'school' && (
          <Question title="Käykö lapsi jo koulua?" hint="Koulu alkaa elokuussa sinä vuonna, jona lapsi täyttää 7. Se ratkaisee, kumpaa suositusta käytetään.">
            <Options>
              <Choice on={a.inSchool === true} onClick={() => next({ inSchool: true })}>
                Kyllä, koulussa
              </Choice>
              <Choice on={a.inSchool === false} onClick={() => next({ inSchool: false })}>
                Ei vielä (esikoulu tai päiväkoti)
              </Choice>
            </Options>
          </Question>
        )}

        {id === 'daycare' && (
          <Question title="Onko lapsi päiväkodissa arkisin?">
            <Options>
              <Choice on={false} onClick={() => next({ daycare: true })}>
                Kyllä, päiväkodissa tai perhepäivähoidossa
              </Choice>
              <Choice on={!a.daycare} onClick={() => next({ daycare: false })}>
                Ei, hoidossa kotona
              </Choice>
            </Options>
          </Question>
        )}

        {id === 'hobbies' && <HobbiesStep a={a} onNext={(hobbies) => next({ hobbies })} />}

        {id === 'commute' && <CommuteStep school={school} a={a} onNext={(commute, commuteMin) => next({ commute, commuteMin })} />}

        {id === 'recess' && (
          <Question title="Mitä lapsi tekee välitunneilla?">
            <Options>
              {(['Enimmäkseen paikallaan', 'Liikkuu jonkin verran', 'Leikkii, juoksee ja pelaa'] as const).map((t, i) => (
                <Choice key={t} on={false} onClick={() => next({ recess: i as Level })}>
                  {t}
                </Choice>
              ))}
            </Options>
          </Question>
        )}

        {id === 'play' && (
          <Question
            title="Paljonko lapsi leikkii ja touhuaa vapaa-ajalla tavallisena päivänä?"
            hint="Ulkoleikit, pihapelit, pyöräily, trampoliini ja muu oma liikkuminen. Ei ohjattuja harrastuksia."
          >
            <Options>
              {(school ? ['Alle puoli tuntia', 'Noin tunnin', 'Pari tuntia tai enemmän'] : a.daycare ? ['Alle tunnin', '1–2 tuntia', 'Yli 2 tuntia'] : ['Alle 2 tuntia', '2–3 tuntia', 'Yli 3 tuntia']).map((t, i) => (
                <Choice key={t} on={false} onClick={() => next({ play: i as Level })}>
                  {t}
                </Choice>
              ))}
            </Options>
          </Question>
        )}

        {id === 'vigorous' && (
          <Question title="Monenako päivänä viikossa lapsi hengästyy ja hikoilee kunnolla?" hint="Harrastukset mukaan lukien: esim. pallopelit, juoksuleikit, uinti.">
            <DayPicker onPick={(n) => next({ vigorousDays: n })} />
          </Question>
        )}

        {id === 'strength' && (
          <Question title="Monenako päivänä viikossa lapsi hyppii, juoksee tai kiipeilee?" hint="Nämä vahvistavat lihaksia ja luustoa: trampoliini, kiipeilytelineet, pallopelit, voimistelu.">
            <DayPicker onPick={(n) => next({ strengthDays: n })} />
          </Question>
        )}
      </div>

      {step > 0 && (
        <button type="button" onClick={() => setStep(step - 1)} className="mt-5 text-sm font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline">
          Edellinen
        </button>
      )}
    </div>
    </div>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="font-display text-xl font-semibold leading-snug text-slate-900 sm:text-2xl">{title}</legend>
      {hint && <p className="mt-1.5 text-sm leading-snug text-slate-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}

function Options({ children }: { children: ReactNode }) {
  return <div className="grid gap-2">{children}</div>;
}

function Choice({ on, onClick, children, compact }: { on: boolean; onClick: () => void; children: ReactNode; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`press min-h-12 rounded-2xl font-semibold ring-1 transition-colors ${compact ? 'px-0 text-base tabular-nums' : 'px-4 text-left text-[15px]'} ${
        on ? 'bg-green-700 text-white ring-green-700' : 'bg-[var(--surface-sunk)] text-slate-800 ring-slate-200 hover:ring-green-700'
      }`}
    >
      {children}
    </button>
  );
}

function DayPicker({ onPick }: { onPick: (n: number) => void }) {
  return (
    <>
      <div className="grid grid-cols-8 gap-1.5">
        {Array.from({ length: 8 }, (_, n) => (
          <Choice key={n} on={false} onClick={() => onPick(n)} compact>
            {n}
          </Choice>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">päivänä viikossa</p>
    </>
  );
}

function HobbiesStep({ a, onNext }: { a: QuickAnswers; onNext: (h: QuickAnswers['hobbies']) => void }) {
  const [sel, setSel] = useState(a.hobbies);
  const toggle = (key: HobbyKey) =>
    setSel((s) => (s.some((h) => h.key === key) ? s.filter((h) => h.key !== key) : s.length >= 3 ? s : [...s, { key, perWeek: 2, minutes: key === 'football' ? 90 : 60 }]));
  const set = (key: HobbyKey, patch: Partial<QuickAnswers['hobbies'][number]>) => setSel((s) => s.map((h) => (h.key === key ? { ...h, ...patch } : h)));

  return (
    <Question title="Onko lapsella ohjattuja harrastuksia?" hint="Valitse enintään kolme ja kerro, kuinka usein ja kauan.">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_HOBBIES.map((h) => {
          const on = sel.some((x) => x.key === h.key);
          return (
            <button
              key={h.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(h.key)}
              className={`press min-h-11 rounded-full px-3.5 text-sm font-semibold ring-1 ${on ? 'bg-green-700 text-white ring-green-700' : 'bg-[var(--surface-sunk)] text-slate-800 ring-slate-200 hover:ring-green-700'}`}
            >
              <span aria-hidden>{h.icon}</span> {h.label}
            </button>
          );
        })}
      </div>
      {sel.length > 0 && (
        <ul className="mt-4 space-y-2">
          {sel.map((h) => {
            const d = QUICK_HOBBIES.find((x) => x.key === h.key)!;
            return (
              <li key={h.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-[var(--surface-sunk)] p-3">
                <span className="min-w-0 basis-full text-sm font-semibold text-slate-900 sm:flex-1 sm:basis-auto">
                  {d.icon} {d.label}
                </span>
                <span className="flex items-center gap-1">
                  <Step label={`${d.label}: vähemmän kertoja`} onClick={() => set(h.key, { perWeek: Math.max(1, h.perWeek - 1) })}>
                    −
                  </Step>
                  <span className="w-16 text-center text-sm tabular-nums text-slate-800" aria-live="polite">
                    {h.perWeek} × vko
                  </span>
                  <Step label={`${d.label}: enemmän kertoja`} onClick={() => set(h.key, { perWeek: Math.min(7, h.perWeek + 1) })}>
                    +
                  </Step>
                </span>
                <label className="flex items-center gap-1.5 text-sm text-slate-700">
                  <span className="sr-only">{d.label}: kesto</span>
                  <select
                    value={h.minutes}
                    onChange={(e) => set(h.key, { minutes: Number(e.target.value) })}
                    className="min-h-10 rounded-xl border-0 bg-[var(--surface-raised)] px-2.5 text-sm text-slate-900 ring-1 ring-slate-200"
                  >
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onNext(sel)}
          disabled={sel.length === 0}
          className="press min-h-12 rounded-full bg-green-700 px-6 font-bold text-white shadow disabled:opacity-40"
        >
          Seuraava
        </button>
        <button type="button" onClick={() => onNext([])} className="press min-h-12 rounded-full px-4 font-semibold text-slate-600 ring-1 ring-slate-200 hover:text-slate-900">
          Ei ohjattuja harrastuksia
        </button>
      </div>
    </Question>
  );
}

function Step({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="press flex size-9 items-center justify-center rounded-full bg-[var(--surface-raised)] text-lg font-bold text-slate-700 ring-1 ring-slate-200">
      {children}
    </button>
  );
}

function CommuteStep({ school, a, onNext }: { school: boolean; a: QuickAnswers; onNext: (c: Commute, min: number) => void }) {
  const [mode, setMode] = useState<Commute>();
  const where = school ? 'Koulumatka' : 'Päiväkotimatka';
  return (
    <Question title={`Miten ${school ? 'koulu' : 'päiväkoti'}matka kuljetaan?`}>
      <Options>
        <Choice on={false} onClick={() => onNext('car', 0)}>
          Autolla, bussilla tai kyydillä
        </Choice>
        <Choice on={mode === 'walk'} onClick={() => setMode('walk')}>
          Kävellen
        </Choice>
        <Choice on={mode === 'bike'} onClick={() => setMode('bike')}>
          Pyörällä tai potkulaudalla
        </Choice>
      </Options>
      {mode && (
        <div className="lp-caption mt-4">
          <p className="text-sm font-semibold text-slate-800">{where} yhteensä päivässä, molemmat suunnat:</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {[10, 20, 30, 45].map((m) => (
              <Choice key={m} on={a.commuteMin === m && a.commute === mode} onClick={() => onNext(mode, m)} compact>
                {m === 45 ? '45+' : m} min
              </Choice>
            ))}
          </div>
        </div>
      )}
    </Question>
  );
}

const STATUS: Record<QuickResult['status'], { text: string; cls: string }> = {
  meets: { text: 'Suositus näyttää täyttyvän', cls: 'bg-green-100 text-green-900 ring-green-300' },
  near: { text: 'Lähellä suositusta', cls: 'bg-amber-100 text-amber-950 ring-amber-300' },
  below: { text: 'Alle suosituksen', cls: 'bg-rose-100 text-rose-950 ring-rose-300' },
};

function Result({ r, invite, onRestart }: { r: QuickResult; invite: ReactNode; onRestart: () => void }) {
  const school = r.group === 'school_age';
  const scale = Math.max(r.headlineTarget * 1.25, r.headline);
  const st = STATUS[r.status];
  const parts = r.parts.filter((p) => p.shown > 0);
  const source = school ? RECOMMENDATIONS.school_age.mvpaAvgMinPerDay.source.title : RECOMMENDATIONS.early_years.totalMinPerDay.source.title;

  return (
    <div className="lp-caption grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="card p-5 sm:p-7" role="status" aria-live="polite">
        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ring-1 ${st.cls}`}>{st.text}</span>
        <p className="mt-4 flex items-baseline gap-2 text-slate-900">
          <span className="text-lg font-semibold">noin</span>
          <span className="font-display text-6xl font-semibold tabular-nums leading-none">{r.headline}</span>
          <span className="text-lg font-semibold">min</span>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {r.headlineLabel} · suositus vähintään {r.headlineTarget} min
        </p>
        <div className="relative mt-4 h-3 rounded-full bg-slate-200" aria-hidden>
          <div className="absolute inset-y-0 left-0 rounded-full bg-green-700" style={{ width: `${Math.min(100, (r.headline / scale) * 100)}%` }} />
          <div className="absolute -inset-y-1 w-0.5 rounded bg-slate-900" style={{ left: `${(r.headlineTarget / scale) * 100}%` }} />
        </div>

        <h3 className="mt-6 text-sm font-bold text-slate-900">Mistä arvio koostuu</h3>
        {/* Käyttäjän kysymys 18.11.2026: "mitä tuo 7 min/pv harrastusta oikein tarkoittaa". Luvut ovat viikon keskiarvoja ja vain liikkumisen osuus. */}
        <p className="mt-1 text-xs leading-snug text-slate-500">
          Viikon keskiarvo päivää kohden: viikon minuutit jaettuna seitsemälle päivälle, myös viikonloput. Mukana on vain arvioitu{' '}
          {r.group === 'school_age' ? 'reippaan ja rasittavan liikunnan' : 'liikkumisen'} osuus, ei koko kestoa.
        </p>
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {parts.map((p) => (
            <li key={p.key} className="flex items-start justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block text-slate-700">{p.label}</span>
                <span className="block text-xs leading-snug text-slate-500">{p.basis}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap tabular-nums font-semibold text-slate-900">{p.shown} min/pv</span>
            </li>
          ))}
        </ul>

        <ul className="mt-4 space-y-1.5 text-sm">
          {r.checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${c.ok ? 'bg-green-700 text-white' : 'bg-slate-200 text-slate-600'}`} aria-hidden>
                {c.ok ? <IconCheck size="0.75rem" strokeWidth={3} /> : <IconClose size="0.7rem" strokeWidth={2.5} />}
              </span>
              <span className="flex-1 text-slate-700">{c.label}</span>
              <span className="tabular-nums font-semibold text-slate-900">
                {c.done} / {c.target}
              </span>
            </li>
          ))}
        </ul>

        {r.tips.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-bold text-slate-900">Helppoja lisäyksiä</h3>
            <ul className="mt-2 space-y-2 text-sm leading-snug text-slate-700">
              {r.tips.map((t) => (
                <li key={t.text} className="flex gap-2 rounded-xl bg-[var(--surface-sunk)] p-3">
                  <span aria-hidden>💡</span>
                  {t.text}
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-5 text-xs leading-snug text-slate-500">
          Karkea arvio vastaustesi perusteella, ei mittaus. Muistinvarainen arvio menee helposti yläkanttiin.{' '}
          {school ? 'Koulun liikuntatunneiksi oletetaan 2 × 45 min viikossa. ' : ''}Lajien teho on ohjelman oma arvio. Suositus: {source}.
        </p>
        <button type="button" onClick={onRestart} className="mt-3 text-sm font-semibold text-green-800 underline underline-offset-2">
          Tee testi uudelleen
        </button>
      </div>

      <div className="lp-hero flex flex-col justify-center rounded-[1.75rem] p-6 sm:p-8">
        <div className="relative z-10">
          <h3 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">Näe todellinen viikko</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--hero-ink-soft)]">
            Arvio perustuu muistiin. Ohjelmassa kirjaat kerrat ja näet joka viikko, miten suositus oikeasti täyttyy ja mikä liikunta sitä kerryttää.
          </p>
          <p className="mt-3 flex gap-2 text-sm text-[var(--hero-ink)]">
            Vastauksesi tulevat valmiiksi ohjelman aloitukseen: ikä, harrastukset ja arkiliikunta.
          </p>
          <div className="mt-5">{invite}</div>
        </div>
      </div>
    </div>
  );
}

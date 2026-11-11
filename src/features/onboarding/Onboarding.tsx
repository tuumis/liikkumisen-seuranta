// Ensikäynnistys (SPEC 12): enintään neljä ohitettavaa näkymää.
// 1 profiili, 2 viikkopohja, 3 perusarvio, 4 laitteen rooli ja asennusohje.
// "Tuo tiedot PC:ltä" ensimmäisellä näkymällä ohittaa vaiheet 1–3 (vahvistettu tulkinta).

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { activityTypeId } from '../../domain/ids';
import type { Category, Profile } from '../../domain/types';
import { mergeSyncFile } from '../../db/backup';
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

type Step = 1 | 2 | 3 | 4;

export function Onboarding({ onDone }: { onDone: (profileId?: string) => void }) {
  const [step, setStep] = useState<Step>(1);
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
      const s = await mergeSyncFile(db, f.text, await repo.deviceId());
      setMessage(`Tiedot tuotu PC:ltä. ${summaryText(s)}.`);
      const first = (await repo.listProfiles())[0];
      if (first) setProfile(first);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-green-800">Liikkumisen seuranta</h1>
          <p className="text-xs text-slate-500">Aloitus · vaihe {step}/4</p>
        </div>
        <Button variant="ghost" onClick={finish}>
          Ohita kaikki
        </Button>
      </div>

      {step === 1 && (
        <Card title="Kenen liikkumista seurataan?">
          <ProfileForm
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
            className={`min-h-12 rounded-xl text-sm font-medium ring-1 ${role === r ? 'bg-green-700 text-white ring-green-700' : 'bg-white text-slate-800 ring-slate-300'}`}
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

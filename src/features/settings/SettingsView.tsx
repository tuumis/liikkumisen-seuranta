import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { recommendationGroup } from '../../domain/groups';
import type { Profile } from '../../domain/types';
import { repo, type DeviceRole } from '../../db/repositories';
import { requestPersistentStorage } from '../../db/storage';
import { Button, Card, EstimateBadge } from '../../ui/components';
import { CATEGORY_LABEL, GROUP_LABEL, MONTHS, MOVEMENT_GROUP_LABEL, pct, STRENGTH_LABEL } from '../../ui/labels';
import { today } from '../../ui/today';
import { ProfileForm, type ProfileFormValues } from './ProfileForm';
import { TemplateSection } from './TemplateSection';
import { EstimatesSection } from './EstimatesSection';
import { ComparisonSection } from './ComparisonSection';
import { BackupSection, PrivacySection, SyncSettingsSection } from './DataSection';
import { InstallHint } from './InstallHint';
import { AppearanceSection } from './AppearanceSection';

export function SettingsView({ profile, onProfileCreated }: { profile?: Profile; onProfileCreated: (id: string) => void }) {
  return (
    <div className="space-y-4 lg:columns-2 lg:gap-6 lg:space-y-0 [&>*]:break-inside-avoid lg:[&>*]:mb-6">
      <ProfilesSection onProfileCreated={onProfileCreated} />
      {profile && <TemplateSection profile={profile} />}
      {profile && <EstimatesSection profile={profile} />}
      <ComparisonSection />
      <ActivityTypesSection />
      <AppearanceSection />
      <DeviceSection />
      <SyncSettingsSection />
      <BackupSection />
      <PrivacySection onCleared={() => window.location.reload()} />
    </div>
  );
}

function ProfilesSection({ onProfileCreated }: { onProfileCreated: (id: string) => void }) {
  const profiles = useLiveQuery(() => repo.listProfiles({ includeArchived: true }), []);
  const [editing, setEditing] = useState<Profile | 'new' | null>(null);

  async function save(v: ProfileFormValues) {
    if (editing === 'new') {
      const p = await repo.createProfile(v);
      void requestPersistentStorage(); // ensimmäisen tallennuksen yhteydessä (SPEC 10)
      onProfileCreated(p.id);
    } else if (editing) {
      await repo.updateProfile(editing.id, v);
    }
    setEditing(null);
  }

  if (editing) {
    return (
      <Card title={editing === 'new' ? 'Uusi profiili' : 'Muokkaa profiilia'}>
        <ProfileForm initial={editing === 'new' ? undefined : editing} onSubmit={save} onCancel={() => setEditing(null)} />
      </Card>
    );
  }

  return (
    <Card
      title="Profiilit"
      action={
        <Button variant="ghost" onClick={() => setEditing('new')}>
          + Lisää
        </Button>
      }
    >
      {profiles?.length === 0 && <p className="text-sm text-slate-600">Ei vielä profiileja. Lisää seurattava henkilö.</p>}
      <ul className="divide-y divide-slate-100">
        {profiles?.map((p) => (
          <li key={p.id} className={`flex items-center gap-3 py-3 ${p.archived ? 'opacity-50' : ''}`}>
            <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-slate-900">
                {p.name} {p.archived && <span className="text-xs font-normal">(arkistoitu)</span>}
              </div>
              <div className="text-xs text-slate-600">
                {MONTHS[p.birthMonth - 1]} {p.birthYear}
                {p.schoolStart && ` · koulu ${p.schoolStart.month}/${p.schoolStart.year}`} ·{' '}
                {GROUP_LABEL[recommendationGroup(p, today())]}
                {p.groupOverride && ' (käsin)'}
              </div>
            </div>
            <Button variant="ghost" className="px-2" onClick={() => setEditing(p)}>
              Muokkaa
            </Button>
            <Button variant="ghost" className="px-2" onClick={() => repo.setProfileArchived(p.id, !p.archived)}>
              {p.archived ? 'Palauta' : 'Arkistoi'}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ActivityTypesSection() {
  const types = useLiveQuery(() => repo.listActivityTypes(), []);
  const [open, setOpen] = useState(false);
  return (
    <Card
      title="Liikkumismuodot"
      action={
        <Button variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Piilota' : `Näytä (${types?.length ?? 0})`}
        </Button>
      }
    >
      <p className="text-sm text-slate-600">
        Tehoprofiilit ovat sovelluksen lähtöoletuksia, eivät virallisia lukuja. Ne kertovat arviolta, kuinka suuri osa kestosta on kevyttä, reipasta ja rasittavaa. Muokkaus tulee myöhemmässä vaiheessa.
      </p>
      {open && (
        <ul className="mt-3 divide-y divide-slate-100">
          {types?.map((t) => (
            <li key={t.id} className="py-3">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden>
                  {t.icon}
                </span>
                <span className="font-medium text-slate-900">{t.name}</span>
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {CATEGORY_LABEL[t.category]} · {MOVEMENT_GROUP_LABEL[t.movementGroup]}
                {t.usesPlayedMinutes && ' · pelatut minuutit'}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700">
                <EstimateBadge />
                <span>kevyt {pct(t.shares.light)}</span>
                <span>reipas {pct(t.shares.moderate)}</span>
                <span>rasittava {pct(t.shares.vigorous)}</span>
                <span>lihas {STRENGTH_LABEL[t.muscleDefault]}</span>
                <span>luusto {STRENGTH_LABEL[t.boneDefault]}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DeviceSection() {
  const role = useLiveQuery(() => repo.getDeviceRole(), []);
  const deviceId = useLiveQuery(() => repo.getMeta<string>('deviceId'), []);
  const [storage, setStorage] = useState<{ persisted?: boolean; usage?: number; quota?: number }>({});

  useEffect(() => {
    const s = navigator.storage;
    if (!s) return;
    void Promise.all([s.persisted?.(), s.estimate?.()]).then(([persisted, est]) =>
      setStorage({ persisted, usage: est?.usage, quota: est?.quota }),
    );
  }, []);

  const mb = (b?: number) => (b === undefined ? '?' : `${(b / 1024 / 1024).toFixed(1)} Mt`);

  return (
    <Card title="Laite">
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Laitteen rooli</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['pc', 'phone'] as DeviceRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => repo.setDeviceRole(r)}
              aria-pressed={role === r}
              className={`min-h-11 rounded-xl text-sm font-medium ring-1 ${role === r ? 'bg-green-700 text-white ring-green-700' : 'bg-white text-slate-800 ring-slate-300'}`}
            >
              {r === 'pc' ? 'PC (päälaite)' : 'Puhelin'}
            </button>
          ))}
        </div>
      </fieldset>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-600">Tallennus</dt>
        <dd className="text-slate-900">
          {storage.persisted === undefined ? 'ei tietoa' : storage.persisted ? 'pysyvä' : 'ei pysyvä (selain voi tyhjentää)'}
        </dd>
        <dt className="text-slate-600">Käytetty tila</dt>
        <dd className="text-slate-900">
          {mb(storage.usage)} / {mb(storage.quota)}
        </dd>
        <dt className="text-slate-600">Laitetunniste</dt>
        <dd className="truncate font-mono text-xs text-slate-900">{deviceId?.slice(0, 8) ?? '…'}</dd>
      </dl>
      {storage.persisted === false && (
        <Button variant="secondary" className="mt-3" onClick={() => requestPersistentStorage().then((p) => setStorage((s) => ({ ...s, persisted: p })))}>
          Pyydä pysyvä tallennus
        </Button>
      )}
      <InstallHint />
    </Card>
  );
}

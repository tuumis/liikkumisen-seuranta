import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { recommendationGroup } from '../../domain/groups';
import type { Profile } from '../../domain/types';
import { repo, type DeviceRole } from '../../db/repositories';
import { requestPersistentStorage } from '../../db/storage';
import { Button, Card } from '../../ui/components';
import { GROUP_LABEL, MONTHS } from '../../ui/labels';
import { today } from '../../ui/today';
import { ProfileForm, type ProfileFormValues } from './ProfileForm';
import { TemplateSection } from './TemplateSection';
import { EstimatesSection } from './EstimatesSection';
import { ComparisonSection } from './ComparisonSection';
import { BackupSection, PrivacySection, SyncSettingsSection } from './DataSection';
import { InstallHint } from './InstallHint';
import { AppearanceSection } from './AppearanceSection';
import { ActivityTypesSection } from './ActivityTypesSection';

export type SettingsSectionId = 'profiles' | 'routine' | 'everyday' | 'goals' | 'devices' | 'appearance' | 'privacy';

const SECTIONS: { id: SettingsSectionId; icon: string; title: string; text: string; needsProfile?: boolean }[] = [
  { id: 'profiles', icon: '👤', title: 'Profiilit', text: 'Lapset ja aikuiset, syntymävuosi ja koulun aloitus' },
  { id: 'routine', icon: '🔁', title: 'Viikkorytmi', text: 'Toistuvat treenit ja koululiikunta, jotka kuitataan viikolla', needsProfile: true },
  { id: 'everyday', icon: '🏫', title: 'Arkiliikunta', text: 'Arvio välitunneista, koulumatkoista ja leikistä', needsProfile: true },
  { id: 'goals', icon: '🎯', title: 'Tavoitteet ja lajit', text: 'Rasittavan päivän raja, pääluku ja lajien tehot' },
  { id: 'devices', icon: '🔄', title: 'Laitteet ja varmuuskopio', text: 'PC ja puhelin, synkronointi, vienti ja tuonti' },
  { id: 'appearance', icon: '🌗', title: 'Ulkoasu', text: 'Vaalea, tumma tai järjestelmän mukaan' },
  { id: 'privacy', icon: '🔒', title: 'Tietosuoja ja poisto', text: 'Mitä tallennetaan ja tietojen poistaminen' },
];

/** Asetukset valikkona: kukin ryhmä avaa oman sivunsa (PC:llä valikko vasemmalla, sisältö oikealla). */
export function SettingsView({
  profile,
  onProfileCreated,
  section,
  onSection,
}: {
  profile?: Profile;
  onProfileCreated: (id: string) => void;
  section?: SettingsSectionId;
  onSection: (s?: SettingsSectionId) => void;
}) {
  const current = SECTIONS.find((x) => x.id === section);
  const menu = (
    <nav aria-label="Asetukset" className="space-y-2">
      {SECTIONS.map((x) => (
        <button
          key={x.id}
          type="button"
          onClick={() => onSection(x.id)}
          aria-current={section === x.id ? 'page' : undefined}
          className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-colors ${section === x.id ? 'bg-green-50 ring-green-200' : 'bg-white ring-slate-200 hover:bg-slate-50'}`}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl" aria-hidden>
            {x.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-slate-900">{x.title}</span>
            <span className="block text-xs text-slate-600">{x.text}</span>
          </span>
          <span className="text-slate-400" aria-hidden>
            ›
          </span>
        </button>
      ))}
    </nav>
  );

  const content = current && (
    <div className="space-y-4">
      <div className="flex items-center gap-2 lg:hidden">
        <Button variant="ghost" className="px-2" onClick={() => onSection(undefined)}>
          ‹ Asetukset
        </Button>
      </div>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <span aria-hidden>{current.icon}</span> {current.title}
      </h2>
      {current.needsProfile && !profile ? (
        <Card>Lisää ensin profiili kohdassa Profiilit.</Card>
      ) : (
        <SectionContent id={current.id} profile={profile} onProfileCreated={onProfileCreated} />
      )}
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
      <div className={`lg:col-span-4 lg:block ${current ? 'hidden' : ''}`}>{menu}</div>
      <div className="lg:col-span-8">
        {content ?? (
          <p className="hidden rounded-2xl bg-white p-6 text-sm text-slate-600 ring-1 ring-slate-200 lg:block">Valitse asetusryhmä vasemmalta.</p>
        )}
      </div>
    </div>
  );
}

function SectionContent({ id, profile, onProfileCreated }: { id: SettingsSectionId; profile?: Profile; onProfileCreated: (id: string) => void }) {
  switch (id) {
    case 'profiles':
      return <ProfilesSection onProfileCreated={onProfileCreated} />;
    case 'routine':
      return <TemplateSection profile={profile!} />;
    case 'everyday':
      return <EstimatesSection profile={profile!} />;
    case 'goals':
      return (
        <>
          <ComparisonSection />
          <ActivityTypesSection />
        </>
      );
    case 'devices':
      return (
        <>
          <DeviceSection />
          <SyncSettingsSection />
          <BackupSection />
        </>
      );
    case 'appearance':
      return <AppearanceSection />;
    case 'privacy':
      return <PrivacySection onCleared={() => window.location.reload()} />;
  }
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

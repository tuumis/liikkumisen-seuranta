import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { recommendationGroup } from '../../domain/groups';
import type { Profile } from '../../domain/types';
import { repo, type DeviceRole } from '../../db/repositories';
import { requestPersistentStorage } from '../../db/storage';
import { Avatar } from '../../ui/Avatar';
import { IconChevronRight, IconContrast, IconDevices, IconLock, IconRepeat, IconSun, IconTarget, IconUser } from '../../ui/icons';
import { Button, Card } from '../../ui/components';
import { GROUP_LABEL, MONTHS } from '../../ui/labels';
import { today } from '../../ui/today';
import { ProfileForm, type ProfileFormValues } from './ProfileForm';
import { TemplateSection } from './TemplateSection';
import { EstimatesSection } from './EstimatesSection';
import { ComparisonSection } from './ComparisonSection';
import { BackupSection, PrivacySection, SyncSettingsSection } from './DataSection';
import { InstallHint } from './InstallHint';
import { DesktopSection } from './DesktopSection';
import { AppearanceSection } from './AppearanceSection';
import { ActivityTypesSection } from './ActivityTypesSection';

export type SettingsSectionId = 'profiles' | 'routine' | 'everyday' | 'goals' | 'devices' | 'appearance' | 'privacy';

export const SETTINGS_SECTIONS: { id: SettingsSectionId; Icon: typeof IconUser; title: string; text: string; needsProfile?: boolean }[] = [
  { id: 'profiles', Icon: IconUser, title: 'Profiilit', text: 'Lapset ja aikuiset, syntymävuosi ja koulun aloitus' },
  { id: 'routine', Icon: IconRepeat, title: 'Viikkorytmi', text: 'Toistuvat treenit ja koululiikunta, jotka kuitataan viikolla', needsProfile: true },
  { id: 'everyday', Icon: IconSun, title: 'Arkiliikunta', text: 'Arvio välitunneista, koulumatkoista ja leikistä', needsProfile: true },
  { id: 'goals', Icon: IconTarget, title: 'Tavoitteet ja lajit', text: 'Rasittavan päivän raja, pääluku ja lajien tehot' },
  { id: 'devices', Icon: IconDevices, title: 'Laitteet ja varmuuskopio', text: 'PC ja puhelin, synkronointi, ilmoitukset, vienti ja tuonti' },
  { id: 'appearance', Icon: IconContrast, title: 'Ulkoasu', text: 'Vaalea, tumma tai järjestelmän mukaan' },
  { id: 'privacy', Icon: IconLock, title: 'Tietosuoja ja poisto', text: 'Mitä tallennetaan ja tietojen poistaminen' },
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
  const current = SETTINGS_SECTIONS.find((x) => x.id === section);
  // PC:llä (valikko ja sisältö rinnakkain) avataan suoraan ensimmäinen ryhmä tyhjän tilan sijaan.
  useEffect(() => {
    if (!section && window.matchMedia?.('(min-width: 1024px)').matches) onSection('profiles');
  }, [section, onSection]);
  const menu = (
    <nav aria-label="Asetukset" className="space-y-2">
      {SETTINGS_SECTIONS.map((x, i) => (
        <button
          key={x.id}
          type="button"
          onClick={() => onSection(x.id)}
          aria-current={section === x.id ? 'page' : undefined}
          className={`press anim-rise flex w-full items-center gap-3 rounded-[1.4rem] p-3 text-left transition-[background-color,box-shadow] ${
            section === x.id ? 'bg-green-700 text-white shadow-[0_10px_24px_-12px_rgb(var(--accent-rgb)/0.8)]' : 'card card-interactive'
          }`}
          style={{ ['--i' as string]: i }}
        >
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${section === x.id ? 'bg-white/15 text-white' : 'bg-[var(--surface-sage)] text-green-800'}`}
            aria-hidden
          >
            <x.Icon size="1.3rem" />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block font-semibold ${section === x.id ? 'text-white' : 'text-slate-900'}`}>{x.title}</span>
            <span className={`block text-xs leading-snug ${section === x.id ? 'text-white/75' : 'text-slate-500'}`}>{x.text}</span>
          </span>
          <IconChevronRight className={section === x.id ? 'text-white/70' : 'text-slate-400'} />
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
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-900">
        <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--surface-sage)] text-green-800" aria-hidden>
          <current.Icon size="1.15rem" />
        </span>
        {current.title}
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
      <div className={`lg:col-span-4 lg:block 2xl:col-span-3 ${current ? 'hidden' : ''}`}>{menu}</div>
      <div className="lg:col-span-8 2xl:col-span-9">
        {content ?? (
          <p className="hidden card p-6 text-sm text-slate-600 lg:block">Valitse asetusryhmä vasemmalta.</p>
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
          <DesktopSection />
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
            <Avatar name={p.name} photo={p.photo} color={p.color} size="md" />
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
              className={`min-h-11 rounded-xl text-sm font-medium ring-1 ${role === r ? 'bg-green-700 text-white ring-green-700' : 'bg-[var(--surface-sunk)] text-slate-800 ring-slate-200'}`}
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

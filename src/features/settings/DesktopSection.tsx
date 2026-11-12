// Asetukset → Laitteet: työpöytätila (SPEC 16) – asennus, sovelluskuvakkeen merkki, ilmoitukset, automaattinen synkronointi.

import { useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo } from '../../db/repositories';
import { Button, Card, inputClass } from '../../ui/components';
import { notificationsSupported, showNotification, useDesktopSettings, useInstallPrompt } from '../desktop/settings';
import { autoSyncReady } from '../sync/useSync';
import { isStandalone } from './InstallHint';

function Switch({ on, onChange, label, text, disabled, children }: { on: boolean; onChange: (v: boolean) => void; label: string; text?: string; disabled?: boolean; children?: ReactNode }) {
  return (
    <div className={`py-3 ${disabled ? 'opacity-55' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          {text && <div className="mt-0.5 text-xs leading-snug text-slate-500">{text}</div>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          disabled={disabled}
          onClick={() => onChange(!on)}
          className={`press relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-green-700' : 'bg-[var(--surface-sunk)] shadow-[inset_0_0_0_1px_var(--line)]'}`}
        >
          <span className={`absolute left-1 size-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-5' : ''}`} aria-hidden />
        </button>
      </div>
      {children && on && !disabled && <div className="mt-2">{children}</div>}
    </div>
  );
}

const SYNC_STATUS: Record<string, string> = {
  ok: 'Kansion käyttölupa on voimassa – synkronointi toimii automaattisesti.',
  'no-folder': 'Valitse ensin synkronointikansio painamalla sivupalkin "Synkronoi" (kapeassa ikkunassa Viikko-sivulla).',
  'no-permission': 'Kansion käyttölupa pitää vahvistaa: paina kerran sivupalkin "Synkronoi". Jos selain tarjoaa vaihtoehdon "Salli aina", lupa säilyy myös uudelleenkäynnistyksen jälkeen.',
  unsupported: 'Tämä selain ei tue kansion käsittelyä (käytä Chromea tai Edgeä).',
};

export function DesktopSection() {
  const [s, set] = useDesktopSettings();
  const install = useInstallPrompt();
  const role = useLiveQuery(() => repo.getDeviceRole(), []);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => (notificationsSupported() ? Notification.permission : 'unsupported'));
  const [syncStatus, setSyncStatus] = useState<string>();
  const installed = isStandalone();

  useEffect(() => {
    if (role !== 'pc') return;
    void autoSyncReady().then(setSyncStatus);
  }, [role]);

  async function toggleNotify(on: boolean) {
    if (!on) return set({ notify: false });
    if (!notificationsSupported()) return;
    const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    setPermission(p);
    set({ notify: p === 'granted' });
  }

  return (
    <Card title="Työpöytätila">
      <p className="text-sm text-slate-600">
        Pidä sovellus auki omassa ikkunassaan (myös pienennettynä tehtäväpalkissa): kuvakkeeseen tulee kuittaamattomien määrä, ilmoitukset muistuttavat kuittaamisesta ja PC synkronoi puhelimen kanssa itsestään.
      </p>

      <div className="mt-4 card-sunk p-3 text-xs leading-relaxed text-slate-700">
        {installed ? (
          <p>
            <strong className="text-green-800">Asennettu omaksi sovellukseksi.</strong> Kiinnitä tehtäväpalkkiin: hiiren oikea painike kuvakkeen päällä → "Kiinnitä tehtäväpalkkiin". Käynnistys automaattisesti:
            Edgessä edge://apps → sovelluksen valikko → "Käynnistä, kun kirjaudun sisään" (Chromessa chrome://apps).
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1">
              <strong>Asenna omaksi sovellukseksi</strong>, niin se aukeaa omaan ikkunaansa ja kuvakkeen merkki toimii.
              {!install && ' Edgessä tai Chromessa: osoiterivin "Asenna"-kuvake tai valikko → Sovellukset → "Asenna tämä sivusto sovelluksena".'}
            </p>
            {install && (
              <Button onClick={() => void install()} className="shrink-0">
                Asenna sovellus
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 divide-y divide-[var(--line)]">
        <Switch
          on={s.badge}
          onChange={(v) => set({ badge: v })}
          label="Merkki sovelluskuvakkeeseen"
          text="Kuittaamattomien kertojen määrä tehtäväpalkin kuvakkeessa (asennettuna) ja välilehden otsikossa. Mukana menneet kerrat ja tämän päivän jo päättyneet."
        />
        <Switch
          on={s.notify && permission === 'granted'}
          onChange={(v) => void toggleNotify(v)}
          label="Ilmoitukset"
          disabled={permission === 'unsupported'}
          text={
            permission === 'denied'
              ? 'Ilmoitukset on estetty selaimessa. Salli ne osoiterivin lukkokuvakkeesta (Sivuston asetukset → Ilmoitukset) ja kytke sitten päälle.'
              : permission === 'unsupported'
                ? 'Tämä selain ei tue ilmoituksia.'
                : 'Windowsin ilmoitukset, kun sovellus on auki (myös pienennettynä). Klikkaus avaa sovelluksen oikeaan kohtaan.'
          }
        >
          <div className="space-y-2 rounded-2xl bg-[var(--surface-sunk)] p-3">
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" className="size-4 accent-green-700" checked={s.planEnd} onChange={(e) => set({ planEnd: e.target.checked })} />
              Kun suunniteltu kerta päättyy (kerrat, joilla on kellonaika)
            </label>
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" className="size-4 accent-green-700" checked={s.evening} onChange={(e) => set({ evening: e.target.checked })} />
              Iltamuistutus klo
              <input
                type="time"
                value={s.eveningTime}
                onChange={(e) => e.target.value && set({ eveningTime: e.target.value })}
                className={`${inputClass} !min-h-9 !w-28 !py-1`}
                aria-label="Iltamuistutuksen kellonaika"
                disabled={!s.evening}
              />
            </label>
            <p className="text-xs text-slate-500">Iltamuistutus tulee kerran päivässä, jos kertoja on kuittaamatta tai tämän päivän arkiliikunta on tarkistamatta.</p>
            <Button variant="secondary" onClick={() => void showNotification('Ilmoitukset toimivat', 'Näin muistutus näkyy. Klikkaus tuo sovelluksen eteen.', 'test')}>
              Kokeile ilmoitusta
            </Button>
          </div>
        </Switch>
        {role === 'pc' && (
          <Switch
            on={s.autoSync}
            onChange={(v) => set({ autoSync: v })}
            label="Automaattinen synkronointi"
            text="PC lukee puhelimen tallentaman liikkuminen.json-tiedoston ja päivittää sen käynnistyessä, 5 minuutin välein ja ikkunaan palatessa. Tiedosto kirjoitetaan vain, kun jotain on muuttunut."
          >
            {syncStatus && <p className={`text-xs ${syncStatus === 'ok' ? 'text-green-800' : 'text-amber-800'}`}>{SYNC_STATUS[syncStatus]}</p>}
          </Switch>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">Asetukset koskevat vain tätä laitetta. Kun sovellus on suljettu, ilmoituksia ei tule (ei palvelinta eikä verkkoliikennettä).</p>
    </Card>
  );
}

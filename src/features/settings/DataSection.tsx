// Varmuuskopio ja tuonti, CSV-vienti, synkronoinnin asetukset sekä tietosuoja ja poistot (SPEC 10, 11, 12).

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { sessionsCsv } from '../../domain/csv';
import type { ActivityType, Profile } from '../../domain/types';
import { today as todayFn } from '../../ui/today';
import { buildBackup, clearAll, detectFileKind, importBackup, mergeAnyFile, purgeProfile, toJson, wrongFileMessage } from '../../db/backup';
import { summaryText } from '../sync/useSync';
import { repo } from '../../db/repositories';
import { db } from '../../db/schema';
import { Button, Card, inputClass } from '../../ui/components';
import { formatDate } from '../../ui/format';
import { useToast } from '../../ui/Toast';
import { localDateOf } from '../../domain/dates';
import { pickFolder, pickTextFile, saveFile, supportsFolder } from '../sync/fileIO';
import { ago } from '../sync/SyncBar';
import { AUTO_BACKUP_DIR, AUTO_BACKUP_KEEP } from '../sync/autoBackup';
import { useSyncState } from '../sync/useSync';

const stamp = () => localDateOf(new Date());

async function exportBackup(): Promise<string> {
  const file = await buildBackup(db);
  const r = await saveFile(`liikkumisseuranta-varmuuskopio-${stamp()}.json`, toJson(file));
  if (r === 'cancelled') return 'Vienti peruttiin';
  await repo.setMeta('lastExportAt', file.exportedAt);
  return r === 'shared' ? 'Varmuuskopio jaettu – tallenna se Tiedostoihin tai pilvikansioon' : 'Varmuuskopio ladattu';
}

export function BackupSection() {
  const toast = useToast();
  const lastExport = useLiveQuery(() => repo.getMeta<string>('lastExportAt'), []);
  const autoBackup = useLiveQuery(() => repo.getMeta<string>('autoBackupAt'), []);
  const sync = useSyncState();
  const [confirmImport, setConfirmImport] = useState(false);
  const [busy, setBusy] = useState(false);

  async function runImport() {
    const f = await pickTextFile();
    if (!f) return;
    setBusy(true);
    try {
      const kind = detectFileKind(f.text);
      if (kind === 'sync') {
        // Synkronointitiedosto (esim. liikkuminen.json): yhdistetään, ei korvata.
        const s = await mergeAnyFile(db, f.text, await repo.deviceId());
        await repo.foldEstimateOnlySessions(todayFn()).catch(() => 0);
        await repo.applyHolidaySkips().catch(() => 0);
        toast(`Tiedosto oli synkronointitiedosto, joten tiedot yhdistettiin. ${summaryText(s)}`);
        setConfirmImport(false);
        return;
      }
      if (kind !== 'backup') throw new Error(wrongFileMessage(kind, f.text));
      // Ennen tuontia tallennetaan automaattisesti varmuuskopio nykytilasta (SPEC 10, C4).
      await importBackup(db, f.text, (current) => void saveFile(`liikkumisseuranta-ennen-tuontia-${stamp()}.json`, toJson(current)));
      toast('Varmuuskopio tuotu. Ennen tuontia tallennettiin varmuuskopio nykytilasta.');
      setConfirmImport(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    const [profiles, sessions, typesList] = await Promise.all([repo.listProfiles({ includeArchived: true }), db.sessions.toArray(), repo.listActivityTypes({ includeArchived: true })]);
    const live = sessions.filter((s) => !s.deletedAt);
    const csv = sessionsCsv({
      profiles,
      sessions: live,
      types: new Map<string, ActivityType>(typesList.map((t) => [t.id, t])),
      details: await repo.footballDetailsFor(live.map((s) => s.id)),
    });
    await saveFile(`liikkumisseuranta-kerrat-${stamp()}.csv`, csv, 'text/csv');
  }

  return (
    <Card title="Varmuuskopio ja tuonti">
      <div className="space-y-3">
        <p className="text-xs text-slate-600">
          Tiedosto sisältää lapsen tietoja. Säilytä se turvallisesti, esim. salatussa pilvikansiossa, äläkä jaa sitä muille.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => exportBackup().then(toast, (e) => toast(e instanceof Error ? e.message : String(e)))}>Vie varmuuskopio (JSON)</Button>
          <Button variant="secondary" onClick={exportCsv}>
            Vie kerrat (CSV)
          </Button>
        </div>
        <p className="text-xs text-slate-500">Edellinen varmuuskopio: {lastExport ? `${formatDate(lastExport.slice(0, 10), 'd.M.yyyy')} (${ago(lastExport)})` : 'ei koskaan'}</p>
        {sync?.role === 'pc' && sync.hasFolder && (
          <p className="text-xs text-slate-500">
            Automaattinen varmuuskopio: kerran viikossa synkronointikansion alikansioon <code>{AUTO_BACKUP_DIR}</code>, {AUTO_BACKUP_KEEP} uusinta säilytetään
            {autoBackup ? ` · viimeksi ${formatDate(autoBackup.slice(0, 10), 'd.M.yyyy')}` : ' · ensimmäinen tehdään seuraavassa synkronoinnissa'}.
          </p>
        )}
        {!confirmImport ? (
          <Button variant="secondary" onClick={() => setConfirmImport(true)}>
            Tuo varmuuskopio…
          </Button>
        ) : (
          <div className="space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
            <p className="text-sm text-amber-950">
              Tuonti <strong>korvaa kaikki tämän laitteen tiedot</strong> varmuuskopion tiedoilla. Ennen tuontia ladataan automaattisesti varmuuskopio nykytilasta.
            </p>
            <div className="flex gap-2">
              <Button disabled={busy} onClick={runImport}>
                Valitse tiedosto ja tuo
              </Button>
              <Button variant="ghost" onClick={() => setConfirmImport(false)}>
                Peruuta
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export function SyncSettingsSection() {
  const state = useSyncState();
  const toast = useToast();
  if (!state?.role) return null;
  return (
    <Card title="Synkronointi PC ↔ puhelin">
      <div className="space-y-2 text-sm">
        {state.role === 'pc' ? (
          <>
            <p className="text-slate-600">
              Valitse pilvikansio (OneDrive tai iCloud Drive), joka näkyy molemmilla laitteilla. Molemmat laitteet käyttävät samaa tiedostoa <code>liikkuminen.json</code>: PC lukee ja yhdistää puhelimen tallentaman version ennen kuin kirjoittaa sen uudelleen, joten mitään ei katoa. Vanhat tiedostot <code>liikkuminen-pc.json</code> ja <code>liikkuminen-puhelin.json</code> voi poistaa, kun olet synkronoinut kerran.
            </p>
            {supportsFolder() ? (
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await repo.setMeta('syncFolderHandle', await pickFolder());
                    toast('Pilvikansio valittu');
                  } catch {
                    /* peruttu */
                  }
                }}
              >
                {state.hasFolder ? 'Vaihda pilvikansio' : 'Valitse pilvikansio'}
              </Button>
            ) : (
              <p className="text-xs text-slate-500">Tämä selain ei tue kansion käsittelyä (vaatii Chromen tai Edgen). Synkronointi tehdään tiedoston tuonnilla ja latauksella.</p>
            )}
          </>
        ) : (
          <p className="text-slate-600">
            "Päivitä PC:ltä" lukee tiedoston <code>liikkuminen.json</code>. "Lähetä PC:lle" jakaa saman nimisen tiedoston: tallenna se pilvikansioon ja valitse "Korvaa" (tavallinen tapa) tai "Säilytä molemmat", jos haluat erillisen kopion. PC:n omat muutokset eivät katoa korvattaessa, vaan palaavat tiedostoon PC:n seuraavassa synkronoinnissa.
          </p>
        )}
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
          <dt className="text-slate-600">Viimeisin yhdistäminen</dt>
          <dd className="text-right">{ago(state.lastSyncAt)}</dd>
          {state.role === 'pc' && (
            <>
              <dt className="text-slate-600">Viimeisin synkronointi</dt>
              <dd className="text-right">{ago(state.lastSyncRunAt)}</dd>
            </>
          )}
          {state.role === 'phone' && (
            <>
              <dt className="text-slate-600">Viimeisin lähetys PC:lle</dt>
              <dd className="text-right">{ago(state.lastSentAt)}</dd>
              <dt className="text-slate-600">Odottaa siirtoa</dt>
              <dd className="text-right">{state.pending}</dd>
            </>
          )}
        </dl>
      </div>
    </Card>
  );
}

/** Kaksivaiheinen vahvistus: painike → vahvistusruutu → "Kyllä, poista pysyvästi". */
function TwoStep({ label, warning, confirmLabel, onConfirm }: { label: string; warning: React.ReactNode; confirmLabel: string; onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="press min-h-11 w-full rounded-xl bg-[var(--surface-raised)] px-4 text-sm font-semibold text-red-700 shadow-xs ring-1 ring-red-200 hover:bg-red-50">
        {label}
      </button>
    );
  return (
    <div className="space-y-2 rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
      <div className="text-sm text-red-950">{warning}</div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              setOpen(false);
            } finally {
              setBusy(false);
            }
          }}
          className="min-h-11 flex-1 rounded-xl bg-red-700 px-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {confirmLabel}
        </button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Peruuta
        </Button>
      </div>
    </div>
  );
}

export function PrivacySection({ onCleared }: { onCleared: () => void }) {
  const toast = useToast();
  const profiles = useLiveQuery(() => repo.listProfiles({ includeArchived: true }), []);
  const [target, setTarget] = useState<string>('');
  const selected: Profile | undefined = profiles?.find((p) => p.id === target) ?? profiles?.[0];

  return (
    <Card title="Tietosuoja ja tietojen poisto">
      <div className="space-y-3 text-sm text-slate-700">
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
          <li>Nimeksi riittää lempinimi; syntymästä tallennetaan vain vuosi ja kuukausi. Sukupuolta, painoa, pituutta, terveystietoja tai kuvia ei tallenneta.</li>
          <li>Sovellus ei lähetä mitään mihinkään: ei analytiikkaa, virheraportointia eikä ulkoisia palveluita. Laitteelta lähtevät vain itse tallentamasi tiedostot.</li>
          <li>Tiedot ovat tämän laitteen selaimessa ja synkronointitiedostoissa omassa pilvikansiossasi. Kansiota ei kannata jakaa muille.</li>
          <li>Sovellus luottaa puhelimen omaan näytön lukitukseen.</li>
        </ul>

        {profiles && profiles.length > 0 && selected && (
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Profiili</span>
              <select className={inputClass} value={selected.id} onChange={(e) => setTarget(e.target.value)}>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <TwoStep
              label="Poista profiili ja kaikki sen tiedot…"
              confirmLabel={`Kyllä, poista ${selected.name} pysyvästi`}
              warning={
                <>
                  Profiilin <strong>{selected.name}</strong> kaikki kerrat, suunnitelmat, perusarviot ja merkinnät poistetaan pysyvästi. Poisto siirtyy synkronoinnissa myös toiselle laitteelle. Toimintoa ei voi kumota.
                </>
              }
              onConfirm={async () => {
                const n = await purgeProfile(db, selected.id, await repo.deviceId());
                toast(`Profiili poistettu (${n} tietuetta)`);
                setTarget('');
              }}
            />
          </div>
        )}

        <TwoStep
          label="Tyhjennä kaikki tiedot…"
          confirmLabel="Kyllä, tyhjennä tämä laite"
          warning={
            <>
              <strong>Kaikki tämän laitteen tiedot poistetaan</strong>, ja sovellus aloittaa alusta. Toisen laitteen tiedot ja pilvikansion tiedostot säilyvät; jos synkronoit myöhemmin, tiedot palaavat niistä. Tee ensin varmuuskopio, jos haluat säilyttää tiedot.
            </>
          }
          onConfirm={async () => {
            await clearAll(db);
            await repo.initialize();
            toast('Kaikki tiedot tyhjennetty');
            onCleared();
          }}
        />
      </div>
    </Card>
  );
}

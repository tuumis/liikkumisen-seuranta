// Viikko-näkymän synkronointipalkki (SPEC 12 "Synkronointi") ja muistutukset (SPEC 10).

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { MergeSummary } from '../../db/backup';
import { repo } from '../../db/repositories';
import { SYNC_FILE_NAME } from '../../domain/version';
import { Button } from '../../ui/components';
import { useToast } from '../../ui/Toast';
import { ConflictSheet } from './ConflictSheet';
import { folderPermission, readFolderFile, supportsFolder } from './fileIO';
import { useSyncActions, useSyncState } from './useSync';

const DAY = 86_400_000;

export function ago(ts?: string): string {
  if (!ts) return 'ei koskaan';
  const min = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (min < 1) return 'juuri nyt';
  if (min < 60) return `${min} min sitten`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h sitten`;
  return `${Math.round(h / 24)} pv sitten`;
}

export function SyncBar() {
  const state = useSyncState();
  const actions = useSyncActions();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<MergeSummary | null>(null);
  const [phoneHasNew, setPhoneHasNew] = useState(false);

  // PC: muistutus, jos kansiossa on lukematon uudempi puhelimen tiedosto (vain jos lupa on jo annettu).
  useEffect(() => {
    if (state?.role !== 'pc' || !state.hasFolder || !supportsFolder()) return;
    let cancelled = false;
    void (async () => {
      try {
        const handle = await repo.getMeta<FileSystemDirectoryHandle>('syncFolderHandle');
        if (!handle || !(await folderPermission(handle, false))) return;
        const f = await readFolderFile(handle, SYNC_FILE_NAME.phone);
        const readAt = (await repo.getMeta<number>('phoneFileReadAt')) ?? 0;
        if (!cancelled) setPhoneHasNew(!!f && f.lastModified > readAt);
      } catch {
        /* ei muistutusta */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state?.role, state?.hasFolder, state?.lastSyncRunAt]);

  if (!state?.role) return null;

  async function run(f: () => Promise<{ summary?: MergeSummary; message: string } | null | string>) {
    setBusy(true);
    try {
      const r = await f();
      if (r === null) return;
      if (typeof r === 'string') return toast(r);
      if (r.summary?.conflicts.length) {
        const s = r.summary;
        toast(r.message, { label: 'Näytä', run: () => setConflicts(s) });
      } else toast(r.message);
      setPhoneHasNew(false);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const stale = state.lastSyncAt ? Date.now() - new Date(state.lastSyncAt).getTime() > 7 * DAY : false;
  const pcDays = state.lastIncomingExportedAt ? Math.floor((Date.now() - new Date(state.lastIncomingExportedAt).getTime()) / DAY) : undefined;

  return (
    <>
      {state.role === 'pc' ? (
        <div className="space-y-2">
          {phoneHasNew && <div className="rounded-2xl bg-sky-50 p-3 text-sm text-sky-950 ring-1 ring-sky-200">Puhelimella on uusia kirjauksia – synkronoi</div>}
          <div className="flex items-center gap-2 rounded-2xl bg-white p-2 pl-3 ring-1 ring-slate-200">
            <span className="flex-1 text-xs text-slate-600">Synkronoitu {ago(state.lastSyncRunAt)}</span>
            {supportsFolder() ? (
              <Button disabled={busy} onClick={() => run(actions.pcSync)}>
                {busy ? 'Synkronoidaan…' : 'Synkronoi'}
              </Button>
            ) : (
              <>
                <Button variant="secondary" disabled={busy} onClick={() => run(actions.importFile)}>
                  Tuo puhelimelta
                </Button>
                <Button disabled={busy} onClick={() => run(async () => (await actions.downloadPcFile(), 'PC:n tiedosto ladattu – siirrä se pilvikansioon'))}>
                  Lataa
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {stale && <div className="rounded-2xl bg-sky-50 p-3 text-sm text-sky-950 ring-1 ring-sky-200">Tiedot PC:ltä {pcDays ?? '?'} päivän takaa</div>}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-2 pl-3 ring-1 ring-slate-200">
            <span className="min-w-0 flex-1 text-xs text-slate-600">
              {state.pending > 0 ? `${state.pending} odottaa siirtoa PC:lle` : `PC:ltä ${ago(state.lastSyncAt)}`}
            </span>
            <Button variant="secondary" disabled={busy} onClick={() => run(actions.importFile)}>
              Päivitä PC:ltä
            </Button>
            {state.pending > 0 && (
              <Button disabled={busy} onClick={() => run(actions.phoneSend)}>
                Lähetä PC:lle
              </Button>
            )}
          </div>
        </div>
      )}
      <ConflictSheet summary={conflicts} onClose={() => setConflicts(null)} />
    </>
  );
}

/** Varmuuskopiomuistutus (SPEC 10): edellisestä viennistä yli N päivää (asetus, oletus 30). */
export function BackupReminder({ onOpenSettings }: { onOpenSettings: () => void }) {
  const info = useLiveQuery(async () => {
    const [last, settings, sessions] = await Promise.all([repo.getMeta<string>('lastExportAt'), repo.getSettings(), repo.db.sessions.orderBy('updatedAt').first()]);
    // Jos vientiä ei ole koskaan tehty, lasketaan ensimmäisestä kirjauksesta.
    const since = last ?? sessions?.createdAt;
    return { since, days: settings.backupReminderDays, never: !last };
  }, []);
  if (!info?.since) return null;
  const age = Math.floor((Date.now() - new Date(info.since).getTime()) / DAY);
  if (age <= info.days) return null;
  return (
    <button type="button" onClick={onOpenSettings} className="w-full rounded-2xl bg-amber-50 p-3 text-left text-sm text-amber-950 ring-1 ring-amber-200">
      {info.never ? 'Varmuuskopiota ei ole vielä tehty.' : `Edellisestä varmuuskopiosta on ${age} päivää.`} <strong>Tee varmuuskopio ›</strong>
    </button>
  );
}

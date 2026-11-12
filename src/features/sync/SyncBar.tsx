// Synkronointi (SPEC 12 "Synkronointi") ja muistutukset (SPEC 10): PC:n leveällä näytöllä sivupalkin alaosassa,
// muuten (puhelin, kapea ikkuna) Viikko-näkymän palkkina.

import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { MergeSummary } from '../../db/backup';
import { repo } from '../../db/repositories';
import { SYNC_FILE_NAME } from '../../domain/version';
import { Button } from '../../ui/components';
import { IconSync } from '../../ui/icons';
import { useMinuteTick } from '../review/unconfirmed';
import { useToast } from '../../ui/Toast';
import { ConflictSheet } from './ConflictSheet';
import { folderPermission, readFolderFile, supportsFolder } from './fileIO';
import { syncFileDevice, useSyncActions, useSyncState } from './useSync';
import { subscribeCommands } from '../desktop/commands';

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

/** variant 'bar' = Viikko-näkymä (PC:llä vain kapeassa ikkunassa), 'sidebar' = PC:n sivupalkki (vain PC-rooli). */
export function SyncBar({ variant = 'bar' }: { variant?: 'bar' | 'sidebar' }) {
  useMinuteTick(); // "Synkronoitu N min sitten" pysyy ajan tasalla
  const state = useSyncState();
  const actions = useSyncActions();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<MergeSummary | null>(null);
  const [phoneHasNew, setPhoneHasNew] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // "Synkronoi"-komento (pikanäppäin, komentovalikko, tehtäväpalkki): vain näkyvissä oleva instanssi suorittaa.
  const runRef = useRef<() => void>(() => {});
  useEffect(
    () =>
      subscribeCommands(['sync'], () => {
        const el = rootRef.current;
        if (!el || el.getBoundingClientRect().height === 0) return false;
        runRef.current();
      }),
    [],
  );

  // PC: muistutus, jos kansiossa on lukematon uudempi puhelimen tiedosto (vain jos lupa on jo annettu).
  useEffect(() => {
    if (state?.role !== 'pc' || !state.hasFolder || !supportsFolder()) return;
    let cancelled = false;
    void (async () => {
      try {
        const handle = await repo.getMeta<FileSystemDirectoryHandle>('syncFolderHandle');
        if (!handle || !(await folderPermission(handle, false))) return;
        const [shared, legacy] = await Promise.all([readFolderFile(handle, SYNC_FILE_NAME.shared), readFolderFile(handle, SYNC_FILE_NAME.legacyPhone)]);
        const [ownWrite, readAt] = await Promise.all([repo.getMeta<number>('syncFileWrittenAt'), repo.getMeta<number>('phoneFileReadAt')]);
        // Yhteinen tiedosto on uusi vain, jos sen on tallentanut toinen laite PC:n oman kirjoituksen jälkeen.
        const sharedNew = !!shared && shared.lastModified > (ownWrite ?? 0) && syncFileDevice(await shared.text()) !== (await repo.getMeta<string>('deviceId'));
        const fresh = sharedNew || (!!legacy && legacy.lastModified > (readAt ?? 0));
        if (!cancelled) setPhoneHasNew(fresh);
      } catch {
        /* ei muistutusta */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state?.role, state?.hasFolder, state?.lastSyncRunAt]);

  if (!state?.role || (variant === 'sidebar' && state.role !== 'pc')) return null;

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

  runRef.current = () => {
    if (busy) return;
    if (state.role === 'pc' && supportsFolder()) void run(actions.pcSync);
    else if (state.role === 'pc') void run(actions.importFile);
    else void run(actions.importFile);
  };
  const sideBtn = 'press flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left hover:bg-white/[0.06] disabled:opacity-60';
  if (variant === 'sidebar') {
    const sub = busy ? 'Synkronoidaan…' : phoneHasNew ? 'Puhelimella uusia kirjauksia' : `Synkronoitu ${ago(state.lastSyncRunAt)}`;
    return (
      <div ref={rootRef}>
        {supportsFolder() ? (
          <button type="button" disabled={busy} onClick={() => run(actions.pcSync)} className={`${sideBtn} group`} aria-label={`Synkronoi puhelimen kanssa. ${sub}`}>
            <span className="relative text-[var(--side-ink-soft)] group-hover:text-white">
              <IconSync size="1.25rem" className={busy ? 'animate-spin [animation-direction:reverse]' : ''} />
              {phoneHasNew && !busy && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--hero-accent)] ring-2 ring-[var(--side-from)]" aria-hidden />}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-sm font-semibold text-[var(--side-ink-soft)] group-hover:text-white">Synkronoi</span>
              <span className={`block truncate text-[11px] ${phoneHasNew && !busy ? 'font-semibold text-[var(--hero-accent)]' : 'text-[var(--side-muted)]'}`}>{sub}</span>
            </span>
          </button>
        ) : (
          <div className="px-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--side-ink-soft)]">
              <IconSync size="1.25rem" />
              Synkronointi
            </div>
            <div className="mt-0.5 pl-7 text-[11px] text-[var(--side-muted)]">Synkronoitu {ago(state.lastSyncRunAt)}</div>
            <div className="mt-2 flex gap-2 pl-7">
              <button type="button" disabled={busy} onClick={() => run(actions.importFile)} className="press rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-[var(--side-ink)] hover:bg-white/[0.14] disabled:opacity-60">
                Tuo puhelimelta
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(async () => (await actions.downloadPcFile(), 'PC:n tiedosto ladattu – siirrä se pilvikansioon'))}
                className="press rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-[var(--side-ink)] hover:bg-white/[0.14] disabled:opacity-60"
              >
                Lataa
              </button>
            </div>
          </div>
        )}
        <ConflictSheet summary={conflicts} onClose={() => setConflicts(null)} />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="space-y-2 empty:hidden">
      {state.role === 'pc' ? (
        <div className="space-y-2 lg:hidden">
          {phoneHasNew && <div className="rounded-2xl bg-sky-50 p-3 text-sm text-sky-950 ring-1 ring-sky-200">Puhelimella on uusia kirjauksia – synkronoi</div>}
          <div className="card flex items-center gap-2 !rounded-2xl p-2 pl-3">
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
          <div className="card flex flex-wrap items-center gap-2 !rounded-2xl p-2 pl-3">
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
    </div>
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

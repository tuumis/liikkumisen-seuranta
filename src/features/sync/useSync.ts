// Synkronoinnin toiminnot ja tila (SPEC 10, "Synkronointi PC ↔ puhelin").

import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { defaultPlanningThrough } from '../../domain/planning';
import { isSyncCopyName, SYNC_FILE_NAME } from '../../domain/version';
import type { Timestamp } from '../../domain/types';
import { buildSyncFile, changedSince, markSent, mergeAnyFile, mergeSyncFile, pendingCount, toJson, type MergeSummary } from '../../db/backup';
import { repo } from '../../db/repositories';
import { db } from '../../db/schema';
import { today } from '../../ui/today';
import { runAutoBackup } from './autoBackup';
import { folderPermission, listFolderFiles, pickFolder, pickTextFile, readFolderFile, removeFolderFile, shareOrDownload, supportsFolder, writeFolderFile, downloadText } from './fileIO';

export interface SyncState {
  role?: 'pc' | 'phone';
  deviceId?: string;
  lastSyncAt?: Timestamp;
  lastSyncRunAt?: Timestamp;
  lastSentAt?: Timestamp;
  lastIncomingExportedAt?: Timestamp;
  hasFolder: boolean;
  pending: number;
}

/** Synkronointitiedoston kirjoittanut laite (tiedoston sisällöstä); undefined, jos ei luettavissa. */
export function syncFileDevice(text: string): string | undefined {
  try {
    const v = JSON.parse(text) as { format?: string; deviceId?: string };
    return v.format === 'liikkumisseuranta-sync' ? v.deviceId : undefined;
  } catch {
    return undefined;
  }
}

/** Yhdistää kaksi yhteenvetoa (yhteinen tiedosto + vanha puhelimen tiedosto samassa synkronoinnissa). */
function combine(a: MergeSummary | undefined, b: MergeSummary): MergeSummary {
  if (!a) return b;
  return { ...b, added: a.added + b.added, updated: a.updated + b.updated, deleted: a.deleted + b.deleted, conflicts: [...a.conflicts, ...b.conflicts] };
}

async function ensurePlannedAll() {
  const t = today();
  for (const p of await repo.listProfiles()) await repo.ensurePlanned(p.id, defaultPlanningThrough(t), t);
}

/**
 * Välituntisiivous myös yhdistämisen jälkeen (ei vain käynnistyksessä): toisen laitteen tiedosto voi
 * tuoda avoimen välituntikerran tai -rivin, jonka tämä laite on jo siivonnut. Idempotentti.
 */
const foldEstimateOnly = async () => {
  await repo.foldEstimateOnlySessions(today()).catch(() => 0);
  await repo.applyHolidaySkips().catch(() => 0); // lomajaksot: toisen laitteen tuomat kerrat/jaksot
  await repo.alignTournamentArrivals().catch(() => 0);
};

export function useSyncState(): SyncState | undefined {
  return useLiveQuery(async () => {
    // Vain lukuja: live-kyselyssä ei saa avata kirjoitustransaktiota (repo.deviceId() voi luoda tunnisteen).
    const deviceId = (await repo.getMeta<string>('deviceId')) ?? '';
    const [role, lastSyncAt, lastSyncRunAt, lastSentAt, lastIncomingExportedAt, folder] = await Promise.all([
      repo.getDeviceRole(),
      repo.getMeta<Timestamp>('lastSyncAt'),
      repo.getMeta<Timestamp>('lastSyncRunAt'),
      repo.getMeta<Timestamp>('lastSentAt'),
      repo.getMeta<Timestamp>('lastIncomingExportedAt'),
      repo.getMeta<FileSystemDirectoryHandle>('syncFolderHandle'),
    ]);
    return { role, deviceId, lastSyncAt, lastSyncRunAt, lastSentAt, lastIncomingExportedAt, hasFolder: !!folder, pending: await pendingCount(db, deviceId) };
  }, []);
}

export type SyncOutcome = { summary?: MergeSummary; wrote?: boolean; message: string };

/** Kansion vaihe ei valmistunut ajassa (pilvikansio ei vastannut). */
export class SyncTimeoutError extends Error {}

/** Yhden kansiovaiheen aikaraja; pilvipalvelun lataus voi kestää, mutta ei loputtomiin. */
export const SYNC_STEP_MS = 30_000;

/** Koko synkronoinnin aikaraja: mikään vaihe (myös laitteen oma tietokanta) ei pidä synkronointia kesken pidempään. */
export const SYNC_TOTAL_MS = 120_000;

/**
 * Synkronoinnin meneillään oleva vaihe (24.11.2026, käyttäjän havainto: pyörii yhä versiossa 1.1.39).
 * Näkyy Synkronoi-painikkeen alla, ja keskeytyksen viesti kertoo vaiheen, jotta jumin kohta selviää.
 */
let stage: string | undefined;
const stageListeners = new Set<(s: string | undefined) => void>();
export function setSyncStage(s: string | undefined) {
  stage = s;
  for (const l of stageListeners) l(s);
}
export const syncStage = () => stage;
export function useSyncStage(): string | undefined {
  const [s, set] = useState(stage);
  useEffect(() => {
    stageListeners.add(set);
    set(stage);
    return () => void stageListeners.delete(set);
  }, []);
  return s;
}

/** Vaihe ilman omaa aikarajaa (laitteen tietokanta); koko synkronoinnin aikaraja kattaa sen. */
async function step<T>(label: string, f: () => Promise<T>): Promise<T> {
  setSyncStage(label);
  return f();
}

/** Ajastin, joka hylkää lupauksen; `message` luetaan vasta laukeamishetkellä. */
function race<T>(p: Promise<T>, ms: number, message: () => string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SyncTimeoutError(message())), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Aikaraja kansion vaiheelle (24.11.2026, käyttäjän havainto: synkronointi pyöri loputtomiin, eikä
 * automaattinen synkronointi enää käynnistynyt). Jumiin jäänyt tiedostotoiminto ei pidä painiketta eikä
 * automaattista synkronointia kesken-tilassa: virheviesti kertoo vaiheen, ja seuraava yritys onnistuu.
 */
export function withTimeout<T>(p: Promise<T>, label: string, ms = SYNC_STEP_MS): Promise<T> {
  setSyncStage(label);
  return timed(p, label, ms);
}

/** Kuten withTimeout, mutta ei muuta näkyvää vaihetta (käsin painetun synkronoinnin alku ennen jonoa). */
function timed<T>(p: Promise<T>, label: string, ms = SYNC_STEP_MS): Promise<T> {
  return race(
    p,
    ms,
    () =>
      `Synkronointi keskeytyi vaiheessa "${label}": ei valmistunut ${Math.round(ms / 1000)} sekunnissa. Pilvipalvelun kansio (esim. OneDrive tai Google Drive) ei vastannut. Tarkista, että pilvipalvelun sovellus on käynnissä, ja yritä uudelleen.`,
  );
}

/** Aikakatkaisu kesken jääneelle tiedostolle ohitetaan, muut virheet (esim. ei lupaa) myös; vain aikakatkaisu keskeyttää. */
const onlyTimeouts = (e: unknown) => {
  if (e instanceof SyncTimeoutError) throw e;
};

/**
 * Yksi synkronointi kerrallaan: käsin painettu ja automaattinen eivät käsittele kansiota yhtä aikaa.
 * Jokaisella ajolla on kokonaisaikaraja, joten jono ei jää jumiin, vaikka jokin vaihe ei koskaan valmistuisi.
 */
let queue: Promise<unknown> = Promise.resolve();
export function exclusive<T>(f: () => Promise<T>, total = SYNC_TOTAL_MS): Promise<T> {
  const before = queue;
  const run = (async () => {
    await before; // vaiheteksti näyttää edellisen ajon vaiheen, kunnes se päättyy
    return race(
      f(),
      total,
      () =>
        `Synkronointi keskeytyi vaiheessa "${stage ?? 'aloitus'}": synkronointi ei valmistunut ${Math.round(total / 1000)} sekunnissa. Sulje selain kokonaan, avaa sovellus uudelleen ja yritä uudelleen.`,
    );
  })();
  const settled = run.catch(() => undefined);
  queue = settled;
  void settled.then(() => {
    if (queue === settled) setSyncStage(undefined);
  });
  return run;
}

/** Kansion tiedostojen luku ja yhdistäminen (PC); palauttaa yhteenvedon, jos jotain yhdistettiin. */
export async function mergeFromFolder(handle: FileSystemDirectoryHandle, deviceId: string): Promise<MergeSummary | undefined> {
  let summary: MergeSummary | undefined;
  // 1) Yhteinen tiedosto: jos joku muu (puhelin) on tallentanut sen PC:n oman kirjoituksen jälkeen, yhdistetään.
  const shared = await withTimeout(readFolderFile(handle, SYNC_FILE_NAME.shared), 'liikkuminen.json avaus');
  const ownWrite = (await repo.getMeta<number>('syncFileWrittenAt')) ?? 0;
  if (shared && shared.lastModified > ownWrite) {
    const text = await withTimeout(shared.text(), 'liikkuminen.json luku');
    const by = syncFileDevice(text);
    if (by && by !== deviceId) summary = await step('puhelimen kirjausten yhdistäminen', () => mergeSyncFile(db, text, deviceId));
  }
  // 2) Vanha puhelimen tiedosto (ennen yhteistä nimeä), jos se on muuttunut edellisen lukukerran jälkeen.
  const legacy = await withTimeout(readFolderFile(handle, SYNC_FILE_NAME.legacyPhone), 'puhelimen vanha tiedosto');
  const readAt = (await repo.getMeta<number>('phoneFileReadAt')) ?? 0;
  if (legacy && legacy.lastModified > readAt) {
    const text = await withTimeout(legacy.text(), 'puhelimen vanhan tiedoston luku');
    summary = combine(summary, await step('puhelimen kirjausten yhdistäminen', () => mergeSyncFile(db, text, deviceId)));
    await repo.setMeta('phoneFileReadAt', legacy.lastModified);
  }
  // 3) Kopiot ("liikkuminen 2.json"): iPhone ei korvaa tiedostoa vaan tallentaa uudella nimellä.
  //    Toisen laitteen kopio yhdistetään ja poistetaan, ettei kopioita kerry (tiedot ovat jo PC:llä
  //    ja palaavat yhteiseen tiedostoon). Oma vanha kopio poistetaan; muihin tiedostoihin ei kosketa.
  let files: File[] = [];
  try {
    // Vain kopioiden nimiset avataan (ks. listFolderFiles).
    files = await withTimeout(listFolderFiles(handle, isSyncCopyName), 'kopiotiedostojen haku');
  } catch (e) {
    onlyTimeouts(e); // kansion luettelointi ei onnistu: yhteinen tiedosto riittää; jumi keskeyttää
  }
  for (const f of files.sort((a, b) => a.lastModified - b.lastModified)) {
    let text: string;
    try {
      text = await withTimeout(f.text(), `${f.name} luku`);
    } catch (e) {
      onlyTimeouts(e);
      continue; // luettavaksi kelpaamaton kopio
    }
    const by = syncFileDevice(text);
    if (!by) continue;
    if (by !== deviceId) summary = combine(summary, await step('puhelimen kirjausten yhdistäminen', () => mergeSyncFile(db, text, deviceId)));
    await withTimeout(removeFolderFile(handle, f.name), `${f.name} poisto`).catch(onlyTimeouts);
  }
  return summary;
}

/** Viikoittainen varmuuskopio kansioon; epäonnistuminen ei estä synkronointia. */
async function weeklyBackup(handle: FileSystemDirectoryHandle) {
  try {
    await withTimeout(runAutoBackup(handle), 'viikoittainen varmuuskopio');
  } catch (e) {
    onlyTimeouts(e); // esim. kansio vain luku -tilassa; yritetään seuraavalla synkronoinnilla
  }
}

/** Kirjoittaa yhdistetyn tilannekuvan yhteiseen tiedostoon ja muistaa oman kirjoitusajan. */
async function writeToFolder(handle: FileSystemDirectoryHandle, deviceId: string) {
  await step('suunniteltujen kertojen päivitys', ensurePlannedAll);
  const text = await step('tiedoston kokoaminen', async () => toJson(await buildSyncFile(db, deviceId, 'pc')));
  await withTimeout(writeFolderFile(handle, SYNC_FILE_NAME.shared, text), 'liikkuminen.json tallennus');
  const written = await withTimeout(readFolderFile(handle, SYNC_FILE_NAME.shared), 'tallennuksen tarkistus').catch(() => null);
  await repo.setMeta('syncFileWrittenAt', written?.lastModified ?? Date.now());
  await repo.setMeta('lastSyncRunAt', new Date().toISOString());
}

/**
 * PC:n automaattinen synkronointi (työpöytätila): ei kysy kansiota eikä lupaa (vain jo annettu lupa),
 * ja kirjoittaa tiedoston vain, jos puhelimelta tuli uutta tai PC:llä on muutoksia edellisen kerran jälkeen.
 * Palauttaa null, jos synkronointi ei ole mahdollista tai mitään ei tarvinnut tehdä.
 */
export function pcAutoSync(): Promise<SyncOutcome | null> {
  return exclusive(pcAutoSyncNow);
}

async function pcAutoSyncNow(): Promise<SyncOutcome | null> {
  if (!supportsFolder() || (await repo.getDeviceRole()) !== 'pc') return null;
  const handle = await repo.getMeta<FileSystemDirectoryHandle>('syncFolderHandle');
  if (!handle || !(await withTimeout(folderPermission(handle, false), 'kansion käyttölupa'))) return null;
  const deviceId = await repo.deviceId();
  const summary = await mergeFromFolder(handle, deviceId);
  await step('kirjausten siivous', foldEstimateOnly);
  await weeklyBackup(handle);
  const since = await repo.getMeta<Timestamp>('lastSyncRunAt');
  const localChanged = await step('muutosten tarkistus', async () => !since || (await changedSince(db, since)) > 0);
  if (!summary && !localChanged) {
    await repo.setMeta('lastSyncRunAt', new Date().toISOString()); // ajan tasalla: tarkistettu juuri nyt
    return null;
  }
  await writeToFolder(handle, deviceId);
  return { summary, wrote: true, message: summary ? summaryText(summary) : 'liikkuminen.json päivitetty' };
}

/** Onko automaattiselle synkronoinnille lupa (kansio valittu ja lupa voimassa ilman kysymistä). */
export async function autoSyncReady(): Promise<'ok' | 'no-folder' | 'no-permission' | 'unsupported'> {
  if (!supportsFolder()) return 'unsupported';
  const handle = await repo.getMeta<FileSystemDirectoryHandle>('syncFolderHandle');
  if (!handle) return 'no-folder';
  return (await folderPermission(handle, false)) ? 'ok' : 'no-permission';
}

export function useSyncActions() {
  /** PC: "Synkronoi" – lue puhelimen tiedosto (jos muuttunut), yhdistä, ensurePlanned, kirjoita PC:n tiedosto. */
  const pcSync = useCallback(async (): Promise<SyncOutcome> => {
    if (!supportsFolder()) throw new Error('Selain ei tue kansion käsittelyä. Käytä tiedoston tuontia ja latausta.');
    const deviceId = await repo.deviceId();
    let handle = await repo.getMeta<FileSystemDirectoryHandle>('syncFolderHandle');
    if (!handle) {
      handle = await pickFolder();
      await repo.setMeta('syncFolderHandle', handle);
    }
    // Lupakysely heti painalluksesta (vaatii käyttäjän eleen); varsinainen työ jonossa automaattisen kanssa.
    // Lupa: tarkistus 30 s, kysely (vain jos lupaa ei ole) odottaa käyttäjän vastausta 2 min.
    const granted =
      (await timed(folderPermission(handle, false), 'kansion käyttölupa')) ||
      (await timed(folderPermission(handle, true), 'kansion käyttöluvan kysely', 4 * SYNC_STEP_MS));
    if (!granted) throw new Error('Kansion käyttöoikeus puuttuu.');
    const folder = handle;
    return exclusive(async () => {
      const summary = await mergeFromFolder(folder, deviceId);
      await step('kirjausten siivous', foldEstimateOnly);
      await weeklyBackup(folder);
      await writeToFolder(folder, deviceId);
      return { summary, wrote: true, message: summary ? summaryText(summary) : 'Tiedosto liikkuminen.json päivitetty; puhelimelta ei uutta' };
    });
  }, []);

  /** PC ilman kansiotukea: tuo puhelimen tiedosto. */
  const importFile = useCallback(async (): Promise<SyncOutcome | null> => {
    const f = await pickTextFile();
    if (!f) return null;
    const me = await repo.deviceId();
    // Oma tiedosto (esim. puhelin tallensi liikkuminen.json, eikä PC ole vielä synkronoinut): ei yhdistettävää.
    if (syncFileDevice(f.text) === me) return { message: 'Tiedosto on tämän laitteen oma tallennus – toinen laite ei ole vielä päivittänyt sitä' };
    const before = await repo.getMeta<Timestamp>('lastIncomingExportedAt');
    // Hyväksyy sekä synkronointitiedoston että varmuuskopion (tunnistus sisällöstä).
    const summary = await mergeAnyFile(db, f.text, me);
    await foldEstimateOnly();
    await ensurePlannedAll();
    await repo.setMeta('lastSyncRunAt', new Date().toISOString());
    return { summary, message: importMessage(summary, before) };
  }, []);

  /** PC ilman kansiotukea: lataa PC:n tiedosto. */
  const downloadPcFile = useCallback(async () => {
    downloadText(SYNC_FILE_NAME.shared, toJson(await buildSyncFile(db, await repo.deviceId(), 'pc')));
    await repo.setMeta('lastSyncRunAt', new Date().toISOString());
  }, []);

  /** Puhelin: "Lähetä PC:lle" – jako tai lataus nimellä liikkuminen.json (korvaa PC:n tiedoston tai tallenna rinnalle). */
  const phoneSend = useCallback(async (): Promise<string> => {
    const text = toJson(await buildSyncFile(db, await repo.deviceId(), 'phone'));
    const r = await shareOrDownload(SYNC_FILE_NAME.shared, text);
    if (r === 'cancelled') return 'Lähetys peruttiin';
    await markSent(db);
    return r === 'shared'
      ? 'Tiedosto jaettu – tallenna se pilvikansioon. Jos iPhone tallentaa sen nimellä "liikkuminen 2", PC yhdistää ja poistaa kopion itse.'
      : 'Tiedosto ladattu – siirrä se pilvikansioon nimellä liikkuminen.json';
  }, []);

  return { pcSync, importFile, downloadPcFile, phoneSend };
}

/** Aikaleima lyhyesti: "tänään klo 9.41" tai "12.11. klo 18.05". */
export function savedAtText(ts: Timestamp, now = new Date()): string {
  const d = new Date(ts);
  const clock = `klo ${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`;
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `tänään ${clock}` : `${d.getDate()}.${d.getMonth() + 1}. ${clock}`;
}

/**
 * Tuonnin viesti: yhteenveto ja tiedoston tallennusaika. Jos tiedosto on sama (tai vanhempi) kuin
 * edellisellä tuonnilla eikä mitään muuttunut, kerrotaan se suoraan: PC tai pilvikansio ei ole
 * vielä ehtinyt päivittää tiedostoa.
 */
export function importMessage(s: MergeSummary & { kind?: 'backup' | 'sync' }, previousExportedAt: Timestamp | undefined, now = new Date()): string {
  if (s.kind === 'backup') return summaryText(s);
  const who = s.incomingRole === 'phone' ? 'Puhelin' : 'PC';
  const saved = `${who} tallensi tiedoston ${savedAtText(s.incomingExportedAt, now)}`;
  const nothing = !s.added && !s.updated && !s.deleted && !s.conflicts.length;
  if (nothing && previousExportedAt && s.incomingExportedAt <= previousExportedAt)
    return `Ei uutta: tiedosto on sama kuin edellisellä kerralla (tallennettu ${savedAtText(s.incomingExportedAt, now)}). Jos teit juuri muutoksia, odota hetki, että tiedosto ehtii päivittyä pilvikansioon, ja yritä uudelleen.`;
  return `${summaryText(s)} · ${saved}`;
}

export function summaryText(s: MergeSummary): string {
  const base = `Yhdistetty: ${s.added} uutta, ${s.updated} päivitettyä, ${s.deleted} poistettu`;
  return s.conflicts.length ? `${base} · ${s.conflicts.length} ristiriitaa` : base;
}

export const ROLE_GEN: Record<'pc' | 'phone', string> = { pc: 'PC:n', phone: 'puhelimen' };

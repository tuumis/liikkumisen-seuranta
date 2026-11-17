// Jalkapallo-ominaisuus profiileittain (SPEC 16): pois päältä jalkapalloon liittyvät näkymät ja
// seurajalkapallon lajit piilotetaan. Tiedot säilyvät, ja kirjatut kerrat lasketaan liikuntaan.

import { createContext, useContext } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { footballEnabled, isClubFootball } from '../../domain/football';
import type { ActivityType, Profile, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';

/**
 * Kaikkien profiilien jalkapallotila valmiiksi laskettuna (17.11.2026, käyttäjän havainto "valikko välkkyy,
 * kun vaihtaa profiilia"): profiilin vaihto ei odota uutta hakua, joten Jalkapallo-välilehti ja
 * jalkapallokortit eivät näy hetkeä edellisen profiilin mukaan. undefined = lasketaan vielä.
 */
export function useFootballStatusMap(enabled = true): ReadonlyMap<UUID, boolean> | undefined {
  return useLiveQuery(async () => {
    if (!enabled) return undefined;
    const out = new Map<UUID, boolean>();
    for (const p of await repo.listProfiles({ includeArchived: true })) out.set(p.id, footballEnabled(p, p.football === undefined && (await repo.hasFootballData(p.id))));
    return out;
  }, [enabled]);
}

/** Sovelluksen jakama tila (App); null = ei jakajaa, jolloin hook hakee profiilin tilan itse. */
export const FootballStatusContext = createContext<ReadonlyMap<UUID, boolean> | undefined | null>(null);

/**
 * Jalkapallo profiilille: tallennettu valinta, muuten päätelty datasta; undefined, kun päättely on
 * vielä kesken (esim. välilehteä ei piiloteta käynnistyksen hetkeksi). Haun tulos on sidottu profiiliin,
 * joten edellisen profiilin tulos ei näy vaihdon aikana.
 */
export function useFootballStatus(profile: Pick<Profile, 'id' | 'football'> | undefined): boolean | undefined {
  const shared = useContext(FootballStatusContext);
  const id = profile?.id;
  const stored = profile?.football;
  const own = useLiveQuery(
    async () => (shared === null && id && stored === undefined ? { id, has: await repo.hasFootballData(id) } : null),
    [shared === null, id, stored],
  );
  if (!profile) return false;
  if (stored !== undefined) return stored;
  if (shared !== null) return shared?.get(profile.id);
  return own && own.id === profile.id ? footballEnabled(profile, own.has) : undefined;
}

/** Onko jalkapallo käytössä profiilille (päättelyn aikana false). */
export function useFootballEnabled(profile: Pick<Profile, 'id' | 'football'> | undefined): boolean {
  return useFootballStatus(profile) ?? false;
}

/** Sama profiilin tunnisteella (esim. kerran muokkaus, jossa profiilia ei ole valmiina). */
export function useFootballEnabledById(profileId: string | undefined): boolean {
  const profile = useLiveQuery(async () => (profileId ? ((await repo.listProfiles({ includeArchived: true })).find((p) => p.id === profileId) ?? null) : null), [profileId]);
  return useFootballEnabled(profile ?? undefined);
}

/** Onko jalkapallo käytössä jollakin profiililla (lajiasetukset ovat yhteiset). */
export function useFootballAnyProfile(): boolean {
  return (
    useLiveQuery(async () => {
      for (const p of await repo.listProfiles()) if (footballEnabled(p, p.football === undefined && (await repo.hasFootballData(p.id)))) return true;
      return false;
    }, []) ?? false
  );
}

/** Lajivalikon lajit: seurajalkapallon lajit pois, kun jalkapallo ei ole käytössä (`keepId` jää aina). */
export function withoutClubFootball<T extends ActivityType>(types: T[] | undefined, footballOn: boolean, keepId?: string): T[] | undefined {
  return footballOn ? types : types?.filter((t) => !isClubFootball(t) || t.id === keepId);
}

// Jalkapallo-ominaisuus profiileittain (SPEC 16): pois päältä jalkapalloon liittyvät näkymät ja
// seurajalkapallon lajit piilotetaan. Tiedot säilyvät, ja kirjatut kerrat lasketaan liikuntaan.

import { useLiveQuery } from 'dexie-react-hooks';
import { footballEnabled, isClubFootball } from '../../domain/football';
import type { ActivityType, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';

/**
 * Jalkapallo profiilille: tallennettu valinta, muuten päätelty datasta; undefined, kun päättely on
 * vielä kesken (esim. välilehteä ei piiloteta käynnistyksen hetkeksi).
 */
export function useFootballStatus(profile: Pick<Profile, 'id' | 'football'> | undefined): boolean | undefined {
  const id = profile?.id;
  const stored = profile?.football;
  const hasData = useLiveQuery(() => (id && stored === undefined ? repo.hasFootballData(id) : false), [id, stored]);
  if (!profile) return false;
  if (stored !== undefined) return stored;
  return hasData === undefined ? undefined : footballEnabled(profile, hasData);
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

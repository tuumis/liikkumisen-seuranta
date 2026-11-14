// Lajivalikoiden lajit profiilille: profiilikohtaisesti piilotetut lajit (Profile.hiddenTypeIds,
// 14.11.2026) jätetään pois. Muokattavan kerran nykyinen laji pysyy aina valittavana.

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ActivityType, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';

const EMPTY: ReadonlySet<UUID> = new Set();

/** Profiilin valikoista piilotetut lajit. */
export function useHiddenTypes(profileId: UUID | undefined): ReadonlySet<UUID> {
  const ids = useLiveQuery(async () => (profileId ? ((await repo.listProfiles({ includeArchived: true })).find((p) => p.id === profileId)?.hiddenTypeIds ?? []) : []), [profileId]);
  return useMemo(() => (ids?.length ? new Set(ids) : EMPTY), [ids]);
}

/** Suodattaa piilotetut lajit; `keepId` (esim. muokattavan kerran nykyinen laji) jää aina näkyviin. */
export function visibleTypes<T extends ActivityType>(types: T[] | undefined, hidden: ReadonlySet<UUID>, keepId?: string): T[] | undefined {
  return types?.filter((t) => !hidden.has(t.id) || t.id === keepId);
}

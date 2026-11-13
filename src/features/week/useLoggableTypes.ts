// Lajivalikoiden lajit profiilille: välitunnit (ESTIMATE_ONLY_CATEGORIES) piilotetaan, kun
// profiililla on niille voimassa oleva arkiliikunnan arvio. Ne vahvistetaan arkiliikunnan rivillä.

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ESTIMATE_ONLY_CATEGORIES } from '../../domain/hours';
import type { ActivityType, Category, ISODate, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';

/** Kategoriat, joiden lajit piilotetaan valikoista (arvio voimassa tänään tai myöhemmin). */
export function useHiddenCategories(profileId: UUID | undefined, today: ISODate): ReadonlySet<Category> {
  const estimates = useLiveQuery(() => (profileId ? repo.listEstimates(profileId) : []), [profileId]);
  return useMemo(
    () => new Set((estimates ?? []).filter((e) => ESTIMATE_ONLY_CATEGORIES.includes(e.category) && (!e.validTo || e.validTo >= today)).map((e) => e.category)),
    [estimates, today],
  );
}

/** Suodattaa piilotetut lajit; `keepId` (esim. muokattavan kerran nykyinen laji) jää aina näkyviin. */
export function visibleTypes<T extends ActivityType>(types: T[] | undefined, hidden: ReadonlySet<Category>, keepId?: string): T[] | undefined {
  return types?.filter((t) => !hidden.has(t.category) || t.id === keepId);
}

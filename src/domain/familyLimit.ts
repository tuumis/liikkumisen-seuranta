// Perhenäkymien profiilimäärä (27.11.2026, käyttäjän hyväksymä ehdotus): Koko perheen viikossa enintään 4 profiilia
// rinnakkain, kalentereissa enintään 6. Raja ylittyessä käyttäjä valitsee näytettävät; valittu profiili on aina mukana.

/** Koko perheen viikon sarakkeet. */
export const FAMILY_WEEK_MAX = 4;
/** Kalentereiden (Viikko ja Jalkapallo) Koko perhe -tila. */
export const FAMILY_CALENDAR_MAX = 6;

/**
 * Näytettävät profiilit profiilien järjestyksessä. Rajan alla kaikki. Muuten tallennettu valinta (poistetut
 * profiilit pois), oletuksena ensimmäiset; valittu profiili lisätään aina ja ylimääräiset karsitaan lopusta.
 */
export function pickShown(allIds: readonly string[], selectedId: string, stored: readonly string[] | null, max: number): string[] {
  if (allIds.length <= max) return [...allIds];
  const exists = new Set(allIds);
  const base = (stored ?? []).filter((id) => exists.has(id));
  const chosen = base.length ? [...new Set(base)] : [...allIds];
  if (exists.has(selectedId) && !chosen.includes(selectedId)) chosen.unshift(selectedId);
  while (chosen.length > max) {
    const i = chosen.map((id, k) => (id === selectedId ? -1 : k)).filter((k) => k >= 0).pop()!;
    chosen.splice(i, 1);
  }
  const set = new Set(chosen);
  return allIds.filter((id) => set.has(id));
}

/** Valinnan muutos: valittua profiilia ei voi poistaa, eikä rajaa voi ylittää; vähintään yksi jää. */
export function toggleShown(shown: readonly string[], id: string, selectedId: string, max: number): string[] {
  if (shown.includes(id)) return id === selectedId || shown.length <= 1 ? [...shown] : shown.filter((x) => x !== id);
  return shown.length >= max ? [...shown] : [...shown, id];
}

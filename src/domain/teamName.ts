// Treenin ja suunnitelman joukkueen nimi (19.11.2026, siirretty omaksi 27.11.2026): oma valinta, viikkorytmin rivi
// tai ainoa aktiivinen joukkue tai ryhmä (sama kuin kuitattaessa). Käytössä Viikko-näkymässä ja kuukausikalenterissa.

import { displayTeamName } from './opponent';
import type { Team, TemplateItem, UUID } from './types';

export type TeamNameFn = (x: { teamId?: UUID; templateItemId?: UUID }, planned?: boolean) => string | undefined;

export function teamNameResolver(teams: readonly Team[] | undefined, templateItems: readonly TemplateItem[] | undefined): TeamNameFn | undefined {
  if (!teams?.length) return undefined;
  const names = new Map(teams.map((t) => [t.id, t.kind === 'group' ? t.name : displayTeamName(t.name)]));
  const itemTeam = new Map((templateItems ?? []).filter((i) => i.teamId).map((i) => [i.id, i.teamId!]));
  const active = teams.filter((t) => !t.archived);
  const sole = active.length === 1 ? active[0].id : undefined;
  return (x, planned = false) => names.get(x.teamId ?? (x.templateItemId ? itemTeam.get(x.templateItemId) : undefined) ?? (planned ? sole : undefined) ?? '');
}

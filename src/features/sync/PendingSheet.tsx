// "N odottaa siirtoa PC:lle" -luvun erittely: mitkä tämän laitteen muutokset puuttuvat vielä toiselta
// laitteelta (SPEC 16). Auttaa näkemään, onko kyse omista kirjauksista vai automaattisista muutoksista.

import { useLiveQuery } from 'dexie-react-hooks';
import { pendingChanges, type PendingChange } from '../../db/backup';
import { repo } from '../../db/repositories';
import { db } from '../../db/schema';
import { isISODate } from '../../domain/dates';
import { displayTeamName } from '../../domain/opponent';
import type { SyncedTable } from '../../domain/migrations';
import { formatDate } from '../../ui/format';
import { Sheet } from '../../ui/Sheet';
import { savedAtText } from './useSync';

const TABLE_LABEL: Record<SyncedTable, string> = {
  profiles: 'Profiili',
  activityTypes: 'Laji',
  estimates: 'Arkiliikunnan arvio',
  templateItems: 'Viikkorytmin rivi',
  plannedSessions: 'Suunniteltu kerta',
  sessions: 'Kirjaus',
  footballDetails: 'Jalkapallon tiedot',
  dayFlags: 'Päivän merkintä',
  settings: 'Asetukset',
  teams: 'Joukkue',
  fixtures: 'Tuleva peli',
  clubs: 'Seura',
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

function describe(p: PendingChange, typeName: (id: unknown) => string | undefined): string {
  const r = p.row;
  const date = isISODate(r.date as string) ? formatDate(r.date as string, 'EEEEEE d.M.') : undefined;
  const team = str(r.opponent) ?? str(r.eventName) ?? str(r.team);
  const parts = [str(r.label) ?? str(r.name) ?? typeName(r.activityTypeId), team && displayTeamName(team), date];
  return parts.filter(Boolean).join(' · ');
}

function stateOf(p: PendingChange): string {
  if (p.row.deletedAt) return 'poistettu';
  return p.row.createdAt === p.row.updatedAt ? 'uusi' : 'muutettu';
}

export function PendingSheet({ open, onClose, otherRole = 'PC' }: { open: boolean; onClose: () => void; otherRole?: string }) {
  const data = useLiveQuery(async () => {
    if (!open) return undefined;
    const me = (await repo.getMeta<string>('deviceId')) ?? '';
    const [list, types] = await Promise.all([pendingChanges(db, me), db.activityTypes.toArray()]);
    return { list: list.sort((a, b) => b.row.updatedAt.localeCompare(a.row.updatedAt)), types: new Map(types.map((t) => [t.id, t.name])) };
  }, [open]);
  const typeName = (id: unknown) => (typeof id === 'string' ? data?.types.get(id) : undefined);

  return (
    <Sheet open={open} onClose={onClose} title={`Odottaa siirtoa ${otherRole}:lle`}>
      <div className="space-y-3 pb-2">
        <p className="text-sm text-slate-600">
          Tämän laitteen muutokset, joita {otherRole}:n tiedostossa ei vielä ole. "Lähetä {otherRole}:lle" siirtää ne. Kun tuot {otherRole}:n tiedoston, jo siellä olevat poistuvat
          listalta.
        </p>
        {data?.list.length === 0 && <p className="text-sm text-slate-600">Ei odottavia muutoksia.</p>}
        <ul className="space-y-1.5">
          {data?.list.map((p) => (
            <li key={`${p.table}|${p.key}`} className="rounded-2xl bg-[var(--surface-sunk)] px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{TABLE_LABEL[p.table]}</span>
                <span className={`shrink-0 text-xs font-semibold ${p.row.deletedAt ? 'text-red-700' : 'text-slate-600'}`}>{stateOf(p)}</span>
              </div>
              <div className="flex items-baseline gap-2 text-xs text-slate-600">
                <span className="min-w-0 flex-1 truncate">{describe(p, typeName) || '—'}</span>
                <span className="shrink-0 tabular-nums text-slate-500">{savedAtText(p.row.updatedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

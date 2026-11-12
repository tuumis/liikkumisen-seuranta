// Ristiriitalista (SPEC 10): esim. "Ti 12.11. Jalkapallo – treeni: PC:n versio korvattiin puhelimen uudemmalla".

import { useLiveQuery } from 'dexie-react-hooks';
import type { Conflict } from '../../domain/merge';
import type { MergeSummary } from '../../db/backup';
import { repo } from '../../db/repositories';
import { dayLabel } from '../../ui/format';
import { Sheet } from '../../ui/Sheet';
import { ROLE_GEN } from './useSync';

const TABLE_LABEL: Record<string, string> = {
  profiles: 'Profiili',
  activityTypes: 'Liikkumismuoto',
  estimates: 'Perusarvio',
  templateItems: 'Viikkopohjan rivi',
  plannedSessions: 'Suunnitelma',
  sessions: 'Kerta',
  footballDetails: 'Jalkapallon lisätiedot',
  dayFlags: 'Päivämerkintä',
  settings: 'Asetukset',
};

export function ConflictSheet({ summary, onClose }: { summary: MergeSummary | null; onClose: () => void }) {
  const types = useLiveQuery(() => repo.listActivityTypes({ includeArchived: true }), []);
  const role = useLiveQuery(() => repo.getDeviceRole(), []);
  if (!summary) return null;
  const me = role ?? (summary.incomingRole === 'pc' ? 'phone' : 'pc');
  const other = summary.incomingRole;

  const describe = (c: Conflict) => {
    const r = c.incoming as Record<string, unknown>;
    const typeName = types?.find((t) => t.id === r.activityTypeId)?.name;
    const what =
      typeof r.date === 'string' && typeName
        ? `${dayLabel(r.date)} ${typeName}`
        : `${TABLE_LABEL[c.table] ?? c.table}${typeof r.name === 'string' ? ` ${r.name}` : typeof r.label === 'string' ? ` ${r.label}` : ''}`;
    const how =
      c.winner === 'incoming'
        ? `${ROLE_GEN[me]} versio korvattiin ${ROLE_GEN[other]} uudemmalla`
        : `${ROLE_GEN[me]} uudempi versio jäi voimaan`;
    return `${what}: ${how}`;
  };

  return (
    <Sheet open onClose={onClose} title={`Ristiriidat (${summary.conflicts.length})`}>
      <p className="mb-2 text-sm text-slate-600">Näitä tietueita oli muokattu molemmilla laitteilla edellisen synkronoinnin jälkeen. Uudempi muutos jäi voimaan.</p>
      <ul className="space-y-2">
        {summary.conflicts.map((c) => (
          <li key={`${c.table}:${c.key}`} className="card-sunk p-3 text-sm text-slate-800">
            {describe(c)}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

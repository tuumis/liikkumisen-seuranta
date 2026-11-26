// Perhenäkymien näytettävät profiilit (27.11.2026): kun profiileja on enemmän kuin näkymään mahtuu, näkymän yläpuolelle
// tulee "Näytä"-rivi profiilien kuvista. Valinta muistetaan laitteella; valittu profiili on aina mukana.

import { useState, type ReactNode } from 'react';
import { pickShown, toggleShown } from '../domain/familyLimit';
import type { Profile } from '../domain/types';
import { Avatar } from './Avatar';

function readIds(key: string): string[] | null {
  try {
    const v = localStorage.getItem(key);
    return v ? v.split(',').filter(Boolean) : null;
  } catch {
    return null;
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, ids.join(','));
  } catch {
    /* ei muistia */
  }
}

/** Näytettävät profiilit ja valintarivi (null, kun kaikki mahtuvat). */
export function useFamilyShown(key: string, profiles: Profile[] | undefined, selectedId: string, max: number): { shown: Profile[]; picker: ReactNode } {
  const [stored, setStored] = useState<string[] | null>(() => readIds(key));
  const all = profiles ?? [];
  const ids = pickShown(
    all.map((p) => p.id),
    selectedId,
    stored,
    max,
  );
  const shown = all.filter((p) => ids.includes(p.id));
  if (all.length <= max) return { shown, picker: null };
  const toggle = (id: string) => {
    const next = toggleShown(ids, id, selectedId, max);
    setStored(next);
    writeIds(key, next);
  };
  const picker = (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Näytettävät profiilit, enintään ${max}`}>
      <span className="mr-1 text-xs font-semibold text-slate-600">
        Näytä ({ids.length}/{max}):
      </span>
      {all.map((p) => {
        const on = ids.includes(p.id);
        const locked = p.id === selectedId;
        const full = !on && ids.length >= max;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            aria-pressed={on}
            disabled={locked || full}
            title={locked ? `${p.name} on valittu profiili` : full ? `Enintään ${max} kerrallaan: poista ensin joku` : on ? `Piilota ${p.name}` : `Näytä ${p.name}`}
            className={`press flex min-h-9 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-semibold ring-1 disabled:cursor-default ${
              on ? 'bg-[var(--surface-sage)] text-slate-900 ring-green-700/40' : 'text-slate-500 ring-[var(--line)] hover:text-slate-800'
            } ${full ? 'opacity-50' : ''}`}
          >
            <Avatar name={p.name} photo={p.photo} color={p.color} size="sm" className={on ? '' : 'opacity-60'} />
            {p.name}
          </button>
        );
      })}
    </div>
  );
  return { shown, picker };
}

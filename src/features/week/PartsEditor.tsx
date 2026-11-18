// Kerran osat (14.11.2026): esim. liikuntapuistossa trampoliini 60 min, potkulauta 45 min ja kiipeily 30 min.
// Kerran teho lasketaan osien lajeista (domain/intensity partsShares); osien ulkopuolinen aika on taukoja.

import { activityTypeId } from '../../domain/ids';
import { supportsParts } from '../../domain/intensity';
import type { ActivityType, SessionPart } from '../../domain/types';
import { inputClass } from '../../ui/components';
import { TypeGlyph } from '../../ui/TypeGlyph';
import { IconPlus } from '../../ui/icons';

export interface PartDraft {
  key: string;
  typeId: string;
  min: string;
}

/** Pikavalinnat liikuntapuiston tavallisimmista tekemisistä (näytetään, jos laji on valittavissa). */
const QUICK = ['trampoline', 'kick_scooter', 'inline_skating', 'climbing', 'gymnastics', 'outdoor_play', 'running', 'football_self'].map(activityTypeId);

let seq = 0;
export const newPartDraft = (typeId: string, min = ''): PartDraft => ({ key: `p${++seq}`, typeId, min });

export const partDraftsOf = (parts: SessionPart[] | undefined): PartDraft[] => (parts ?? []).map((p) => newPartDraft(p.activityTypeId, String(p.durationMin)));

/** Osat tallennettavaksi; null = jokin minuuttimäärä on virheellinen. Tyhjät rivit ohitetaan. */
export function partsFromDrafts(drafts: PartDraft[]): SessionPart[] | null {
  const out: SessionPart[] = [];
  for (const d of drafts) {
    if (!d.typeId || d.min.trim() === '') continue;
    const n = Number(d.min);
    if (!Number.isInteger(n) || n <= 0 || n > 1440) return null;
    out.push({ activityTypeId: d.typeId, durationMin: n });
  }
  return out;
}

/** Lajit, joita voi käyttää osana (ei toista osiin jaettavaa lajia eikä peliä tai turnausta). */
export const partCandidates = (types: ActivityType[] | undefined) => (types ?? []).filter((t) => !t.archived && !supportsParts(t) && !t.usesPlayedMinutes);

export function PartsEditor({
  types,
  drafts,
  onChange,
  durationMin,
}: {
  types: ActivityType[];
  drafts: PartDraft[];
  onChange: (d: PartDraft[]) => void;
  /** Kerran kesto (min), jos annettu; osien yhteismäärää verrataan siihen. */
  durationMin?: number;
}) {
  const byId = new Map(types.map((t) => [t.id, t]));
  const parsed = partsFromDrafts(drafts);
  const used = (parsed ?? []).reduce((a, p) => a + p.durationMin, 0);
  const over = durationMin !== undefined && used > durationMin;
  const quick = QUICK.map((id) => byId.get(id)).filter((t): t is ActivityType => !!t && !drafts.some((d) => d.typeId === t.id));
  const set = (key: string, patch: Partial<PartDraft>) => onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  return (
    <div className="space-y-2 rounded-2xl bg-[var(--surface-sunk)] p-3">
      <div>
        <div className="text-sm font-medium text-slate-800">Mitä teit? (valinnainen)</div>
        <p className="text-xs text-slate-500">Merkitse tekemiset ja niiden kesto. Teho lasketaan tekemisten lajeista; muu aika lasketaan tauoiksi ja siirtymiksi.</p>
      </div>
      {drafts.length > 0 && (
        <ul className="space-y-2">
          {drafts.map((d) => (
            <li key={d.key} className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.5rem_2.25rem] items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-raised)] text-lg" aria-hidden>
                <TypeGlyph t={byId.get(d.typeId)} />
              </span>
              <select className={`${inputClass} !bg-[var(--surface-raised)]`} value={d.typeId} onChange={(e) => set(d.key, { typeId: e.target.value })} aria-label="Tekeminen">
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.name}
                  </option>
                ))}
              </select>
              <input
                className={`${inputClass} !bg-[var(--surface-raised)] !px-2 text-right`}
                inputMode="numeric"
                value={d.min}
                onChange={(e) => set(d.key, { min: e.target.value })}
                placeholder="min"
                aria-label={`${byId.get(d.typeId)?.name ?? 'Tekeminen'}: minuutit`}
              />
              <button
                type="button"
                onClick={() => onChange(drafts.filter((x) => x.key !== d.key))}
                className="press flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-[var(--surface-raised)]"
                aria-label={`Poista ${byId.get(d.typeId)?.name ?? 'tekeminen'}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-1.5">
        {quick.slice(0, 6).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange([...drafts, newPartDraft(t.id)])}
            className="press inline-flex min-h-9 items-center gap-1 rounded-full bg-[var(--surface-raised)] px-3 text-xs font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            <IconPlus size="0.85rem" /> <TypeGlyph t={t} /> {t.name}
          </button>
        ))}
        {types.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([...drafts, newPartDraft((quick[0] ?? types[0]).id)])}
            className="press inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold text-green-800 hover:bg-[var(--surface-raised)]"
          >
            <IconPlus size="0.85rem" /> Muu tekeminen
          </button>
        )}
      </div>
      {drafts.length > 0 && (
        <p className={`text-xs ${parsed === null || over ? 'font-semibold text-red-700' : 'text-slate-600'}`} aria-live="polite">
          {parsed === null
            ? 'Anna minuutit kokonaislukuina.'
            : `Tekemiset yhteensä ${used} min${durationMin !== undefined ? ` / ${durationMin} min` : ''}${
                over ? ' – ylittää keston' : durationMin !== undefined && durationMin > used ? ` · tauot ja siirtymät ${durationMin - used} min` : ''
              }`}
        </p>
      )}
    </div>
  );
}

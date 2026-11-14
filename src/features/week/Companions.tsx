// Sama tapahtuma usealle profiilille (14.11.2026): esim. perheen ulkoilu, jossa molemmat lapset ovat mukana.
// Tallennus luo jokaiselle profiilille oman kerran tai suunnitelman; kestoa, ponnistelua ja vahvistavia
// valintoja voi säätää profiileittain ennen tallennusta. Tallennuksen jälkeen kerrat ovat toisistaan erillisiä.

import { useLiveQuery } from 'dexie-react-hooks';
import type { Effort, Profile, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Avatar } from '../../ui/Avatar';
import { inputClass } from '../../ui/components';
import { EFFORT_OPTIONS, Segmented, ToggleChip } from '../../ui/controls';

export interface Companion {
  profileId: UUID;
  /** Tyhjä = sama kesto kuin pääkerralla. */
  duration: string;
  effort: Effort;
  muscle: boolean;
  bone: boolean;
}

/** Seuralaisen kesto (min) tai null, jos virheellinen; tyhjä → pääkerran kesto. */
export function companionDuration(c: Companion, main: number): number | null {
  if (c.duration.trim() === '') return main;
  const n = Number(c.duration);
  return Number.isInteger(n) && n >= 1 && n <= 1440 ? n : null;
}

export function CompanionsPicker({
  mainProfileId,
  value,
  onChange,
  defaults,
  mainDuration,
  intensity = false,
  strength,
}: {
  mainProfileId: UUID;
  value: Companion[];
  onChange: (v: Companion[]) => void;
  /** Uuden seuralaisen lähtöarvot (pääkerran valinnat). */
  defaults: { effort: Effort; muscle: boolean; bone: boolean };
  mainDuration?: string;
  /** Kirjaus: ponnistelu profiileittain (suunnitelmassa vain kesto). */
  intensity?: boolean;
  /** Näytetäänkö lihas- ja luustovalinnat (lajin mukaan). */
  strength?: { muscle: boolean; bone: boolean };
}) {
  const profiles = useLiveQuery(() => repo.listProfiles(), []);
  const others = (profiles ?? []).filter((p) => p.id !== mainProfileId);
  if (!others.length) return null;
  const byId = new Map(others.map((p) => [p.id, p]));
  const toggle = (p: Profile) =>
    onChange(value.some((c) => c.profileId === p.id) ? value.filter((c) => c.profileId !== p.id) : [...value, { profileId: p.id, duration: '', ...defaults }]);
  const set = (id: UUID, patch: Partial<Companion>) => onChange(value.map((c) => (c.profileId === id ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-700">Mukana myös</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Mukana myös">
        {others.map((p) => {
          const on = value.some((c) => c.profileId === p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(p)}
              className={`press inline-flex min-h-10 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 text-sm font-semibold ring-1 ${
                on ? 'bg-[var(--surface-sage)] text-green-900 ring-green-700/40' : 'bg-[var(--surface-raised)] text-slate-700 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              <Avatar name={p.name} photo={p.photo} color={p.color} size="sm" />
              {on ? '✓ ' : '+ '}
              {p.name}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((c) => {
            const p = byId.get(c.profileId);
            if (!p) return null;
            return (
              <li key={c.profileId} className="space-y-2 rounded-2xl bg-[var(--surface-sunk)] p-3">
                <div className="flex items-center gap-2">
                  <Avatar name={p.name} photo={p.photo} color={p.color} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{p.name}</span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    Kesto
                    <input
                      className={`${inputClass} !min-h-9 w-20 !bg-[var(--surface-raised)] !px-2 text-right text-sm`}
                      inputMode="numeric"
                      value={c.duration}
                      placeholder={mainDuration || 'min'}
                      onChange={(e) => set(c.profileId, { duration: e.target.value })}
                      aria-label={`${p.name}: kesto minuutteina`}
                    />
                    min
                  </label>
                </div>
                {intensity && (
                  <Segmented<Effort> label={`${p.name}: teho`} value={c.effort} onChange={(v) => set(c.profileId, { effort: v })} options={EFFORT_OPTIONS} />
                )}
                {strength && (strength.muscle || strength.bone) && (
                  <div className="flex flex-wrap gap-2">
                    {strength.muscle && (
                      <ToggleChip on={c.muscle} onChange={(v) => set(c.profileId, { muscle: v })}>
                        Lihaksia vahvistava
                      </ToggleChip>
                    )}
                    {strength.bone && (
                      <ToggleChip on={c.bone} onChange={(v) => set(c.profileId, { bone: v })}>
                        Luustoa vahvistava
                      </ToggleChip>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          <p className="text-xs text-slate-500">
            Jokaiselle tallennetaan oma {intensity ? 'kerta' : 'suunnitelma'}; tyhjä kesto = sama kuin yllä. Myöhemmin kutakin muokataan erikseen.
          </p>
        </ul>
      )}
    </div>
  );
}

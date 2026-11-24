// Lihaksia ja luustoa vahvistava -valinnat (24.11.2026, käyttäjän toive): näkyvät kaikilla lajeilla, ja
// valinnan voi tallentaa lajin oletukseksi (esim. lihas esivalituksi jalkapallon treeneihin). Lajin oletus:
// 'yes' = esivalittu, muut = ei esivalittu. Käytössä kirjauksessa, kerran muokkauksessa ja kuittauksessa.

import type { ActivityType } from '../../domain/types';
import { repo } from '../../db/repositories';
import { ToggleChip } from '../../ui/controls';
import { TermInfo } from '../../ui/glossary';

/** Poikkeaako valinta lajin oletuksesta (silloin tarjotaan "Tallenna lajin oletukseksi"). */
export const differsFromDefault = (t: ActivityType, muscle: boolean, bone: boolean) => muscle !== (t.muscleDefault === 'yes') || bone !== (t.boneDefault === 'yes');

/** Tallentaa valinnan lajin oletukseksi; palauttaa true, jos jotain muuttui. */
export async function saveStrengthDefault(t: ActivityType, muscle: boolean, bone: boolean): Promise<boolean> {
  if (!differsFromDefault(t, muscle, bone)) return false;
  await repo.updateActivityType(t.id, { muscleDefault: muscle ? 'yes' : 'ask', boneDefault: bone ? 'yes' : 'ask' });
  return true;
}

export function StrengthFields({
  type,
  muscle,
  bone,
  onMuscle,
  onBone,
  saveDefault,
  onSaveDefault,
}: {
  type: ActivityType;
  muscle: boolean;
  bone: boolean;
  onMuscle: (v: boolean) => void;
  onBone: (v: boolean) => void;
  saveDefault: boolean;
  onSaveDefault: (v: boolean) => void;
}) {
  const differs = differsFromDefault(type, muscle, bone);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1">
          <ToggleChip on={muscle} onChange={onMuscle}>
            Lihaksia vahvistava
          </ToggleChip>
          <TermInfo id="muscle" />
        </span>
        <span className="inline-flex items-center gap-1">
          <ToggleChip on={bone} onChange={onBone}>
            Luustoa vahvistava
          </ToggleChip>
          <TermInfo id="bone" align="right" />
        </span>
      </div>
      {differs && (
        <label className="flex min-h-9 items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={saveDefault} onChange={(e) => onSaveDefault(e.target.checked)} />
          Tallenna lajin oletukseksi ({type.name})
        </label>
      )}
      <p className="text-xs text-slate-500">
        Lihakset: kiipeily, punnerrukset, kuntopiiri. Luusto: hypyt, juoksu, pallopelit. Lajien oletukset: Asetukset → Liikkumismuodot ja tehoprofiilit.
      </p>
    </div>
  );
}

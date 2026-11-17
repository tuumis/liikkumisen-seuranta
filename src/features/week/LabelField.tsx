// Tarkenne lajin rinnalle (esim. Joukkuetreeni, Talenttitreeni, Taitokoulu, Futsal). Aiemmin
// käytetyt tarkenteet näkyvät pikavalintoina.

import { useLiveQuery } from 'dexie-react-hooks';
import { activityTypeId as typeIdOf } from '../../domain/ids';
import type { UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Field, inputClass } from '../../ui/components';
import { ToggleChip } from '../../ui/controls';

export function LabelField({
  profileId,
  activityTypeId,
  value,
  onChange,
  placeholder = 'esim. Talenttitreeni, Futsal',
}: {
  profileId: UUID;
  activityTypeId: UUID;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const recent = useLiveQuery(() => repo.recentLabels(profileId, activityTypeId), [profileId, activityTypeId]) ?? [];
  const id = `labels-${activityTypeId}`;
  // Liikuntapuisto: tarkenne kertoo, mikä puisto (17.11.2026), esim. "Superpark · Liikuntapuisto".
  const park = activityTypeId === typeIdOf('activity_park');
  return (
    <Field
      label={park ? 'Mikä liikuntapuisto? (valinnainen)' : 'Tarkenne (valinnainen)'}
      hint={park ? 'Näkyy kerran nimenä, esim. Superpark · Liikuntapuisto. Aiemmat puistot pikavalintoina.' : 'Näkyy viikolla lajin nimen kohdalla, jotta saman päivän kerrat erottaa toisistaan.'}
    >
      <input
        className={inputClass}
        value={value}
        maxLength={40}
        placeholder={park ? 'esim. Superpark, Hoplop, Flowpark' : placeholder}
        list={id}
        onChange={(e) => onChange(e.target.value)}
        aria-label={park ? 'Mikä liikuntapuisto' : 'Tarkenne'}
      />
      <datalist id={id}>
        {recent.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      {recent.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-1.5">
          {recent.map((l) => (
            <ToggleChip key={l} on={value.trim().toLocaleLowerCase('fi') === l.toLocaleLowerCase('fi')} onChange={(on) => onChange(on ? l : '')}>
              {l}
            </ToggleChip>
          ))}
        </span>
      )}
    </Field>
  );
}

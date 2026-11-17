// Koti/vieras-valinta (18.11.2026): valinnainen tieto pelille ja turnauksen otteluohjelman riville.
// Näkyy halutessa ennakko- ja tuloskuvassa.

import { HOME_AWAY_LABEL } from '../../domain/football';
import type { HomeAway } from '../../domain/types';
import { inputClass } from '../../ui/components';
import { ToggleChip } from '../../ui/controls';

/** Koti / Vieras -painikkeet; uudelleen painallus poistaa valinnan. */
export function HomeAwayChips({ value, onChange, label }: { value: HomeAway | ''; onChange: (v: HomeAway | '') => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {(['home', 'away'] as const).map((v) => (
        <ToggleChip key={v} on={value === v} onChange={() => onChange(value === v ? '' : v)}>
          {HOME_AWAY_LABEL[v]}
        </ToggleChip>
      ))}
    </div>
  );
}

/** Tiivis valinta otteluohjelman riville (ajan alle, kentän viereen). */
export function HomeAwaySelect({ value, onChange, label }: { value: HomeAway | ''; onChange: (v: HomeAway | '') => void; label: string }) {
  return (
    <select className={`${inputClass} px-2 text-sm`} value={value} aria-label={label} onChange={(e) => onChange(e.target.value as HomeAway | '')}>
      <option value="">Koti/vieras</option>
      <option value="home">{HOME_AWAY_LABEL.home}</option>
      <option value="away">{HOME_AWAY_LABEL.away}</option>
    </select>
  );
}

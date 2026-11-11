// Tehon valinta kirjauksessa: lajin arvio (tehoprofiili + ponnistelu), "enimmäkseen …" -esiasetus
// tai oma jako minuutteina. Kaikki muut kuin oma jako ovat sovelluksen arvioita.

import { effectiveShares, INTENSITY_PRESETS } from '../../domain/intensity';
import type { ActivityType, Effort, IntensityPreset, IntensityShares } from '../../domain/types';
import { inputClass } from '../../ui/components';
import { EFFORT_OPTIONS, Segmented, ToggleChip } from '../../ui/controls';
import { pct } from '../../ui/labels';

export type IntensityMode = 'profile' | IntensityPreset | 'manual';
export type ManualDraft = { light: string; moderate: string; vigorous: string };

const OPTIONS: { value: IntensityMode; label: string }[] = [
  { value: 'profile', label: 'Lajin arvio' },
  { value: 'light', label: 'Enimmäkseen kevyttä' },
  { value: 'moderate', label: 'Enimmäkseen reipasta' },
  { value: 'vigorous', label: 'Enimmäkseen rasittavaa' },
  { value: 'manual', label: 'Oma jako' },
];

export const isPreset = (m: IntensityMode): m is IntensityPreset => m === 'light' || m === 'moderate' || m === 'vigorous';

function sharesText(s: IntensityShares) {
  const rest = Math.max(0, 1 - s.light - s.moderate - s.vigorous);
  return `kevyt ${pct(s.light)} · reipas ${pct(s.moderate)} · rasittava ${pct(s.vigorous)}${rest > 0.005 ? ` · paikallaan ${pct(rest)}` : ''}`;
}

export function IntensityPicker({
  type,
  shares,
  mode,
  onMode,
  effort,
  onEffort,
  manual,
  onManual,
}: {
  type: ActivityType;
  /** Lajin arviossa käytettävä profiili (muokkauksessa kerran oma). */
  shares: IntensityShares;
  mode: IntensityMode;
  onMode: (m: IntensityMode) => void;
  effort: Effort;
  onEffort: (e: Effort) => void;
  manual: ManualDraft;
  onManual: (m: ManualDraft) => void;
}) {
  const shown = mode === 'profile' ? effectiveShares(shares, effort) : isPreset(mode) ? INTENSITY_PRESETS[mode] : undefined;
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-700">Teho</div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Teho">
        {OPTIONS.map((o) => (
          <ToggleChip key={o.value} on={mode === o.value} onChange={() => onMode(o.value)}>
            {o.label}
          </ToggleChip>
        ))}
      </div>
      {mode === 'profile' && <Segmented label="Ponnistelu" value={effort} options={EFFORT_OPTIONS} onChange={onEffort} />}
      {shown && (
        <p className="text-xs text-slate-600">
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">arvio</span> {sharesText(shown)}
          {mode === 'profile' && <span className="text-slate-500"> ({type.name.toLowerCase()}{effort ? `, ${effort > 0 ? 'kovempi' : 'kevyempi'}` : ''})</span>}
        </p>
      )}
      {mode === 'manual' && (
        <div className="grid grid-cols-3 gap-2">
          {(['light', 'moderate', 'vigorous'] as const).map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs text-slate-600">{k === 'light' ? 'Kevyt min' : k === 'moderate' ? 'Reipas min' : 'Rasittava min'}</span>
              <input className={inputClass} inputMode="numeric" value={manual[k]} onChange={(e) => onManual({ ...manual, [k]: e.target.value })} />
            </label>
          ))}
          <p className="col-span-3 text-xs text-slate-500">Minuuttien summa saa olla enintään kesto; loput on paikallaanoloa.</p>
        </div>
      )}
    </div>
  );
}

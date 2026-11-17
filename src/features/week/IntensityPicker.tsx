// Tehon valinta kirjauksessa: lajin arvio (tehoprofiili + ponnistelu), "enimmäkseen …" -esiasetus
// tai oma jako minuutteina. Kaikki muut kuin oma jako ovat sovelluksen arvioita.

import { effectiveShares, INTENSITY_PRESETS } from '../../domain/intensity';
import { mvpaOf } from '../../domain/intensity';
import type { ActivityType, Effort, IntensityMinutes, IntensityPreset, IntensityShares } from '../../domain/types';
import { EstimateBadge, inputClass } from '../../ui/components';
import { EFFORT_OPTIONS, Segmented, ToggleChip } from '../../ui/controls';
import { pct } from '../../ui/labels';
import { TermInfo } from '../../ui/glossary';
import { InfoTip } from '../../ui/InfoTip';
import { intensityNoteFor, sharesDiffer } from '../../domain/intensityNotes';
import { BUILT_IN_ACTIVITY_TYPES } from '../../seed/activityTypes';

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

/** Lajin tehoprofiilin perustelu selitteenä ("Miksi tämä jako?"); omalle lajille ei näytetä. */
export function TypeIntensityNote({ type, align = 'right' }: { type: ActivityType; align?: 'left' | 'right' }) {
  const text = intensityNoteText(type);
  if (!text) return null;
  return (
    <>
      {' '}
      <InfoTip
        align={align}
        className="font-medium text-slate-600 underline decoration-dotted decoration-slate-400 underline-offset-[3px] hover:text-slate-900"
        tip={
          <>
            <strong className="mb-1 block text-[13px]">{type.name}: miksi tämä jako?</strong>
            {text}
          </>
        }
      >
        Miksi tämä jako?
      </InfoTip>
    </>
  );
}

/** Perustelu tekstinä; jos oletusta on muutettu, kerrotaan että perustelu koskee oletusta. */
export function intensityNoteText(type: ActivityType): string | undefined {
  const note = intensityNoteFor(type);
  if (!note) return undefined;
  const seed = BUILT_IN_ACTIVITY_TYPES.find((t) => t.id === type.id);
  if (seed && sharesDiffer(seed.shares, type.shares))
    return `${note} (Tämä on perustelu oletukselle ${pct(seed.shares.light)} / ${pct(seed.shares.moderate)} / ${pct(seed.shares.vigorous)}; lajin tehoprofiilia on muutettu.)`;
  return note;
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
  minutes,
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
  /** Kerran arvioidut minuutit (kesto tiedossa); näytetään arvion pääasiana (17.11.2026). */
  minutes?: IntensityMinutes;
}) {
  const shown = mode === 'profile' ? effectiveShares(shares, effort) : isPreset(mode) ? INTENSITY_PRESETS[mode] : undefined;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        Teho <TermInfo id="intensity" />
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Teho">
        {OPTIONS.map((o) => (
          <ToggleChip key={o.value} on={mode === o.value} onChange={() => onMode(o.value)}>
            {o.label}
          </ToggleChip>
        ))}
      </div>
      {mode === 'profile' && <Segmented label="Ponnistelu" value={effort} options={EFFORT_OPTIONS} onChange={onEffort} />}
      {shown && (
        // Yksi arviolaatikko (käyttäjän palaute 17.11.2026): otsikkorivi, minuutit ja jako pienellä.
        <div className="card-sunk space-y-2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <EstimateBadge />
              {mode === 'profile' ? `${type.name}${effort ? (effort > 0 ? ', kovempi' : ', kevyempi') : ''}` : OPTIONS.find((o) => o.value === mode)?.label}
            </span>
            {mode === 'profile' && <TypeIntensityNote type={type} align="right" />}
          </div>
          {minutes && (
            <>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ['Kevyt', minutes.light],
                    ['Reipas', minutes.moderate],
                    ['Rasittava', minutes.vigorous],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="rounded-lg bg-[var(--surface)] px-2 py-1.5">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                    <dd className="text-base font-semibold tabular-nums text-slate-900">
                      {v} <span className="text-xs font-medium text-slate-500">min</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm text-slate-700">
                Reipasta ja rasittavaa yhteensä <strong className="tabular-nums">{mvpaOf(minutes)} min</strong>
              </p>
            </>
          )}
          <p className="text-xs text-slate-500">Jako: {sharesText(shown)}</p>
        </div>
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

// Kuittaus lisätiedoilla (24.11.2026, käyttäjän toive: treenin päätyttyä kuittaus ja samalla omatoiminen
// verryttely, teho ja lihas/luusto). Käytössä viikon läpikäynnissä (myös ilmoituksesta) ja päiväkortissa.
// Oletukset: suunniteltu kesto, lajin arvio, lajin lihas/luusto-oletukset ja viikkorytmin verryttely.

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { isClubTraining } from '../../domain/football';
import type { ActivityType, IntensityPreset, PlannedSession } from '../../domain/types';
import type { ConfirmDetails } from '../../db/repositories';
import { repo } from '../../db/repositories';
import { Button, Field, inputClass } from '../../ui/components';
import { ToggleChip } from '../../ui/controls';
import { saveStrengthDefault, StrengthFields } from '../week/StrengthFields';
import { TermInfo } from '../../ui/glossary';
import { parseSelfMin, TrainingSelfFields } from '../football/TrainingSelf';
import { durationSchema } from '../week/sessionForm';

type Teho = 'profile' | IntensityPreset;

/** Tehon vaihtoehdot: samat sanat kuin kerran muokkauksessa (ilman omaa jakoa). */
export const CONFIRM_INTENSITY: { value: Teho; label: string }[] = [
  { value: 'profile', label: 'Lajin arvio' },
  { value: 'light', label: 'Enimmäkseen kevyttä' },
  { value: 'moderate', label: 'Enimmäkseen reipasta' },
  { value: 'vigorous', label: 'Enimmäkseen rasittavaa' },
];

export function ConfirmForm({
  plan,
  type,
  onConfirm,
  onCancel,
}: {
  plan: PlannedSession;
  type?: ActivityType;
  onConfirm: (d: ConfirmDetails) => Promise<void> | void;
  onCancel: () => void;
}) {
  const club = isClubTraining(type);
  const item = useLiveQuery(
    async () => (club && plan.templateItemId ? ((await repo.listTemplateItems(plan.profileId)).find((i) => i.id === plan.templateItemId) ?? null) : null),
    [club, plan.profileId, plan.templateItemId],
  );
  const [duration, setDuration] = useState(String(plan.durationMin));
  const [teho, setTeho] = useState<Teho>('profile');
  const [muscle, setMuscle] = useState(type?.muscleDefault === 'yes');
  const [bone, setBone] = useState(type?.boneDefault === 'yes');
  const [saveDefault, setSaveDefault] = useState(false);
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ duration?: string; self?: string }>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setMuscle(type?.muscleDefault === 'yes');
    setBone(type?.boneDefault === 'yes');
  }, [type?.muscleDefault, type?.boneDefault]);

  // Viikkorytmin verryttely esitäytettynä (käyttäjä voi muuttaa tai tyhjentää).
  const beforeVal = before ?? (item?.selfBeforeMin ? String(item.selfBeforeMin) : '');
  const afterVal = after ?? (item?.selfAfterMin ? String(item.selfAfterMin) : '');

  async function submit() {
    const d = durationSchema.safeParse(duration);
    const sb = parseSelfMin(beforeVal);
    const sa = parseSelfMin(afterVal);
    const errs: typeof errors = {};
    if (!d.success) errs.duration = d.error.issues[0].message;
    if (club && (sb === null || sa === null)) errs.self = 'Anna minuutit kokonaislukuina (0–180)';
    setErrors(errs);
    if (!d.success || errs.self) return;
    setSaving(true);
    try {
      if (saveDefault && type) await saveStrengthDefault(type, muscle, bone);
      await onConfirm({
        durationMin: d.data,
        intensityPreset: teho === 'profile' ? undefined : teho,
        muscle,
        bone,
        self: club ? { before: sb ?? 0, after: sa ?? 0 } : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label="Toteutunut kesto (min)">
        <input className={inputClass} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Toteutunut kesto minuutteina" />
        {errors.duration && <span className="mt-1 block text-sm text-red-700">{errors.duration}</span>}
      </Field>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          Teho <TermInfo id="intensity" />
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Teho">
          {CONFIRM_INTENSITY.map((o) => (
            <ToggleChip key={o.value} on={teho === o.value} onChange={() => setTeho(o.value)}>
              {o.label}
            </ToggleChip>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {teho === 'profile' ? `Lajin arvio: ${type?.name ?? 'laji'} tavallisella teholla.` : 'Kerran minuutit lasketaan valitulla teholla lajin arvion sijaan.'}
        </p>
      </div>

      {type && <StrengthFields type={type} muscle={muscle} bone={bone} onMuscle={setMuscle} onBone={setBone} saveDefault={saveDefault} onSaveDefault={setSaveDefault} />}

      {club && (
        <TrainingSelfFields
          before={beforeVal}
          after={afterVal}
          onBefore={setBefore}
          onAfter={setAfter}
          error={errors.self}
          hint={item && (item.selfBeforeMin || item.selfAfterMin) ? 'Esitäytetty viikkorytmistä. Kirjataan treenin viereen omaksi kerraksi; treenin kesto ei muutu.' : undefined}
        />
      )}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={saving}>
          Kuittaa tehdyksi
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Peruuta
        </Button>
      </div>
    </form>
  );
}

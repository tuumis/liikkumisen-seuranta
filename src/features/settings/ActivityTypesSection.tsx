// Liikkumismuodot ja tehoprofiilit (SPEC 5, 12): muokkaus, lähtöoletusten palautus ja "Laske uudelleen".
// Profiilit ovat sovelluksen arvioita; muutos ei koske vanhoja kertoja (niillä on oma sharesSnapshot).

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays } from '../../domain/dates';
import { minutesFromShares, mvpaOf } from '../../domain/intensity';
import type { ActivityType, StrengthDefault } from '../../domain/types';
import { repo } from '../../db/repositories';
import { BUILT_IN_ACTIVITY_TYPES } from '../../seed/activityTypes';
import { Button, Card, EstimateBadge, inputClass } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { CATEGORY_LABEL, MOVEMENT_GROUP_LABEL, pct, STRENGTH_LABEL } from '../../ui/labels';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { useHiddenCategoriesAnyProfile, visibleTypes } from '../week/useLoggableTypes';
import { DateInput } from '../../ui/DateInput';

const STRENGTH_OPTIONS: { value: StrengthDefault; label: string }[] = [
  { value: 'yes', label: 'Esivalittu' },
  { value: 'ask', label: 'Kysytään' },
  { value: 'no', label: 'Ei näytetä' },
];

export function ActivityTypesSection() {
  // Välitunnit (arkiliikunnan arvio käytössä) eivät ole kirjattava laji: niiden teho asetetaan arviossa.
  const hidden = useHiddenCategoriesAnyProfile(todayFn());
  const types = visibleTypes(useLiveQuery(() => repo.listActivityTypes(), []), hidden);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityType | null>(null);
  return (
    <Card
      title="Liikkumismuodot ja tehoprofiilit"
      action={
        <Button variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Piilota' : `Näytä (${types?.length ?? 0})`}
        </Button>
      }
    >
      <p className="text-sm text-slate-600">
        Tehoprofiili kertoo arviolta, kuinka suuri osa kestosta on kevyttä, reipasta ja rasittavaa; loput on paikallaanoloa. Arvot ovat sovelluksen lähtöoletuksia, eivät virallisia lukuja. Voit korjata ne vastaamaan esimerkiksi lapsesi treenejä.
        {hidden.size > 0 && ' Välituntien teho asetetaan arkiliikunnan arviossa (Asetukset → Arkiliikunta).'}
      </p>
      {open && (
        <ul className="mt-3 divide-y divide-slate-100">
          {types?.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => setEditing(t)} className="flex w-full items-start gap-2 py-3 text-left hover:bg-slate-50">
                <span className="text-xl" aria-hidden>
                  {t.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-900">{t.name}</span>
                  <span className="block text-xs text-slate-600">
                    {CATEGORY_LABEL[t.category]} · {MOVEMENT_GROUP_LABEL[t.movementGroup]}
                    {t.usesPlayedMinutes && ' · pelatut minuutit'}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700">
                    <EstimateBadge />
                    <span>kevyt {pct(t.shares.light)}</span>
                    <span>reipas {pct(t.shares.moderate)}</span>
                    <span>rasittava {pct(t.shares.vigorous)}</span>
                    <span>lihas {STRENGTH_LABEL[t.muscleDefault]}</span>
                    <span>luusto {STRENGTH_LABEL[t.boneDefault]}</span>
                  </span>
                </span>
                <span className="pt-1 text-slate-400" aria-hidden>
                  ✎
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <TypeEditor type={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

function TypeEditor({ type, onClose }: { type: ActivityType | null; onClose: () => void }) {
  const toast = useToast();
  const today = todayFn();
  const [pcts, setPcts] = useState({ light: '', moderate: '', vigorous: '' });
  const [muscle, setMuscle] = useState<StrengthDefault>('ask');
  const [bone, setBone] = useState<StrengthDefault>('ask');
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<ActivityType | null>(null);
  const [from, setFrom] = useState(addDays(today, -28));

  useEffect(() => {
    if (!type) return;
    setPcts({
      light: String(Math.round(type.shares.light * 100)),
      moderate: String(Math.round(type.shares.moderate * 100)),
      vigorous: String(Math.round(type.shares.vigorous * 100)),
    });
    setMuscle(type.muscleDefault);
    setBone(type.boneDefault);
    setError(undefined);
    setSaved(null);
  }, [type]);

  const affected = useLiveQuery(
    () => (saved && from ? repo.recalculableSessions(saved.id, from).then((r) => r.length) : Promise.resolve(0)),
    [saved?.id, from],
  );

  if (!type) return null;
  const nums = (['light', 'moderate', 'vigorous'] as const).map((k) => Number(pcts[k]));
  const valid = nums.every((x) => Number.isInteger(x) && x >= 0 && x <= 100) && nums.reduce((a, b) => a + b, 0) <= 100;
  const shares = valid ? { light: nums[0] / 100, moderate: nums[1] / 100, vigorous: nums[2] / 100 } : undefined;
  const preview = shares ? minutesFromShares(60, shares) : undefined;
  const rest = valid ? 100 - nums.reduce((a, b) => a + b, 0) : undefined;
  const seed = BUILT_IN_ACTIVITY_TYPES.find((t) => t.id === type.id);

  async function save() {
    if (!shares) return setError('Anna osuudet kokonaislukuina 0–100 %; yhteensä enintään 100 %.');
    const t = await repo.updateActivityType(type!.id, { shares, muscleDefault: muscle, boneDefault: bone });
    setSaved(t);
    toast('Tehoprofiili tallennettu – vanhat kerrat eivät muuttuneet');
  }

  async function restore() {
    const t = await repo.restoreActivityTypeDefaults(type!.id);
    setPcts({
      light: String(Math.round(t.shares.light * 100)),
      moderate: String(Math.round(t.shares.moderate * 100)),
      vigorous: String(Math.round(t.shares.vigorous * 100)),
    });
    setMuscle(t.muscleDefault);
    setBone(t.boneDefault);
    setSaved(t);
    toast('Lähtöoletukset palautettu');
  }

  async function recalc() {
    const n = await repo.recalculateSessions(type!.id, from);
    toast(`Laskettu uudelleen: ${n} ${n === 1 ? 'kerta' : 'kertaa'}`);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={`${type.icon} ${type.name}`}>
      <div className="space-y-4">
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Tehoprofiili (% kestosta)</div>
          <div className="grid grid-cols-3 gap-2">
            {(['light', 'moderate', 'vigorous'] as const).map((k) => (
              <label key={k} className="block">
                <span className="mb-1 block text-xs text-slate-600">{k === 'light' ? 'Kevyt' : k === 'moderate' ? 'Reipas' : 'Rasittava'}</span>
                <input className={inputClass} inputMode="numeric" value={pcts[k]} onChange={(e) => setPcts({ ...pcts, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          {valid ? (
            <p className="mt-2 text-xs text-slate-600">
              Paikallaanoloa {rest} %. <EstimateBadge /> 60 min:n kerrasta kevyt {preview!.light} · reipas {preview!.moderate} · rasittava {preview!.vigorous} min (reipasta ja rasittavaa {mvpaOf(preview!)} min).
            </p>
          ) : (
            <p className="mt-2 text-xs text-red-700">Osuudet 0–100 %, yhteensä enintään 100 %.</p>
          )}
        </div>
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Lihaksia vahvistava</div>
          <Segmented label="Lihaksia vahvistava" value={muscle} onChange={setMuscle} options={STRENGTH_OPTIONS} />
        </div>
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Luustoa vahvistava</div>
          <Segmented label="Luustoa vahvistava" value={bone} onChange={setBone} options={STRENGTH_OPTIONS} />
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={!valid} className="flex-1">
            Tallenna
          </Button>
          {seed && (
            <Button variant="secondary" onClick={restore}>
              Palauta oletus ({pct(seed.shares.light)} / {pct(seed.shares.moderate)} / {pct(seed.shares.vigorous)})
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">Muutos koskee uusia kirjauksia. Vanhat kerrat säilyttävät oman profiilinsa, ellet laske niitä uudelleen.</p>

        {saved && (
          <div className="space-y-2 card-sunk p-3">
            <div className="text-sm font-medium text-slate-800">Laske uudelleen</div>
            <p className="text-xs text-slate-600">
              Lasketaan tämän lajin kerrat uudella profiililla valitusta päivästä alkaen. Käsin syötettyjä ja "enimmäkseen …" -valinnalla kirjattuja kertoja ei muuteta.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-slate-700">
                Alkaen{' '}
                <DateInput className="field-shell inline-flex min-h-10 min-w-40 border-0 px-2 text-sm" value={from} max={today} onChange={setFrom} aria-label="Alkaen" />
              </label>
              <Button variant="secondary" disabled={!affected} onClick={recalc}>
                Laske uudelleen ({affected ?? 0} {affected === 1 ? 'kerta' : 'kertaa'})
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

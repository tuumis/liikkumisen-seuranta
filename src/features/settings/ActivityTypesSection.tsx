// Liikkumismuodot ja tehoprofiilit (SPEC 5, 12, 16): muokkaus, lähtöoletusten palautus, "Laske uudelleen",
// omat lajit (nimi, emoji tai oma kuva) ja profiilikohtainen piilotus (14.11.2026).
// Profiilit ovat sovelluksen arvioita; muutos ei koske vanhoja kertoja (niillä on oma sharesSnapshot).

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays } from '../../domain/dates';
import { minutesFromShares, mvpaOf } from '../../domain/intensity';
import type { ActivityType, Category, MovementGroup, Profile, StrengthDefault } from '../../domain/types';
import { repo } from '../../db/repositories';
import { BUILT_IN_ACTIVITY_TYPES } from '../../seed/activityTypes';
import { Button, Card, EstimateBadge, Field, inputClass } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { CATEGORY_LABEL, MOVEMENT_GROUP_LABEL, pct, STRENGTH_LABEL } from '../../ui/labels';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { useFootballAnyProfile, withoutClubFootball } from '../football/useFootballEnabled';
import { DateInput } from '../../ui/DateInput';
import { TermInfo } from '../../ui/glossary';
import { intensityNoteText } from '../week/IntensityPicker';
import { TypeGlyph } from '../../ui/TypeGlyph';
import { PhotoPicker } from '../../ui/Avatar';
import { IconCheck, IconPencil, IconPlus } from '../../ui/icons';

const STRENGTH_OPTIONS: { value: StrengthDefault; label: string }[] = [
  { value: 'yes', label: 'Esivalittu' },
  { value: 'ask', label: 'Kysytään' },
  { value: 'no', label: 'Ei näytetä' },
];

/** Pikavalinnat oman lajin kuvakkeeksi (voi kirjoittaa myös oman emojin). */
const EMOJI_PICKS = ['🏃', '🚴', '🛹', '🛼', '🧗', '🤸', '🏊', '⛸️', '🎿', '🛷', '🏀', '🏐', '🎾', '🏸', '🥋', '🧘', '🐴', '🎯', '🎢', '🌲', '⛹️', '🏓', '🥏', '✳️'];

const NEW_SHARES = { light: 40, moderate: 35, vigorous: 10 };

export function ActivityTypesSection() {
  // Seurajalkapallon lajit vain, jos jalkapallo on käytössä jollakin profiililla.
  const types = withoutClubFootball(useLiveQuery(() => repo.listActivityTypes(), []), useFootballAnyProfile());
  const profiles = useLiveQuery(() => repo.listProfiles(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityType | 'new' | null>(null);
  const hiddenFor = (t: ActivityType) => (profiles ?? []).filter((p) => p.hiddenTypeIds?.includes(t.id)).map((p) => p.name);
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
        Tehoprofiili kertoo arviolta, kuinka suuri osa kestosta on kevyttä, reipasta ja rasittavaa; loput on paikallaanoloa. Arvot ovat sovelluksen lähtöoletuksia, eivät virallisia lukuja. Voit
        korjata ne, luoda omia lajeja ja piilottaa lajeja, joita joku profiili ei tarvitse.{' '}
        <span className="inline-flex translate-y-1">
          <TermInfo id="intensity" />
        </span>
      </p>
      <p className="mt-2 text-xs text-slate-500">Jokaisen lajin kohdalla on lyhyt perustelu sen oletusjaolle.</p>
      <div className="mt-3">
        <Button variant="secondary" onClick={() => setEditing('new')}>
          <IconPlus size="1rem" /> Uusi laji
        </Button>
      </div>
      {open && (
        <ul className="mt-3 divide-y divide-slate-100">
          {types?.map((t) => {
            const hidden = hiddenFor(t);
            return (
              <li key={t.id}>
                <button type="button" onClick={() => setEditing(t)} className="flex w-full items-start gap-2 py-3 text-left hover:bg-slate-50">
                  <span className="text-xl" aria-hidden>
                    <TypeGlyph t={t} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900">
                      {t.name}
                      {!t.builtIn && <span className="rounded-full bg-[var(--surface-sage)] px-1.5 text-[10px] font-bold text-green-800">oma</span>}
                    </span>
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
                    {intensityNoteText(t) && <span className="mt-1 block text-xs text-slate-500">{intensityNoteText(t)}</span>}
                    {hidden.length > 0 && <span className="mt-1 block text-xs font-medium text-amber-800">Piilotettu: {hidden.join(', ')}</span>}
                  </span>
                  <span className="pt-1 text-slate-400" aria-hidden>
                    <IconPencil size="1rem" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <TypeEditor key={editing === 'new' ? 'new' : (editing?.id ?? 'none')} type={editing} profiles={profiles ?? []} onCreated={setEditing} onClose={() => setEditing(null)} />
    </Card>
  );
}

const sharesToPcts = (s: ActivityType['shares']) => ({
  light: String(Math.round(s.light * 100)),
  moderate: String(Math.round(s.moderate * 100)),
  vigorous: String(Math.round(s.vigorous * 100)),
});

function TypeEditor({
  type,
  profiles,
  onCreated,
  onClose,
}: {
  type: ActivityType | 'new' | null;
  profiles: Profile[];
  onCreated: (t: ActivityType) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const today = todayFn();
  const isNew = type === 'new';
  const existing = type && type !== 'new' ? type : undefined;
  const custom = isNew || (existing && !existing.builtIn);
  const [pcts, setPcts] = useState(() => (existing ? sharesToPcts(existing.shares) : { light: String(NEW_SHARES.light), moderate: String(NEW_SHARES.moderate), vigorous: String(NEW_SHARES.vigorous) }));
  const [muscle, setMuscle] = useState<StrengthDefault>(existing?.muscleDefault ?? 'ask');
  const [bone, setBone] = useState<StrengthDefault>(existing?.boneDefault ?? 'ask');
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '🏃');
  const [image, setImage] = useState<string | undefined>(existing?.image);
  const [category, setCategory] = useState<Category>(existing?.category ?? 'self_directed');
  const [group, setGroup] = useState<MovementGroup>(existing?.movementGroup ?? 'play');
  const [multi, setMulti] = useState(!!existing?.multiActivity);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<ActivityType | null>(null);
  const [from, setFrom] = useState(addDays(today, -28));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => setError(undefined), [type]);

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
  const seed = existing && BUILT_IN_ACTIVITY_TYPES.find((t) => t.id === existing.id);

  async function save() {
    if (!shares) return setError('Anna osuudet kokonaislukuina 0–100 %; yhteensä enintään 100 %.');
    if (custom && !name.trim()) return setError('Anna lajille nimi');
    try {
      if (isNew) {
        const t = await repo.createActivityType({ name, icon, image, category, movementGroup: group, shares, muscleDefault: muscle, boneDefault: bone, multiActivity: multi });
        toast(`Laji ${t.name} lisätty`);
        onCreated(t);
        return;
      }
      const t = await repo.updateActivityType(existing!.id, {
        shares,
        muscleDefault: muscle,
        boneDefault: bone,
        ...(custom ? { name: name.trim(), icon: icon.trim() || '✳️', image, category, movementGroup: group, multiActivity: multi } : {}),
      });
      setSaved(t);
      toast('Laji tallennettu – vanhat kerrat eivät muuttuneet');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function restore() {
    const t = await repo.restoreActivityTypeDefaults(existing!.id);
    setPcts(sharesToPcts(t.shares));
    setMuscle(t.muscleDefault);
    setBone(t.boneDefault);
    setSaved(t);
    toast('Lähtöoletukset palautettu');
  }

  async function recalc() {
    const n = await repo.recalculateSessions(existing!.id, from);
    toast(`Laskettu uudelleen: ${n} ${n === 1 ? 'kerta' : 'kertaa'}`);
    onClose();
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    await repo.updateActivityType(existing!.id, { archived: true });
    toast('Laji poistettu valikoista – vanhat kerrat säilyvät');
    onClose();
  }

  const title = isNew ? 'Uusi laji' : `${existing!.icon} ${existing!.name}`;

  return (
    <Sheet open onClose={onClose} title={title}>
      <div className="space-y-4">
        {custom && (
          <>
            <Field label="Nimi">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="esim. Parkour" />
            </Field>
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Kuvake</div>
              <div className="flex items-center gap-2">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-sage)] text-xl" aria-hidden>
                  <TypeGlyph t={{ icon: icon || '✳️', image }} />
                </span>
                <input className={`${inputClass} w-24`} value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={8} aria-label="Emoji" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Emojin pikavalinnat">
                {EMOJI_PICKS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setIcon(e)}
                    className={`press flex size-9 items-center justify-center rounded-xl text-lg ${icon === e ? 'bg-[var(--surface-sage)] ring-2 ring-green-700' : 'hover:bg-[var(--surface-sunk)]'}`}
                    aria-label={`Kuvake ${e}`}
                    aria-pressed={icon === e}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <PhotoPicker name={name || '?'} value={image} fallback={icon} onChange={setImage} label="Oma kuva emojin sijaan" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kategoria">
                <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Liikkumismuoto">
                <select className={inputClass} value={group} onChange={(e) => setGroup(e.target.value as MovementGroup)}>
                  {(Object.keys(MOVEMENT_GROUP_LABEL) as MovementGroup[]).map((g) => (
                    <option key={g} value={g}>
                      {MOVEMENT_GROUP_LABEL[g]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input type="checkbox" className="mt-1 size-4 accent-green-700" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
              <span>
                <span className="font-medium">Monta tekemistä yhdessä kerrassa</span>
                <span className="block text-xs text-slate-500">Kirjatessa voi merkitä, mitä tehtiin ja kuinka kauan (kuten liikuntapuistossa); teho lasketaan tekemisten lajeista.</span>
              </span>
            </label>
          </>
        )}
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700">
            Tehoprofiili (% kestosta) <TermInfo id="intensity" />
          </div>
          {existing && intensityNoteText(existing) && <p className="mb-2 rounded-xl bg-[var(--surface-sunk)] p-2.5 text-xs text-slate-600">{intensityNoteText(existing)}</p>}
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
        {existing && profiles.length > 0 && <Visibility type={existing} profiles={profiles} />}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={!valid} className="flex-1">
            {isNew ? 'Lisää laji' : 'Tallenna'}
          </Button>
          {seed && (
            <Button variant="secondary" onClick={restore}>
              Palauta oletus ({pct(seed.shares.light)} / {pct(seed.shares.moderate)} / {pct(seed.shares.vigorous)})
            </Button>
          )}
          {existing && !existing.builtIn && (
            <button
              type="button"
              onClick={remove}
              className={`min-h-11 rounded-xl px-3 text-sm font-medium ring-1 ${confirmDelete ? 'bg-red-700 text-white ring-red-700' : 'bg-[var(--surface-raised)] text-red-700 ring-red-200'}`}
            >
              {confirmDelete ? 'Vahvista poisto' : 'Poista laji'}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {isNew
            ? 'Oma laji näkyy kaikkien profiilien lajivalikoissa; voit piilottaa sen profiilikohtaisesti lisäämisen jälkeen.'
            : 'Muutos koskee uusia kirjauksia. Vanhat kerrat säilyttävät oman profiilinsa, ellet laske niitä uudelleen.'}
        </p>

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

/** Profiilikohtainen näkyvyys lajivalikoissa (tallentuu heti). */
function Visibility({ type, profiles }: { type: ActivityType; profiles: Profile[] }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-slate-700">Näkyy lajivalikoissa</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Näkyy lajivalikoissa">
        {profiles.map((p) => {
          const shown = !p.hiddenTypeIds?.includes(type.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={shown}
              onClick={() => void repo.setTypeHidden(p.id, type.id, shown)}
              className={`press inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 ${
                shown ? 'bg-[var(--surface-sage)] text-green-900 ring-green-700/30' : 'bg-[var(--surface-sunk)] text-slate-500 ring-slate-200 line-through'
              }`}
            >
              <span aria-hidden>{shown ? <IconCheck size="0.85rem" className="inline-block align-[-2px]" /> : '–'}</span>
              {p.name}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-slate-500">Piilotettu laji ei näy profiilin kirjaus- ja suunnitteluvalikoissa. Vanhat kerrat säilyvät ennallaan.</p>
    </div>
  );
}

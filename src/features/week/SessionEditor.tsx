// Kerran muokkaus ja poisto (SPEC 10: poisto pyytää vahvistusta ja tarjoaa kumoamisen 5 s).

import { PartsEditor, partCandidates, partDraftsOf, partsFromDrafts, type PartDraft } from './PartsEditor';
import { partsShares, supportsParts } from '../../domain/intensity';
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { activityTypeId } from '../../domain/ids';
import { computeSessionMinutes, INTENSITY_PRESETS, mvpaOf } from '../../domain/intensity';
import type { Effort, IntensityMinutes, Session } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, EstimateBadge, Field, inputClass } from '../../ui/components';
import { ToggleChip } from '../../ui/controls';
import { IntensityPicker, isPreset, type IntensityMode } from './IntensityPicker';
import { Sheet } from '../../ui/Sheet';
import { LabelField } from './LabelField';
import { useHiddenTypes } from './useLoggableTypes';
import { useFootballEnabledById } from '../football/useFootballEnabled';
import { isClubFootball, isClubTraining } from '../../domain/football';
import { parseSelfMin, TrainingSelfFields } from '../football/TrainingSelf';
import { TermInfo } from '../../ui/glossary';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { dateSchema, durationSchema, manualSchema, optionalMinutes, showStrength } from './sessionForm';
import { DateInput } from '../../ui/DateInput';


export function SessionEditor({
  session,
  onClose,
  onFootball,
}: {
  session: Session | null;
  onClose: () => void;
  /** Jalkapallokerralle: avaa lisätietopaneelin. */
  onFootball?: (s: Session) => void;
}) {
  const today = todayFn();
  const toast = useToast();
  const types = useLiveQuery(() => repo.listActivityTypes({ includeArchived: true }), []);
  const hidden = useHiddenTypes(session?.profileId);
  const footballOn = useFootballEnabledById(session?.profileId);

  const [typeId, setTypeId] = useState('');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState('');
  const [played, setPlayed] = useState('');
  const [effort, setEffort] = useState<Effort>(0);
  const [muscle, setMuscle] = useState(false);
  const [bone, setBone] = useState(false);
  const [note, setNote] = useState('');
  const [label, setLabel] = useState('');
  const [mode, setMode] = useState<IntensityMode>('profile');
  const [manual, setManual] = useState({ light: '', moderate: '', vigorous: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [parts, setParts] = useState<PartDraft[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  // Treenin omatoiminen verryttely (linkitetty kerta); null = ei muutettu.
  const [selfBefore, setSelfBefore] = useState<string | null>(null);
  const [selfAfter, setSelfAfter] = useState<string | null>(null);
  const self = useLiveQuery(() => (session ? repo.getTrainingSelf(session.id) : undefined), [session?.id]);

  useEffect(() => {
    if (!session) return;
    setTypeId(session.activityTypeId);
    setDate(session.date);
    setDuration(String(session.durationMin));
    setPlayed(session.playedMin === undefined ? '' : String(session.playedMin));
    setEffort(session.effort);
    setMuscle(session.muscle);
    setBone(session.bone);
    setNote(session.note ?? '');
    setLabel(session.label ?? '');
    setMode(session.intensitySource === 'manual' ? 'manual' : (session.intensityPreset ?? 'profile'));
    setManual({
      light: String(session.minutes.light),
      moderate: String(session.minutes.moderate),
      vigorous: String(session.minutes.vigorous),
    });
    setParts(partDraftsOf(session.parts));
    setSelfBefore(null);
    setSelfAfter(null);
    setErrors({});
    setConfirmDelete(false);
  }, [session]);

  // Poistovahvistus raukeaa 4 sekunnissa.
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const type = types?.find((t) => t.id === typeId);
  // Lajin arviossa käytetään kerran omaa profiilia, jos laji ei vaihdu eikä kertaa kirjattu esiasetuksella.
  const typeMap = useMemo(() => new Map((types ?? []).map((t) => [t.id, t])), [types]);
  // Osiin jaettu kerta: teho osien lajeista (sama laskenta kuin tallennuksessa).
  const fromParts = type && supportsParts(type) ? partsShares(partsFromDrafts(parts) ?? [], typeMap, Number(duration) || 0) : undefined;
  const profileShares =
    fromParts ??
    (type && session && session.activityTypeId === type.id && session.sharesSnapshot && !session.intensityPreset && !session.parts?.length ? session.sharesSnapshot : type?.shares);

  // Esikatselu: sama laskenta kuin tallennuksessa (kerran oma profiili, jos laji ei vaihdu).
  const preview: IntensityMinutes | undefined = useMemo(() => {
    if (!type || !session || !profileShares || mode === 'manual') return undefined;
    const d = durationSchema.safeParse(duration);
    const p = optionalMinutes.safeParse(played);
    if (!d.success || !p.success) return undefined;
    const shares = isPreset(mode) ? INTENSITY_PRESETS[mode] : profileShares;
    const warmupShares = type.usesPlayedMinutes ? types?.find((t) => t.id === activityTypeId('football_training') && !t.deletedAt)?.shares : undefined;
    return computeSessionMinutes(
      { ...type, shares },
      { durationMin: d.data, playedMin: p.data, effort: mode === 'profile' ? effort : 0, warmupMin: session.warmupMin, playShare: session.playShare, warmupShares },
    ).minutes;
  }, [type, types, session, profileShares, mode, duration, played, effort]);

  async function save() {
    if (!session || !type) return;
    const errs: Record<string, string> = {};
    const d = durationSchema.safeParse(duration);
    const day = dateSchema(today).safeParse(date);
    const p = optionalMinutes.safeParse(played);
    const m = manualSchema.safeParse(manual);
    if (!d.success) errs.duration = d.error.issues[0].message;
    if (!day.success) errs.date = day.error.issues[0].message;
    if (type.usesPlayedMinutes && !p.success) errs.played = 'Tarkista pelatut minuutit';
    if (d.success && p.success && p.data !== undefined && p.data > d.data) errs.played = 'Pelatut minuutit eivät voi ylittää kestoa';
    const partList = type && supportsParts(type) ? partsFromDrafts(parts) : [];
    if (partList === null) errs.parts = 'Tarkista tekemisten minuutit';
    else if (d.success && partList.reduce((a, x) => a + x.durationMin, 0) > d.data) errs.parts = 'Tekemisten minuutit ylittävät keston';
    const clubTraining = isClubTraining(type) && !session.linkedTo;
    const sb = selfBefore === null ? self?.before ?? 0 : parseSelfMin(selfBefore);
    const sa = selfAfter === null ? self?.after ?? 0 : parseSelfMin(selfAfter);
    if (clubTraining && (sb === null || sa === null)) errs.self = 'Anna minuutit kokonaislukuina (0–180)';
    if (mode === 'manual') {
      if (!m.success) errs.manual = 'Anna minuutit kokonaislukuina';
      else if (d.success && m.data.light + m.data.moderate + m.data.vigorous > d.data) errs.manual = 'Minuuttien summa ylittää keston';
    }
    setErrors(errs);
    if (Object.keys(errs).length || !d.success || !day.success) return;
    setSaving(true);
    try {
      await repo.updateSession(session.id, {
        activityTypeId: type.id,
        date: day.data,
        startTime: session.startTime,
        durationMin: d.data,
        playedMin: type.usesPlayedMinutes && p.success ? p.data : undefined,
        effort: mode === 'profile' ? effort : 0,
        intensityPreset: isPreset(mode) ? mode : undefined,
        manual: mode === 'manual' && m.success ? m.data : undefined,
        muscle: showStrength(type.muscleDefault, muscle) && muscle,
        bone: showStrength(type.boneDefault, bone) && bone,
        note,
        label,
        parts: partList ?? [],
      });
      if (clubTraining && (selfBefore !== null || selfAfter !== null) && (sb !== self?.before || sa !== self?.after)) {
        await repo.setTrainingSelf(session.id, { before: sb ?? 0, after: sa ?? 0 });
      }
      onClose();
      toast('Muutokset tallennettu');
    } catch (e) {
      setErrors({ _: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!session) return;
    // Ei vahvistuskysymystä: poisto on kumottavissa ilmoituksen "Kumoa"-painikkeella (SPEC 16).
    const undo = await repo.deleteSession(session.id);
    onClose();
    toast('Kerta poistettu', { label: 'Kumoa', run: () => repo.undoDelete(undo) });
  }

  return (
    <Sheet open={!!session} onClose={onClose} title="Muokkaa kertaa">
      {session && (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Laji">
            <select className={inputClass} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {types
                ?.filter((t) => (!t.archived && !hidden.has(t.id) && (footballOn || !isClubFootball(t))) || t.id === session.activityTypeId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.name}
                  </option>
                ))}
            </select>
          </Field>

          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3">
            <Field label="Päivä">
              <DateInput className={inputClass} value={date} max={today} onChange={setDate} aria-label="Päivä" />
              {errors.date && <span className="mt-1 block text-sm text-red-700">{errors.date}</span>}
            </Field>
            <Field label="Kesto (min)">
              <input className={inputClass} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
              {errors.duration && <span className="mt-1 block text-sm text-red-700">{errors.duration}</span>}
            </Field>
          </div>

          {type?.usesPlayedMinutes && (
            <Field label="Pelatut minuutit (valinnainen)">
              <input className={inputClass} inputMode="numeric" value={played} onChange={(e) => setPlayed(e.target.value)} />
              {errors.played && <span className="mt-1 block text-sm text-red-700">{errors.played}</span>}
              <span className="mt-1 block text-xs text-slate-500">Ilman pelattuja minuutteja arvio: lämmittely ~15 min treenin teholla ja peliaika-arvio (joukkueen asetus, oletus 70 %) pelin teholla; vaihtopenkki ei kerrytä liikuntaa.</span>
            </Field>
          )}

          {type && supportsParts(type) && (
            <div>
              <PartsEditor types={partCandidates(types)} drafts={parts} onChange={setParts} durationMin={Number(duration) > 0 ? Number(duration) : undefined} />
              {errors.parts && <p className="mt-1 text-sm text-red-700">{errors.parts}</p>}
            </div>
          )}

          {type && (showStrength(type.muscleDefault, muscle) || showStrength(type.boneDefault, bone)) && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {showStrength(type.muscleDefault, muscle) && (
                  <span className="inline-flex items-center gap-1">
                    <ToggleChip on={muscle} onChange={setMuscle}>
                      Lihaksia vahvistava
                    </ToggleChip>
                    <TermInfo id="muscle" />
                  </span>
                )}
                {showStrength(type.boneDefault, bone) && (
                  <span className="inline-flex items-center gap-1">
                    <ToggleChip on={bone} onChange={setBone}>
                      Luustoa vahvistava
                    </ToggleChip>
                    <TermInfo id="bone" align="right" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Lihakset: kiipeily, punnerrukset, kuntopiiri. Luusto: hypyt, juoksu, pallopelit.</p>
            </div>
          )}

          {type && profileShares && (
            <div>
              <IntensityPicker
                type={type}
                shares={profileShares}
                mode={mode}
                onMode={setMode}
                effort={effort}
                onEffort={setEffort}
                manual={manual}
                onManual={setManual}
              />
              {preview && (
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
                  <EstimateBadge />
                  kevyt {preview.light} · reipas {preview.moderate} · rasittava {preview.vigorous} min (reipasta ja rasittavaa arviolta {mvpaOf(preview)} min)
                </p>
              )}
              {errors.manual && <p className="mt-1 text-sm text-red-700">{errors.manual}</p>}
            </div>
          )}

          {isClubTraining(type) && !session.linkedTo && (
            <TrainingSelfFields
              before={selfBefore ?? (self?.before ? String(self.before) : '')}
              after={selfAfter ?? (self?.after ? String(self.after) : '')}
              onBefore={setSelfBefore}
              onAfter={setSelfAfter}
              error={errors.self}
            />
          )}
          {session.linkedTo && (
            <p className="card-sunk p-3 text-xs text-slate-600">
              🥾 Treeniin liittyvä omatoiminen verryttely. Minuutit ennen ja jälkeen treenin voi muuttaa myös treenin muokkauksesta; poisto poistaa vain verryttelyn.
            </p>
          )}

          {type && <LabelField profileId={session.profileId} activityTypeId={type.id} value={label} onChange={setLabel} />}

          <Field label="Muistiinpano">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </Field>

          {type?.sport === 'football' && onFootball && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                onClose();
                onFootball(session);
              }}
            >
              ⚽ Jalkapallon lisätiedot
            </Button>
          )}

          {errors._ && <p className="text-sm text-red-700">{errors._}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving} className="flex-1">
              Tallenna
            </Button>
            <button
              type="button"
              onClick={remove}
              className={`min-h-11 rounded-xl px-4 text-sm font-medium ring-1 ${confirmDelete ? 'bg-red-700 text-white ring-red-700' : 'bg-[var(--surface-raised)] text-red-700 ring-red-200 active:bg-red-50'}`}
            >
              {confirmDelete ? 'Vahvista poisto' : 'Poista'}
            </button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

// Pikalisäys (SPEC 12): + → laji → kesto. Keston valinta tallentaa heti.
// Päivä, ponnistelu, lihas/luusto ja muistiinpano ovat valinnaisia ja
// valitaan samassa paneelissa ennen kestoa.

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays } from '../../domain/dates';
import type { ActivityType, Category, Effort, IntensityMinutes, ISODate, Profile, Session } from '../../domain/types';
import { repo } from '../../db/repositories';
import { requestPersistentStorage } from '../../db/storage';
import { Button, inputClass } from '../../ui/components';
import { ToggleChip } from '../../ui/controls';
import { IntensityPicker, isPreset, type IntensityMode, type ManualDraft } from '../week/IntensityPicker';
import { dayLabel } from '../../ui/format';
import { CATEGORY_LABEL } from '../../ui/labels';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { dateSchema, durationSchema, manualSchema, optionalMinutes, showStrength, strengthDefaults } from '../week/sessionForm';

const DURATIONS = [15, 30, 45, 60, 75, 90];
const CATEGORY_ORDER: Category[] = ['hobby', 'school_pe', 'school_recess', 'commute', 'self_directed', 'family', 'other'];

function TypeButton({ t, onPick }: { t: ActivityType; onPick: (t: ActivityType) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(t)}
      className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-slate-50 p-2 text-center ring-1 ring-slate-200 active:bg-green-50"
    >
      <span className="text-2xl" aria-hidden>
        {t.icon}
      </span>
      <span className="text-xs font-medium leading-tight text-slate-800">{t.name}</span>
    </button>
  );
}

export function QuickAdd({
  open,
  onClose,
  profile,
  initialDate,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  initialDate?: ISODate;
  /** Tallennuksen jälkeen (esim. jalkapallon lisätietopaneeli). */
  onSaved?: (s: Session) => void;
}) {
  const today = todayFn();
  const toast = useToast();
  const types = useLiveQuery(() => repo.listActivityTypes(), []);
  const recentIds = useLiveQuery(() => repo.recentActivityTypeIds(profile.id, 6), [profile.id]);

  const [type, setType] = useState<ActivityType | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [date, setDate] = useState<ISODate>(initialDate ?? today);
  const [effort, setEffort] = useState<Effort>(0);
  const [mode, setMode] = useState<IntensityMode>('profile');
  const [manual, setManual] = useState<ManualDraft>({ light: '', moderate: '', vigorous: '' });
  const [muscle, setMuscle] = useState(false);
  const [bone, setBone] = useState(false);
  const [note, setNote] = useState('');
  const [played, setPlayed] = useState('');
  /** Valittu kesto (pikavalinta tai "Muu"); tallennus vasta Tallenna-painikkeesta. */
  const [duration, setDuration] = useState('');
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  // Paneelin avaus nollaa valinnat.
  useEffect(() => {
    if (!open) return;
    setType(null);
    setShowAll(false);
    setDate(initialDate && initialDate <= today ? initialDate : today);
    setEffort(0);
    setNote('');
    setMode('profile');
    setManual({ light: '', moderate: '', vigorous: '' });
    setPlayed('');
    setDuration('');
    setCustom(false);
    setError(undefined);
  }, [open, initialDate, today]);

  const recent = useMemo(() => {
    if (!types) return [];
    const byId = new Map(types.map((t) => [t.id, t]));
    const list = (recentIds ?? []).map((id) => byId.get(id)).filter((t): t is ActivityType => !!t);
    // Täydennetään oletusjärjestyksellä, kunnes kuusi painiketta on täynnä.
    for (const t of types) {
      if (list.length >= 6) break;
      if (!list.includes(t)) list.push(t);
    }
    return list.slice(0, 6);
  }, [types, recentIds]);

  const sameDay = useLiveQuery(
    async () => (type ? (await repo.sessionsInRange(profile.id, date, date)).filter((s) => s.activityTypeId === type.id).length : 0),
    [type?.id, profile.id, date],
  );

  // Avoin suunnitelma samalle päivälle ja lajille → varoitus ja "Kuittaa suunniteltu" (SPEC 10).
  const openPlan = useLiveQuery(
    async () =>
      type
        ? (await repo.plansInRange(profile.id, date, date)).find((p) => p.activityTypeId === type.id && p.status === 'open')
        : undefined,
    [type?.id, profile.id, date],
  );

  async function confirmPlan() {
    if (!openPlan || saving) return;
    setSaving(true);
    try {
      const r = await repo.confirmPlanned(openPlan.id, today);
      onClose();
      toast(`Kuitattu suunniteltu: ${type!.name} ${r.session.durationMin} min`, {
        label: 'Kumoa',
        run: () => repo.undoConfirm([r.session.id]),
      });
      if (r.created) onSaved?.(r.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function pick(t: ActivityType) {
    setType(t);
    const d = strengthDefaults(t);
    setMuscle(d.muscle);
    setBone(d.bone);
    setPlayed('');
  }

  async function save() {
    if (!type || saving) return;
    const dur = durationSchema.safeParse(duration);
    const day = dateSchema(today).safeParse(date);
    const pl = optionalMinutes.safeParse(played);
    if (!dur.success) return setError(dur.error.issues[0].message);
    if (!day.success) return setError(day.error.issues[0].message);
    if (!pl.success) return setError('Tarkista pelatut minuutit');
    if (pl.data !== undefined && pl.data > dur.data) return setError('Pelatut minuutit eivät voi ylittää kestoa');
    let manualMinutes: IntensityMinutes | undefined;
    if (mode === 'manual') {
      const m = manualSchema.safeParse(manual);
      if (!m.success) return setError('Anna oman jaon minuutit kokonaislukuina');
      if (m.data.light + m.data.moderate + m.data.vigorous > dur.data) return setError('Oman jaon minuutit ylittävät keston');
      manualMinutes = m.data;
    }
    setSaving(true);
    try {
      const s = await repo.createSession({
        profileId: profile.id,
        activityTypeId: type.id,
        date: day.data,
        durationMin: dur.data,
        playedMin: type.usesPlayedMinutes ? pl.data : undefined,
        effort: mode === 'profile' ? effort : 0,
        intensityPreset: isPreset(mode) ? mode : undefined,
        manual: manualMinutes,
        muscle: showStrength(type.muscleDefault) && muscle,
        bone: showStrength(type.boneDefault) && bone,
        note,
      });
      void requestPersistentStorage();
      onClose();
      toast(`Tallennettu: ${type.name} ${dur.data} min`, { label: 'Kumoa', run: () => repo.deleteSession(s.id).then(() => {}) });
      onSaved?.(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const yesterday = addDays(today, -1);
  return (
    <Sheet open={open} onClose={onClose} title={type ? type.name : 'Uusi kerta'}>
      {!type ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {recent.map((t) => (
              <TypeButton key={t.id} t={t} onPick={pick} />
            ))}
          </div>
          <Button variant="secondary" className="w-full" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
            {showAll ? 'Piilota lajit' : 'Kaikki lajit'}
          </Button>
          {showAll &&
            CATEGORY_ORDER.map((c) => {
              const inCat = (types ?? []).filter((t) => t.category === c);
              if (!inCat.length) return null;
              return (
                <div key={c}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{CATEGORY_LABEL[c]}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {inCat.map((t) => (
                      <TypeButton key={t.id} t={t} onPick={pick} />
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="space-y-4">
          {openPlan && (
            <div className="space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
              <p className="text-sm text-amber-900">
                Päivälle {dayLabel(date)} on suunniteltu {type.name.toLowerCase()}
                {openPlan.startTime && ` klo ${openPlan.startTime}`} ({openPlan.durationMin} min).
              </p>
              <Button className="w-full" disabled={saving} onClick={confirmPlan}>
                Kuittaa suunniteltu
              </Button>
            </div>
          )}
          {sameDay ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
              Päivälle {dayLabel(date)} on jo kirjattu {type.name.toLowerCase()} ({sameDay} kpl). Voit silti lisätä uuden kerran.
            </p>
          ) : null}

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Päivä</div>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleChip on={date === today} onChange={() => setDate(today)}>
                Tänään
              </ToggleChip>
              <ToggleChip on={date === yesterday} onChange={() => setDate(yesterday)}>
                Eilen
              </ToggleChip>
              <input
                type="date"
                className="min-h-10 rounded-full border border-slate-300 bg-white px-3 text-sm"
                value={date}
                max={today}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                aria-label="Päivä"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">{type.usesPlayedMinutes ? 'Kesto (koko tapahtuma)' : 'Kesto'}</div>
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Kesto">
              {DURATIONS.map((m) => {
                const on = !custom && duration === String(m);
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setCustom(false);
                      setDuration(String(m));
                      setError(undefined);
                    }}
                    className={`min-h-12 rounded-xl text-base font-semibold ring-1 ${on ? 'bg-green-700 text-white ring-green-700' : 'bg-white text-slate-900 ring-slate-300 hover:bg-slate-50'}`}
                  >
                    {m}
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={custom}
                onClick={() => {
                  setCustom(true);
                  setDuration('');
                }}
                className={`col-span-2 min-h-12 rounded-xl text-sm font-medium ring-1 ${custom ? 'bg-green-700 text-white ring-green-700' : 'bg-white text-slate-900 ring-slate-300 hover:bg-slate-50'}`}
              >
                Muu
              </button>
            </div>
            {custom && (
              <input
                className={`${inputClass} mt-2`}
                inputMode="numeric"
                autoFocus
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void save()}
                placeholder="minuutit"
                aria-label="Kesto minuutteina"
              />
            )}
          </div>

          {type.usesPlayedMinutes && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Pelatut minuutit (valinnainen)</span>
              <input
                className={inputClass}
                inputMode="numeric"
                value={played}
                onChange={(e) => setPlayed(e.target.value)}
                placeholder="esim. 40"
              />
              <span className="mt-1 block text-xs text-slate-500">Arvio lasketaan pelatuista minuuteista; vaihtopenkki ei kerrytä liikuntaa.</span>
            </label>
          )}

          <div className="space-y-3 border-t border-slate-100 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valinnaiset</div>
            <IntensityPicker
              type={type}
              shares={type.shares}
              mode={mode}
              onMode={setMode}
              effort={effort}
              onEffort={setEffort}
              manual={manual}
              onManual={setManual}
            />
            {(showStrength(type.muscleDefault) || showStrength(type.boneDefault)) && (
              <div className="flex flex-wrap gap-2">
                {showStrength(type.muscleDefault) && (
                  <ToggleChip on={muscle} onChange={setMuscle}>
                    Lihaksia vahvistava
                  </ToggleChip>
                )}
                {showStrength(type.boneDefault) && (
                  <ToggleChip on={bone} onChange={setBone}>
                    Luustoa vahvistava
                  </ToggleChip>
                )}
              </div>
            )}
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Muistiinpano" maxLength={200} aria-label="Muistiinpano" />
          </div>

          {/* Aina näkyvä tallennus: kertoo päivän ja keston ennen tallennusta. */}
          <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-slate-200 bg-white px-4 pb-1 pt-3 lg:-mx-6 lg:px-6">
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" className="shrink-0 px-3" onClick={() => setType(null)}>
                ← Laji
              </Button>
              <Button className="flex-1" disabled={saving || !duration} onClick={() => void save()}>
                {duration ? `Tallenna · ${dayLabel(date)} · ${duration} min` : 'Valitse kesto'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

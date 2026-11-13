// Yksittäinen suunniteltu kerta tulevalle päivälle (SPEC 16): esim. tiedossa oleva tapahtuma, joka
// näkyy viikolla suunnitelmana ja kuitataan (✓) vasta kyseisenä päivänä kuten viikkorytmin kerrat.

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays } from '../../domain/dates';
import type { HHmm, ISODate, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Field, inputClass } from '../../ui/components';
import { DateInput } from '../../ui/DateInput';
import { dayLabel } from '../../ui/format';
import { Sheet } from '../../ui/Sheet';
import { TimeField } from '../../ui/TimeField';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { useFootballEnabled, withoutClubFootball } from '../football/useFootballEnabled';
import { LabelField } from './LabelField';
import { useHiddenCategories, visibleTypes } from './useLoggableTypes';

export function PlanOnceSheet({ profile, date, onClose }: { profile: Profile; date: ISODate | null; onClose: () => void }) {
  const toast = useToast();
  const today = todayFn();
  const hidden = useHiddenCategories(profile.id, today);
  const footballOn = useFootballEnabled(profile);
  const all = useLiveQuery(() => repo.listActivityTypes(), []);
  // Pelit ja turnaukset lisätään pelikalenteriin (vastustaja, otteluohjelma), joten ne eivät ole tässä.
  const types = withoutClubFootball(visibleTypes(all, hidden), footballOn)?.filter((t) => !t.usesPlayedMinutes);
  const [typeId, setTypeId] = useState('');
  const [day, setDay] = useState<ISODate>(addDays(today, 1));
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!date) return;
    setDay(date);
    setTime('');
    setDuration('60');
    setLabel('');
    setError(undefined);
  }, [date]);
  const firstId = types?.[0]?.id;
  useEffect(() => {
    if (date && !typeId && firstId) setTypeId(firstId);
  }, [date, typeId, firstId]);

  async function save() {
    const d = Number(duration);
    if (!typeId) return setError('Valitse laji');
    if (!Number.isInteger(d) || d < 1 || d > 1440) return setError('Tarkista kesto (min)');
    setSaving(true);
    try {
      const p = await repo.createPlannedOnce(profile.id, { activityTypeId: typeId, date: day, durationMin: d, startTime: (time || undefined) as HHmm | undefined, label });
      toast(`Lisätty suunnitelmiin: ${dayLabel(day)}`, { label: 'Kumoa', run: () => repo.deletePlanned(p.id) });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={!!date} onClose={onClose} title="Suunniteltu kerta">
      {date && (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p className="text-sm text-slate-600">
            Tiedossa oleva tapahtuma tulevalle päivälle. Se näkyy viikolla suunnitelmana, ja kuittaat sen (✓) tai muutat kestoa vasta kyseisenä päivänä.
            {footballOn && ' Pelit ja turnaukset lisätään Jalkapallo → Kalenteri.'}
          </p>
          <Field label="Laji">
            <select className={inputClass} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {types?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)]">
            <Field label="Päivä">
              <DateInput className={inputClass} value={day} min={today} onChange={setDay} aria-label="Päivä" />
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:contents">
              <Field label="Kello (valinnainen)">
                <TimeField label="Kellonaika" value={time} onChange={setTime} />
              </Field>
              <Field label="Kesto (min)">
                <input className={inputClass} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </Field>
            </div>
          </div>
          {typeId && <LabelField profileId={profile.id} activityTypeId={typeId} value={label} onChange={setLabel} placeholder="esim. Uintikoulu, Leiri" />}
          {error && (
            <p className="text-sm font-medium text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              Lisää suunnitelmiin
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Peruuta
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

// Loukkaantumisjakso (24.11.2026, käyttäjän valinta): alkupäivä ja arvioitu paluupäivä. Jakson päivät merkitään
// kerralla, eikä niitä lasketa suositusvertailuun; jakson suunnitellut kerrat merkitään poissaoloksi.

import { useEffect, useState } from 'react';
import { addDays, diffDays } from '../../domain/dates';
import { MAX_INJURY_DAYS, type InjuryRun } from '../../domain/injury';
import type { ISODate, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Field, inputClass } from '../../ui/components';
import { DateInput } from '../../ui/DateInput';
import { dayLabel } from '../../ui/format';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

const QUICK: [string, number][] = [
  ['1 vk', 7],
  ['2 vk', 14],
  ['4 vk', 28],
  ['6 vk', 42],
];

export const returnText = (r: InjuryRun) => `arvioitu paluu ${dayLabel(r.returnDate).toLowerCase()}`;

/** `date`: päivä, jolta paneeli avattiin; jos se kuuluu jaksoon, jaksoa muokataan. */
export function InjurySheet({ profile, date, onClose }: { profile: Profile; date: ISODate | null; onClose: () => void }) {
  const toast = useToast();
  // undefined = jaksoa haetaan, null = uusi jakso.
  const [prev, setPrev] = useState<InjuryRun | null | undefined>(undefined);
  const [start, setStart] = useState<ISODate | ''>('');
  const [ret, setRet] = useState<ISODate | ''>('');
  const [seen, setSeen] = useState<ISODate | null>(null);
  if (date !== seen) {
    setSeen(date);
    setPrev(undefined);
  }
  useEffect(() => {
    if (!date) return;
    let alive = true;
    void repo.injuryAt(profile.id, date).then((r) => {
      if (!alive) return;
      setPrev(r);
      setStart(r?.start ?? date);
      setRet(r?.returnDate ?? addDays(date, 7));
    });
    return () => {
      alive = false;
    };
  }, [date, profile.id]);

  const days = start && ret ? diffDays(start, ret) : 0;
  const valid = !!start && !!ret && days >= 1 && days <= MAX_INJURY_DAYS;

  async function save() {
    if (!valid || prev === undefined) return;
    const run: InjuryRun = { start: start as ISODate, returnDate: ret as ISODate };
    await repo.setInjury(profile.id, run, prev);
    onClose();
    toast(`${profile.name}: loukkaantunut, ${returnText(run)}`, { label: 'Kumoa', run: () => repo.setInjury(profile.id, prev ?? null, run) });
  }

  async function remove() {
    if (!prev) return;
    await repo.setInjury(profile.id, null, prev);
    onClose();
    toast('Loukkaantumisjakso poistettu', { label: 'Kumoa', run: () => repo.setInjury(profile.id, prev, null) });
  }

  return (
    <Sheet open={!!date} onClose={onClose} title={prev ? 'Loukkaantumisjakso' : 'Merkitse loukkaantuneeksi'}>
      {date && prev !== undefined && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Alkaen">
              <DateInput
                className={inputClass}
                value={start}
                onChange={(d) => {
                  // Paluu pysyy alun jälkeen (sama jakson pituus, jos alku siirtyy paluun ohi).
                  setStart(d);
                  if (ret && ret <= d) setRet(addDays(d, Math.max(1, days)));
                }}
                aria-label="Alkaen"
              />
            </Field>
            <Field label="Arvioitu paluu">
              <DateInput className={inputClass} value={ret} min={start ? addDays(start, 1) : undefined} onChange={setRet} aria-label="Arvioitu paluu" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Jakson pituus">
            {QUICK.map(([label, n]) => (
              <button
                key={label}
                type="button"
                aria-pressed={days === n}
                onClick={() => start && setRet(addDays(start, n))}
                className={`press min-h-9 rounded-full px-3 text-sm font-semibold ring-1 ${days === n ? 'bg-green-700 text-white ring-green-700' : 'bg-[var(--surface-raised)] text-slate-700 ring-slate-200 hover:bg-slate-100'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-600">
            {valid ? `${days} ${days === 1 ? 'päivä' : 'päivää'}. ` : days > MAX_INJURY_DAYS ? `Jakso voi olla enintään ${MAX_INJURY_DAYS} päivää. ` : 'Paluun pitää olla alun jälkeen. '}
            Paluupäivä on ensimmäinen tavallinen päivä, ja sitä voi muuttaa myöhemmin.
          </p>
          <div className="space-y-2">
            <Button className="w-full" disabled={!valid} onClick={save}>
              Tallenna
            </Button>
            {prev && (
              <Button variant="secondary" className="w-full" onClick={remove}>
                Poista jakso
              </Button>
            )}
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            Jakson päiviä ei lasketa mukaan suositusvertailuun, ja jakson suunnitellut treenit ja pelit merkitään poissaoloksi (syy: loukkaantunut). Päivien kirjaukset säilyvät.
          </p>
        </div>
      )}
    </Sheet>
  );
}

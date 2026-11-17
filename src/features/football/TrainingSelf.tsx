// Treenin omatoiminen alku- ja loppuverryttely (17.11.2026): kentät viikkorytmiin ja kerran muokkaukseen
// sekä työkalu, jolla verryttely lisätään menneille treeneille valitusta päivästä alkaen.

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays } from '../../domain/dates';
import { isClubTraining } from '../../domain/football';
import type { Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Card, Field, inputClass } from '../../ui/components';
import { DateInput } from '../../ui/DateInput';
import { formatDate } from '../../ui/format';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';

/** Minuuttikentän arvo luvuksi: tyhjä = 0, virhe = null. */
export function parseSelfMin(s: string): number | null {
  const t = s.trim();
  if (!t) return 0;
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n <= 180 ? n : null;
}

export function TrainingSelfFields({
  before,
  after,
  onBefore,
  onAfter,
  error,
  hint,
}: {
  before: string;
  after: string;
  onBefore: (v: string) => void;
  onAfter: (v: string) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <fieldset className="card-sunk space-y-2 p-3">
      <legend className="sr-only">Omatoiminen verryttely</legend>
      <p className="text-sm font-medium text-slate-800">🥾 Omatoiminen verryttely</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ennen treeniä (min)">
          <input className={inputClass} inputMode="numeric" value={before} onChange={(e) => onBefore(e.target.value)} placeholder="0" aria-label="Omatoiminen ennen (min)" />
        </Field>
        <Field label="Treenin jälkeen (min)">
          <input className={inputClass} inputMode="numeric" value={after} onChange={(e) => onAfter(e.target.value)} placeholder="0" aria-label="Omatoiminen jälkeen (min)" />
        </Field>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <p className="text-xs text-slate-600">
        {hint ?? 'Kirjataan treenin viereen omaksi "Jalkapallo – omatoiminen" -kerraksi (omatoiminen liikunta). Treenin kesto ei muutu.'}
      </p>
    </fieldset>
  );
}

/** Työkalu: verryttely kaikille valitun aikavälin treeneille, joilla sitä ei vielä ole. */
export function TrainingSelfBackfill({ profile }: { profile: Profile }) {
  const today = todayFn();
  const toast = useToast();
  const items = useLiveQuery(() => repo.listTemplateItems(profile.id), [profile.id]);
  const types = useLiveQuery(() => repo.listActivityTypes({ includeArchived: true }), []);
  const def = items?.find((i) => (i.selfBeforeMin || i.selfAfterMin) && isClubTraining(types?.find((t) => t.id === i.activityTypeId)));
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(addDays(today, -28));
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const b = before ?? String(def?.selfBeforeMin ?? '');
  const a = after ?? String(def?.selfAfterMin ?? '');
  const all = useLiveQuery(() => repo.trainingsWithoutSelf(profile.id, '0000-01-01', today), [profile.id, today]);
  const candidates = (all ?? []).filter((s) => s.date >= from);
  const nb = parseSelfMin(b);
  const na = parseSelfMin(a);
  const invalid = nb === null || na === null;
  const empty = !invalid && nb === 0 && na === 0;

  if (!all?.length) return null;

  async function apply() {
    if (invalid || empty) return;
    setBusy(true);
    try {
      const ids = await repo.addTrainingSelfFrom(profile.id, from, today, { before: nb!, after: na! });
      toast(`Verryttely lisätty ${ids.length} treeniin`, { label: 'Kumoa', run: () => repo.removeTrainingSelves(ids) }, 'success');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Omatoiminen verryttely menneille treeneille">
      {!open ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            {all.length} kirjatulla treenillä ei ole vielä omatoimista alku- tai loppuverryttelyä. Voit lisätä sen kerralla valitusta päivästä alkaen.
          </p>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Lisää menneille treeneille…
          </Button>
        </div>
      ) : (
        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void apply();
          }}
        >
          <Field label="Treenit alkaen">
            <DateInput className={inputClass} value={from} max={today} onChange={setFrom} aria-label="Treenit alkaen" />
          </Field>
          <TrainingSelfFields
            before={b}
            after={a}
            onBefore={setBefore}
            onAfter={setAfter}
            error={invalid ? 'Anna minuutit kokonaislukuina (0–180)' : undefined}
            hint="Lisätään vain treeneille, joilla verryttelyä ei vielä ole. Yksittäistä kertaa voi muuttaa myöhemmin kerran muokkauksesta."
          />
          <p className="text-sm text-slate-700" aria-live="polite">
            {candidates.length > 0
              ? `${candidates.length} treeniä ${formatDate(candidates[0].date, 'd.M.yyyy')} – ${formatDate(candidates[candidates.length - 1].date, 'd.M.yyyy')}`
              : 'Valitulta ajalta ei löydy treenejä ilman verryttelyä.'}
          </p>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || invalid || empty || candidates.length === 0} className="flex-1">
              Lisää {candidates.length} treeniin
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Peruuta
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

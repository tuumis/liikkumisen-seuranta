// Lomajaksot (SPEC 16): lomapäivinä arkipäivän arkiliikunta-arvio lasketaan viikonlopun arvoilla ja
// avoimet koululiikuntakerrat ohitetaan syyllä "Loma". Jaksot ovat synkronoituvissa asetuksissa.

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { datesBetween } from '../../domain/dates';
import { HOLIDAY_SUGGESTIONS, holidayError, sortHolidays, type Holiday } from '../../domain/holidays';
import { newId } from '../../domain/ids';
import type { Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Card, Field, inputClass } from '../../ui/components';
import { formatDate } from '../../ui/format';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { DateInput } from '../../ui/DateInput';

const range = (h: Holiday) =>
  h.start === h.end ? formatDate(h.start, 'EEEEEE d.M.yyyy') : `${formatDate(h.start, 'd.M.')}–${formatDate(h.end, 'd.M.yyyy')}`;

export function HolidaysSection({ profile }: { profile: Profile }) {
  const toast = useToast();
  const settings = useLiveQuery(() => repo.getSettings(), []);
  const profiles = useLiveQuery(() => repo.listProfiles(), []) ?? [];
  const [draft, setDraft] = useState<Holiday | null>(null);
  const holidays = settings?.holidays ?? [];
  const today = todayFn();

  const save = async (list: Holiday[], msg: string) => {
    await repo.updateSettings({ holidays: list });
    toast(msg);
  };

  if (draft) {
    return (
      <Card title={holidays.some((h) => h.id === draft.id) ? 'Muokkaa lomajaksoa' : 'Uusi lomajakso'}>
        <HolidayForm
          draft={draft}
          profiles={profiles}
          onCancel={() => setDraft(null)}
          onSave={async (h) => {
            const exists = holidays.some((x) => x.id === h.id);
            await save(exists ? holidays.map((x) => (x.id === h.id ? h : x)) : [...holidays, h], 'Lomajakso tallennettu');
            setDraft(null);
          }}
        />
      </Card>
    );
  }

  const list = sortHolidays(holidays);
  const name = (id: string) => profiles.find((p) => p.id === id)?.name ?? '?';
  return (
    <Card title="Lomajaksot">
      <p className="text-sm text-slate-600">
        Lomapäivinä arkipäivän arkiliikunta lasketaan viikonlopun arvoilla (esim. ei välitunteja), ja avoimet koululiikuntakerrat ohitetaan syyllä ”Loma”. Treenit ja muut kerrat
        pysyvät ennallaan.
      </p>
      {list.length > 0 ? (
        <ul className="mt-2 divide-y divide-slate-100">
          {list.map((h) => {
            const days = datesBetween(h.start, h.end).length;
            const past = h.end < today;
            return (
              <li key={h.id} className="flex items-center gap-2 py-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDraft({ ...h })}>
                  <div className={`font-semibold ${past ? 'text-slate-600' : 'text-slate-900'}`}>
                    {h.label}
                    {h.start <= today && today <= h.end && <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-900">nyt</span>}
                  </div>
                  <div className="text-xs tabular-nums text-slate-500">
                    {range(h)} · {days} {days === 1 ? 'päivä' : 'päivää'}
                    {h.profileIds?.length ? ` · ${h.profileIds.map(name).join(', ')}` : profiles.length > 1 ? ' · kaikki' : ''}
                  </div>
                </button>
                <Button variant="ghost" className="px-3 max-sm:hidden" onClick={() => setDraft({ ...h })}>
                  Muokkaa
                </Button>
                <Button
                  variant="ghost"
                  className="px-3 text-red-700 hover:bg-red-50"
                  aria-label={`Poista ${h.label}`}
                  onClick={() => void save(holidays.filter((x) => x.id !== h.id), `${h.label} poistettu`)}
                >
                  Poista
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl bg-[var(--surface-sunk)] p-3 text-sm text-slate-600">Ei lomajaksoja. Lisää esim. syys- tai joululoma, niin arvio ei oleta välitunteja lomalle.</p>
      )}
      <Button variant="secondary" className="mt-3" onClick={() => setDraft({ id: newId(), label: '', start: today, end: today })}>
        + Lisää lomajakso
      </Button>
      {profiles.length > 1 && <p className="mt-2 text-xs text-slate-500">Jakso koskee oletuksena kaikkia profiileja; voit rajata sen esim. vain profiiliin {profile.name}.</p>}
    </Card>
  );
}

function HolidayForm({ draft, profiles, onSave, onCancel }: { draft: Holiday; profiles: Profile[]; onSave: (h: Holiday) => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = new Set(v.profileIds?.length ? v.profileIds : profiles.map((p) => p.id));

  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Kaikki valittuina = ei rajausta (koskee myös myöhemmin lisättäviä profiileja).
    setV((c) => ({ ...c, profileIds: next.size === profiles.length ? undefined : [...next] }));
  };

  const submit = async () => {
    const h = { ...v, label: v.label.trim() };
    const e = holidayError(h) ?? (chosen.size === 0 ? 'Valitse vähintään yksi profiili' : null);
    setError(e);
    if (e) return;
    setBusy(true);
    try {
      await onSave(h);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Nimi">
        <input className={inputClass} value={v.label} maxLength={40} placeholder="esim. Syysloma" onChange={(e) => setV((c) => ({ ...c, label: e.target.value }))} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {HOLIDAY_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setV((c) => ({ ...c, label: s }))}
            className={`press min-h-9 rounded-full px-3 text-sm font-semibold ring-1 ${v.label === s ? 'bg-green-100 text-green-900 ring-green-300' : 'bg-[var(--surface-sunk)] text-slate-700 ring-slate-200 hover:bg-slate-100'}`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Alkaa">
          <DateInput className={inputClass} value={v.start} onChange={(d) => setV((c) => ({ ...c, start: d, end: c.end < d ? d : c.end }))} aria-label="Alkaa" />
        </Field>
        <Field label="Päättyy (mukaan lukien)">
          <DateInput className={inputClass} value={v.end} min={v.start} onChange={(d) => setV((c) => ({ ...c, end: d }))} aria-label="Päättyy" />
        </Field>
      </div>
      {profiles.length > 1 && (
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-slate-700">Koskee</legend>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <label key={p.id} className="flex min-h-10 items-center gap-2 rounded-xl bg-[var(--surface-sunk)] px-3 text-sm font-medium text-slate-800 ring-1 ring-slate-200">
                <input type="checkbox" className="size-4" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {error && (
        <p className="text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void submit()} disabled={busy}>
          Tallenna
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Peruuta
        </Button>
      </div>
    </div>
  );
}

// Viikkopohjan hallinta (SPEC 12 Asetukset; SPEC 10 pohjan muokkaus koskee vain tulevia avoimia suunnitelmia).

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { isISODate } from '../../domain/dates';
import type { Profile, TemplateItem, Weekday } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Card, Field, inputClass } from '../../ui/components';
import { TimeField } from '../../ui/TimeField';
import { formatDate } from '../../ui/format';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { durationSchema, issuesByField } from '../week/sessionForm';

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: 'Ma' },
  { value: 2, label: 'Ti' },
  { value: 3, label: 'Ke' },
  { value: 4, label: 'To' },
  { value: 5, label: 'Pe' },
  { value: 6, label: 'La' },
  { value: 7, label: 'Su' },
];

const schema = z
  .object({
    activityTypeId: z.string().min(1, 'Valitse laji'),
    weekdays: z.array(z.number().int().min(1).max(7)).min(1, 'Valitse vähintään yksi viikonpäivä'),
    startTime: z.string().refine((s) => s === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(s), 'Kellonaika muodossa 17:30'),
    durationMin: durationSchema,
    validFrom: z.string().refine(isISODate, 'Valitse alkupäivä'),
    validTo: z.string().refine((s) => s === '' || isISODate(s), 'Tarkista päättymispäivä'),
    note: z.string().max(200),
  })
  .refine((v) => v.validTo === '' || v.validTo >= v.validFrom, { path: ['validTo'], message: 'Päättyy ennen alkua' });

export function TemplateSection({ profile }: { profile: Profile }) {
  const items = useLiveQuery(() => repo.listTemplateItems(profile.id), [profile.id]);
  const types = useLiveQuery(() => repo.listActivityTypes({ includeArchived: true }), []);
  const [editing, setEditing] = useState<TemplateItem | 'new' | null>(null);
  const typeName = (id: string) => {
    const t = types?.find((x) => x.id === id);
    return t ? `${t.icon} ${t.name}` : '?';
  };

  if (editing) {
    return (
      <Card title={editing === 'new' ? 'Uusi toistuva kerta' : 'Muokkaa riviä'}>
        <TemplateForm profile={profile} item={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
      </Card>
    );
  }

  return (
    <Card
      title={`Viikkorytmi · ${profile.name}`}
      action={
        <Button variant="ghost" onClick={() => setEditing('new')}>
          + Lisää
        </Button>
      }
    >
      <p className="text-sm text-slate-600">
        Toistuvat harrastukset ja koululiikunta. Niistä syntyy suunniteltuja kertoja, jotka kuitataan Viikko-näkymässä. Suunnitelmat eivät näy liikuntamäärissä ennen kuittausta.
      </p>
      {items?.length === 0 && <p className="mt-3 text-sm text-slate-500">Ei rivejä.</p>}
      <ul className="mt-2 divide-y divide-slate-100">
        {items?.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => setEditing(i)} className="flex w-full items-center gap-3 py-3 text-left active:bg-slate-50">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-900">{typeName(i.activityTypeId)}</span>
                <span className="block text-xs text-slate-600">
                  {i.weekdays.map((d) => WEEKDAYS[d - 1].label).join(', ')}
                  {i.startTime && ` klo ${i.startTime}`} · {i.durationMin} min
                </span>
                <span className="block text-xs text-slate-500">
                  {formatDate(i.validFrom, 'd.M.yyyy')} – {i.validTo ? formatDate(i.validTo, 'd.M.yyyy') : 'toistaiseksi'}
                  {i.note && ` · ${i.note}`}
                </span>
              </span>
              <span className="text-slate-400" aria-hidden>
                ✎
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TemplateForm({ profile, item, onDone }: { profile: Profile; item?: TemplateItem; onDone: () => void }) {
  const today = todayFn();
  const toast = useToast();
  const types = useLiveQuery(() => repo.listActivityTypes(), []);
  const [v, setV] = useState({
    activityTypeId: item?.activityTypeId ?? 't:football_training',
    weekdays: (item?.weekdays ?? []) as Weekday[],
    startTime: item?.startTime ?? '',
    durationMin: String(item?.durationMin ?? 60),
    validFrom: item?.validFrom ?? today,
    validTo: item?.validTo ?? '',
    note: item?.note ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Funktionaalinen päivitys: nopeat peräkkäiset napautukset eivät hukkaa valintoja.
  const toggleDay = (d: Weekday) =>
    setV((cur) => ({
      ...cur,
      weekdays: cur.weekdays.includes(d) ? cur.weekdays.filter((x) => x !== d) : [...cur.weekdays, d],
    }));

  async function save() {
    const r = schema.safeParse(v);
    if (!r.success) return setErrors(issuesByField(r.error));
    setErrors({});
    setSaving(true);
    const input = {
      activityTypeId: r.data.activityTypeId,
      weekdays: r.data.weekdays as Weekday[],
      startTime: r.data.startTime || undefined,
      durationMin: r.data.durationMin,
      validFrom: r.data.validFrom,
      validTo: r.data.validTo || undefined,
      note: r.data.note,
    };
    try {
      if (item) await repo.updateTemplateItem(item.id, input, today);
      else await repo.createTemplateItem(profile.id, input, today);
      toast(item ? 'Pohja päivitetty – muutos koskee tulevia avoimia kertoja' : 'Rivi lisätty viikkopohjaan');
      onDone();
    } catch (e) {
      setErrors({ _: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item) return;
    if (!confirmDelete) return setConfirmDelete(true);
    await repo.deleteTemplateItem(item.id, today);
    toast('Rivi poistettu – menneet ja kuitatut kerrat säilyvät');
    onDone();
  }

  const err = (k: string) => errors[k] && <span className="mt-1 block text-sm text-red-700">{errors[k]}</span>;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field label="Laji">
        <select className={inputClass} value={v.activityTypeId} onChange={(e) => setV((c) => ({ ...c, activityTypeId: e.target.value }))}>
          {types?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icon} {t.name}
            </option>
          ))}
        </select>
      </Field>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Viikonpäivät</legend>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              aria-pressed={v.weekdays.includes(d.value)}
              onClick={() => toggleDay(d.value)}
              className={`min-h-11 rounded-xl text-sm font-medium ring-1 ${v.weekdays.includes(d.value) ? 'bg-green-700 text-white ring-green-700' : 'bg-[var(--surface-sunk)] text-slate-800 ring-slate-200'}`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {err('weekdays')}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Kellonaika (valinnainen)">
          <TimeField label="Kellonaika" value={v.startTime} onChange={(t) => setV((c) => ({ ...c, startTime: t }))} />
          {err('startTime')}
        </Field>
        <Field label="Kesto (min)">
          <input className={inputClass} inputMode="numeric" value={v.durationMin} onChange={(e) => setV((c) => ({ ...c, durationMin: e.target.value }))} />
          {err('durationMin')}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Alkaa">
          <input type="date" className={inputClass} value={v.validFrom} onChange={(e) => setV((c) => ({ ...c, validFrom: e.target.value }))} />
          {err('validFrom')}
        </Field>
        <Field label="Päättyy (valinnainen)">
          <input type="date" className={inputClass} value={v.validTo} min={v.validFrom} onChange={(e) => setV((c) => ({ ...c, validTo: e.target.value }))} />
          {err('validTo')}
        </Field>
      </div>

      <Field label="Muistiinpano">
        <input className={inputClass} value={v.note} maxLength={200} onChange={(e) => setV((c) => ({ ...c, note: e.target.value }))} placeholder="esim. syyskausi" />
      </Field>

      <p className="text-xs text-slate-500">
        {item ? 'Muutos koskee vain avoimia suunnitelmia tästä päivästä eteenpäin. Menneet ja kuitatut kerrat eivät muutu.' : 'Suunnitelmat luodaan tästä päivästä eteenpäin.'}
      </p>
      {errors._ && <p className="text-sm text-red-700">{errors._}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1">
          {item ? 'Tallenna' : 'Lisää'}
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Peruuta
        </Button>
        {item && (
          <button
            type="button"
            onClick={remove}
            className={`min-h-11 rounded-xl px-3 text-sm font-medium ring-1 ${confirmDelete ? 'bg-red-700 text-white ring-red-700' : 'bg-[var(--surface-raised)] text-red-700 ring-red-200'}`}
          >
            {confirmDelete ? 'Vahvista' : 'Poista'}
          </button>
        )}
      </div>
    </form>
  );
}

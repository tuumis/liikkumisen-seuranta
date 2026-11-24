// Viikkopohjan hallinta (SPEC 12 Asetukset; SPEC 10 pohjan muokkaus koskee vain tulevia avoimia suunnitelmia).

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { isISODate } from '../../domain/dates';
import type { Profile, TemplateItem, Weekday } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Card, EmptyState, Field, inputClass } from '../../ui/components';
import { TimeField } from '../../ui/TimeField';
import { formatDate } from '../../ui/format';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { durationSchema, issuesByField } from '../week/sessionForm';
import { LabelField } from '../week/LabelField';
import { typeOptionLabel, useHiddenTypes, visibleTypes } from '../week/useLoggableTypes';
import { useFootballStatus, withoutClubFootball } from '../football/useFootballEnabled';
import { DateInput } from '../../ui/DateInput';
import { isClubTraining, trainingSelfText } from '../../domain/football';
import { parseSelfMin, TrainingSelfBackfill, TrainingSelfFields } from '../football/TrainingSelf';
import { IconClose, IconPencil, IconPlus } from '../../ui/icons';
import { TrainingTeamField } from '../football/TrainingTeam';
import { displayTeamName } from '../../domain/opponent';

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
    label: z.string().max(40),
  })
  .refine((v) => v.validTo === '' || v.validTo >= v.validFrom, { path: ['validTo'], message: 'Päättyy ennen alkua' });

export function TemplateSection({ profile }: { profile: Profile }) {
  const items = useLiveQuery(() => repo.listTemplateItems(profile.id), [profile.id]);
  const types = useLiveQuery(() => repo.listActivityTypes({ includeArchived: true }), []);
  const teams = useLiveQuery(() => repo.listTeams(profile.id, { includeArchived: true, groups: true }), [profile.id]);
  const [editing, setEditing] = useState<TemplateItem | 'new' | null>(null);
  const today = todayFn();
  // Seuran treenin joukkue tai ryhmä listan rivillä (19.11.2026). Ilman valintaa ainoa joukkue tulee kuitatessa
  // (ja jää riville, jos toinen lisätään), joten se näytetään valittuna.
  const activeTeams = teams?.filter((t) => !t.archived) ?? [];
  const teamLine = (i: TemplateItem): { text: string; warn?: boolean } | undefined => {
    if (!teams?.length || !isClubTraining(types?.find((t) => t.id === i.activityTypeId))) return undefined;
    const name = (t: { kind?: string; name: string }) => (t.kind === 'group' ? `Ryhmä: ${t.name}` : displayTeamName(t.name));
    const t = i.teamId ? teams.find((x) => x.id === i.teamId) : undefined;
    if (t) return { text: t.archived ? `${name(t)} (arkistoitu)` : name(t) };
    if (activeTeams.length === 1) return { text: name(activeTeams[0]) };
    if (activeTeams.length > 1) return { text: 'Joukkue tai ryhmä valitsematta', warn: true };
    return undefined;
  };
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
    <>
    <Card
      title={`Viikkorytmi · ${profile.name}`}
      action={
        <Button variant="ghost" onClick={() => setEditing('new')}>
          <IconPlus size="1rem" /> Lisää
        </Button>
      }
    >
      <p className="text-sm text-slate-600">
        Toistuvat harrastukset ja koululiikunta. Niistä syntyy suunniteltuja kertoja, jotka kuitataan Viikko-näkymässä. Suunnitelmat eivät näy liikuntamäärissä ennen kuittausta.
      </p>
      {items?.length === 0 && (
        <EmptyState art="repeat" title="Viikkorytmi on tyhjä" compact>
          Lisää esimerkiksi treenit tai koulun liikuntatunnit, niin ne tulevat viikolle valmiiksi kuitattaviksi.
        </EmptyState>
      )}
      <ul className="mt-2 divide-y divide-slate-100">
        {items?.map((i) => {
          const team = teamLine(i);
          const ended = !!i.validTo && i.validTo < today;
          const upcoming = i.validFrom > today;
          return (
          <li key={i.id}>
            <button type="button" onClick={() => setEditing(i)} className="flex w-full items-center gap-3 py-3 text-left active:bg-slate-50">
              <span className={`min-w-0 flex-1 ${ended ? 'opacity-60' : ''}`}>
                <span className="block font-medium leading-relaxed text-slate-900">
                  {typeName(i.activityTypeId)}
                  {i.label && <span className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-[var(--surface-sage)] px-2 py-0.5 text-xs font-semibold text-green-900">{i.label}</span>}
                  {ended && <span className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">päättynyt</span>}
                  {upcoming && <span className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">alkaa {formatDate(i.validFrom, 'd.M.')}</span>}
                </span>
                {team && (
                  <span className={`block text-xs font-semibold ${team.warn ? 'text-amber-800' : 'text-slate-700'}`}>{team.text}</span>
                )}
                <span className="block text-xs text-slate-600">
                  {i.weekdays.map((d) => WEEKDAYS[d - 1].label).join(', ')}
                  {i.startTime && ` klo ${i.startTime}`} · {i.durationMin} min
                  {(i.selfBeforeMin || i.selfAfterMin) && isClubTraining(types?.find((t) => t.id === i.activityTypeId)) ? ` · 🥾 ${trainingSelfText(i)}` : ''}
                </span>
                <span className="block text-xs text-slate-500">
                  {formatDate(i.validFrom, 'd.M.yyyy')} – {i.validTo ? formatDate(i.validTo, 'd.M.yyyy') : 'toistaiseksi'}
                  {i.note && ` · ${i.note}`}
                </span>
              </span>
              <span className="text-slate-400" aria-hidden>
                <IconPencil size="1rem" />
              </span>
            </button>
          </li>
          );
        })}
      </ul>
    </Card>
    <TrainingSelfBackfill profile={profile} />
    </>
  );
}

function TemplateForm({ profile, item, onDone }: { profile: Profile; item?: TemplateItem; onDone: () => void }) {
  const today = todayFn();
  const toast = useToast();
  const hidden = useHiddenTypes(profile.id);
  const footballStatus = useFootballStatus(profile);
  const footballOn = !!footballStatus;
  const types = withoutClubFootball(visibleTypes(useLiveQuery(() => repo.listActivityTypes(), []), hidden, item?.activityTypeId), footballOn, item?.activityTypeId);
  const [v, setV] = useState({
    // Oletuslaji: jalkapallotreeni, jos jalkapallo on käytössä; muuten valitaan ensimmäinen laji (alla).
    activityTypeId: item?.activityTypeId ?? (profile.football ? 't:football_training' : ''),
    weekdays: (item?.weekdays ?? []) as Weekday[],
    startTime: item?.startTime ?? '',
    durationMin: String(item?.durationMin ?? 60),
    validFrom: item?.validFrom ?? today,
    validTo: item?.validTo ?? '',
    note: item?.note ?? '',
    label: item?.label ?? '',
    selfBefore: item?.selfBeforeMin ? String(item.selfBeforeMin) : '',
    selfAfter: item?.selfAfterMin ? String(item.selfAfterMin) : '',
    teamId: item?.teamId ?? '',
  });
  const clubTraining = isClubTraining(types?.find((t) => t.id === v.activityTypeId));
  // Uuden rivin oletuslaji, kun jalkapallon päättely ja lajit ovat valmiina.
  const firstId = types?.[0]?.id;
  useEffect(() => {
    if (item || footballStatus === undefined || !firstId) return;
    setV((c) => (c.activityTypeId ? c : { ...c, activityTypeId: footballStatus ? 't:football_training' : firstId }));
  }, [item, footballStatus, firstId]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Menneet kerrat kuitattaviksi, kun alkupäivä on menneisyydessä (oletus: kyllä).
  const [backfill, setBackfill] = useState(true);
  const past = isISODate(v.validFrom) && v.validFrom < today;

  // Funktionaalinen päivitys: nopeat peräkkäiset napautukset eivät hukkaa valintoja.
  const toggleDay = (d: Weekday) =>
    setV((cur) => ({
      ...cur,
      weekdays: cur.weekdays.includes(d) ? cur.weekdays.filter((x) => x !== d) : [...cur.weekdays, d],
    }));

  async function save() {
    const r = schema.safeParse(v);
    if (!r.success) return setErrors(issuesByField(r.error));
    const sb = clubTraining ? parseSelfMin(v.selfBefore) : 0;
    const sa = clubTraining ? parseSelfMin(v.selfAfter) : 0;
    if (sb === null || sa === null) return setErrors({ self: 'Anna minuutit kokonaislukuina (0–180)' });
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
      label: r.data.label,
      selfBeforeMin: sb || undefined,
      selfAfterMin: sa || undefined,
      teamId: clubTraining ? v.teamId || undefined : undefined,
    };
    try {
      const saved = item ? await repo.updateTemplateItem(item.id, input, today) : await repo.createTemplateItem(profile.id, input, today);
      const added = past && backfill ? await repo.backfillTemplateItem(saved.id, today) : 0;
      toast(
        added > 0
          ? `${item ? 'Pohja päivitetty' : 'Rivi lisätty'} – ${added} mennyttä kertaa lisätty kuitattavaksi (Viikko → Käy viikko läpi)`
          : item
            ? 'Pohja päivitetty – muutos koskee tulevia avoimia kertoja'
            : 'Rivi lisätty viikkorytmiin',
        undefined,
        'success',
      );
      onDone();
    } catch (e) {
      setErrors({ _: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item) return;
    // Ei vahvistuskysymystä: poisto on kumottavissa ilmoituksen "Kumoa"-painikkeella (SPEC 16).
    const restored = await repo.deleteTemplateItem(item.id, today);
    const id = item.id;
    toast('Rivi poistettu – menneet ja kuitatut kerrat säilyvät', { label: 'Kumoa', run: () => repo.restoreTemplateItem(id, today, restored) });
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
              {typeOptionLabel(t)}
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Alkaa">
          <DateInput className={inputClass} value={v.validFrom} onChange={(d) => setV((c) => ({ ...c, validFrom: d }))} aria-label="Alkaa" />
          {err('validFrom')}
        </Field>
        <Field label="Päättyy (valinnainen)">
          <div className="flex gap-1">
            <DateInput className={inputClass} value={v.validTo} min={v.validFrom} onChange={(d) => setV((c) => ({ ...c, validTo: d }))} aria-label="Päättyy" placeholder="Ei päättymispäivää" />
            {v.validTo && (
              <button type="button" onClick={() => setV((c) => ({ ...c, validTo: '' }))} className="min-h-11 shrink-0 rounded-xl px-2 text-sm text-slate-600 hover:bg-[var(--surface-sunk)]" aria-label="Poista päättymispäivä">
                <IconClose size="1.1rem" />
              </button>
            )}
          </div>
          {err('validTo')}
        </Field>
      </div>

      {clubTraining && (
        <TrainingTeamField
          profileId={profile.id}
          value={v.teamId}
          onChange={(id) => setV((c) => ({ ...c, teamId: id }))}
          hint="Kuitattu treeni merkitään tälle joukkueelle tai ryhmälle; yksittäisen treenin valintaa voi muuttaa sen lisätiedoista. Uuden joukkueen tai treeniryhmän lisäät kohdassa Jalkapallo → Joukkueet."
        />
      )}

      {clubTraining && (
        <TrainingSelfFields
          before={v.selfBefore}
          after={v.selfAfter}
          onBefore={(x) => setV((c) => ({ ...c, selfBefore: x }))}
          onAfter={(x) => setV((c) => ({ ...c, selfAfter: x }))}
          error={errors.self}
          hint='Oletus jokaiselle treenille: kuittaus kirjaa treenin viereen oman "Jalkapallo – omatoiminen" -kerran (omatoiminen liikunta). Yksittäistä kertaa voi muuttaa kerran muokkauksesta.'
        />
      )}

      <LabelField profileId={profile.id} activityTypeId={v.activityTypeId} value={v.label} onChange={(l) => setV((c) => ({ ...c, label: l }))} placeholder="esim. Joukkuetreeni, Taitokoulu" />

      <Field label="Muistiinpano">
        <input className={inputClass} value={v.note} maxLength={200} onChange={(e) => setV((c) => ({ ...c, note: e.target.value }))} placeholder="esim. syyskausi" />
      </Field>

      {past && (
        <label className="card-sunk flex cursor-pointer items-start gap-3 p-3">
          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-green-700" checked={backfill} onChange={(e) => setBackfill(e.target.checked)} />
          <span className="text-sm text-slate-800">
            <strong className="block">Luo myös menneet kerrat</strong>
            <span className="text-xs text-slate-600">
              Kerrat alkupäivästä eiliseen (enintään 12 viikkoa) lisätään avoimiksi, jotta voit kuitata ne tehdyiksi tai ei tehdyiksi. Jo olemassa olevat kerrat eivät muutu.
            </span>
          </span>
        </label>
      )}
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
            className="min-h-11 rounded-xl bg-[var(--surface-raised)] px-3 text-sm font-medium text-red-700 ring-1 ring-red-200"
          >
            Poista
          </button>
        )}
      </div>
    </form>
  );
}

import { Switch } from './DesktopSection';
import { useState, type ReactNode } from 'react';
import { z } from 'zod';
import { isISODate, timestampToLocalDate } from '../../domain/dates';
import { recommendationGroup } from '../../domain/groups';
import type { Profile, RecommendationGroup } from '../../domain/types';
import { PhotoPicker } from '../../ui/Avatar';
import { Button, Field, inputClass } from '../../ui/components';
import { GROUP_LABEL, MONTHS, PROFILE_COLORS } from '../../ui/labels';
import { today } from '../../ui/today';
import { DateInput } from '../../ui/DateInput';
import { useFootballStatus } from '../football/useFootballEnabled';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo } from '../../db/repositories';

const currentYear = Number(today().slice(0, 4));

// Tietojen minimointi (SPEC 11): lempinimi, syntymävuosi ja -kuukausi, koulun aloitus.
const schema = z
  .object({
    name: z.string().trim().min(1, 'Anna nimi tai lempinimi').max(40),
    kind: z.enum(['child', 'adult']),
    birthYear: z.coerce.number().int().min(1940, 'Tarkista vuosi').max(currentYear, 'Tarkista vuosi'),
    birthMonth: z.coerce.number().int().min(1).max(12),
    schoolStartYear: z.string(),
    schoolStartMonth: z.coerce.number().int().min(1).max(12),
    groupOverride: z.enum(['', 'early_years', 'school_age', 'adult']),
    color: z.string(),
    trackingStart: z.string().refine((s) => isISODate(s) && s <= today(), 'Tarkista päivä'),
  })
  .superRefine((v, ctx) => {
    if (v.schoolStartYear !== '') {
      const y = Number(v.schoolStartYear);
      if (!Number.isInteger(y) || y < v.birthYear || y > currentYear + 10) {
        ctx.addIssue({ code: 'custom', path: ['schoolStartYear'], message: 'Tarkista koulun aloitusvuosi' });
      }
    }
  });

export type ProfileFormValues = Pick<Profile, 'name' | 'kind' | 'birthYear' | 'birthMonth' | 'color'> & {
  schoolStart: Profile['schoolStart'];
  groupOverride: Profile['groupOverride'];
  trackingStart: Profile['trackingStart'];
  photo: Profile['photo'];
  football: Profile['football'];
  insightsRec: Profile['insightsRec'];
  insightsLoad: Profile['insightsLoad'];
};

export function ProfileForm({
  initial,
  onSubmit,
  onCancel,
  wide,
  defaults,
  actions,
}: {
  initial?: Profile;
  /** Uuden profiilin esitäyttö (pikatestin vastauksista). */
  defaults?: { birthYear?: number; schoolStartYear?: number; football?: boolean };
  onSubmit: (v: ProfileFormValues) => Promise<void>;
  onCancel: () => void;
  /** Leveällä näytöllä kentät kahteen palstaan (aloitus). */
  wide?: boolean;
  /** Oma painikerivi (aloituksen Takaisin / Ohita / Seuraava, 27.11.2026); tallennus on lomakkeen submit. */
  actions?: (saving: boolean) => ReactNode;
}) {
  const [raw, setRaw] = useState({
    name: initial?.name ?? '',
    kind: initial?.kind ?? 'child',
    birthYear: String(initial?.birthYear ?? defaults?.birthYear ?? ''),
    birthMonth: String(initial?.birthMonth ?? 1),
    schoolStartYear: initial?.schoolStart ? String(initial.schoolStart.year) : defaults?.schoolStartYear ? String(defaults.schoolStartYear) : '',
    schoolStartMonth: String(initial?.schoolStart?.month ?? 8),
    groupOverride: (initial?.groupOverride ?? '') as '' | RecommendationGroup,
    color: initial?.color ?? PROFILE_COLORS[0],
    trackingStart: initial?.trackingStart ?? (initial ? timestampToLocalDate(initial.createdAt) : today()),
  });
  const [photo, setPhoto] = useState<string | undefined>(initial?.photo);
  // Jalkapallo: tallennettu valinta tai datasta päätelty (vanha profiili); uudella profiililla oletus "Ei".
  const inferredFootball = useFootballStatus(initial);
  const [footballChoice, setFootballChoice] = useState<boolean | undefined>(initial ? initial.football : defaults?.football);
  const football = footballChoice ?? (initial ? !!inferredFootball : false);
  // Viikon huomiot (24.11.2026): oletuksena päällä; vain poisto tallennetaan.
  const [insightsRec, setInsightsRec] = useState(initial?.insightsRec !== false);
  const [insightsLoad, setInsightsLoad] = useState(initial?.insightsLoad !== false);
  // Oletus = luontipäivä (uudella profiililla tänään); vain poikkeava päivä tallennetaan.
  const defaultStart = initial ? timestampToLocalDate(initial.createdAt) : today();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof raw) => (e: { target: { value: string } }) => { const val = e.target.value; setRaw((c) => ({ ...c, [k]: val })); };
  // Aloitus PC:llä (27.11.2026): mahtuu yhteen näkymään. Suositusryhmä ja seurannan alku piilossa (oletukset, Asetuksissa),
  // lyhyemmät ohjetekstit ja tiiviimmät välit. Vain leveällä näytöllä; puhelimen aloitus ja Asetukset ennallaan.
  const onlyNarrow = wide ? 'lg:hidden' : '';
  const onlyWide = wide ? 'hidden lg:block' : 'hidden';
  const gap = wide ? 'space-y-4 lg:space-y-3' : 'space-y-4';
  // Muiden profiilien värit (27.11.2026): perhenäkymissä profiilit erotetaan väreistä, joten sama väri huomautetaan.
  const otherProfiles = useLiveQuery(() => repo.listProfiles(), [])?.filter((p) => p.id !== initial?.id) ?? [];
  const usedBy = (c: string) => otherProfiles.filter((p) => p.color?.toLowerCase() === c.toLowerCase()).map((p) => p.name);
  const sameColor = usedBy(raw.color);
  const colorPicker = (
  <fieldset>
    <legend className="mb-1 text-sm font-medium text-slate-700">Väri</legend>
    <div className="flex flex-wrap gap-2">
      {PROFILE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setRaw((cur) => ({ ...cur, color: c }))}
          className={`relative ${wide ? 'size-10 lg:size-8' : 'size-10'} rounded-full ring-offset-2 ${raw.color === c ? 'ring-2 ring-slate-900' : ''}`}
          style={{ backgroundColor: c }}
          aria-label={`Väri ${c}${usedBy(c).length ? `, käytössä: ${usedBy(c).join(', ')}` : ''}`}
          title={usedBy(c).length ? `Käytössä: ${usedBy(c).join(', ')}` : undefined}
          aria-pressed={raw.color === c}
        >
          {usedBy(c).length > 0 && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-[var(--surface)] ring-2 ring-[var(--surface)]" aria-hidden><span className="block size-full rounded-full bg-slate-400" /></span>}
        </button>
      ))}
    </div>
    {sameColor.length > 0 && (
      <p className="mt-1.5 text-xs text-amber-800" role="status">
        Sama väri kuin profiililla {sameColor.join(', ')}. Perheen kalentereissa ja viikossa profiilit erottuvat toisistaan väristä, joten eri väri on selkeämpi.
      </p>
    )}
    {sameColor.length === 0 && otherProfiles.length > 0 && <p className="mt-1.5 text-xs text-slate-500">Harmaa piste: väri on jo toisella profiililla.</p>}
  </fieldset>
  );

  const parsed = schema.safeParse(raw);
  const preview: RecommendationGroup | undefined = parsed.success
    ? recommendationGroup(
        {
          birthYear: parsed.data.birthYear,
          birthMonth: parsed.data.birthMonth,
          schoolStart:
            parsed.data.kind === 'child' && parsed.data.schoolStartYear !== ''
              ? { year: Number(parsed.data.schoolStartYear), month: parsed.data.schoolStartMonth }
              : undefined,
          groupOverride: parsed.data.groupOverride || undefined,
        },
        today(),
      )
    : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = schema.safeParse(raw);
    if (!r.success) {
      const errs: Record<string, string> = {};
      for (const issue of r.error.issues) errs[String(issue.path[0])] ??= issue.message;
      setErrors(errs);
      return;
    }
    const v = r.data;
    setSaving(true);
    try {
      await onSubmit({
        name: v.name,
        kind: v.kind,
        birthYear: v.birthYear,
        birthMonth: v.birthMonth,
        color: v.color,
        schoolStart:
          v.kind === 'child' && v.schoolStartYear !== ''
            ? { year: Number(v.schoolStartYear), month: v.schoolStartMonth }
            : undefined,
        groupOverride: v.groupOverride || undefined,
        trackingStart: v.trackingStart === defaultStart ? undefined : v.trackingStart,
        photo,
        // Vanhan profiilin päättely kesken eikä valintaa tehty → ei muuteta (päätellään jatkossakin).
        football: footballChoice ?? (initial ? inferredFootball : false),
        insightsRec: insightsRec ? undefined : false,
        insightsLoad: insightsLoad ? undefined : false,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className={wide ? 'space-y-4 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:space-y-0' : 'space-y-4'}>
      <div className={gap}>
      <div className={wide ? 'space-y-4 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0' : 'space-y-4'}>
      <Field label="Nimi" hint={wide ? undefined : 'Lempinimi riittää.'}>
        <input className={inputClass} value={raw.name} onChange={set('name')} autoComplete="off" maxLength={40} placeholder={wide ? 'Lempinimi riittää' : undefined} />
        {errors.name && <span className="mt-1 block text-sm text-red-700">{errors.name}</span>}
      </Field>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Seurattava</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['child', 'adult'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRaw((cur) => ({ ...cur, kind: k }))}
              className={`min-h-11 rounded-xl text-sm font-medium ring-1 ${raw.kind === k ? 'bg-green-700 text-white ring-green-700' : 'bg-[var(--surface-sunk)] text-slate-800 ring-slate-200'}`}
              aria-pressed={raw.kind === k}
            >
              {k === 'child' ? 'Lapsi' : 'Aikuinen'}
            </button>
          ))}
        </div>
      </fieldset>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Syntymävuosi">
          <input className={inputClass} inputMode="numeric" value={raw.birthYear} onChange={set('birthYear')} placeholder="2018" />
          {errors.birthYear && <span className="mt-1 block text-sm text-red-700">{errors.birthYear}</span>}
        </Field>
        <Field label="Syntymäkuukausi">
          <select className={inputClass} value={raw.birthMonth} onChange={set('birthMonth')}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="-mt-2 text-xs text-slate-500">Syntymästä tallennetaan vain vuosi ja kuukausi.</p>

      {raw.kind === 'child' && (
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Koulun aloitus</span>
          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputClass}
              inputMode="numeric"
              value={raw.schoolStartYear}
              onChange={set('schoolStartYear')}
              placeholder="vuosi"
              aria-label="Koulun aloitusvuosi"
            />
            <select className={inputClass} value={raw.schoolStartMonth} onChange={set('schoolStartMonth')} aria-label="Koulun aloituskuukausi">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {errors.schoolStartYear && <span className="mt-1 block text-sm text-red-700">{errors.schoolStartYear}</span>}
          <span className={`mt-1 block text-xs text-slate-500 ${onlyNarrow}`}>
            Ratkaisee, milloin alle kouluikäisten suositus vaihtuu kouluikäisten suositukseen. Jos tyhjä, vaihto tehdään 7 vuoden iässä.
          </span>
          <span className={`mt-1 text-xs text-slate-500 ${onlyWide}`}>Kouluikäisten suositus alkaa tästä; jos tyhjä, 7-vuotiaana.</span>
        </div>
      )}

      {wide && preview && (
        <p className={`text-sm text-slate-600 ${onlyWide}`}>
          Suositus tänään: <strong>{GROUP_LABEL[preview]}</strong>
        </p>
      )}
      <div className={onlyNarrow}>
      <Field label="Suositusryhmä">
        <select className={inputClass} value={raw.groupOverride} onChange={set('groupOverride')}>
          <option value="">Automaattinen</option>
          {(Object.keys(GROUP_LABEL) as RecommendationGroup[]).map((g) => (
            <option key={g} value={g}>
              {GROUP_LABEL[g]} (käsin)
            </option>
          ))}
        </select>
        {preview && (
          <span className="mt-1 block text-xs text-slate-600">
            Tänään: <strong>{GROUP_LABEL[preview]}</strong>
          </span>
        )}
      </Field>
      </div>
      {wide && <div className="hidden lg:block">{colorPicker}</div>}

      </div>
      <div className={gap}>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Pelaako {raw.name.trim() || 'hän'} jalkapalloa?</legend>
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((on) => (
            <button
              key={String(on)}
              type="button"
              onClick={() => setFootballChoice(on)}
              className={`min-h-11 rounded-xl text-sm font-medium ring-1 ${football === on ? 'bg-green-700 text-white ring-green-700' : 'bg-[var(--surface-sunk)] text-slate-800 ring-slate-200'}`}
              aria-pressed={football === on}
            >
              {on ? '⚽ Kyllä' : 'Ei'}
            </button>
          ))}
        </div>
        <span className="mt-1 block text-xs leading-relaxed text-slate-500">
          {football
            ? 'Mukana Jalkapallo-välilehti: päiväkirja, pelikalenteri, tulokset ja joukkueet sekä jalkapallon lisätiedot kerroille.'
            : 'Jalkapalloon liittyvät osat piilotetaan. Voit ottaa ne käyttöön myöhemmin tästä.'}
          {!football && initial && inferredFootball && ' Kirjatut jalkapallokerrat säilyvät ja lasketaan edelleen liikuntaan.'}
        </span>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Viikon huomiot</legend>
        <span className={`block text-xs leading-relaxed text-slate-500 ${onlyNarrow}`}>Päättyneen viikon lyhyet havainnot lähteineen Viikko-näkymän koosteessa ja Analyysissa.</span>
        <div className="divide-y divide-slate-100">
          <Switch
            on={insightsRec}
            onChange={setInsightsRec}
            label="Liikkumissuositus"
            text={wide ? <>Mitä suosituksesta jäi vajaaksi<span className="lg:hidden">, esim. rasittavat päivät tai päivittäinen tunti</span>.</> : 'Mitä suosituksesta jäi vajaaksi, esim. rasittavat päivät tai päivittäinen tunti.'}
          />
          {raw.kind === 'child' && (
            <Switch
              on={insightsLoad}
              onChange={setInsightsLoad}
              label="Urheilun kuormitus"
              text={
                wide ? (
                  <>
                    <span className="lg:hidden">Ohjatun urheilun vapaapäivät</span>
                    <span className="hidden lg:inline">Vapaapäivät</span>, tunnit suhteessa ikään ja nopea kasvu
                    <span className="lg:hidden"> (tutkimustieto). Myös Kauden koosteen Tauot ja vaihtelu -kortti</span>.
                  </>
                ) : (
                  'Ohjatun urheilun vapaapäivät, tunnit suhteessa ikään ja nopea kasvu (tutkimustieto). Myös Kauden koosteen Tauot ja vaihtelu -kortti.'
                )
              }
            />
          )}
        </div>
      </fieldset>

      <div className={onlyNarrow}>
      <Field label="Seuranta alkoi" hint="Analyysi laskee päivät tästä alkaen. Voit siirtää alkua aiemmaksi, jos kirjaat vanhoja kertoja.">
        <DateInput className={inputClass} value={raw.trackingStart} max={today()} onChange={(v) => set('trackingStart')({ target: { value: v } })} aria-label="Seurannan alku" />
        {errors.trackingStart && <span className="mt-1 block text-sm text-red-700">{errors.trackingStart}</span>}
      </Field>
      </div>

      <PhotoPicker label="Profiilikuva" name={raw.name} value={photo} color={raw.color} onChange={setPhoto} />

      {wide ? <div className="lg:hidden">{colorPicker}</div> : colorPicker}

      </div>
      </div>

      {actions ? (
        actions(saving)
      ) : (
        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={saving} className="flex-1">
            {initial ? 'Tallenna' : 'Lisää profiili'}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Peruuta
          </Button>
        </div>
      )}
    </form>
  );
}

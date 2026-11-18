// Perusarvioiden hallinta (SPEC 3, 6, 12). Perusarvio täyttää vain ne kategoriat,
// joille päivällä ei ole kirjauksia, eikä se koskaan tuota rasittavaa tai vahvistavaa päivää.

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { activityTypeId } from '../../domain/ids';
import { estimateMinutes } from '../../domain/aggregate';
import { minutesFromShares, mvpaOf } from '../../domain/intensity';
import type { Category, Estimate, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { ESTIMATE_DEFAULT_TYPE_KEY, estimateSuggestions } from '../../seed/activityTypes';
import { recommendationGroup } from '../../domain/groups';
import { RECOMMENDATIONS } from '../../domain/recommendations';
import { Button, Card, EmptyState, EstimateBadge, Field, inputClass } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { formatDate } from '../../ui/format';
import { CATEGORY_LABEL, pct } from '../../ui/labels';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { DateInput } from '../../ui/DateInput';
import { IconPencil } from '../../ui/icons';

const minutesField = z.coerce.number().int().min(0, 'Vähintään 0').max(600, 'Enintään 600');

type Draft = { category: Category; label: string; existing?: Estimate; weekdayMin?: number };

export function EstimatesSection({ profile }: { profile: Profile }) {
  const today = todayFn();
  const active = useLiveQuery(() => repo.activeEstimates(profile.id, today), [profile.id, today]);
  const all = useLiveQuery(() => repo.listEstimates(profile.id), [profile.id]);
  const [draft, setDraft] = useState<Draft | null>(null);
  // Aiemmat (päättyneet tai myöhemmin alkavat) arviot: näkyvät, jotta niiden kategorian voi korjata (17.11.2026).
  const activeIds = new Set(active?.map((e) => e.id));
  const earlier = (all ?? []).filter((e) => !activeIds.has(e.id)).sort((a, b) => b.validFrom.localeCompare(a.validFrom));

  if (draft) {
    return (
      <Card title={draft.existing ? 'Muokkaa perusarviota' : 'Uusi perusarvio'}>
        <EstimateForm profile={profile} draft={draft} onDone={() => setDraft(null)} />
      </Card>
    );
  }

  const used = new Set(active?.map((e) => e.category));
  // Alle kouluikäiselle päiväkotipäivä ja leikki, koululaiselle välitunnit, koulumatkat ja leikki.
  const suggestions = estimateSuggestions(recommendationGroup(profile, today)).filter((s) => !used.has(s.category));
  const freeCategories = (Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => !used.has(c));

  return (
    <Card title={`Arkiliikunta (perusarviot) · ${profile.name}`}>
      <DaycareDoubles profileId={profile.id} />
      <p className="text-sm text-slate-600">
        Arvio tavallisesta liikkumisesta, jota ei kirjata kerta kerralta (esim. välitunnit). Arvio täyttää kategorian vain päivinä, joille siinä ei ole kirjauksia, ja se näytetään
        aina erikseen.
      </p>
      <ul className="mt-2 divide-y divide-slate-100">
        {active?.map((e) => {
          const wd = estimateMinutes(e, '2026-11-09');
          return (
            <li key={e.id} className="flex items-center gap-2 py-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() =>
                  setDraft({
                    category: e.category,
                    label: e.label,
                    existing: e,
                  })
                }
              >
                <span className="block truncate font-medium text-slate-900">{e.label}</span>
                <span className="block text-xs text-slate-600">
                  {CATEGORY_LABEL[e.category]} · arki {e.weekdayMin} min/pv · viikonloppu {e.weekendMin} min/pv
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                  <EstimateBadge /> arkipäivänä reipasta ja rasittavaa arviolta {mvpaOf(wd)} min · voimassa {formatDate(e.validFrom, 'd.M.yyyy')} alkaen
                </span>
              </button>
              <span className="text-slate-400" aria-hidden>
                <IconPencil size="1rem" />
              </span>
            </li>
          );
        })}
      </ul>
      {active?.length === 0 && (
        <EmptyState art="sprout" title="Ei arkiliikunnan arvioita" compact>
          Lisää arvio esimerkiksi välitunneista tai koulumatkoista, niin arki näkyy viikon liikunnassa.
        </EmptyState>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <Button key={s.category} variant="secondary" onClick={() => setDraft({ category: s.category, label: s.label, weekdayMin: s.weekdayMin })}>
            + {s.label}
          </Button>
        ))}
        {freeCategories.length > 0 && (
          <Button variant="ghost" onClick={() => setDraft({ category: freeCategories[0], label: '' })}>
            + Muu kategoria
          </Button>
        )}
      </div>
      {earlier.length > 0 && (
        <details className="mt-4 rounded-xl bg-[var(--surface-sunk)] p-3 ring-1 ring-slate-200">
          <summary className="min-h-9 cursor-pointer text-sm font-semibold text-slate-800">Aiemmat arviot ({earlier.length})</summary>
          <p className="mt-1 text-xs text-slate-500">Päättyneet arviot vaikuttavat yhä omien päiviensä laskentaan. Jos sama arki näkyy vanhoilla päivillä kahdesti, siirrä vanha arvio oikeaan kategoriaan.</p>
          <ul className="mt-2 divide-y divide-slate-200/70">
            {earlier.map((e) => (
              <li key={e.id} className="py-2.5">
                <span className="block truncate text-sm font-medium text-slate-900">{e.label}</span>
                <span className="block text-xs text-slate-600">
                  {CATEGORY_LABEL[e.category]} · arki {e.weekdayMin} min/pv · {formatDate(e.validFrom, 'd.M.yyyy')}–{e.validTo ? formatDate(e.validTo, 'd.M.yyyy') : ''}
                </span>
                <CategoryChange estimate={e} profileId={profile.id} onDone={() => undefined} />
              </li>
            ))}
          </ul>
        </details>
      )}
      {active && active.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Muokatessa voit valita, koskeeko muutos tästä päivästä eteenpäin (aiemmat päivät eivät muutu) vai korjataanko koko arvio alkamispäivää myöten.
        </p>
      )}
    </Card>
  );
}

/** Liukusäädin minuuteille (määritelty komponentin ulkopuolella, jotta vetäminen ei katkea renderöinnissä). */
function Slider({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm font-medium text-slate-700">
        <span>{label}</span>
        <span className="tabular-nums">{value} min/pv</span>
      </span>
      <input type="range" min={0} max={180} step={5} value={value} onChange={(ev) => onChange(Number(ev.target.value))} className="w-full accent-green-700" />
    </label>
  );
}

function EstimateForm({ profile, draft, onDone }: { profile: Profile; draft: Draft; onDone: () => void }) {
  const today = todayFn();
  const toast = useToast();
  const types = useLiveQuery(() => repo.listActivityTypes(), []);
  const e = draft.existing;
  const [category, setCategory] = useState<Category>(draft.category);
  const [label, setLabel] = useState(draft.label);
  const [weekday, setWeekday] = useState(e?.weekdayMin ?? draft.weekdayMin ?? (draft.category === 'daycare' ? 120 : 30));
  const [weekend, setWeekend] = useState(e?.weekendMin ?? 0);
  const [typeKey, setTypeKey] = useState<string>(() => (e ? '' : activityTypeId(ESTIMATE_DEFAULT_TYPE_KEY[draft.category])));
  const [error, setError] = useState<string>();
  const [confirmEnd, setConfirmEnd] = useState(false);
  // Uusi arvio voi alkaa myös menneisyydestä; olemassa olevaa muutetaan tästä päivästä tai korjataan kokonaan.
  const [mode, setMode] = useState<'forward' | 'correct'>('forward');
  const [validFrom, setValidFrom] = useState<string>(e?.validFrom ?? today);

  // Tehoprofiili: valitun lajin profiili; muokattaessa säilyy arvion oma profiili, kunnes lajia vaihdetaan.
  const shares = typeKey ? types?.find((t) => t.id === typeKey)?.shares : e?.shares;
  const preview = shares ? minutesFromShares(weekday, shares) : undefined;

  async function save() {
    const w = minutesField.safeParse(weekday);
    const we = minutesField.safeParse(weekend);
    if (!label.trim()) return setError('Anna nimi');
    if (!w.success || !we.success) return setError('Tarkista minuutit');
    if (!shares) return setError('Valitse tehoprofiili');
    const input = {
      category,
      label,
      weekdayMin: w.data,
      weekendMin: we.data,
      shares,
    };
    try {
      if (e && mode === 'correct') await repo.correctEstimate(e.id, input, validFrom, today);
      else await repo.saveEstimate(profile.id, input, today, e ? today : validFrom);
      toast('Perusarvio tallennettu');
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function end() {
    if (!e) return;
    if (!confirmEnd) return setConfirmEnd(true);
    await repo.endEstimate(e.id, today);
    toast('Perusarvio lopetettu – aiemmat päivät säilyvät');
    onDone();
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        void save();
      }}
    >
      <Field label="Nimi">
        <input className={inputClass} value={label} onChange={(ev) => setLabel(ev.target.value)} maxLength={60} placeholder="esim. Välitunnit ja pihaleikit" />
      </Field>
      {!e && (
        <Field label="Kategoria">
          <select
            className={inputClass}
            value={category}
            onChange={(ev) => {
              const c = ev.target.value as Category;
              setCategory(c);
              setTypeKey(activityTypeId(ESTIMATE_DEFAULT_TYPE_KEY[c]));
            }}
          >
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
      )}
      {e && <CategoryChange estimate={e} profileId={profile.id} onDone={onDone} />}
      {e && (
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Muutos koskee</div>
          <Segmented
            label="Muutos koskee"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'forward', label: 'Tästä päivästä' },
              { value: 'correct', label: 'Koko arviota' },
            ]}
          />
        </div>
      )}
      {(!e || mode === 'correct') && (
        <Field label="Voimassa alkaen" hint={e ? 'Korjaus muuttaa myös aiempien päivien arvion.' : 'Voit valita myös menneen päivän, esim. seurannan alun.'}>
          <DateInput className={inputClass} value={validFrom} max={today} onChange={setValidFrom} aria-label="Voimassa alkaen" />
        </Field>
      )}
      <Slider label="Arkipäivä (ma–pe)" value={weekday} onChange={setWeekday} />
      {category === 'daycare' && <DaycareHint weekday={weekday} mvpa={preview ? mvpaOf(preview) : undefined} />}
      <Slider label="Viikonloppu (la–su)" value={weekend} onChange={setWeekend} />
      <Field label="Tehoprofiili" hint="Kuinka suuri osa ajasta on arviolta kevyttä, reipasta ja rasittavaa.">
        <select className={inputClass} value={typeKey} onChange={(ev) => setTypeKey(ev.target.value)}>
          {e && <option value="">Nykyinen ({shares && `${pct(shares.light)} / ${pct(shares.moderate)} / ${pct(shares.vigorous)}`})</option>}
          {types?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icon} {t.name} ({pct(t.shares.light)} / {pct(t.shares.moderate)} / {pct(t.shares.vigorous)})
            </option>
          ))}
        </select>
      </Field>
      {preview && (
        <p className="flex flex-wrap items-center gap-1 text-sm text-slate-700">
          <EstimateBadge /> Arkipäivänä kevyt {preview.light} · reipas {preview.moderate} · rasittava {preview.vigorous} min. Perusarvio ei tuota rasittavaa eikä vahvistavaa
          päivää.
        </p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Tallenna
        </Button>
        <Button variant="secondary" onClick={onDone}>
          Peruuta
        </Button>
        {e && (
          <button
            type="button"
            onClick={end}
            className={`min-h-11 rounded-xl px-3 text-sm font-medium ring-1 ${confirmEnd ? 'bg-red-700 text-white ring-red-700' : 'bg-[var(--surface-raised)] text-red-700 ring-red-200'}`}
          >
            {confirmEnd ? 'Vahvista' : 'Lopeta'}
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Kategorian vaihto koko historiaan (SPEC 16, 17.11.2026): esim. Muu-kategoriaan tehty päiväkotiarvio
 * siirretään Päiväkoti-kategoriaan. Päällekkäisestä kohdekategorian arviosta uudempi voittaa, ja
 * vahvistukset siirtyvät mukaan (saman päivän päällekkäinen vahvistus poistetaan).
 */
function CategoryChange({ estimate: e, profileId, onDone }: { estimate: Estimate; profileId: string; onDone: () => void }) {
  const today = todayFn();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Category | ''>('');
  const [error, setError] = useState<string>();
  const others = useLiveQuery(() => repo.listEstimates(profileId), [profileId]);
  const overlaps = (o: Estimate) => o.validFrom <= (e.validTo ?? '9999-12-31') && e.validFrom <= (o.validTo ?? today);
  const clash = target ? others?.find((o) => o.category === target && o.id !== e.id && overlaps(o)) : undefined;

  async function apply() {
    if (!target) return setError('Valitse kategoria');
    try {
      const r = await repo.changeEstimateCategory(e.id, target);
      const parts = [`Arvio siirretty: ${CATEGORY_LABEL[target]}`];
      if (r.moved) parts.push(`${r.moved} vahvistusta siirretty`);
      if (r.removed) parts.push(`${r.removed} päällekkäistä poistettu`);
      toast(parts.join(' · '));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!open) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-slate-700">
        <span>
          Kategoria: <strong>{CATEGORY_LABEL[e.category]}</strong>
        </span>
        <button type="button" className="min-h-11 font-medium text-green-800 underline underline-offset-2" onClick={() => setOpen(true)}>
          Vaihda kategoria (koko historia)
        </button>
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-xl bg-[var(--surface-sunk)] p-3 ring-1 ring-slate-200">
      <Field label={`Siirrä kategoriasta ${CATEGORY_LABEL[e.category]}`} hint="Koskee koko arviota alkamispäivästä lähtien, myös aiempia päiviä ja niiden vahvistuksia.">
        <select className={inputClass} value={target} onChange={(ev) => (setTarget(ev.target.value as Category), setError(undefined))}>
          <option value="">Valitse kategoria</option>
          {(Object.keys(CATEGORY_LABEL) as Category[])
            .filter((c) => c !== e.category)
            .map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
        </select>
      </Field>
      {clash && (
        <p className="text-xs leading-relaxed text-slate-700">
          Kategoriassa on jo arvio <strong>{clash.label}</strong> ({formatDate(clash.validFrom, 'd.M.yyyy')} alkaen). Arviot yhdistetään: uudempi on voimassa omasta
          alkamispäivästään, vanhempi päättyy sitä edeltävään päivään, eikä sama liikkuminen enää näy kahdesti. Saman päivän päällekkäiset vahvistukset poistetaan.
        </p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => void apply()}>
          Siirrä
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Peruuta
        </Button>
      </div>
    </div>
  );
}

/** Päiväkotipäivän tavoite (Liikkuva varhaiskasvatus) arvion rinnalla. */
function DaycareHint({ weekday, mvpa }: { weekday: number; mvpa?: number }) {
  const r = RECOMMENDATIONS.early_years;
  const ok = weekday >= r.daycareMinPerDay.value && (mvpa ?? 0) >= r.daycareMvpaMinPerDay.value;
  return (
    <p className={`rounded-xl px-3 py-2 text-xs leading-relaxed ring-1 ${ok ? 'bg-green-50 text-green-900 ring-green-200' : 'bg-[var(--surface-sunk)] text-slate-700 ring-slate-200'}`}>
      <strong>Päiväkodin tavoite:</strong> varhaiskasvatuspäivässä vähintään {r.daycareMinPerDay.value / 60} h liikkumista, josta {r.daycareMvpaMinPerDay.value} min reipasta ja rasittavaa
      (Liikkuva varhaiskasvatus) – kaksi kolmasosaa koko päivän 3 h / 1 h -suosituksesta.
      {mvpa !== undefined && ` Tällä arviolla ${weekday} min, josta reipasta ja rasittavaa ${mvpa} min${ok ? ', tavoite täyttyy' : ''}.`}
    </p>
  );
}

/**
 * Tupla päiväkoti (17.11.2026): ilmoitus ja yhden painalluksen korjaus, kun päiväkotiarvio on myös muussa
 * kategoriassa (myös päättynyt arvio) tai vanhoja päiväkotivahvistuksia on muussa kategoriassa.
 */
function DaycareDoubles({ profileId }: { profileId: string }) {
  const toast = useToast();
  const found = useLiveQuery(() => repo.daycareDoubles(profileId), [profileId]);
  const [busy, setBusy] = useState(false);
  if (!found || (found.estimates.length === 0 && found.sessions === 0)) return null;

  async function fix() {
    setBusy(true);
    try {
      const r = await repo.mergeDaycareDoubles(profileId);
      const parts = ['Päiväkoti yhdistetty'];
      if (r.estimates) parts.push(`${r.estimates} arviota siirretty`);
      if (r.moved) parts.push(`${r.moved} vahvistusta siirretty`);
      if (r.removed) parts.push(`${r.removed} päällekkäistä poistettu`);
      toast(parts.join(' · '), undefined, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const names = found.estimates.map((e) => `${e.label} (${CATEGORY_LABEL[e.category]}, ${formatDate(e.validFrom, 'd.M.yyyy')}–${e.validTo ? formatDate(e.validTo, 'd.M.yyyy') : ''})`);
  return (
    <div className="mb-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
      <p className="text-sm font-semibold text-amber-900">Päiväkoti näkyy osalla päivistä kahdesti</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-700">
        {names.length > 0 && <>Päiväkotiarvio on myös muussa kategoriassa: {names.join(', ')}. </>}
        {found.sessions > 0 && <>{found.sessions} vanhaa päiväkotivahvistusta on muussa kategoriassa. </>}
        Yhdistäminen siirtää ne Päiväkoti-kategoriaan koko historiaan: päällekkäisistä arvioista uudempi on voimassa omasta alkamispäivästään, ja saman päivän
        päällekkäiset vahvistukset poistetaan. Tavalliset kirjatut kerrat eivät muutu.
      </p>
      <Button className="mt-2" onClick={() => void fix()} disabled={busy}>
        {busy ? 'Yhdistetään…' : 'Yhdistä Päiväkotiin'}
      </Button>
    </div>
  );
}

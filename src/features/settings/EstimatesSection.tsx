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
import { ESTIMATE_DEFAULT_TYPE_KEY, ESTIMATE_SUGGESTIONS } from '../../seed/activityTypes';
import { Button, Card, EstimateBadge, Field, inputClass } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { formatDate } from '../../ui/format';
import { CATEGORY_LABEL, pct } from '../../ui/labels';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';

const minutesField = z.coerce.number().int().min(0, 'Vähintään 0').max(600, 'Enintään 600');

type Draft = { category: Category; label: string; existing?: Estimate };

export function EstimatesSection({ profile }: { profile: Profile }) {
  const today = todayFn();
  const active = useLiveQuery(() => repo.activeEstimates(profile.id, today), [profile.id, today]);
  const [draft, setDraft] = useState<Draft | null>(null);

  if (draft) {
    return (
      <Card title={draft.existing ? 'Muokkaa perusarviota' : 'Uusi perusarvio'}>
        <EstimateForm profile={profile} draft={draft} onDone={() => setDraft(null)} />
      </Card>
    );
  }

  const used = new Set(active?.map((e) => e.category));
  const suggestions = ESTIMATE_SUGGESTIONS.filter((s) => !used.has(s.category));
  const freeCategories = (Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => !used.has(c));

  return (
    <Card title={`Arkiliikunta (perusarviot) · ${profile.name}`}>
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
                ✎
              </span>
            </li>
          );
        })}
      </ul>
      {active?.length === 0 && <p className="mt-2 text-sm text-slate-500">Ei perusarvioita.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <Button key={s.category} variant="secondary" onClick={() => setDraft({ category: s.category, label: s.label })}>
            + {s.label}
          </Button>
        ))}
        {freeCategories.length > 0 && (
          <Button variant="ghost" onClick={() => setDraft({ category: freeCategories[0], label: '' })}>
            + Muu kategoria
          </Button>
        )}
      </div>
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
  const [weekday, setWeekday] = useState(e?.weekdayMin ?? 30);
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
          <input type="date" className={inputClass} value={validFrom} max={today} onChange={(ev) => setValidFrom(ev.target.value)} />
        </Field>
      )}
      <Slider label="Arkipäivä (ma–pe)" value={weekday} onChange={setWeekday} />
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

// Päivän arkiliikunta: perusarvio näytetään kategorioittain, ja vanhempi voi ottaa siihen kantaa
// päiväkohtaisesti – vahvistaa sen, muuttaa minuutteja tai merkitä, ettei sitä ollut. Valinta
// tallentuu tavallisena kirjauksena (saman kategorian laji), jolloin korvausperiaatteen mukaan
// perusarviota ei sille päivälle enää käytetä. Kumottavissa ilmoituksesta.

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { isWeekend } from '../../domain/dates';
import { activityTypeId } from '../../domain/ids';
import type { ActivityType, Category, Estimate, ISODate, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { ESTIMATE_DEFAULT_TYPE_KEY } from '../../seed/activityTypes';
import { Button, inputClass } from '../../ui/components';
import { dayLabel } from '../../ui/format';
import { CATEGORY_LABEL } from '../../ui/labels';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

/** Kirjauksen laji arkiliikunnalle: saman kategorian laji (ei jalkapallo, ettei lisätietopaneeli avaudu). */
function typeFor(category: Category, types: ActivityType[]): ActivityType | undefined {
  const preferred = types.find((t) => t.id === activityTypeId(ESTIMATE_DEFAULT_TYPE_KEY[category]));
  if (preferred && preferred.sport !== 'football' && !preferred.archived) return preferred;
  return types.find((t) => t.category === category && t.sport !== 'football' && !t.archived);
}

export function EstimateDaySheet({ date, profile, categories, onClose }: { date: ISODate | null; profile: Profile; categories: Category[]; onClose: () => void }) {
  const toast = useToast();
  const data = useLiveQuery(
    async () => (date ? { estimates: await repo.activeEstimates(profile.id, date), types: await repo.listActivityTypes() } : undefined),
    [profile.id, date],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const rows = (data?.estimates ?? []).filter((e) => categories.includes(e.category));
  const minutesOf = (e: Estimate) => (date && isWeekend(date) ? e.weekendMin : e.weekdayMin);

  useEffect(() => {
    if (!date || !data) return;
    setValues(Object.fromEntries(rows.map((e) => [e.category, String(minutesOf(e))])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, data]);

  if (!date) return null;

  async function save(e: Estimate, minutes: number) {
    const type = typeFor(e.category, data!.types);
    if (!type) return toast('Kategorialle ei löydy lajia – lisää laji asetuksissa');
    const s = await repo.createSession({
      profileId: profile.id,
      activityTypeId: type.id,
      date: date!,
      durationMin: minutes,
      effort: 0,
      muscle: false,
      bone: false,
      label: e.label,
      note: minutes === 0 ? 'Ei arkiliikuntaa tänä päivänä' : 'Arkiliikunta vahvistettu',
    });
    toast(minutes === 0 ? `${e.label}: ei tänä päivänä` : `${e.label}: ${minutes} min kirjattu`, { label: 'Kumoa', run: () => repo.deleteSession(s.id).then(() => {}) }, 'success');
  }

  return (
    <Sheet open onClose={onClose} title={`Arkiliikunta · ${dayLabel(date)}`}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Arkiliikunta on <strong>arvio</strong> tavallisesta liikkumisesta (esim. välitunnit, koulumatkat), jota ei kirjata joka päivä. Se lasketaan mukaan päiville, joilta saman kategorian kirjaus
          puuttuu. Voit vahvistaa arvion, muuttaa minuutteja tai merkitä, ettei sitä tänä päivänä ollut.
        </p>
        {data && rows.length === 0 && <p className="text-sm text-slate-500">Tälle päivälle ei enää käytetä arviota – kaikki kategoriat on kirjattu.</p>}
        <ul className="space-y-3">
          {rows.map((e) => {
            const est = minutesOf(e);
            const v = values[e.category] ?? String(est);
            const n = Number(v);
            const valid = v.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 600;
            return (
              <li key={e.id} className="card-sunk space-y-3 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">{e.label}</div>
                    <div className="text-xs text-slate-500">
                      {CATEGORY_LABEL[e.category]} · arvio {est} min ({date && isWeekend(date) ? 'viikonloppu' : 'arkipäivä'})
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">arvio</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <span className="sr-only">Toteutunut kesto minuutteina</span>
                    <input className={inputClass} inputMode="numeric" value={v} onChange={(ev) => setValues((c) => ({ ...c, [e.category]: ev.target.value }))} aria-label={`${e.label}: toteutunut kesto (min)`} />
                  </label>
                  <span className="text-sm text-slate-500">min</span>
                  <Button disabled={!valid} onClick={() => void save(e, n)}>
                    {n === est ? 'Vahvista' : 'Tallenna'}
                  </Button>
                </div>
                <button type="button" onClick={() => void save(e, 0)} className="press min-h-10 w-full rounded-xl bg-[var(--surface-raised)] text-sm font-semibold text-slate-700 shadow-xs ring-1 ring-slate-200 hover:bg-slate-100">
                  Ei tänä päivänä (0 min)
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-slate-500">
          Vahvistettu arkiliikunta näkyy päivällä kirjattuna kertana, ja sen voi muokata tai poistaa kuten muutkin kerrat. Perusarvion oletusminuutit muutetaan kohdassa Asetukset → Arkiliikunta.
        </p>
      </div>
    </Sheet>
  );
}

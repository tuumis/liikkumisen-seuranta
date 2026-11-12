// Päivän arkiliikunta: perusarvio näytetään kategorioittain, ja vanhempi voi ottaa siihen kantaa
// päiväkohtaisesti – vahvistaa sen, muuttaa minuutteja tai merkitä, ettei sitä ollut. Valinta
// tallentuu tavallisena kirjauksena (saman kategorian laji, merkintä estimateConfirmed), jolloin
// korvausperiaatteen mukaan perusarviota ei sille päivälle enää käytetä. Vahvistettu näkyy edelleen
// päivän arkiliikuntarivillä, ja sen voi muuttaa tai palauttaa arvioksi. Kumottavissa ilmoituksesta.

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { isWeekend } from '../../domain/dates';
import { isEstimateConfirmation } from '../../domain/hours';
import { activityTypeId } from '../../domain/ids';
import type { ActivityType, Category, Estimate, ISODate, Profile, Session } from '../../domain/types';
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

/**
 * Pikavahvistus (taulukon ✓): päivän avoimet arviot kirjataan sellaisinaan vahvistetuiksi.
 * Palauttaa luotujen kirjausten tunnisteet kumoamista varten.
 */
export async function confirmDayEstimates(profileId: string, date: ISODate, categories: Category[]): Promise<string[]> {
  const estimates = await repo.activeEstimates(profileId, date);
  const types = await repo.listActivityTypes({ includeArchived: true });
  const ids: string[] = [];
  for (const e of estimates) {
    if (!categories.includes(e.category)) continue;
    const minutes = isWeekend(date) ? e.weekendMin : e.weekdayMin;
    const type = typeFor(e.category, types);
    if (!minutes || !type) continue;
    const s = await repo.createSession({ profileId, activityTypeId: type.id, date, durationMin: minutes, effort: 0, muscle: false, bone: false, label: e.label, estimateConfirmed: true });
    ids.push(s.id);
  }
  return ids;
}

export function EstimateDaySheet({ date, profile, onClose }: { date: ISODate | null; profile: Profile; onClose: () => void }) {
  const toast = useToast();
  const data = useLiveQuery(
    async () =>
      date
        ? {
            estimates: await repo.activeEstimates(profile.id, date),
            types: await repo.listActivityTypes({ includeArchived: true }),
            sessions: await repo.sessionsInRange(profile.id, date, date),
          }
        : undefined,
    [profile.id, date],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const minutesOf = (e: Estimate) => (date && isWeekend(date) ? e.weekendMin : e.weekdayMin);
  const catOf = (s: Session): Category => data?.types.find((t) => t.id === s.activityTypeId)?.category ?? 'other';
  const rows = (data?.estimates ?? []).map((e) => {
    const same = (data?.sessions ?? []).filter((s) => catOf(s) === e.category);
    return { e, est: minutesOf(e), conf: same.find(isEstimateConfirmation), manual: same.filter((s) => !isEstimateConfirmation(s)) };
  });

  useEffect(() => {
    if (!date || !data) return;
    setValues(Object.fromEntries(rows.map((r) => [r.e.category, String(r.conf ? r.conf.durationMin : r.est)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, data]);

  if (!date) return null;

  async function save(e: Estimate, minutes: number, conf?: Session) {
    const label = (m: number) => (m === 0 ? `${e.label}: ei tänä päivänä` : `${e.label}: ${m} min`);
    if (conf) {
      const before = conf.durationMin;
      const input = { activityTypeId: conf.activityTypeId, date: date!, effort: 0 as const, muscle: false, bone: false, label: conf.label, note: conf.note };
      await repo.updateSession(conf.id, { ...input, durationMin: minutes });
      toast(`${label(minutes)} tallennettu`, { label: 'Kumoa', run: () => repo.updateSession(conf.id, { ...input, durationMin: before }).then(() => {}) }, 'success');
      return;
    }
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
      estimateConfirmed: true,
    });
    toast(`${label(minutes)} vahvistettu`, { label: 'Kumoa', run: () => repo.deleteSession(s.id).then(() => {}) }, 'success');
  }

  async function revert(e: Estimate, conf: Session) {
    const undo = await repo.deleteSession(conf.id);
    toast(`${e.label}: palautettu arvioksi`, { label: 'Kumoa', run: () => repo.undoDelete(undo) });
  }

  return (
    <Sheet open onClose={onClose} title={`Arkiliikunta · ${dayLabel(date)}`}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Arkiliikunta on <strong>arvio</strong> tavallisesta liikkumisesta (esim. välitunnit, koulumatkat), jota ei kirjata joka päivä. Voit vahvistaa arvion, muuttaa minuutteja tai merkitä, ettei sitä
          tänä päivänä ollut. Vahvistettu jää näkyviin päivän arkiliikuntariville.
        </p>
        {data && rows.length === 0 && <p className="text-sm text-slate-500">Tälle päivälle ei ole voimassa olevaa arkiliikunnan arviota.</p>}
        <ul className="space-y-3">
          {rows.map(({ e, est, conf, manual }) => {
            const v = values[e.category] ?? String(conf ? conf.durationMin : est);
            const n = Number(v);
            const valid = v.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 600;
            const status = conf ? (conf.durationMin > 0 ? 'vahvistettu' : 'ei tänä päivänä') : manual.length ? 'kirjattu' : 'arvio';
            return (
              <li key={e.id} className="card-sunk space-y-3 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">{e.label}</div>
                    <div className="text-xs text-slate-500">
                      {CATEGORY_LABEL[e.category]} · arvio {est} min ({isWeekend(date) ? 'viikonloppu' : 'arkipäivä'})
                      {conf && ` · merkitty ${conf.durationMin} min`}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${status === 'arvio' ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800'}`}>{status}</span>
                </div>
                {manual.length > 0 && !conf ? (
                  <p className="text-sm text-slate-600">
                    Kirjattu erikseen {manual.reduce((a, s) => a + s.durationMin, 0)} min, joten arviota ei tälle päivälle käytetä. Kirjausta muokataan päivän kerroista.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <label className="flex-1">
                        <span className="sr-only">Toteutunut kesto minuutteina</span>
                        <input className={inputClass} inputMode="numeric" value={v} onChange={(ev) => setValues((c) => ({ ...c, [e.category]: ev.target.value }))} aria-label={`${e.label}: toteutunut kesto (min)`} />
                      </label>
                      <span className="text-sm text-slate-500">min</span>
                      <Button disabled={!valid || (conf && n === conf.durationMin)} onClick={() => void save(e, n, conf)}>
                        {!conf && n === est ? 'Vahvista' : 'Tallenna'}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      {!(conf && conf.durationMin === 0) && (
                        <button
                          type="button"
                          onClick={() => void save(e, 0, conf)}
                          className="press min-h-10 flex-1 rounded-xl bg-[var(--surface-raised)] text-sm font-semibold text-slate-700 shadow-xs ring-1 ring-slate-200 hover:bg-slate-100"
                        >
                          Ei tänä päivänä (0 min)
                        </button>
                      )}
                      {conf && (
                        <button
                          type="button"
                          onClick={() => void revert(e, conf)}
                          className="press min-h-10 flex-1 rounded-xl bg-[var(--surface-raised)] text-sm font-semibold text-slate-700 shadow-xs ring-1 ring-slate-200 hover:bg-slate-100"
                        >
                          Palauta arvioksi
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-slate-500">Perusarvion oletusminuutit muutetaan kohdassa Asetukset → Arkiliikunta.</p>
      </div>
    </Sheet>
  );
}

// Yksittäisen suunnitelman toiminnot Viikko-näkymästä: kuittaus (kuten suunniteltu tai muulla
// kestolla), tämän kerran muutos (kesto, kellonaika) myös etukäteen, ohitus syineen.

import { useEffect, useState } from 'react';
import type { ActivityType, Fixture, PlannedSession, Session } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Field, inputClass } from '../../ui/components';
import { TimeField } from '../../ui/TimeField';
import { dayLabel } from '../../ui/format';
import { SKIP_REASON_LABEL } from '../../ui/labels';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { SkipReasons } from '../review/SkipReasons';
import { usePlanActions } from '../review/usePlanActions';
import { ConfirmForm } from '../review/ConfirmForm';
import { HOME_AWAY_LABEL, isClubTraining, LEVEL_LABEL } from '../../domain/football';
import { durationSchema } from './sessionForm';
import { useLiveQuery } from 'dexie-react-hooks';
import { newStopwatch } from '../../domain/stopwatch';
import { IconClock } from '../../ui/icons';

/** Kestovaihtoehdot kuittaukseen: suunniteltu ja sitä lyhyemmät/pidemmät yleiset kestot. */
function durationChoices(planned: number): number[] {
  const base = [15, 30, 45, 60, 75, 90, 120, 150, 180];
  return [...new Set([planned, ...base.filter((m) => m !== planned && m <= Math.max(planned * 1.5, 60))])].sort((a, b) => b - a).slice(0, 8);
}

/** Pelin, turnauksen tai harjoituspelin tiedot yhdellä rivillä (24.11.2026). */
function fixtureSummary(f: Fixture | undefined, typeId: string): string {
  if (!f) return '';
  const friendlyOpp = typeId === 't:football_friendly' ? f.games?.map((g) => g.opponent).filter(Boolean).join(', ') : '';
  const games = typeId === 't:football_tournament' ? (f.games?.length || f.gamesCount) : undefined;
  return [
    f.opponent ? `vs ${f.opponent}` : f.eventName || (friendlyOpp ? `vs ${friendlyOpp}` : undefined),
    f.homeAway ? HOME_AWAY_LABEL[f.homeAway].toLowerCase() : undefined,
    games ? `${games} ${games === 1 ? 'peli' : 'peliä'}` : undefined,
    f.level ? LEVEL_LABEL[f.level] : undefined,
    f.location,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function PlanSheet({
  plan,
  type,
  onClose,
  onOpenSession,
  onConfirmed,
  fixture,
  onEditFixture,
  skipMode = false,
}: {
  plan: PlannedSession | null;
  type?: ActivityType;
  onClose: () => void;
  onOpenSession: (s: Session) => void;
  onConfirmed?: (s: Session) => void;
  /** Pelin, turnauksen tai harjoituspelin lisätiedot (Viikko-näkymä, 24.11.2026). */
  fixture?: Fixture;
  /** Avaa tapahtuman muokkauksen (pelikalenterin paneeli). Annetaan vain peleille ja turnauksille. */
  onEditFixture?: (plan: PlannedSession) => void;
  /** "Ei tehty" -painike (27.11.2026): avautuu pelkkiin syihin; "Muut toiminnot" näyttää koko paneelin. */
  skipMode?: boolean;
}) {
  const toast = useToast();
  const actions = usePlanActions(onOpenSession, onConfirmed);
  const [custom, setCustom] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [skipOnly, setSkipOnly] = useState(skipMode);
  const stopwatch = useLiveQuery(async () => (plan ? ((await repo.listStopwatches()).find((x) => x.profileId === plan.profileId) ?? null) : null), [plan?.profileId]);

  useEffect(() => {
    setCustom('');
    setEditDuration(plan ? String(plan.durationMin) : '');
    setEditTime(plan?.startTime ?? '');
    setEditing(false);
    setDetails(false);
    setError(undefined);
    setConfirmDelete(false);
    setSkipOnly(skipMode);
  }, [plan, skipMode]);
  if (!plan) return null;
  const future = plan.date > todayFn();
  const run = (f: () => Promise<void>) => async () => {
    await f();
    onClose();
  };

  async function remove() {
    // Ei vahvistuskysymystä: poisto on kumottavissa ilmoituksen "Kumoa"-painikkeella (SPEC 16).
    try {
      const id = plan!.id;
      await repo.deletePlanned(id);
      onClose();
      toast(`Poistettu: ${type?.name ?? 'suunnitelma'} ${dayLabel(plan!.date)}`, { label: 'Kumoa', run: () => repo.restorePlanned(id) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveOccurrence() {
    const d = durationSchema.safeParse(editDuration);
    if (!d.success) return setError(d.error.issues[0].message);
    try {
      await repo.updatePlannedOccurrence(plan!.id, { durationMin: d.data, startTime: editTime || undefined });
      toast(`Suunnitelma muutettu: ${dayLabel(plan!.date)} ${d.data} min`, undefined, 'success');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const title = `${type?.icon ?? ''} ${plan.label ?? type?.name ?? 'Suunnitelma'}`.trim();
  if (skipOnly && plan.status === 'open')
    return (
      <Sheet open onClose={onClose} title={`${title} · ei tehty`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Suunniteltu {dayLabel(plan.date)}
            {plan.startTime && ` klo ${plan.startTime}`} · <strong>{plan.durationMin} min</strong>
          </p>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Miksi jäi väliin? (valinnainen)</div>
            <SkipReasons onPick={(r, note) => void run(() => actions.skip(plan, r, note))()} />
            <p className="mt-1.5 text-xs text-slate-500">
              Valinta kuittaa kerran ei tehdyksi. Merkintä jää näkyviin, ja sen voi palauttaa avoimeksi.
            </p>
          </div>
          <button type="button" className="press w-full rounded-xl px-1 py-2 text-left text-sm font-medium text-green-800" onClick={() => setSkipOnly(false)}>
            Muut toiminnot (kuittaus tehdyksi, muutos, poisto)
          </button>
        </div>
      </Sheet>
    );

  return (
    <Sheet open onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Suunniteltu {dayLabel(plan.date)}
          {plan.startTime && ` klo ${plan.startTime}`} · <strong>{plan.durationMin} min</strong>
          {plan.overridden && <span className="text-slate-500"> (muutettu tälle kerralle)</span>}
          {plan.status === 'skipped' && (
            <>
              <br />
              <strong>Ei tehty</strong>
              {plan.skipReason && ` – ${SKIP_REASON_LABEL[plan.skipReason].toLowerCase()}`}
            </>
          )}
        </p>
        {plan.status === 'skipped' && <SkipNoteField plan={plan} />}

        {onEditFixture && (plan.status !== 'done' || fixture) && (
          <div className="card-sunk flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1 text-sm">
              {fixture?.infoMissing && (
                <div className="font-semibold text-amber-800">Tietoja puuttuu{fixture.missingNote ? `: ${fixture.missingNote}` : ''}</div>
              )}
              <div className="text-slate-700">{fixtureSummary(fixture, plan.activityTypeId) || 'Ei lisätietoja'}</div>
            </div>
            {/* Pelattua tapahtumaa ei muokata kalenterista (tulos ja tiedot pelin kerrasta). */}
            {plan.status !== 'done' && (
              <Button variant="secondary" className="shrink-0" onClick={() => onEditFixture(plan)}>
                Muokkaa tapahtumaa
              </Button>
            )}
          </div>
        )}

        {/* Sekuntikello (vaihe 2): tämän päivän avoimen kerran todellinen aika; Lopeta kuittaa kerran. */}
        {plan.status === 'open' && plan.date === todayFn() && stopwatch !== undefined && (
          stopwatch?.plannedSessionId === plan.id ? (
            <p className="flex items-center gap-2.5 rounded-2xl bg-[var(--surface-sage)] p-3.5 text-sm text-slate-800">
              <IconClock size="1.15rem" className="shrink-0 text-green-800" />
              Kello on käynnissä tälle kerralle. Lopeta kello, niin kerta kuitataan kellotetulla ajalla.
            </p>
          ) : !stopwatch ? (
            <button
              type="button"
              onClick={async () => {
                await repo.saveStopwatch(newStopwatch(plan.profileId, plan.activityTypeId, new Date(), plan.id));
                onClose();
                toast(`Kello käynnistyi: ${plan.label ?? type?.name ?? 'kerta'}. Lopeta kuittaa kerran kellotetulla ajalla.`, undefined, 'success');
              }}
              className="press card-interactive card flex w-full items-center gap-3 rounded-[1.25rem] px-3.5 py-3 text-left"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-sage)] text-green-800" aria-hidden>
                <IconClock size="1.35rem" />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-sm font-semibold text-slate-900">Käynnistä kello</span>
                <span className="block text-xs text-slate-500">Kellota todellinen aika; Lopeta kuittaa kerran sillä kestolla</span>
              </span>
            </button>
          ) : null
        )}

        {!future && plan.status !== 'done' && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Tehty, kesto</div>
            <div className="grid grid-cols-4 gap-2">
              {durationChoices(plan.durationMin).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={run(() => actions.confirm(plan, m === plan.durationMin ? undefined : m))}
                  className={`press stat min-h-14 rounded-2xl text-xl font-semibold ${m === plan.durationMin ? 'bg-green-700 text-white shadow-[0_8px_18px_-8px_rgb(var(--accent-rgb)/0.7)]' : 'bg-[var(--surface-sunk)] text-slate-900 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-slate-100'}`}
                  aria-label={`Tehty ${m} min`}
                >
                  {m}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const d = durationSchema.safeParse(custom);
                if (!d.success) return setError(d.error.issues[0].message);
                void run(() => actions.confirm(plan, d.data))();
              }}
            >
              <input className={inputClass} inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="muu kesto (min)" aria-label="Toteutunut kesto minuutteina" />
              <Button type="submit" variant="secondary" className="shrink-0" disabled={!custom}>
                Kuittaa
              </Button>
            </form>
            <p className="text-xs text-slate-500">Vihreä = suunniteltu kesto. Suunnitelma säilyy ennallaan vertailua varten (esim. 120 suunniteltu → 60 toteutunut).</p>
            {/* Kuittaus lisätiedoilla (24.11.2026): teho, lihas/luusto ja treenin omatoiminen verryttely samalla. */}
            <div className="card-sunk p-3">
              {!details ? (
                <button type="button" className="w-full text-left text-sm font-medium text-green-800" onClick={() => setDetails(true)}>
                  Kuittaa tiedoilla (teho, lihas/luusto{isClubTraining(type) ? ', verryttely' : ''})
                </button>
              ) : (
                <ConfirmForm plan={plan} type={type} onConfirm={(d) => run(() => actions.confirm(plan, undefined, d))()} onCancel={() => setDetails(false)} />
              )}
            </div>
          </div>
        )}

        {plan.status === 'open' && !onEditFixture && (
          <div className="card-sunk p-3">
            {!editing ? (
              <button type="button" className="w-full text-left text-sm font-medium text-green-800" onClick={() => setEditing(true)}>
                Muuta tätä suunnitelmaa (kesto, kellonaika)
              </button>
            ) : (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveOccurrence();
                }}
              >
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Suunniteltu kesto (min)">
                    <input className={inputClass} inputMode="numeric" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} />
                  </Field>
                  <Field label="Kellonaika">
                    <TimeField label="Kellonaika" value={editTime} onChange={setEditTime} />
                  </Field>
                </div>
                <p className="text-xs text-slate-500">
                  Muutos koskee vain tätä kertaa{plan.templateItemId ? '; viikkorytmi ja muut viikot pysyvät ennallaan' : ''}.
                </p>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    Tallenna suunnitelma
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Peruuta
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-700">{error}</p>}

        {plan.status === 'open' ? (
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Ei tehty, syy (valinnainen)</div>
            <SkipReasons onPick={(r, note) => void run(() => actions.skip(plan, r, note))()} />
            {future && <p className="mt-1 text-xs text-slate-500">Tuleva kerta kuitataan tehdyksi sen päivänä tai myöhemmin; peruuntumisen voi merkitä jo nyt.</p>}
          </div>
        ) : (
          <Button variant="secondary" className="w-full" onClick={run(() => actions.reopen(plan))}>
            Palauta avoimeksi
          </Button>
        )}

        {plan.status !== 'done' && (
          <div className="border-t border-slate-200 pt-4">
            {confirmDelete && (
              <p className="mb-2 text-sm text-slate-700">
                Poistetaanko tämä kerta kokonaan? Se ei näy viikolla eikä suunnitelman toteutumassa{plan.templateItemId ? '. Viikkorytmi ja muut viikot pysyvät ennallaan' : ''}.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void remove()}
                className={`press min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold ${confirmDelete ? 'bg-red-700 text-white hover:bg-red-800' : 'bg-[var(--surface-raised)] text-red-700 shadow-xs ring-1 ring-red-200 hover:bg-red-50'}`}
              >
                {confirmDelete ? 'Vahvista poisto' : 'Poista kokonaan'}
              </button>
              {confirmDelete && (
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                  Peruuta
                </Button>
              )}
            </div>
            {!confirmDelete && <p className="mt-1.5 text-xs text-slate-500">Yleensä riittää "Ei tehty", jolloin merkintä jää näkyviin. Poista vain, jos kertaa ei pitänyt olla lainkaan.</p>}
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Väliin jääneen kerran kommentti (24.11.2026): lisättävissä ja muokattavissa jälkikäteen; tallentuu kentästä poistuttaessa. */
function SkipNoteField({ plan }: { plan: PlannedSession }) {
  const [note, setNote] = useState(plan.skipNote ?? '');
  useEffect(() => setNote(plan.skipNote ?? ''), [plan.id, plan.skipNote]);
  return (
    <Field label="Kommentti (valinnainen)">
      <input
        className={inputClass}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => void repo.setSkipNote(plan.id, note)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        maxLength={200}
        placeholder="esim. kipeä kurkku"
      />
    </Field>
  );
}

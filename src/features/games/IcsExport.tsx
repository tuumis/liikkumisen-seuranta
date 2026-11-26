// Vienti puhelimen tai tietokoneen kalenteriin (.ics, 19.11.2026): valitut kuukaudet tai kausi,
// valinnaisesti treenit ja koko perhe. Tiedosto muodostetaan laitteella ja ladataan tai jaetaan; sovellus
// ei tee verkkokutsuja eikä tilaa kalenteria, joten muutosten jälkeen tiedosto viedään uudelleen.

import { useState } from 'react';
import { buildIcs } from '../../domain/ics';
import { eventsBetween, firstOfMonth, isSubdued, lastOfMonth, type CalEvent, type MonthKey } from '../../domain/monthCalendar';
import type { ISODate, Profile } from '../../domain/types';
import { Button } from '../../ui/components';
import { ToggleChip } from '../../ui/controls';
import { Sheet } from '../../ui/Sheet';
import { readStoredJson, writeStoredJson } from '../../ui/storedPref';
import { useToast } from '../../ui/Toast';
import { downloadText, shareOrDownload } from '../sync/fileIO';
import { useFootballProfiles } from '../football/useFootballEnabled';
import { memberLabeler, PeriodPicker, periodLabel, periodMonths, type Span } from './calendarShared';
import { useCalendarEvents } from './useCalendarEvents';

interface IcsOpts {
  span: Span;
  count: number;
  trainings: boolean;
  /** Kalenterimerkinnät (27.11.2026), oletuksena pois. */
  notes: boolean;
  results: boolean;
  family: boolean;
  childName: boolean;
}

const DEFAULT: IcsOpts = { span: 'months', count: 3, trainings: false, notes: false, results: true, family: false, childName: false };
const KEY = 'calendarIcs';
const clean = (v: Partial<IcsOpts>): IcsOpts => ({
  span: v.span === 'spring' || v.span === 'autumn' ? v.span : 'months',
  count: Math.max(1, Math.min(12, Math.round(Number(v.count) || 3))),
  trainings: !!v.trainings,
  notes: !!v.notes,
  results: v.results !== false,
  family: !!v.family,
  childName: !!v.childName,
});

export function IcsExport({ profile, today, startMonth, open, onClose }: { profile: Profile; today: ISODate; startMonth: MonthKey; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Vie kalenteriin">
      {open && <IcsExportBody profile={profile} today={today} startMonth={startMonth} onDone={onClose} />}
    </Sheet>
  );
}

function IcsExportBody({ profile, today, startMonth, onDone }: { profile: Profile; today: ISODate; startMonth: MonthKey; onDone: () => void }) {
  const toast = useToast();
  const [opts, setOpts] = useState<IcsOpts>(() => readStoredJson(KEY, DEFAULT, clean));
  const set = (patch: Partial<IcsOpts>) =>
    setOpts((o) => {
      const next = clean({ ...o, ...patch });
      writeStoredJson(KEY, next);
      return next;
    });
  const [start, setStart] = useState<MonthKey>(startMonth);
  const [year, setYear] = useState(Number(startMonth.slice(0, 4)));
  const familyProfiles = useFootballProfiles();
  const canFamily = (familyProfiles?.length ?? 0) > 1;
  const family = opts.family && canFamily;
  const members = family ? familyProfiles! : [profile];
  const months = periodMonths(opts.span, start, opts.count, year);
  const from = firstOfMonth(months[0]);
  const to = lastOfMonth(months[months.length - 1]);
  const data = useCalendarEvents(
    members.map((p) => p.id),
    from,
    to,
    today,
    opts.trainings,
    opts.notes,
  );
  const ready = !!data && data.from === from && data.to === to;
  const events: CalEvent[] = ready ? eventsBetween(data.events, from, to, opts.trainings) : [];
  const games = events.filter((e) => !isSubdued(e)).length;
  const noteCount = events.filter((e) => e.kind === 'note').length;
  const labels = memberLabeler(members, data?.teams ?? new Map(), opts.childName);
  const ownTeams = [...(data?.teams.values() ?? [])].filter((t) => t.profileId === profile.id && !t.archived && t.kind !== 'group');
  const calName = family ? 'Perheen pelit' : ownTeams.length === 1 ? ownTeams[0].name : 'Pelikalenteri';

  const file = () => {
    const text = buildIcs(events, {
      calName,
      now: new Date().toISOString(),
      results: opts.results,
      // Perheessä lapsi tai joukkue nimen alkuun; yhden lapsen kalenterissa nimi vain valittaessa.
      prefix: family ? labels.event : opts.childName ? () => profile.name : undefined,
    });
    const name = `pelikalenteri-${months[0]}${months.length > 1 ? `_${months[months.length - 1]}` : ''}.ics`;
    return { name, text };
  };
  const download = () => {
    const f = file();
    downloadText(f.name, f.text, 'text/calendar');
    toast(`Kalenteritiedosto ladattu (${events.length} tapahtumaa)`, undefined, 'success');
    onDone();
  };
  const share = async () => {
    const f = file();
    const r = await shareOrDownload(f.name, f.text, 'text/calendar');
    if (r !== 'cancelled') onDone();
  };
  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-600">Valitse jakso ja tiedot. Tiedosto avautuu puhelimen tai tietokoneen kalenterissa, ja sieltä tapahtumat voi lisätä omaan kalenteriin.</p>
      <PeriodPicker
        today={today}
        span={opts.span}
        onSpan={(span) => set({ span })}
        start={start}
        onStart={setStart}
        count={opts.count}
        onCount={(count) => set({ count })}
        maxCount={12}
        year={year}
        onYear={setYear}
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kalenterin tiedot">
        <ToggleChip on={opts.results} onChange={(results) => set({ results })}>
          Tulokset
        </ToggleChip>
        <ToggleChip on={opts.trainings} onChange={(trainings) => set({ trainings })}>
          Treenit
        </ToggleChip>
        <ToggleChip on={opts.notes} onChange={(notes) => set({ notes })}>
          Muut merkinnät
        </ToggleChip>
        {canFamily && (
          <ToggleChip on={opts.family} onChange={(f) => set({ family: f })}>
            Koko perhe
          </ToggleChip>
        )}
        <ToggleChip on={opts.childName} onChange={(childName) => set({ childName })}>
          {family ? 'Lasten nimet' : 'Lapsen nimi'}
        </ToggleChip>
      </div>
      <div className="rounded-xl bg-[var(--surface-sunk)] px-3 py-2 text-slate-700" aria-live="polite">
        {!ready ? (
          'Lasketaan…'
        ) : (
          <>
            <span className="font-semibold">{periodLabel(opts.span, months)}:</span> {games} {games === 1 ? 'peli tai turnaus' : 'peliä ja turnausta'}
            {opts.trainings && `, ${events.length - games - noteCount} treeniä`}
            {opts.notes && `, ${noteCount} ${noteCount === 1 ? 'muu merkintä' : 'muuta merkintää'}`}
          </>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Kalenteri ei päivity itsestään. Jos pelit muuttuvat, vie tiedosto uudelleen: samat tapahtumat korvautuvat esimerkiksi Applen ja Outlookin kalenterissa, mutta osa
        kalentereista lisää ne uudelleen, jolloin vanhat kannattaa poistaa ensin. {family && !opts.childName && 'Tapahtumien alussa on lapsen joukkue; nimet vain valittaessa.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1" disabled={!ready || events.length === 0} onClick={download}>
          Lataa kalenteritiedosto (.ics)
        </Button>
        {canShare && (
          <Button variant="secondary" disabled={!ready || events.length === 0} onClick={share}>
            Jaa…
          </Button>
        )}
      </div>
    </div>
  );
}

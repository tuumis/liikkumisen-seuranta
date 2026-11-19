// Treenin joukkue (käyttäjän pyyntö 19.11.2026): pelaaja voi treenata useammassa omassa joukkueessa.
// Valinta viikkorytmiin, yksittäiseen suunnitelmaan ja kirjatun treenin lisätietoihin, sekä aiempien
// treenien merkitseminen kerralla Joukkueet-näkymässä.

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ISODate, Profile, Team, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { displayTeamName } from '../../domain/opponent';
import { Button, Field, inputClass } from '../../ui/components';
import { DateInput } from '../../ui/DateInput';
import { formatDate } from '../../ui/format';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';

const ADD_HINT = 'Joukkueen tai treeniryhmän (esim. pienryhmävalmennus, taitokoulu) lisäät kohdassa Jalkapallo → Joukkueet.';

/**
 * Joukkueen valinta seuran treenille. Viikkorytmissä ja suunnitelmassa kohta näkyy aina (käyttäjän palaute
 * 19.11.2026: valintaa ei löytänyt): ilman joukkueita ohje, yhdellä joukkueella tai ryhmällä tieto automaattisesta
 * valinnasta, useammalla valinta. Lisätiedoissa (`inPanel`) valinta näkyy, kun joukkueita on vähintään yksi.
 */
export function TrainingTeamField({ profileId, value, onChange, inPanel = false, hint }: { profileId: UUID; value: string; onChange: (id: string) => void; inPanel?: boolean; hint?: string }) {
  const teams = useLiveQuery(() => repo.listTeams(profileId, { includeArchived: true, groups: true }), [profileId]);
  if (!teams) return null;
  const active = teams.filter((t) => !t.archived);
  const current = teams.find((t) => t.id === value);
  const anyGroup = teams.some((t) => t.kind === 'group');
  const label = anyGroup ? 'Joukkue tai ryhmä' : 'Joukkue';
  if (!current && active.length === 0) {
    if (inPanel) return null;
    return (
      <Field label={label}>
        <span className="block rounded-xl bg-[var(--surface-sunk)] px-3.5 py-2.5 text-sm text-slate-600 ring-1 ring-inset ring-[var(--line)]">Ei vielä joukkueita. {ADD_HINT}</span>
      </Field>
    );
  }
  if (!current && active.length === 1 && !inPanel) {
    return (
      <Field label={label} hint={`Ainoa ${active[0]!.kind === 'group' ? 'ryhmä' : 'joukkue'} valitaan treeneille automaattisesti. Jos treenaat myös muualla, lisää joukkue tai treeniryhmä (esim. pienryhmävalmennus, taitokoulu) kohdassa Jalkapallo → Joukkueet; sen jälkeen voit valita tässä.`}>
        <span className="flex min-h-11 items-center rounded-xl bg-[var(--surface-sunk)] px-3.5 text-base text-slate-900 ring-1 ring-inset ring-[var(--line)]">{displayTeamName(active[0]!.name)}</span>
      </Field>
    );
  }
  const options: Team[] = current?.archived ? [...active, current] : active;
  const squads = options.filter((t) => t.kind !== 'group');
  const groups = options.filter((t) => t.kind === 'group');
  const option = (t: Team) => (
    <option key={t.id} value={t.id}>
      {displayTeamName(t.name)}
      {t.archived ? ' (arkistoitu)' : ''}
    </option>
  );
  return (
    <Field label={label} hint={hint ?? (inPanel ? undefined : ADD_HINT)}>
      <select className={inputClass} value={current ? value : ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{anyGroup ? '– ei joukkuetta tai ryhmää –' : '– ei joukkuetta –'}</option>
        {groups.length && squads.length ? (
          <>
            <optgroup label="Joukkueet">{squads.map(option)}</optgroup>
            <optgroup label="Treeniryhmät">{groups.map(option)}</optgroup>
          </>
        ) : (
          options.map(option)
        )}
      </select>
    </Field>
  );
}

/** Treenien valinnoissa (joukkue tai treeniryhmä). */
const teamsAndGroups = (profileId: UUID) => repo.listTeams(profileId, { groups: true });

/** Joukkueet-näkymän rivi: aiemmat treenit ilman joukkuetta ja painike niiden merkitsemiseen. */
export function UnassignedTrainings({ profile }: { profile: Profile }) {
  const rows = useLiveQuery(() => repo.trainingsWithoutTeam(profile.id), [profile.id]);
  const teams = useLiveQuery(() => teamsAndGroups(profile.id), [profile.id]);
  const [open, setOpen] = useState(false);
  if (!rows?.length || !teams?.length) return null;
  const anyGroup = teams.some((t) => t.kind === 'group');
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-2xl sm:flex-row sm:items-center sm:justify-between bg-[var(--surface-sunk)] p-3 ring-1 ring-inset ring-[var(--line)]">
      <p className="min-w-0 flex-1 text-sm text-slate-700">
        <strong className="font-semibold text-slate-900">{rows.length}</strong> treenillä ei ole {anyGroup ? 'joukkuetta tai ryhmää' : 'joukkuetta'}.
        <span className="block text-xs text-slate-500">Merkitse ne {anyGroup ? 'joukkueelle tai ryhmälle' : 'joukkueelle'}, niin ne näkyvät sen tiedoissa.</span>
      </p>
      <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        Merkitse aiemmat treenit
      </Button>
      <AssignTrainingsSheet profile={profile} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function AssignTrainingsSheet({ profile, open, onClose }: { profile: Profile; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const today = todayFn();
  const teams = useLiveQuery(() => teamsAndGroups(profile.id), [profile.id]);
  const all = useLiveQuery(() => repo.trainingsWithoutTeam(profile.id), [profile.id]);
  const anyGroup = !!teams?.some((t) => t.kind === 'group');
  const [teamId, setTeamId] = useState('');
  const [from, setFrom] = useState<ISODate | ''>('');
  const [to, setTo] = useState<ISODate>(today);
  const [saving, setSaving] = useState(false);
  const earliest = all?.length ? all[all.length - 1]!.date : undefined;

  // Avattaessa: koko aikaväli ja ainoa joukkue valmiiksi valittuna.
  useEffect(() => {
    if (!open) return;
    setTeamId(teams?.length === 1 ? teams[0]!.id : '');
    setFrom(earliest ?? today);
    setTo(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (open && !from && earliest) setFrom(earliest);
  }, [open, from, earliest]);

  const inRange = (all ?? []).filter((s) => (!from || s.date >= from) && s.date <= to);
  const n = inRange.length;

  async function save() {
    if (!teamId || !n) return;
    setSaving(true);
    try {
      const ids = await repo.assignTrainingsTeam(profile.id, teamId, from || undefined, to);
      const name = displayTeamName(teams?.find((t) => t.id === teamId)?.name ?? '');
      toast(`${ids.length} treeniä merkitty: ${name}`, { label: 'Kumoa', run: () => repo.clearTrainingsTeam(ids) }, 'success');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Merkitse aiemmat treenit">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Valitse {anyGroup ? 'joukkue tai ryhmä' : 'joukkue'} ja aikaväli. Merkintä koskee vain treenejä, joilta se puuttuu; jo merkityt treenit eivät muutu.
        </p>
        <Field label={anyGroup ? 'Joukkue tai ryhmä' : 'Joukkue'}>
          <select className={inputClass} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">{anyGroup ? 'Valitse joukkue tai ryhmä' : 'Valitse joukkue'}</option>
            {teams?.map((t) => (
              <option key={t.id} value={t.id}>
                {displayTeamName(t.name)}
                {t.kind === 'group' ? ' (treeniryhmä)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Alkaen">
            <DateInput className={inputClass} value={from} max={to} onChange={setFrom} aria-label="Alkaen" />
          </Field>
          <Field label="Päättyen">
            <DateInput className={inputClass} value={to} min={from || undefined} max={today} onChange={setTo} aria-label="Päättyen" />
          </Field>
        </div>
        <p className="text-sm text-slate-700" aria-live="polite">
          {n > 0 ? (
            <>
              Merkitään <strong>{n}</strong> treeniä
              {inRange.length > 0 && ` (${formatDate(inRange[inRange.length - 1]!.date, 'd.M.yyyy')}–${formatDate(inRange[0]!.date, 'd.M.yyyy')})`}.
            </>
          ) : (
            'Aikavälillä ei ole treenejä ilman joukkuetta.'
          )}
        </p>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!teamId || !n || saving} onClick={() => void save()}>
            {n > 0 ? `Merkitse ${n} treeniä` : 'Merkitse'}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Peruuta
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

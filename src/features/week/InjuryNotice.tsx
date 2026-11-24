// Kuluvan viikon ilmoitus loukkaantumisjaksosta (24.11.2026): arvioitu paluu sekä Palasi jo ja Muuta paluupäivää.

import { useLiveQuery } from 'dexie-react-hooks';
import { diffDays } from '../../domain/dates';
import type { InjuryRun } from '../../domain/injury';
import type { ISODate, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Card } from '../../ui/components';
import { dayLabel } from '../../ui/format';
import { useToast } from '../../ui/Toast';
import { returnText } from './InjurySheet';

export function InjuryNotice({ profile, today, onEdit }: { profile: Profile; today: ISODate; onEdit: () => void }) {
  const toast = useToast();
  const run = useLiveQuery(() => repo.injuryAt(profile.id, today), [profile.id, today]);
  if (!run) return null;
  const left = diffDays(today, run.returnDate);

  async function back() {
    if (!run) return;
    // Tänään on taas tavallinen päivä: jakso päättyy eiliseen (tai poistuu, jos se alkoi tänään).
    const next: InjuryRun | null = today > run.start ? { start: run.start, returnDate: today } : null;
    await repo.setInjury(profile.id, next, run);
    toast(`${profile.name}: palasi tänään`, { label: 'Kumoa', run: () => repo.setInjury(profile.id, run, next) });
  }

  return (
    <Card eyebrow="Loukkaantunut" title={`Arvioitu paluu ${dayLabel(run.returnDate).toLowerCase()}`}>
      <p className="text-sm text-slate-600">
        {dayLabel(run.start)} alkaen · {left === 1 ? 'paluuseen 1 päivä' : `paluuseen ${left} päivää`}. Jakson päivät eivät ole mukana suositusvertailussa, ja suunnitellut
        treenit ja pelit on merkitty poissaoloksi.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={back}>Palasi jo</Button>
        <Button variant="secondary" onClick={onEdit} aria-label={`Muuta paluupäivää (${returnText(run)})`}>
          Muuta paluupäivää
        </Button>
      </div>
    </Card>
  );
}

// Päivän toiminnot (pitkä painallus): lisää kerta, sairaus- ja matkapäivät (SPEC 12).

import type { DayFlag, DayFlagReason, ISODate, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button } from '../../ui/components';
import { dayLabel } from '../../ui/format';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';

export const FLAG_LABEL: Record<DayFlagReason, string> = {
  sick: 'Sairas',
  travel: 'Matkapäivä',
  other: 'Ei seurantaa',
};

const FLAG_ACTION: Record<DayFlagReason, string> = {
  sick: 'Merkitse sairaaksi',
  travel: 'Merkitse matkapäiväksi',
  other: 'Merkitse muuksi poissaoloksi',
};

export function DaySheet({
  date,
  flag,
  profile,
  onClose,
  onAdd,
}: {
  date: ISODate | null;
  flag?: DayFlag;
  profile: Profile;
  onClose: () => void;
  onAdd: (date: ISODate) => void;
}) {
  const toast = useToast();
  const today = todayFn();

  async function setFlag(reason: DayFlagReason) {
    if (!date) return;
    const prev = flag?.reason;
    await repo.setDayFlag(profile.id, date, reason);
    onClose();
    toast(`${dayLabel(date)}: ${FLAG_LABEL[reason].toLowerCase()}`, {
      label: 'Kumoa',
      run: () => (prev ? repo.setDayFlag(profile.id, date, prev) : repo.clearDayFlag(profile.id, date)),
    });
  }

  async function clear() {
    if (!date || !flag) return;
    const prev = flag.reason;
    await repo.clearDayFlag(profile.id, date);
    onClose();
    toast(`${dayLabel(date)}: merkintä poistettu`, { label: 'Kumoa', run: () => repo.setDayFlag(profile.id, date, prev) });
  }

  return (
    <Sheet open={!!date} onClose={onClose} title={date ? `${dayLabel(date)} · ${profile.name}` : ''}>
      {date && (
        <div className="space-y-2">
          {date <= today && (
            <Button className="w-full" onClick={() => onAdd(date)}>
              + Lisää kerta tälle päivälle
            </Button>
          )}
          {(Object.keys(FLAG_ACTION) as DayFlagReason[])
            .filter((r) => r !== flag?.reason)
            .map((r) => (
              <Button key={r} variant="secondary" className="w-full" onClick={() => setFlag(r)}>
                {FLAG_ACTION[r]}
              </Button>
            ))}
          {flag && (
            <Button variant="secondary" className="w-full" onClick={clear}>
              Poista merkintä ({FLAG_LABEL[flag.reason].toLowerCase()})
            </Button>
          )}
          <p className="pt-1 text-xs text-slate-500">
            Merkittyä päivää ei lasketa mukaan suositusvertailuun. Päivän kirjaukset säilyvät.
          </p>
        </div>
      )}
    </Sheet>
  );
}

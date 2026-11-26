// Kalenterimerkintä (27.11.2026): arjen muu tapahtuma (nimi, päivä, valinnainen aika, profiili tai koko perhe).
// Ei vaikuta liikuntamääriin. Uusi merkintä avautuu lisäysvalikoista, olemassa oleva päivän rivistä.

import { useState } from 'react';
import type { CalendarNote, ISODate, Profile } from '../../domain/types';
import { NOTE_TITLE_MAX, noteError } from '../../domain/calendarNotes';
import { repo } from '../../db/repositories';
import { Button, Field, inputClass } from '../../ui/components';
import { ToggleChip } from '../../ui/controls';
import { DateInput } from '../../ui/DateInput';
import { dayLabel } from '../../ui/format';
import { Sheet } from '../../ui/Sheet';
import { TimeField } from '../../ui/TimeField';
import { useToast } from '../../ui/Toast';

export type NoteDraft = { date: ISODate; note?: undefined } | { note: CalendarNote; date?: undefined };

export function CalendarNoteSheet({ profile, draft, onClose }: { profile: Profile; draft: NoteDraft | null; onClose: () => void }) {
  return (
    <Sheet open={!!draft} onClose={onClose} title={draft?.note ? 'Kalenterimerkintä' : 'Uusi kalenterimerkintä'}>
      {draft && <NoteForm key={draft.note?.id ?? draft.date} profile={profile} draft={draft} onClose={onClose} />}
    </Sheet>
  );
}

function NoteForm({ profile, draft, onClose }: { profile: Profile; draft: NoteDraft; onClose: () => void }) {
  const toast = useToast();
  const note = draft.note;
  const [title, setTitle] = useState(note?.title ?? '');
  const [date, setDate] = useState<ISODate>(note?.date ?? draft.date!);
  const [start, setStart] = useState(note?.startTime ?? '');
  const [end, setEnd] = useState(note?.endTime ?? '');
  // Uusi merkintä valitulle profiilille; koko perheen merkintä näkyy kaikilla profiileilla.
  const [family, setFamily] = useState(note ? !note.profileId : false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function save() {
    const input = { profileId: family ? undefined : profile.id, date, title, startTime: start || undefined, endTime: start && end ? end : undefined };
    const err = noteError(input);
    if (err) return setError(err);
    setSaving(true);
    try {
      await repo.saveCalendarNote(input, note?.id);
      toast(note ? 'Merkintä tallennettu' : `Merkintä lisätty: ${dayLabel(date)}`, undefined, 'success');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const id = note!.id;
    await repo.deleteCalendarNote(id);
    onClose();
    toast(`Poistettu: ${note!.title}`, { label: 'Kumoa', run: () => repo.restoreCalendarNote(id) });
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="text-sm text-slate-600">Arjen muu tapahtuma kalenteriin, esim. lääkäri tai kyläily. Se ei vaikuta liikuntamääriin.</p>
      <Field label="Mikä">
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={NOTE_TITLE_MAX}
          placeholder="esim. Hammaslääkäri"
          autoComplete="off"
          autoFocus={!note}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Päivä">
          <DateInput className={inputClass} value={date} onChange={setDate} aria-label="Merkinnän päivä" />
        </Field>
        <Field label="Alkaa (valinnainen)">
          <TimeField label="Alkaa" value={start} onChange={setStart} />
        </Field>
      </div>
      {start && (
        <Field label="Päättyy (valinnainen)">
          <TimeField label="Päättyy" value={end} onChange={setEnd} />
        </Field>
      )}
      <div>
        <div className="mb-1.5 text-[13px] font-semibold text-slate-700">Kenelle</div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kenelle">
          <ToggleChip on={!family} onChange={() => setFamily(false)}>
            {profile.name}
          </ToggleChip>
          <ToggleChip on={family} onChange={() => setFamily(true)}>
            Koko perhe
          </ToggleChip>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">Koko perheen merkintä näkyy kaikilla profiileilla.</p>
      </div>
      {error && (
        <p className="text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={saving}>
          {note ? 'Tallenna' : 'Lisää merkintä'}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Peruuta
        </Button>
      </div>
      {note && (
        <button
          type="button"
          onClick={() => void remove()}
          className="press min-h-11 w-full rounded-xl bg-[var(--surface-raised)] px-4 text-sm font-semibold text-red-700 shadow-xs ring-1 ring-red-200 hover:bg-red-50"
        >
          Poista merkintä
        </button>
      )}
    </form>
  );
}

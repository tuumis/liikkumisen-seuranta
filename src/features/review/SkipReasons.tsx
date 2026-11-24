import { useState } from 'react';
import type { SkipReason } from '../../domain/types';
import { inputClass } from '../../ui/components';
import { SKIP_REASON_LABEL } from '../../ui/labels';

/**
 * Ohituksen syyn valinta; "Ilman syytä" ohittaa valinnaisen syyn. "Loma" tulee lomajaksoista, ei valita käsin.
 * Vapaa kommentti (24.11.2026, käyttäjän toive): kirjoitetaan ennen syyn valintaa ja tallentuu sen mukana.
 */
export function SkipReasons({ onPick, onCancel }: { onPick: (r?: SkipReason, note?: string) => void; onCancel?: () => void }) {
  const [note, setNote] = useState('');
  const pick = (r?: SkipReason) => onPick(r, note.trim() || undefined);
  return (
    <div className="space-y-2">
    <input
      className={inputClass}
      value={note}
      onChange={(e) => setNote(e.target.value)}
      maxLength={200}
      placeholder="Kommentti (valinnainen), esim. kipeä kurkku"
      aria-label="Kommentti: miksi kerta jäi väliin"
    />
    <div className="flex flex-wrap gap-2">
      {(Object.keys(SKIP_REASON_LABEL) as SkipReason[]).filter((r) => r !== 'holiday').map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => pick(r)}
          className="press min-h-10 rounded-full bg-[var(--surface-sunk)] px-3.5 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
        >
          {SKIP_REASON_LABEL[r]}
        </button>
      ))}
      <button
        type="button"
        onClick={() => pick(undefined)}
        className="min-h-10 rounded-full bg-slate-100 px-3 text-sm font-medium text-slate-700 active:bg-slate-200"
      >
        Ilman syytä
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="min-h-10 px-2 text-sm text-slate-500">
          Peruuta
        </button>
      )}
    </div>
    </div>
  );
}

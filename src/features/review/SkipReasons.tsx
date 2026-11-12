import type { SkipReason } from '../../domain/types';
import { SKIP_REASON_LABEL } from '../../ui/labels';

/** Ohituksen syyn valinta; "Ilman syytä" ohittaa valinnaisen syyn. */
export function SkipReasons({ onPick, onCancel }: { onPick: (r?: SkipReason) => void; onCancel?: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(SKIP_REASON_LABEL) as SkipReason[]).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onPick(r)}
          className="press min-h-10 rounded-full bg-[var(--surface-sunk)] px-3.5 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
        >
          {SKIP_REASON_LABEL[r]}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPick(undefined)}
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
  );
}

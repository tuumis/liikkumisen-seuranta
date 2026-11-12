// Näkymän muokkaus (Viikko, Analyysi): korttien näkyvyys, järjestys ja PC:llä palsta.

import type { CardLayoutApi } from './cardLayout';
import { Button } from './components';
import { Sheet } from './Sheet';

const Arrow = ({ up }: { up?: boolean }) => (
  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
    <path d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
  </svg>
);

export function EditLayoutSheet<Id extends string>({
  open,
  onClose,
  title,
  intro,
  api,
  columns = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro: string;
  api: CardLayoutApi<Id>;
  /** Näytä PC:llä valinta pää- tai sivupalstasta. */
  columns?: boolean;
}) {
  const { cards, layout, toggle, move, setSide, reset } = api;
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="mb-3 text-sm text-slate-600">{intro}</p>
      <ul className="space-y-2">
        {layout.order.map((id, i) => {
          const c = cards.find((x) => x.id === id)!;
          const on = c.locked || !layout.hidden.includes(id);
          const side = layout.side.includes(id);
          return (
            <li key={id} className={`flex flex-wrap items-center gap-2 rounded-2xl p-2 pl-3 ${on ? 'card' : 'card-sunk opacity-70'}`}>
              <label className={`flex min-w-0 flex-1 items-center gap-3 ${c.locked ? '' : 'cursor-pointer'}`}>
                <input type="checkbox" className="size-5 shrink-0 accent-green-700 disabled:opacity-50" checked={on} disabled={c.locked} onChange={() => toggle(id)} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{c.title}</span>
                  <span className="block text-xs leading-snug text-slate-500">
                    {c.text}
                    {c.locked && ' · aina näkyvissä'}
                  </span>
                </span>
              </label>
              <div className="flex shrink-0 items-center gap-1">
                {columns && (
                  <div className="mr-1 hidden rounded-xl bg-[var(--surface-sunk)] p-0.5 text-[11px] font-semibold lg:flex" role="group" aria-label={`Palsta: ${c.title}`}>
                    {[false, true].map((s) => (
                      <button
                        key={String(s)}
                        type="button"
                        onClick={() => setSide(id, s)}
                        aria-pressed={side === s}
                        className={`press rounded-[0.6rem] px-2 py-1.5 ${side === s ? 'bg-[var(--surface-raised)] text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        {s ? 'Sivu' : 'Pää'}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" disabled={i === 0} onClick={() => move(id, -1)} className="press flex size-9 items-center justify-center rounded-xl bg-[var(--surface-sunk)] text-slate-600 disabled:opacity-30" aria-label={`Siirrä ylös: ${c.title}`}>
                  <Arrow up />
                </button>
                <button
                  type="button"
                  disabled={i === layout.order.length - 1}
                  onClick={() => move(id, 1)}
                  className="press flex size-9 items-center justify-center rounded-xl bg-[var(--surface-sunk)] text-slate-600 disabled:opacity-30"
                  aria-label={`Siirrä alas: ${c.title}`}
                >
                  <Arrow />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={onClose}>
          Valmis
        </Button>
        <Button variant="secondary" onClick={reset}>
          Palauta oletus
        </Button>
      </div>
    </Sheet>
  );
}

// Päivänauha (19.11.2026, käyttäjän toive: "mobiililla joutuu scrollaamaan että löytää päivän jossa mennään").
// Puhelimella ja tabletilla viikon valitsimen tilalla: viikon vaihto nuolilla ja viikon seitsemän päivää.
// Valitun päivän kortti näkyy heti nauhan alla (WeekView), joten päivä löytyy ilman vieritystä.

import type { ISODate } from '../../domain/types';
import { formatDate } from '../../ui/format';
import { IconCheck, IconChevronLeft, IconChevronRight } from '../../ui/icons';

/** Päivän tila nauhassa: suositus täyttyi, liikuntaa mutta vajaa, suunniteltua tulossa tai ei mitään. */
export type StripState = 'met' | 'some' | 'plan' | 'none';

export interface StripDay {
  date: ISODate;
  state: StripState;
  /** Kuittaamattomat suunnitelmat (päättyneet). */
  pending: number;
}

const STATE_LABEL: Record<StripState, string> = {
  met: 'suositus täyttyi',
  some: 'liikuntaa kirjattu',
  plan: 'suunniteltua tulossa',
  none: '',
};

export function DayStrip({
  days,
  today,
  selected,
  onSelect,
  week,
  start,
  end,
  onPrev,
  onNext,
}: {
  days: StripDay[];
  today: ISODate;
  selected: ISODate;
  onSelect: (d: ISODate) => void;
  week: number;
  start: ISODate;
  end: ISODate;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="card anim-fade rounded-[1.5rem] p-2">
      <div className="flex items-center gap-1">
        <button type="button" onClick={onPrev} className="press flex size-9 items-center justify-center rounded-xl text-slate-600 hover:bg-[var(--surface-sunk)] hover:text-slate-900" aria-label="Edellinen viikko">
          <IconChevronLeft />
        </button>
        <div className="min-w-0 flex-1 truncate text-center text-sm font-bold text-slate-900">
          <span className="mr-2 text-[10.5px] uppercase tracking-[0.14em] text-slate-500">Viikko {week}</span>
          {formatDate(start, 'd.M.')} – {formatDate(end, 'd.M.yyyy')}
        </div>
        <button type="button" onClick={onNext} className="press flex size-9 items-center justify-center rounded-xl text-slate-600 hover:bg-[var(--surface-sunk)] hover:text-slate-900" aria-label="Seuraava viikko">
          <IconChevronRight />
        </button>
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5" role="radiogroup" aria-label="Viikon päivät">
        {days.map((d) => {
          const on = d.date === selected;
          const isToday = d.date === today;
          const future = d.date > today;
          const wd = formatDate(d.date, 'cccccc').toUpperCase();
          const label = [formatDate(d.date, 'cccc d.M.'), isToday ? 'tänään' : '', STATE_LABEL[d.state], d.pending ? `${d.pending} kuittaamatta` : ''].filter(Boolean).join(', ');
          return (
            <button
              key={d.date}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              onClick={() => onSelect(d.date)}
              className={`press relative flex min-h-[4.6rem] flex-col items-center justify-center gap-1 rounded-2xl leading-none transition-colors ${
                on
                  ? 'bg-green-700 text-white shadow-[0_6px_14px_-6px_rgb(var(--accent-rgb)/0.7)]'
                  : isToday
                    ? 'bg-[var(--surface-sunk)] text-slate-900 ring-2 ring-inset ring-green-700/60'
                    : `${future ? 'text-slate-500' : 'text-slate-800'} hover:bg-[var(--surface-sunk)]`
              }`}
            >
              <span className="text-[10px] font-bold tracking-wider opacity-75">{wd}</span>
              <span className="stat text-[19px] font-semibold">{Number(d.date.slice(8, 10))}</span>
              <span className="flex h-4 items-center" aria-hidden>
                {d.state === 'met' ? (
                  <span className={`flex size-4 items-center justify-center rounded-full ${on ? 'bg-white/25' : 'bg-green-700'} text-white`}>
                    <IconCheck size="0.6rem" strokeWidth={3.4} />
                  </span>
                ) : d.state === 'some' ? (
                  <span className={`size-2 rounded-full ${on ? 'bg-white' : 'bg-green-700'} opacity-55`} />
                ) : d.state === 'plan' ? (
                  <span className={`size-2 rounded-full border-2 ${on ? 'border-white' : 'border-slate-400'}`} />
                ) : null}
              </span>
              {d.pending > 0 && (
                <span className="absolute -top-1 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold tabular-nums text-amber-950" aria-hidden>
                  {d.pending}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

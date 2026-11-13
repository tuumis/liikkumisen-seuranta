// Päivämäärän valinta suomeksi (SPEC 16): selaimen oma päivävalitsin näkyy laitteen kielellä
// (esim. englanninkielisessä iPhonessa englanniksi), joten sovelluksella on oma kalenteri.
// Kuukausinäkymä, viikko alkaa maanantaista, min/max-rajat. Ei lisäkirjastoja.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays, isISODate, isoWeekday, parseISODate, startOfIsoWeek, toISODate } from '../domain/dates';
import type { ISODate } from '../domain/types';
import { formatDate } from './format';
import { today as todayFn } from './today';

const MONTHS = ['tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu', 'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu'];
const WEEKDAYS = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'];
const PANEL_W = 300;

/** Kuukauden ruudukko: 6 viikkoa maanantaista alkaen. */
export function monthGrid(year: number, month: number): ISODate[] {
  const first = startOfIsoWeek(toISODate(year, month, 1));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

const shiftMonth = (y: number, m: number, d: number) => {
  const n = y * 12 + (m - 1) + d;
  return { year: Math.floor(n / 12), month: (n % 12) + 1 };
};

export function DateInput({
  value,
  onChange,
  min,
  max,
  className = '',
  'aria-label': ariaLabel,
  placeholder = 'Valitse päivä',
}: {
  value: string;
  onChange: (v: ISODate) => void;
  min?: string;
  max?: string;
  className?: string;
  'aria-label'?: string;
  placeholder?: string;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const valid = isISODate(value);
  const base = valid ? value : todayFn();
  const [view, setView] = useState(() => ({ year: parseISODate(base).year, month: parseISODate(base).month }));
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const b = valid ? value : todayFn();
    setView({ year: parseISODate(b).year, month: parseISODate(b).month });
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const h = panel.current?.offsetHeight ?? 360;
    const below = r.bottom + 6 + h <= window.innerHeight - 8;
    const top = below ? r.bottom + 6 : Math.max(8, r.top - 6 - h);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - PANEL_W - 8);
    setPos({ top, left });
  }, [open, view]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (panel.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onScroll = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const today = todayFn();
  const allowed = (d: ISODate) => (!min || d >= min) && (!max || d <= max);
  const pick = (d: ISODate) => {
    if (!allowed(d)) return;
    onChange(d);
    setOpen(false);
    btn.current?.focus();
  };
  const prev = shiftMonth(view.year, view.month, -1);
  const next = shiftMonth(view.year, view.month, 1);
  const lastOfPrev = addDays(toISODate(view.year, view.month, 1), -1);
  const firstOfNext = toISODate(next.year, next.month, 1);
  const canPrev = !min || lastOfPrev >= min;
  const canNext = !max || firstOfNext <= max;
  const nav = 'press flex size-10 items-center justify-center rounded-xl text-lg text-slate-700 hover:bg-[var(--surface-sunk)] disabled:opacity-30';

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}: ${valid ? formatDate(value, 'EEEEEE d.M.yyyy') : 'ei valittu'}` : undefined}
        className={`${className} flex items-center justify-between gap-2 text-left tabular-nums`}
      >
        <span className={valid ? '' : 'text-slate-400'}>{valid ? formatDate(value, 'EEEEEE d.M.yyyy') : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label={ariaLabel ?? 'Valitse päivä'}
            className="fixed z-[90] rounded-2xl bg-[var(--surface-raised)] p-3 shadow-xl ring-1 ring-slate-200"
            style={{ width: PANEL_W, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          >
            <div className="flex items-center justify-between gap-1">
              <button type="button" className={nav} disabled={!canPrev} onClick={() => setView(prev)} aria-label="Edellinen kuukausi">
                ‹
              </button>
              <div className="text-sm font-bold text-slate-900" aria-live="polite">
                {MONTHS[view.month - 1]} {view.year}
              </div>
              <button type="button" className={nav} disabled={!canNext} onClick={() => setView(next)} aria-label="Seuraava kuukausi">
                ›
              </button>
            </div>
            <div className="mt-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase text-slate-500">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5" role="grid">
              {monthGrid(view.year, view.month).map((d) => {
                const inMonth = parseISODate(d).month === view.month;
                const sel = valid && d === value;
                const ok = allowed(d);
                const weekend = isoWeekday(d) >= 6;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!ok}
                    onClick={() => pick(d)}
                    aria-label={formatDate(d, 'cccc d.M.yyyy')}
                    aria-pressed={sel}
                    className={`press flex h-10 items-center justify-center rounded-xl text-sm tabular-nums disabled:opacity-25 ${
                      sel
                        ? 'bg-green-700 font-bold text-white'
                        : d === today
                          ? 'font-bold text-green-800 ring-1 ring-green-700/60'
                          : inMonth
                            ? `${weekend ? 'text-slate-600' : 'text-slate-900'} hover:bg-[var(--surface-sunk)]`
                            : 'text-slate-400 hover:bg-[var(--surface-sunk)]'
                    }`}
                  >
                    {parseISODate(d).day}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" disabled={!allowed(today)} onClick={() => pick(today)} className="min-h-9 rounded-lg px-2 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-30">
                Tänään
              </button>
              <button type="button" onClick={() => setOpen(false)} className="min-h-9 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-[var(--surface-sunk)]">
                Sulje
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

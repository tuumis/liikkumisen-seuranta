// Pienennettävät kortit: tila muistetaan laitteella (localStorage), sisältö avautuu ja
// sulkeutuu sulavasti (grid-rows-siirtymä, ei korkeuden mittaamista).

import { useState, type ReactNode } from 'react';

const KEY = (id: string) => `collapsed:${id}`;

export function useCollapsible(id: string, defaultOpen = true): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(KEY(id));
      return v === null ? defaultOpen : v === '0';
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(KEY(id), o ? '1' : '0');
      } catch {
        /* ei tallennusta */
      }
      return !o;
    });
  return [open, toggle];
}

/** Pyöreä avaa/pienennä-painike kortin otsikkoriville. */
export function CollapseToggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${open ? 'Pienennä' : 'Avaa'}: ${label}`}
      title={open ? 'Pienennä' : 'Avaa'}
      className="press -mr-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunk)] text-slate-600 hover:text-slate-900"
    >
      <svg viewBox="0 0 24 24" className={`size-4 transition-transform duration-300 ${open ? '' : '-rotate-90'}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

/** Avautuva sisältö. Suljettuna sisältö ei ole fokusoitavissa (inert). */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`grid transition-[grid-template-rows] duration-300 [transition-timing-function:var(--ease-out)] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} inert={!open}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

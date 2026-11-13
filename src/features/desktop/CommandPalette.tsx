// Komentovalikko (Ctrl+K) ja pikanäppäimet (SPEC 16): haku toimintoihin, näkymiin, profiileihin,
// asetuksiin ja tuleviin peleihin. Näppäimet toimivat, kun kirjoituskenttä tai paneeli ei ole auki.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo } from '../../db/repositories';
import type { Profile } from '../../domain/types';
import { formatDate } from '../../ui/format';
import { IconSearch } from '../../ui/icons';
import { setThemeChoice, useIsDark } from '../../ui/theme';
import { today as todayFn } from '../../ui/today';
import { SETTINGS_SECTIONS, type SettingsSectionId } from '../settings/SettingsView';
import type { AppCommand } from './commands';

export type PaletteTab = 'week' | 'games' | 'analysis' | 'settings';

export interface PaletteContext {
  profiles: Profile[];
  selected?: Profile;
  tab: PaletteTab;
  setTab: (t: PaletteTab) => void;
  /** Jalkapallo käytössä valitulle profiilille (muuten välilehti ja tulevat pelit piilossa). */
  football: boolean;
  selectProfile: (id: string) => void;
  openSettings: (s?: SettingsSectionId) => void;
  openHelp: () => void;
  run: (cmd: AppCommand) => void;
}

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keys?: string;
  words?: string;
  run: () => void;
}

const TAB_ITEMS: { id: PaletteTab; label: string; key: string }[] = [
  { id: 'week', label: 'Viikko', key: '1' },
  { id: 'games', label: 'Jalkapallo', key: '2' },
  { id: 'analysis', label: 'Analyysi', key: '3' },
  { id: 'settings', label: 'Asetukset', key: '4' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

/** Pikanäppäimet + komentovalikko. Kiinnitetään kerran sovelluksen juureen. */
export function CommandPalette(ctx: PaletteContext) {
  const [open, setOpen] = useState(false);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return; // paneeli auki: Esc ja paneelin omat näppäimet
      const c = ctxRef.current;
      if (!c.profiles.length) return;
      const k = e.key;
      const act = (f: () => void) => {
        e.preventDefault();
        f();
      };
      if (k === '?' || k === '/') act(() => setOpen(true));
      else if (k === 'n' || k === '+') act(() => c.run({ kind: 'add' }));
      else if (k === 's') act(() => c.run({ kind: 'sync' }));
      else if (k === 'l') act(() => c.run({ kind: 'review' }));
      else if (k === 't') act(() => c.run({ kind: 'week', delta: 0 }));
      else if (k === 'k') act(() => c.run({ kind: 'story' }));
      else if (c.tab === 'week' && k === 'ArrowLeft') act(() => c.run({ kind: 'week', delta: -1 }));
      else if (c.tab === 'week' && k === 'ArrowRight') act(() => c.run({ kind: 'week', delta: 1 }));
      else {
        const t = TAB_ITEMS.find((x) => x.key === k && (x.id !== 'games' || c.football));
        if (t) act(() => c.setTab(t.id));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;
  return createPortal(<Palette ctx={ctx} onClose={() => setOpen(false)} />, document.body);
}

function Palette({ ctx, onClose }: { ctx: PaletteContext; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const dark = useIsDark();
  const today = todayFn();
  const fixtures = useLiveQuery(() => (ctx.selected ? repo.listFixtures(ctx.selected.id, today) : Promise.resolve([])), [ctx.selected?.id, today]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const items = useMemo<Item[]>(() => {
    const go = (f: () => void) => () => {
      onClose();
      f();
    };
    const out: Item[] = [
      { id: 'add', group: 'Toiminnot', label: 'Kirjaa liikuntakerta', keys: 'N', words: 'lisää uusi kerta treeni', run: go(() => ctx.run({ kind: 'add' })) },
      { id: 'review', group: 'Toiminnot', label: 'Käy viikko läpi', keys: 'L', words: 'kuittaa suunnitelmat läpikäynti', run: go(() => ctx.run({ kind: 'review' })) },
      { id: 'sync', group: 'Toiminnot', label: 'Synkronoi puhelimen kanssa', keys: 'S', words: 'synkronointi pc puhelin icloud', run: go(() => ctx.run({ kind: 'sync' })) },
      { id: 'story', group: 'Toiminnot', label: 'Kauden kooste', keys: 'K', words: 'tarinat yhteenveto kuva jaa', run: go(() => ctx.run({ kind: 'story' })) },
      { id: 'thisweek', group: 'Toiminnot', label: 'Tämä viikko', keys: 'T', words: 'tänään nykyinen', run: go(() => ctx.run({ kind: 'week', delta: 0 })) },
      { id: 'prev', group: 'Toiminnot', label: 'Edellinen viikko', keys: '←', run: go(() => ctx.run({ kind: 'week', delta: -1 })) },
      { id: 'next', group: 'Toiminnot', label: 'Seuraava viikko', keys: '→', run: go(() => ctx.run({ kind: 'week', delta: 1 })) },
      ...TAB_ITEMS.filter((t) => t.id !== 'games' || ctx.football).map((t) => ({ id: `tab-${t.id}`, group: 'Siirry', label: t.label, keys: t.key, words: 'näkymä välilehti', run: go(() => ctx.setTab(t.id)) })),
      ...ctx.profiles
        .filter((p) => p.id !== ctx.selected?.id)
        .map((p) => ({ id: `p-${p.id}`, group: 'Profiilit', label: `Vaihda profiiliin ${p.name}`, words: 'profiili lapsi', run: go(() => ctx.selectProfile(p.id)) })),
      ...SETTINGS_SECTIONS.map((s) => ({ id: `s-${s.id}`, group: 'Asetukset', label: s.title, hint: s.text, words: 'asetukset', run: go(() => ctx.openSettings(s.id)) })),
      { id: 'theme', group: 'Ulkoasu', label: dark ? 'Vaihda vaaleaan teemaan' : 'Vaihda tummaan teemaan', words: 'tumma vaalea teema yö', run: go(() => setThemeChoice(dark ? 'light' : 'dark')) },
      { id: 'help', group: 'Ohje', label: 'Ohje', keys: '?', words: 'apua käyttöohje', run: go(ctx.openHelp) },
    ];
    for (const e of ctx.football ? (fixtures ?? []) : []) {
      const f = e.fixture;
      const name = f?.eventName || (f?.opponent ? `vs. ${f.opponent}` : undefined);
      if (!name) continue;
      out.push({
        id: `f-${e.plan.id}`,
        group: 'Tulevat pelit',
        label: name,
        hint: `${formatDate(e.plan.date, 'EEEEEE d.M.')}${e.plan.startTime ? ` klo ${e.plan.startTime}` : ''}`,
        words: 'peli turnaus ottelu',
        run: go(() => ctx.setTab('games')),
      });
    }
    return out;
  }, [ctx, dark, fixtures, onClose]);

  const shown = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return items;
    return items.filter((it) => {
      const hay = norm(`${it.label} ${it.hint ?? ''} ${it.words ?? ''} ${it.group}`);
      return words.every((w) => hay.includes(w));
    });
  }, [items, q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(shown.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      shown[active]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="presentation" onKeyDown={onKey}>
      <div className="scrim absolute inset-0" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Komennot" className="palette anim-pop relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-[1.5rem] bg-[var(--surface)] shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center gap-3 border-b border-slate-200/70 px-4">
          <IconSearch size="1.2rem" className="shrink-0 text-slate-400" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hae toimintoa, näkymää, profiilia tai peliä…"
            className="min-h-14 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={shown[active] ? `pal-${shown[active].id}` : undefined}
            aria-label="Hae komentoa"
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <ul ref={list} id="palette-list" role="listbox" className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
          {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">Ei osumia haulle "{q}"</li>}
          {shown.map((it, i) => {
            const head = it.group !== lastGroup;
            lastGroup = it.group;
            return (
              <li key={it.id} role="presentation">
                {head && <div className="px-3 pb-1 pt-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">{it.group}</div>}
                <div
                  id={`pal-${it.id}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={it.run}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${i === active ? 'bg-[var(--surface-sage)] text-slate-900' : 'text-slate-700'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{it.label}</span>
                    {it.hint && <span className="block truncate text-xs text-slate-500">{it.hint}</span>}
                  </span>
                  {it.keys && <kbd className="kbd">{it.keys}</kbd>}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200/70 px-4 py-2.5 text-[11px] text-slate-500">
          <span>
            <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> valitse
          </span>
          <span>
            <kbd className="kbd">Enter</kbd> suorita
          </span>
          <span className="ml-auto">
            <kbd className="kbd">Ctrl</kbd> <kbd className="kbd">K</kbd> avaa ja sulje
          </span>
        </div>
      </div>
    </div>
  );
}

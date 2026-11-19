// Ulkoasu: järjestelmä / vaalea / tumma (oletus vaalea), väriteema oletuksena Vuono. Laitekohtainen käyttöliittymäasetus (localStorage),
// ei synkronoidu. public/theme-init.js asettaa teeman jo ennen Reactin käynnistystä (ei välähdystä).

import { useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'theme';
const media = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export function getThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'system' || v === 'dark' ? v : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(choice: ThemeChoice = getThemeChoice()): void {
  const dark = choice === 'dark' || (choice === 'system' && !!media()?.matches);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1613' : '#f6f5f0');
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'light') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* ei tallennusta */
  }
  applyTheme(choice);
  window.dispatchEvent(new Event('themechange'));
}

/** Seuraa järjestelmän teemaa, kun valinta on "Järjestelmä". */
export function watchSystemTheme(): () => void {
  const m = media();
  const onChange = () => {
    if (getThemeChoice() === 'system') {
      applyTheme('system');
      window.dispatchEvent(new Event('themechange'));
    }
  };
  m?.addEventListener('change', onChange);
  return () => m?.removeEventListener('change', onChange);
}

/** true, kun tumma tila on käytössä (kaavioiden SVG-värit). */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const update = () => setDark(document.documentElement.classList.contains('dark'));
    window.addEventListener('themechange', update);
    return () => window.removeEventListener('themechange', update);
  }, []);
  return dark;
}

export function useThemeChoice(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(getThemeChoice);
  return [
    choice,
    (c) => {
      setThemeChoice(c);
      setChoice(c);
    },
  ];
}

// ---------- väriteema (korosteväri) ----------

export type AccentTheme = 'forest' | 'fjord' | 'heather' | 'graphite';
export const ACCENT_THEMES: { id: AccentTheme; label: string; text: string; swatch: [string, string, string] }[] = [
  { id: 'fjord', label: 'Vuono', text: 'Syvä sinivihreä ja persikka', swatch: ['#1f4a5b', '#d6e8ee', '#efbf94'] },
  { id: 'forest', label: 'Metsä', text: 'Metsänvihreä ja hiekka', swatch: ['#244c3b', '#dce8dc', '#e6bd89'] },
  { id: 'heather', label: 'Kanerva', text: 'Luumu ja ruusukulta', swatch: ['#4a2f55', '#ebe0ee', '#ecb9a2'] },
  { id: 'graphite', label: 'Grafiitti', text: 'Hiilenharmaa ja meripihka', swatch: ['#2f3a40', '#e3e7e9', '#e8b562'] },
];
const ACCENT_KEY = 'accent';
/** Oletusväriteema, kun laitteella ei ole valintaa. */
export const DEFAULT_ACCENT: AccentTheme = 'fjord';

export function getAccent(): AccentTheme {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    return ACCENT_THEMES.some((t) => t.id === v) ? (v as AccentTheme) : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function applyAccent(a: AccentTheme = getAccent()): void {
  const root = document.documentElement;
  if (a === 'forest') root.removeAttribute('data-accent');
  else root.setAttribute('data-accent', a);
}

export function useAccent(): [AccentTheme, (a: AccentTheme) => void] {
  const [accent, setAccent] = useState<AccentTheme>(getAccent);
  return [
    accent,
    (a) => {
      try {
        if (a === DEFAULT_ACCENT) localStorage.removeItem(ACCENT_KEY);
        else localStorage.setItem(ACCENT_KEY, a);
      } catch {
        /* ei tallennusta */
      }
      // Pehmeä siirtymä teemojen välillä (View Transitions, jos tuettu).
      const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
      if (doc.startViewTransition && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(() => applyAccent(a));
      else applyAccent(a);
      setAccent(a);
      window.dispatchEvent(new Event('themechange'));
    },
  ];
}

/** Kasvaa aina teeman tai väriteeman vaihtuessa (SVG-kaaviot lukevat värit CSS-muuttujista). */
export function useThemeVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((x) => x + 1);
    window.addEventListener('themechange', bump);
    return () => window.removeEventListener('themechange', bump);
  }, []);
  return v;
}

/** Design systemin tokenin arvo (esim. '--viz-logged') nykyisessä teemassa. */
export const cssVar = (name: string, fallback = '') =>
  (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;

// ---------- näkymä: kattava vai yksinkertainen ----------

export type ViewMode = 'full' | 'simple';
const VIEW_KEY = 'viewMode';

export function getViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'simple' ? 'simple' : 'full';
  } catch {
    return 'full';
  }
}

/** Laitekohtainen näkymävalinta; muutos välittyy kaikille käyttäjille (viewmodechange). */
export function useViewMode(): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(getViewMode);
  useEffect(() => {
    const update = () => setMode(getViewMode());
    window.addEventListener('viewmodechange', update);
    return () => window.removeEventListener('viewmodechange', update);
  }, []);
  return [
    mode,
    (m) => {
      try {
        if (m === 'full') localStorage.removeItem(VIEW_KEY);
        else localStorage.setItem(VIEW_KEY, m);
      } catch {
        /* ei tallennusta */
      }
      setMode(m);
      window.dispatchEvent(new Event('viewmodechange'));
    },
  ];
}

// ---------- tausta (17.11.2026) ----------

/**
 * Sovelluksen tausta: oletus, piirretyt (vaalea ja tumma versio, index.css) tai oma kuva. Laitekohtainen
 * (localStorage); oma kuva ei siirry synkronoinnissa eikä varmuuskopiossa. public/theme-init.js asettaa
 * taustan ennen käynnistystä.
 */
export type BackgroundId = 'default' | 'grass' | 'fjord' | 'forest' | 'snow' | 'paper' | 'aurora' | 'floodlight' | 'photo';
export const BACKGROUNDS: { id: Exclude<BackgroundId, 'photo'>; label: string }[] = [
  { id: 'default', label: 'Oletus' },
  { id: 'grass', label: 'Nurmi' },
  { id: 'fjord', label: 'Vuono' },
  { id: 'forest', label: 'Metsä' },
  { id: 'snow', label: 'Lumi' },
  { id: 'paper', label: 'Paperi' },
  { id: 'aurora', label: 'Revontulet' },
  { id: 'floodlight', label: 'Kenttävalot' },
];
const BG_KEY = 'background';
const BG_PHOTO_KEY = 'bgPhoto';
const BG_DIM_KEY = 'bgDim';
export const DEFAULT_BG_DIM = 65;
const BG_IDS: readonly BackgroundId[] = ['default', 'grass', 'fjord', 'forest', 'snow', 'paper', 'aurora', 'floodlight', 'photo'];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getBackground(): BackgroundId {
  const v = read(BG_KEY);
  if (v === 'photo' && !read(BG_PHOTO_KEY)) return 'default';
  return BG_IDS.includes(v as BackgroundId) ? (v as BackgroundId) : 'default';
}
export const getBackgroundPhoto = (): string | undefined => read(BG_PHOTO_KEY) ?? undefined;
export function getBackgroundDim(): number {
  const n = Number(read(BG_DIM_KEY));
  return Number.isFinite(n) && n >= 20 && n <= 95 ? n : DEFAULT_BG_DIM;
}

export function applyBackground(): void {
  const root = document.documentElement;
  const bg = getBackground();
  if (bg === 'default') root.removeAttribute('data-bg');
  else root.setAttribute('data-bg', bg);
  const photo = getBackgroundPhoto();
  if (photo) root.style.setProperty('--bg-photo', `url("${photo}")`);
  else root.style.removeProperty('--bg-photo');
  root.style.setProperty('--bg-dim', `${getBackgroundDim()}%`);
}

function write(key: string, value: string | undefined): void {
  if (value === undefined) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

/** Taustan tila ja muuttajat; oman kuvan tallennus heittää virheen, jos laitteen tila ei riitä. */
export function useBackground() {
  const [state, setState] = useState(() => ({ bg: getBackground(), photo: getBackgroundPhoto(), dim: getBackgroundDim() }));
  const refresh = () => {
    applyBackground();
    setState({ bg: getBackground(), photo: getBackgroundPhoto(), dim: getBackgroundDim() });
  };
  return {
    ...state,
    setBackground(bg: BackgroundId) {
      try {
        write(BG_KEY, bg === 'default' ? undefined : bg);
      } catch {
        /* ei tallennusta */
      }
      refresh();
    },
    setPhoto(dataUrl: string | undefined) {
      if (dataUrl) {
        write(BG_PHOTO_KEY, dataUrl); // voi heittää (QuotaExceededError)
        write(BG_KEY, 'photo');
      } else {
        try {
          write(BG_PHOTO_KEY, undefined);
          if (read(BG_KEY) === 'photo') write(BG_KEY, undefined);
        } catch {
          /* ei tallennusta */
        }
      }
      refresh();
    },
    setDim(dim: number) {
      try {
        write(BG_DIM_KEY, dim === DEFAULT_BG_DIM ? undefined : String(dim));
      } catch {
        /* ei tallennusta */
      }
      refresh();
    },
  };
}

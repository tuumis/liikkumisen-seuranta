// Ulkoasu: järjestelmä / vaalea / tumma. Laitekohtainen käyttöliittymäasetus (localStorage),
// ei synkronoidu. public/theme-init.js asettaa teeman jo ennen Reactin käynnistystä (ei välähdystä).

import { useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'theme';
const media = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export function getThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
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
    if (choice === 'system') localStorage.removeItem(KEY);
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

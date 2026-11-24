// Viikon pääkortin teema (24.11.2026): pikavalitsin kortin alakulmassa ja sama valinta Asetuksissa.
// Valinta tallennetaan profiiliin (Profile.heroTheme, tummalle tilalle heroThemeDark), joten se on
// profiilikohtainen ja synkronoituu. Pikavalinta muuttaa sen tilan teemaa, joka on käytössä.

import { useEffect, useRef, useState } from 'react';
import type { HeroTheme, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { ACCENT_THEMES, getAccent, HERO_THEMES, useIsDark } from '../../ui/theme';
import { IconPalette } from '../../ui/icons';

/** Tilan teema: tumma tila ilman omaa valintaa käyttää vaalean tilan teemaa. */
export function heroThemeFor(profile: Profile, dark: boolean): HeroTheme {
  return (dark ? (profile.heroThemeDark ?? profile.heroTheme) : profile.heroTheme) ?? 'app';
}

/** Kortin data-hero-attribuutti ja profiilivärin muuttuja (WeekHero). */
export function heroThemeProps(profile: Profile, dark: boolean): { 'data-hero'?: string; style: Record<string, string> } {
  const t = heroThemeFor(profile, dark);
  return { 'data-hero': t && t !== 'app' ? t : undefined, style: { '--hero-profile': profile.color } };
}

/** Teeman näyte: profiilin värille liukuväri profiilin väristä. */
export function swatchStyle(id: HeroTheme, profile: Profile): React.CSSProperties {
  const t = HERO_THEMES.find((x) => x.id === id)!;
  if (id === 'profile') {
    return { background: `linear-gradient(155deg, color-mix(in oklab, ${profile.color} 64%, #0b1015), color-mix(in oklab, ${profile.color} 34%, #0b1015))` };
  }
  if (id === 'app') {
    // Kortin sisällä --hero-from on valitun teeman arvo, joten näyte tehdään väriteeman väristä.
    const c = (ACCENT_THEMES.find((a) => a.id === getAccent()) ?? ACCENT_THEMES[0]).swatch[0];
    return { background: `linear-gradient(155deg, color-mix(in oklab, ${c} 85%, #ffffff), color-mix(in oklab, ${c} 70%, #000000))` };
  }
  return { background: t.swatch, boxShadow: id === 'morning' ? 'inset 0 0 0 1px rgb(60 50 30 / 0.2)' : undefined };
}

/** Tallennus tilan mukaan; tummalle tilalle myös 'app' erikseen (muuten se seuraisi vaaleaa). */
export function saveHeroTheme(profile: Profile, id: HeroTheme, dark: boolean): Promise<void> {
  if (dark) return repo.updateProfile(profile.id, { heroThemeDark: id });
  return repo.updateProfile(profile.id, { heroTheme: id === 'app' ? undefined : id });
}

/** Paletti-painike kortin oikeassa alakulmassa; teemarivi avautuu sen yläpuolelle. */
export function HeroThemePicker({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dark = useIsDark();
  const current = heroThemeFor(profile, dark);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Kortin teema"
        title="Kortin teema"
        className={`press hit flex size-8 items-center justify-center rounded-full text-[var(--hero-ink)] transition-colors hover:bg-[var(--hero-glass-strong)] ${open ? 'bg-[var(--hero-glass-strong)]' : 'opacity-75 hover:opacity-100'}`}
      >
        <IconPalette size="1.05rem" />
      </button>
      {open && (
        <div className="anim-pop absolute bottom-full right-0 z-30 mb-2 w-max max-w-[calc(100vw-3rem)] rounded-2xl bg-[var(--surface-raised)] p-3 text-slate-900 shadow-lg ring-1 ring-black/5">
          <div className="mb-2 text-xs font-semibold text-slate-600">Kortin teema · {profile.name} · {dark ? 'tumma tila' : 'vaalea tila'}</div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Kortin teema, ${profile.name}, ${dark ? 'tumma tila' : 'vaalea tila'}`}>
            {HERO_THEMES.map((t) => {
              const on = current === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={t.label}
                  title={t.label}
                  onClick={() => void saveHeroTheme(profile, t.id, dark)}
                  className={`press size-9 rounded-full ${on ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-[var(--surface-raised)]' : ''}`}
                  style={swatchStyle(t.id, profile)}
                />
              );
            })}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">{HERO_THEMES.find((t) => t.id === current)?.label} · myös Asetukset → Ulkoasu</div>
        </div>
      )}
    </div>
  );
}

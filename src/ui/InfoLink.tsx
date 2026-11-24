import { linkHost } from '../domain/link';
import { IconExternal } from './icons';

/** Jakopainike (tuloskuva, ennakko): korostettu tekstipainike (24.11.2026, käyttäjän toive: selkeämpi). */
export const SHARE_PILL =
  'press hit inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full bg-green-100 px-3 text-xs font-semibold text-green-900 ring-1 ring-green-200 hover:bg-green-200';

/**
 * Pelin tai turnauksen linkki (17.11.2026): avautuu selaimen uuteen välilehteen. Aina teksti "Tiedot"
 * kuvakkeen kanssa (24.11.2026, käyttäjän toive: pelkkä kuvake oli epäselvä); compact = matalampi.
 */
export function InfoLink({ href, compact, className = '' }: { href: string; compact?: boolean; className?: string }) {
  const host = linkHost(href);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`press hit inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--surface-raised)] text-xs font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-100 hover:text-slate-900 ${
        compact ? 'min-h-8 px-2.5' : 'min-h-9 px-3'
      } ${className}`}
      aria-label={`Avaa tiedot: ${host} (uusi välilehti)`}
      title={`Avaa ${host}`}
    >
      <IconExternal size="0.9rem" />
      Tiedot
    </a>
  );
}

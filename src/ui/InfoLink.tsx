import { linkHost } from '../domain/link';
import { IconExternal } from './icons';

/**
 * Pelin tai turnauksen linkki (17.11.2026): avautuu selaimen uuteen välilehteen. compact = pelkkä kuvake
 * (tiiviit rivit), muuten "Tiedot".
 */
export function InfoLink({ href, compact, className = '' }: { href: string; compact?: boolean; className?: string }) {
  const host = linkHost(href);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`press inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-900 ${
        compact ? 'relative size-8 before:absolute before:-inset-1.5 hover:bg-[var(--surface-sunk)]' : 'min-h-9 bg-[var(--surface-raised)] px-3 ring-1 ring-slate-200'
      } ${className}`}
      aria-label={`Avaa tiedot: ${host} (uusi välilehti)`}
      title={`Avaa ${host}`}
    >
      <IconExternal size="0.9rem" />
      {!compact && 'Tiedot'}
    </a>
  );
}

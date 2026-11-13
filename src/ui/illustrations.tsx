// Tyhjien tilojen kuvitukset (SPEC 16): yhtenäinen viivapiirros sovelluksen sävyillä. Viiva perii
// tekstin värin (teeman korostusväri), täytöt tulevat teeman pinnoista, joten kuvat toimivat myös tummassa teemassa.

import type { ReactNode } from 'react';

export type IllustrationName = 'calendar' | 'ball' | 'notebook' | 'chart' | 'shirt' | 'people' | 'search' | 'sprout' | 'scoreboard' | 'repeat';

const L = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const SURF = 'var(--surface)';
const ACC = 'var(--hero-accent)';

/** Pehmeä tausta + pienet koristepisteet; kaikille kuville sama kehys. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <>
      <path d="M28 70c-6-26 14-50 44-54 30-4 60 6 68 32 8 26-10 52-44 56-34 4-62-8-68-34Z" fill="var(--surface-sage)" />
      <circle cx="30" cy="30" r="3" fill={ACC} opacity="0.8" />
      <circle cx="140" cy="88" r="2.5" fill="currentColor" opacity="0.35" />
      <path d="M136 26v8M132 30h8" {...L} strokeWidth={2} opacity="0.5" />
      {children}
    </>
  );
}

const ART: Record<IllustrationName, ReactNode> = {
  calendar: (
    <Frame>
      <rect x="46" y="30" width="68" height="62" rx="10" {...L} fill={SURF} />
      <path d="M46 46h68M62 24v12M98 24v12" {...L} />
      <path d="M60 60h8M76 60h8M92 60h8M60 74h8M76 74h8" {...L} opacity="0.45" />
      <circle cx="100" cy="76" r="9" fill={ACC} />
      <path d="m96 76 3 3 5-6" {...L} stroke="#1c2b24" strokeWidth={2.2} />
    </Frame>
  ),
  ball: (
    <Frame>
      <path d="M40 92V44h80v48" {...L} />
      <path d="M40 56h80M40 68h80M40 80h80M56 44v48M72 44v48M88 44v48M104 44v48" {...L} strokeWidth={1.2} opacity="0.35" />
      <circle cx="80" cy="84" r="16" {...L} fill={SURF} />
      <path d="m80 76 7 5-3 8h-8l-3-8Z" fill="currentColor" opacity="0.85" />
      <path d="M80 76v-8M87 81l7-3M84 89l4 7M76 89l-4 7M73 81l-7-3" {...L} strokeWidth={1.6} />
      <path d="M30 100h100" {...L} opacity="0.4" />
    </Frame>
  ),
  notebook: (
    <Frame>
      <rect x="50" y="24" width="58" height="72" rx="8" {...L} fill={SURF} />
      <path d="M50 38h-6M50 54h-6M50 70h-6M50 86h-6" {...L} />
      <path d="M62 42h34M62 54h28M62 66h32" {...L} opacity="0.45" />
      <path d="m112 52 10 10-26 26-12 3 3-12Z" {...L} fill={ACC} />
      <path d="m106 58 10 10" {...L} />
    </Frame>
  ),
  chart: (
    <Frame>
      <path d="M40 94h84" {...L} />
      <rect x="48" y="66" width="14" height="28" rx="4" {...L} fill={SURF} />
      <rect x="70" y="52" width="14" height="42" rx="4" {...L} fill={SURF} />
      <rect x="92" y="36" width="14" height="58" rx="4" {...L} fill={ACC} />
      <path d="M46 56 66 44l18 6 26-22" {...L} strokeDasharray="1 6" />
      <path d="M114 22v10M109 27h10" {...L} />
    </Frame>
  ),
  shirt: (
    <Frame>
      <path d="m62 28-22 14 8 16 10-5v41h44V53l10 5 8-16-22-14c-2 8-8 12-18 12s-16-4-18-12Z" {...L} fill={SURF} />
      <path d="M68 32c3 4 7 6 12 6s9-2 12-6" {...L} />
      <text x="80" y="80" textAnchor="middle" fontSize="22" fontWeight="700" fill="currentColor" fontFamily="var(--font-display)">
        9
      </text>
      <path d="M58 94h44" stroke={ACC} strokeWidth={5} strokeLinecap="round" />
    </Frame>
  ),
  people: (
    <Frame>
      <circle cx="64" cy="48" r="12" {...L} fill={SURF} />
      <path d="M42 92c0-14 10-24 22-24s22 10 22 24" {...L} fill={SURF} />
      <circle cx="100" cy="56" r="10" {...L} fill={ACC} />
      <path d="M82 92c0-11 8-19 18-19s18 8 18 19" {...L} fill={SURF} />
    </Frame>
  ),
  search: (
    <Frame>
      <circle cx="74" cy="58" r="24" {...L} fill={SURF} />
      <path d="m92 76 20 20" {...L} strokeWidth={5} />
      <path d="M64 54c2-6 7-10 14-10" {...L} opacity="0.45" />
      <path d="M66 66h16" {...L} opacity="0.3" />
    </Frame>
  ),
  scoreboard: (
    <Frame>
      <rect x="42" y="34" width="76" height="46" rx="10" {...L} fill={SURF} />
      <path d="M80 42v30" {...L} opacity="0.35" />
      <text x="61" y="67" textAnchor="middle" fontSize="20" fontWeight="700" fill="currentColor" fontFamily="var(--font-display)">
        3
      </text>
      <text x="99" y="67" textAnchor="middle" fontSize="20" fontWeight="700" fill="currentColor" fontFamily="var(--font-display)">
        1
      </text>
      <path d="M58 80v12M102 80v12M50 92h60" {...L} />
      <circle cx="116" cy="36" r="10" fill={ACC} />
      <path d="m111.5 36 3 3 5.5-6" {...L} stroke="#1c2b24" strokeWidth={2.2} />
    </Frame>
  ),
  repeat: (
    <Frame>
      <rect x="46" y="32" width="68" height="58" rx="10" {...L} fill={SURF} />
      <path d="M46 46h68" {...L} />
      <path d="M60 58h40M60 70h28" {...L} opacity="0.4" />
      <path d="M98 66a14 14 0 1 1-4-10" {...L} stroke={ACC} strokeWidth={3.4} />
      <path d="m95 50 0 7 7-1" {...L} stroke={ACC} strokeWidth={3.4} />
    </Frame>
  ),
  sprout: (
    <Frame>
      <path d="M58 92h44l-5 -18H63Z" {...L} fill={SURF} />
      <path d="M80 74V48" {...L} />
      <path d="M80 58c-14 0-22-8-22-20 14 0 22 8 22 20Z" {...L} fill="var(--surface-sage)" />
      <path d="M80 50c0-12 8-20 22-20 0 12-8 20-22 20Z" {...L} fill={ACC} />
    </Frame>
  ),
};

/** Kuvitus tyhjään tilaan (koristeellinen, ei ruudunlukijalle). */
export function Illustration({ name, className = '' }: { name: IllustrationName; className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={`illustration h-24 w-32 text-green-800 ${className}`} aria-hidden>
      {ART[name]}
    </svg>
  );
}

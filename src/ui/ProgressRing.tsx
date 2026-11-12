// Edistymisrengas: täyttyy animoidusti 0 → arvo. Yli 100 % näkyy toisena, ohuempana kierroksena.

import type { ReactNode } from 'react';
import { useMounted } from './motion';

export function ProgressRing({
  value,
  size = 140,
  stroke = 12,
  color = 'currentColor',
  track = 'rgb(0 0 0 / 0.08)',
  children,
  label,
}: {
  /** Osuus tavoitteesta (1 = 100 %). */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  label: string;
}) {
  const mounted = useMounted();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Number.isFinite(value) ? value : 0);
  const first = Math.min(1, v);
  const over = Math.min(1, Math.max(0, v - 1));
  const offset = (x: number) => c * (1 - (mounted ? x : 0));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset(first)}
          style={{ transition: 'stroke-dashoffset 1.2s var(--ease-out)' }}
        />
        {over > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeOpacity={0.55}
            strokeWidth={stroke * 0.45}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset(over)}
            style={{ transition: 'stroke-dashoffset 1.2s var(--ease-out) 0.9s' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

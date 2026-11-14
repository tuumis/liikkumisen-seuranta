// Lajin kuvake: oma kuva (ActivityType.image), jos sellainen on, muuten emoji.

import type { ActivityType } from '../domain/types';

export function TypeGlyph({ t, className = '' }: { t?: Pick<ActivityType, 'icon' | 'image'>; className?: string }) {
  if (t?.image) return <img src={t.image} alt="" draggable={false} className={`inline-block size-[1.35em] shrink-0 rounded-[0.35em] object-cover align-[-0.3em] ${className}`} />;
  return <>{t?.icon ?? '•'}</>;
}

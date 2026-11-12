// Jalkapallo-välilehden yläkortti: kuluvan kauden tunnusluvut ja seuraava peli.
// Tulokset ovat joukkueen tuloksia; luvut eivät vaikuta liikunta-arvioihin.

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { seasonPeriod } from '../../domain/dates';
import { footballKindOf, gameRows, seasonKey, summarizeGames } from '../../domain/football';
import type { Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { dayLabel } from '../../ui/format';
import { IconTrophy } from '../../ui/icons';
import { useCountUp } from '../../ui/motion';
import { today as todayFn } from '../../ui/today';
import { useFootball } from '../football/useFootball';

function Stat({ label, value, i }: { label: string; value: number | string; i: number }) {
  const n = typeof value === 'number' ? value : NaN;
  const shown = useCountUp(Number.isFinite(n) ? n : 0);
  return (
    <div className="anim-rise rounded-2xl bg-white/[0.08] px-3 py-2.5 ring-1 ring-white/[0.08]" style={{ ['--i' as string]: i }}>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--hero-ink-soft)]">{label}</dt>
      <dd className="stat mt-1.5 text-[24px] font-semibold lg:text-[28px]">{Number.isFinite(n) ? Math.round(shown) : value}</dd>
    </div>
  );
}

export function FootballHero({ profile }: { profile: Profile }) {
  const today = todayFn();
  const season = seasonPeriod(today);
  const data = useFootball(profile.id, season.start, season.end);
  const fixtures = useLiveQuery(() => repo.listFixtures(profile.id, today), [profile.id, today]);
  const next = (fixtures ?? []).filter((e) => e.plan.status === 'open' && e.plan.date >= today).sort((a, b) => a.plan.date.localeCompare(b.plan.date))[0];

  const stats = useMemo(() => {
    if (!data) return null;
    const trainings = data.sessions.filter((s) => !s.deletedAt && footballKindOf(s, data.types) === 'training').length;
    const g = summarizeGames(gameRows(data.sessions, data.details, data.types));
    return { trainings, g };
  }, [data]);

  return (
    <section className="hero anim-rise p-5 sm:p-6" aria-label="Kauden yhteenveto">
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="min-w-0 lg:w-64">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--hero-ink-soft)]">{seasonKey(today)}</div>
          <div className="mt-1 font-display text-2xl font-semibold leading-snug">Kausi tähän mennessä</div>
          {next ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/[0.1] p-3 ring-1 ring-white/10">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--hero-accent)] text-[#244c3b]" aria-hidden>
                <IconTrophy size="1.25rem" />
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--hero-ink-soft)]">Seuraava</span>
                <span className="block truncate text-sm font-semibold">
                  {next.fixture?.opponent ? `vs ${next.fixture.opponent}` : next.fixture?.eventName ?? 'Peli'} · {dayLabel(next.plan.date)}
                  {next.plan.startTime && ` klo ${next.plan.startTime}`}
                </span>
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--hero-ink-soft)]">Ei tulevia pelejä kalenterissa.</p>
          )}
        </div>
        {stats && (
          <dl className="grid flex-1 grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
            <Stat label="Treenit" value={stats.trainings} i={1} />
            <Stat label="Pelit" value={stats.g.games} i={2} />
            <Stat label="V–T–H" value={`${stats.g.wins}–${stats.g.draws}–${stats.g.losses}`} i={3} />
            <Stat label="Maalit" value={`${stats.g.goalsFor}–${stats.g.goalsAgainst}`} i={4} />
            <Stat label="Omat ⚽" value={stats.g.playerGoals} i={5} />
          </dl>
        )}
      </div>
    </section>
  );
}

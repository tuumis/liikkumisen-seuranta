// Jalkapallo-välilehden yläkortti: kuluvan kauden tunnusluvut ja seuraava peli.
// Tulokset ovat joukkueen tuloksia; luvut eivät vaikuta liikunta-arvioihin.

import { useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { seasonPeriod } from '../../domain/dates';
import { footballKindOf, gameRows, seasonKey, summarizeGames } from '../../domain/football';
import type { Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { dayLabel } from '../../ui/format';
import { IconSparkle, IconTrophy } from '../../ui/icons';
import { CountUp } from '../../ui/CountUp';
import { today as todayFn } from '../../ui/today';
import { useFootball } from '../football/useFootball';
import { goalsLabel } from '../../ui/labels';
import { dispatchCommand } from '../desktop/commands';

// Puhelimella (alle 640 px) luvut ovat yhdellä rivillä pienempinä (19.11.2026), jotta sivun valinnat mahtuvat ensimmäiseen ruutuun.
function Stat({ label, value, i }: { label: ReactNode; value: number | string; i: number }) {
  const n = typeof value === 'number' ? value : NaN;
  const long = String(value).length > 5;
  return (
    <div className="anim-rise min-w-0 rounded-2xl bg-white/[0.08] px-1 py-1.5 text-center ring-1 ring-white/[0.08] sm:px-3 sm:py-2.5 sm:text-left" style={{ ['--i' as string]: i }}>
      <dt className="truncate text-[9.5px] sm:overflow-visible sm:whitespace-normal font-bold uppercase tracking-wide text-[var(--hero-ink-soft)] sm:text-[10px]">{label}</dt>
      <dd className={`stat mt-0.5 whitespace-nowrap font-semibold sm:mt-1.5 sm:text-[24px] lg:text-[28px] ${long ? 'text-[15px]' : 'text-[19px]'}`}>{Number.isFinite(n) ? <CountUp value={n} format={(v) => String(Math.round(v))} /> : value}</dd>
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
    const trainings = data.sessions.filter((s) => !s.deletedAt && footballKindOf(s, data.types) === 'training' && !s.linkedTo).length;
    const g = summarizeGames(gameRows(data.sessions, data.details, data.types));
    return { trainings, g };
  }, [data]);

  return (
    <section className="hero anim-rise p-3.5 sm:p-6" aria-label="Kauden yhteenveto">
      <div className="relative z-10 flex flex-col gap-2.5 sm:gap-5 lg:flex-row lg:items-center">
        <div className="min-w-0 lg:w-64">
          <div className="flex items-center justify-between gap-3 sm:block">
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--hero-ink-soft)] sm:text-[11px]">{seasonKey(today)}</div>
              <div className="mt-0.5 font-display text-[17px] font-semibold leading-snug sm:mt-1 sm:text-2xl">Kausi tähän mennessä</div>
            </div>
            <button
              type="button"
              onClick={() => dispatchCommand({ kind: 'story' })}
              className="press hit inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--hero-accent)] px-3 text-xs sm:gap-2 sm:px-3.5 font-bold text-[#1c2b24] shadow-md hover:brightness-105 sm:mt-3"
            >
              <IconSparkle size="0.95rem" /> Kauden kooste
            </button>
          </div>
          {next ? (
            <div className="mt-3 hidden items-center gap-3 rounded-2xl bg-white/[0.1] p-3 ring-1 ring-white/10 sm:flex">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--hero-accent)] text-[var(--hero-to)]" aria-hidden>
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
          ) : fixtures ? (
            <p className="mt-2 hidden text-sm text-[var(--hero-ink-soft)] sm:block">Ei tulevia pelejä kalenterissa.</p>
          ) : null}
        </div>
        {stats && (
          <dl className="grid flex-1 grid-cols-5 gap-1.5 sm:gap-3">
            <Stat label="Treenit" value={stats.trainings} i={1} />
            <Stat label="Pelit" value={stats.g.games} i={2} />
            <Stat label="V–T–H" value={`${stats.g.wins}–${stats.g.draws}–${stats.g.losses}`} i={3} />
            <Stat label="Maalit" value={`${stats.g.goalsFor}–${stats.g.goalsAgainst}`} i={4} />
            <Stat
              label={
                <>
                  <span className="sm:hidden">{profile.name || 'Maalit'} ⚽</span>
                  <span className="hidden sm:inline">{goalsLabel(profile.name)} ⚽</span>
                </>
              }
              value={stats.g.playerGoals}
              i={5}
            />
          </dl>
        )}
        {/* Puhelimella seuraava peli yhtenä rivinä lukujen alla. */}
        {next ? (
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-white/[0.1] px-2.5 py-2 ring-1 ring-white/10 sm:hidden">
            <IconTrophy size="1rem" className="shrink-0 text-[var(--hero-accent)]" />
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[var(--hero-ink-soft)]">Seuraava</span>
            <span className="min-w-0 truncate text-[13px] font-semibold">
              {next.fixture?.opponent ? `vs ${next.fixture.opponent}` : next.fixture?.eventName ?? 'Peli'} · {dayLabel(next.plan.date)}
              {next.plan.startTime && ` klo ${next.plan.startTime}`}
            </span>
          </div>
        ) : fixtures ? (
          <p className="text-[13px] text-[var(--hero-ink-soft)] sm:hidden">Ei tulevia pelejä kalenterissa.</p>
        ) : null}
      </div>
    </section>
  );
}

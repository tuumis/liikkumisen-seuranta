// Jalkapallo-välilehden yläkortti (uusi rakenne 27.11.2026, käyttäjän hyväksymä): seuraava peli juoksevalla
// laskurilla, kaksi seuraavaa tulevaa ja kauden tunnusluvut. Leveällä yksi matala rivi (otsikko | seuraava peli |
// tulevat | luvut); kapeammalla tulevat avautuvat "+n tulevaa" -painikkeesta, ja puhelimella kortti on kompakti.
// Tulokset ovat joukkueen tuloksia; luvut eivät vaikuta liikunta-arvioihin.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { seasonPeriod } from '../../domain/dates';
import { HOME_AWAY_LABEL, footballKindOf, gameRows, seasonKey, summarizeGames } from '../../domain/football';
import {
  FIXTURE_KIND_LABEL,
  countdownOf,
  daysUntilLabel,
  fixtureTitle,
  nextFixtures,
  recentForm,
  splitMs,
} from '../../domain/nextGames';
import { previewCard } from '../../domain/previewCard';
import type { ISODate, Profile, Session } from '../../domain/types';
import { repo, type FixtureEntry } from '../../db/repositories';
import { dayLabel } from '../../ui/format';
import { IconEye, IconEyeOff, IconPlus, IconShare, IconSparkle, IconTrophy } from '../../ui/icons';
import { openCoachShare } from '../coach/CoachShare';
import { CountUp } from '../../ui/CountUp';
import { today as todayFn } from '../../ui/today';
import { useFootball } from '../football/useFootball';
import { FootballPanel } from '../football/FootballPanel';
import { goalsLabel } from '../../ui/labels';
import { dispatchCommand } from '../desktop/commands';
import { heroThemeProps } from '../week/HeroThemePicker';
import { useIsDark } from '../../ui/theme';
import { useStoredFlag } from '../../ui/storedPref';
import { useToast } from '../../ui/Toast';
import { playSound } from '../../ui/sound';

const OUTCOME_LETTER = { W: 'V', D: 'T', L: 'H' } as const;
const OUTCOME_WORD = { W: 'voitto', D: 'tasapeli', L: 'häviö' } as const;
const clock = (t?: string) => t?.replace(/^0(\d)/, '$1').replace(':', '.');

/** Kellonaika, joka päivittyy annetuin välein (laskuri). */
function useNow(ms: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

// Luvut: puhelimella viisi pientä ruutua rivissä, leveämmällä kolme saraketta kahdella rivillä (container fh).
function Stat({ label, value, i, className = '' }: { label: ReactNode; value: ReactNode; i: number; className?: string }) {
  return (
    <div className={`hero-glass anim-rise min-w-0 rounded-2xl px-1 py-1.5 text-center @min-[40rem]/fh:px-2 @min-[40rem]/fh:py-2 @min-[40rem]/fh:text-left ${className}`} style={{ ['--i' as string]: i }}>
      <dt className="truncate text-[9.5px] font-bold uppercase tracking-wide text-[var(--hero-ink-soft)] @min-[40rem]/fh:text-[10px]">{label}</dt>
      <dd className="stat mt-0.5 whitespace-nowrap text-[17px] font-semibold @min-[40rem]/fh:mt-1 @min-[68rem]/fh:text-[21px] @min-[80rem]/fh:text-[25px]">{value}</dd>
    </div>
  );
}

const num = (n: number) => <CountUp value={n} format={(v) => String(Math.round(v))} />;

/** Juokseva laskuri tai tila: käynnissä / kirjaa tulos / päiviä jäljellä (ei kellonaikaa). */
function Countdown({ e, onRecord }: { e: FixtureEntry; onRecord: () => void }) {
  const now = useNow(1000);
  const c = countdownOf(e, now);
  if (c.state === 'live')
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--hero-accent)] px-3 py-1.5 text-sm font-bold text-[var(--hero-accent-ink)]">
        <span className="size-2 animate-pulse rounded-full bg-current motion-reduce:animate-none" aria-hidden />
        Peli käynnissä
      </span>
    );
  if (c.state === 'ended')
    return (
      <button
        type="button"
        onClick={onRecord}
        className="press hit inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[var(--hero-accent)] px-4 text-sm font-bold text-[var(--hero-accent-ink)] shadow-md hover:brightness-105"
      >
        Kirjaa tulos
      </button>
    );
  if (c.state === 'day')
    return (
      <span className="text-right">
        <span className="stat block text-[22px] font-semibold leading-none @min-[40rem]/fh:text-[26px]">{c.days === 0 ? 'Tänään' : c.days === 1 ? 'Huomenna' : `${c.days} pv`}</span>
        <span className="mt-1 block text-[11px] text-[var(--hero-ink-soft)]">kellonaika puuttuu</span>
      </span>
    );
  const p = splitMs(c.ms);
  const parts: [number, string, string][] = [
    [p.days, 'pv', ''],
    [p.hours, 'h', ''],
    [p.minutes, 'min', ''],
    // Sekunnit vain leveämmällä (puhelimella rauhallisempi).
    [p.seconds, 's', 'hidden @min-[40rem]/fh:block'],
  ];
  return (
    <span role="timer" aria-label={`Alkuun ${p.days} päivää ${p.hours} tuntia ${p.minutes} minuuttia`} className="flex items-start gap-1 @min-[40rem]/fh:gap-1.5">
      {parts.map(([v, unit, cls]) => (
        <span key={unit} className={`text-center ${cls}`} aria-hidden>
          <span className="hero-glass stat block min-w-[2.25rem] rounded-xl px-1.5 py-1 text-[20px] font-semibold leading-none tabular-nums @min-[40rem]/fh:min-w-[2.6rem] @min-[40rem]/fh:text-[24px] @min-[80rem]/fh:text-[28px]">
            {unit === 'pv' ? v : String(v).padStart(2, '0')}
          </span>
          <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-[var(--hero-ink-soft)]">{unit}</span>
        </span>
      ))}
    </span>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="hero-glass whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold">{children}</span>;
}

/** Tulevan pelin rivi (tulevat-sarake ja "+n tulevaa" -lista). */
function UpcomingRow({ e, today, onOpen }: { e: FixtureEntry; today: ISODate; onOpen?: (e: FixtureEntry) => void }) {
  const card = previewCard(e.plan, e.fixture);
  const home = card.kind === 'game' ? card.games[0]?.homeAway : undefined;
  const meta = [
    dayLabel(e.plan.date),
    card.kickoff ?? e.plan.startTime ? `klo ${clock(card.kickoff ?? e.plan.startTime)}` : undefined,
    card.kind === 'tournament' ? `${card.games.length || e.fixture?.gamesCount || ''} ${card.games.length === 1 ? 'peli' : 'peliä'}`.trim() : home ? HOME_AWAY_LABEL[home] : undefined,
  ].filter(Boolean);
  return (
    <li>
      <button type="button" onClick={() => onOpen?.(e)} className="press hero-glass flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left hover:brightness-110">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">{fixtureTitle(card)}</span>
          <span className="block truncate text-[11.5px] text-[var(--hero-ink-soft)]">{meta.join(' · ')}</span>
        </span>
        <span className="shrink-0 text-[11.5px] font-semibold text-[var(--hero-ink-soft)]">{daysUntilLabel(e.plan.date, today)}</span>
      </button>
    </li>
  );
}

export function FootballHero({ profile, onOpen, onAdd }: { profile: Profile; onOpen?: (e: FixtureEntry) => void; onAdd?: () => void }) {
  const today = todayFn();
  // Sama teema kuin Viikko-näkymän pääkortissa (profiilin valinta, vaalea / tumma tila; 24.11.2026).
  const theme = heroThemeProps(profile, useIsDark());
  const season = seasonPeriod(today);
  const data = useFootball(profile.id, season.start, season.end);
  const fixtures = useLiveQuery(() => repo.listFixtures(profile.id, today), [profile.id, today]);
  const upcoming = useMemo(() => (fixtures ? nextFixtures(fixtures, today) : undefined), [fixtures, today]);
  const next = upcoming?.[0];
  const rest = upcoming?.slice(1) ?? [];
  // Omat maalit piiloon tarvittaessa (junnupeleissä maalintekijöitä on vaikea seurata); laitekohtainen.
  const [showGoals, setShowGoals] = useStoredFlag('heroPlayerGoals', true);
  const [more, setMore] = useState(false);
  const [panel, setPanel] = useState<Session | null>(null);
  const toast = useToast();

  const stats = useMemo(() => {
    if (!data) return null;
    const trainings = data.sessions.filter((s) => !s.deletedAt && footballKindOf(s, data.types) === 'training' && !s.linkedTo).length;
    const rows = gameRows(data.sessions, data.details, data.types);
    return { trainings, g: summarizeGames(rows), form: recentForm(rows) };
  }, [data]);

  async function record(e: FixtureEntry) {
    try {
      const r = await repo.confirmPlanned(e.plan.id, today);
      if (r.created) playSound('confirm');
      setPanel(r.session);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    }
  }

  const nextCard = next ? previewCard(next.plan, next.fixture) : undefined;
  const nextHome = nextCard?.kind === 'game' ? nextCard.games[0]?.homeAway : undefined;
  const nextTime = nextCard?.kickoff ?? next?.plan.startTime;

  return (
    <section className="hero anim-rise @container/fh p-3.5 sm:p-5" data-hero={theme['data-hero']} style={theme.style} aria-label="Kauden yhteenveto">
      <div className="relative z-10 grid gap-2.5 @min-[40rem]/fh:grid-cols-[11.5rem_minmax(0,1.25fr)_minmax(0,1.1fr)] @min-[40rem]/fh:gap-3.5 @min-[62rem]/fh:grid-cols-[12.5rem_minmax(0,1.3fr)_minmax(0,0.95fr)_minmax(0,1.15fr)] @min-[80rem]/fh:gap-4">
        {/* Otsikko ja painikkeet */}
        <div className="flex min-w-0 items-center justify-between gap-3 @min-[40rem]/fh:flex-col @min-[40rem]/fh:items-start @min-[40rem]/fh:justify-start">
          <div className="min-w-0">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--hero-ink-soft)] sm:text-[11px]">{seasonKey(today)}</div>
            <div className="mt-0.5 font-display text-[17px] font-semibold leading-snug sm:text-xl @min-[80rem]/fh:text-2xl">Kausi tähän mennessä</div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 @min-[40rem]/fh:mt-1 @min-[40rem]/fh:flex-col @min-[40rem]/fh:items-start @min-[40rem]/fh:gap-2">
            <button
              type="button"
              onClick={() => dispatchCommand({ kind: 'story' })}
              className="press hit inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--hero-accent)] px-3 text-xs font-bold text-[var(--hero-accent-ink)] shadow-md hover:brightness-105 sm:gap-2 sm:px-3.5"
            >
              <IconSparkle size="0.95rem" /> Kauden kooste
            </button>
            {/* Kokonaiskuormitus valmentajalle (25.11.2026); puhelimella pelkkä kuvake. */}
            <button
              type="button"
              onClick={() => openCoachShare(profile.id)}
              aria-label="Jaa valmentajalle"
              className="press hit hero-glass-strong inline-flex size-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-xs font-bold sm:w-auto sm:px-3.5"
            >
              <IconShare size="0.95rem" /> <span className="hidden sm:inline">Jaa valmentajalle</span>
            </button>
          </div>
        </div>

        {/* Seuraava peli ja laskuri */}
        <div className="hero-glass-strong flex min-w-0 flex-col justify-between gap-2 rounded-2xl p-2.5 @min-[40rem]/fh:p-3">
          {!fixtures ? (
            <div className="h-16" aria-busy="true" aria-label="Ladataan" />
          ) : next && nextCard ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--hero-ink-soft)]">
                  <IconTrophy size="0.9rem" className="text-[var(--hero-accent)]" /> Seuraava peli
                </span>
                {/* Leveällä lajin merkit; kapeammalla tilalla "+n tulevaa" (kortti ei kasva korkeutta). */}
                <span className="hidden min-w-0 gap-1 overflow-hidden @min-[62rem]/fh:flex">
                  <Chip>{FIXTURE_KIND_LABEL[nextCard.kind]}</Chip>
                  {nextCard.level && <Chip>{nextCard.level}</Chip>}
                  {nextCard.series && <Chip>{nextCard.series}</Chip>}
                </span>
                {rest.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMore((v) => !v)}
                    aria-expanded={more}
                    className="press hit hero-glass -my-1 shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold @min-[62rem]/fh:hidden"
                  >
                    {more ? 'Piilota tulevat' : `+ ${rest.length} ${rest.length === 1 ? 'tuleva' : 'tulevaa'}`}
                  </button>
                )}
              </div>
              <div className="flex items-end justify-between gap-3 @min-[40rem]/fh:flex-col @min-[40rem]/fh:items-stretch @min-[40rem]/fh:gap-2.5">
                <button type="button" onClick={() => onOpen?.(next)} className="press min-w-0 flex-1 text-left hover:opacity-90" aria-label={`${fixtureTitle(nextCard)}, avaa tiedot`}>
                  <span className="block truncate font-display text-base font-semibold leading-tight @min-[40rem]/fh:text-lg">{fixtureTitle(nextCard)}</span>
                  {/* Aika selvästi (myös puhelimella): päivä ja kellonaika vahvemmalla tekstillä. */}
                  <span className="mt-0.5 block truncate text-[13px] font-semibold">
                    {dayLabel(next.plan.date)}
                    {nextTime ? ` klo ${clock(nextTime)}` : ''}
                    {nextHome ? <span className="font-normal text-[var(--hero-ink-soft)]"> · {HOME_AWAY_LABEL[nextHome]}</span> : null}
                  </span>
                  {nextCard.location && <span className="block truncate text-[12px] text-[var(--hero-ink-soft)]">{nextCard.location}</span>}
                </button>
                <span className="shrink-0">
                  <Countdown e={next} onRecord={() => void record(next)} />
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--hero-ink-soft)]">Ei tulevia pelejä kalenterissa.</p>
              {onAdd && (
                <button type="button" onClick={onAdd} className="press hit hero-glass inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold">
                  <IconPlus size="0.95rem" /> Lisää peli
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tulevat (vain leveällä omana sarakkeenaan) */}
        <div className="hidden min-w-0 @min-[62rem]/fh:block">
          <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[var(--hero-ink-soft)]">Tulevat</div>
          {rest.length ? (
            <ul className="space-y-1.5">
              {rest.map((e) => (
                <UpcomingRow key={e.plan.id} e={e} today={today} onOpen={onOpen} />
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-[var(--hero-ink-soft)]">{fixtures ? 'Ei muita tulevia pelejä.' : ''}</p>
          )}
        </div>

        {/* Kapeammalla avattava lista tulevista; leveällä riveistä alimpana */}
        {more && rest.length > 0 && (
          <ul className="space-y-1.5 @min-[40rem]/fh:order-last @min-[40rem]/fh:col-span-full @min-[62rem]/fh:hidden">
            {rest.map((e) => (
              <UpcomingRow key={e.plan.id} e={e} today={today} onOpen={onOpen} />
            ))}
          </ul>
        )}

        {/* Kauden luvut */}
        {stats ? (
          <dl className="grid grid-cols-5 gap-1.5 @min-[40rem]/fh:grid-cols-3 @min-[40rem]/fh:gap-2">
            <Stat label="Pelit" value={num(stats.g.games)} i={1} />
            <Stat label="V–T–H" value={`${stats.g.wins}–${stats.g.draws}–${stats.g.losses}`} i={2} />
            <Stat label="Maalit" value={`${stats.g.goalsFor}–${stats.g.goalsAgainst}`} i={3} />
            <Stat label="Treenit" value={num(stats.trainings)} i={4} />
            <Stat
              className="hidden @min-[40rem]/fh:block"
              label="Viimeiset"
              i={5}
              value={
                stats.form.length ? (
                  <span className="flex gap-1 pt-0.5" aria-label={`Viimeiset pelit: ${stats.form.map((r) => OUTCOME_WORD[r.outcome]).join(', ')}`}>
                    {stats.form.map((r) => (
                      <span
                        key={`${r.sessionId}-${r.index ?? 0}`}
                        title={`${dayLabel(r.date)}${r.opponent ? ` vs ${r.opponent}` : ''} ${r.goalsFor}–${r.goalsAgainst}`}
                        className={`flex size-[1.35rem] items-center justify-center rounded-full text-[11px] font-bold not-italic ${
                          r.outcome === 'W' ? 'bg-[var(--hero-accent)] text-[var(--hero-accent-ink)]' : r.outcome === 'D' ? 'hero-glass-strong' : 'ring-1 ring-inset ring-[var(--hero-line)]'
                        }`}
                        aria-hidden
                      >
                        {OUTCOME_LETTER[r.outcome]}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-[13px] font-normal text-[var(--hero-ink-soft)]">ei vielä</span>
                )
              }
            />
            {/* Omat maalit: napautus piilottaa tai näyttää (muistetaan laitteella). */}
            <div className="hero-glass anim-rise min-w-0 rounded-2xl" style={{ ['--i' as string]: 6 }}>
              <button
                type="button"
                onClick={() => setShowGoals(!showGoals)}
                aria-pressed={showGoals}
                aria-label={showGoals ? `${goalsLabel(profile.name)}: ${stats.g.playerGoals}. Piilota` : `${goalsLabel(profile.name)} piilotettu. Näytä`}
                title={showGoals ? 'Piilota omat maalit' : 'Näytä omat maalit'}
                className="press block w-full px-1 py-1.5 text-center @min-[40rem]/fh:px-2 @min-[40rem]/fh:py-2 @min-[40rem]/fh:text-left"
              >
                <span className="flex items-center justify-center gap-1 @min-[40rem]/fh:justify-between">
                  <span className="truncate text-[9.5px] font-bold uppercase tracking-wide text-[var(--hero-ink-soft)] @min-[40rem]/fh:text-[10px]">
                    <span className="@min-[40rem]/fh:hidden">{profile.name || 'Maalit'}</span>
                    <span className="hidden @min-[40rem]/fh:inline">{goalsLabel(profile.name)}</span>
                  </span>
                  <span className="hidden shrink-0 text-[var(--hero-ink-soft)] @min-[40rem]/fh:inline">{showGoals ? <IconEye size="0.95rem" /> : <IconEyeOff size="0.95rem" />}</span>
                </span>
                <span className="stat mt-0.5 flex items-center justify-center gap-1 whitespace-nowrap text-[17px] font-semibold @min-[40rem]/fh:mt-1 @min-[40rem]/fh:justify-start @min-[68rem]/fh:text-[21px] @min-[80rem]/fh:text-[25px]">
                  {showGoals ? num(stats.g.playerGoals) : <IconEyeOff size="1.1rem" className="text-[var(--hero-ink-soft)]" />}
                </span>
              </button>
            </div>
          </dl>
        ) : (
          <div className="h-14" />
        )}
      </div>
      <FootballPanel session={panel} type={panel && data ? data.types.get(panel.activityTypeId) : undefined} onClose={() => setPanel(null)} />
    </section>
  );
}

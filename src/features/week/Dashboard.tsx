// Etusivun kortit: päivittäinen jakauma, viikon rytmi (rasittava, lihas, luusto), tulevat
// suunnitellut kerrat ja viimeisimmät kirjaukset. Pelkkää esitystä; luvut tulevat raportista.

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, isoWeekday } from '../../domain/dates';
import { mvpaOf } from '../../domain/intensity';
import type { PeriodReport } from '../../domain/report';
import type { ActivityType, ISODate, PlannedSession, Profile, Session, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { EmptyState, SectionLabel } from '../../ui/components';
import { dayLabel, formatDate } from '../../ui/format';
import { IconBolt, IconBone, IconCalendarClock, IconHistory, IconLeaf } from '../../ui/icons';
import { useMounted } from '../../ui/motion';
import { Term } from '../../ui/glossary';
import { Collapse, CollapseToggle, useCollapsible } from '../../ui/Collapse';

const WD = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];

const median = (xs: number[]) => {
  const v = xs.filter((x) => x > 0).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
};

/** Lajin ikoni pehmeässä ruudussa (lajien ikonit ovat käyttäjän muokattavia emojeja). */
export function TypeIcon({ t, muted = false, size = 'md' }: { t?: ActivityType; muted?: boolean; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl ${size === 'sm' ? 'size-9 text-lg' : 'size-11 text-xl'} ${
        muted ? 'bg-[var(--surface-sunk)] grayscale-[0.6]' : 'bg-[var(--surface-sage)] shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.06)]'
      }`}
      aria-hidden
    >
      {t?.icon ?? '•'}
    </span>
  );
}

// ---------- päivittäinen jakauma ----------

export function DailyChart({ report, today, target, title }: { report: PeriodReport; today: ISODate; target: number; title: string }) {
  const mounted = useMounted();
  const [hover, setHover] = useState<number | null>(null);
  // Näkymä: reipas ja rasittava (suositusvertailu) tai kaikki liikunta kestona (myös kevyt).
  const [mode, setMode] = useState<'mvpa' | 'total'>('mvpa');
  const hours = report.hours.days;
  const days = report.allDays.map((d, i) =>
    mode === 'mvpa'
      ? { date: d.date, total: d.mvpaCombined, logged: d.mvpa }
      : { date: d.date, total: hours[i]?.actualMin ?? 0, logged: hours[i]?.actualLoggedMin ?? 0 },
  );
  const showTarget = mode === 'mvpa';
  const peak = Math.max(...days.map((d) => d.total));
  // Asteikko enintään 2,5 × tavoite, jottei yksi pitkä turnauspäivä litistä muita; ylittävä palkki saa arvon yläpuolelleen.
  const max = (showTarget ? Math.max(target * 1.4, Math.min(target * 2.5, peak)) : Math.max(60, Math.min(peak, Math.max(120, median(days.map((d) => d.total)) * 3)))) || 1;
  const h = 168;
  const y = (v: number) => (Math.min(v, max) / max) * h;
  const anyEstimate = days.some((d) => d.total > d.logged);
  const active = hover ?? days.findIndex((d) => d.date === today);
  const ad = active >= 0 ? days[active] : undefined;

  return (
    <section className="card anim-rise p-4 sm:p-5 lg:p-6" style={{ ['--i' as string]: 2 }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <SectionLabel>Päivittäin</SectionLabel>
          <h2 className="font-display text-lg font-semibold text-slate-900">{mode === 'mvpa' ? title : 'Kaikki liikunta'}</h2>
          <div className="mt-2 inline-flex rounded-xl bg-[var(--surface-sunk)] p-0.5 text-[11px] font-bold" role="radiogroup" aria-label="Kaavion sisältö">
            {(
              [
                ['mvpa', 'Reipas + rasittava'],
                ['total', 'Kaikki liikunta'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={mode === k}
                onClick={() => setMode(k)}
                className={`press min-h-8 rounded-[10px] px-3 py-1.5 ${mode === k ? 'bg-[var(--surface-raised)] text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {ad && (
          <div className="text-right" aria-live="polite">
            <div className="stat text-2xl font-semibold text-slate-900">
              {ad.total}
              <span className="ml-1 font-sans text-xs font-semibold tracking-normal text-slate-500">min</span>
            </div>
            <div className="text-[11px] text-slate-500">
              {dayLabel(ad.date)}
              {ad.total > ad.logged && ` · arviota ${ad.total - ad.logged}`}
            </div>
          </div>
        )}
      </div>

      <div className="relative" style={{ height: h + 28 }} onMouseLeave={() => setHover(null)}>
        {/* tavoiteviiva */}
        {showTarget && (
          <div className="absolute inset-x-0 border-t-2 border-dashed border-[var(--viz-track-line)]" style={{ bottom: 28 + y(target) }} aria-hidden>
            <span className="absolute -top-5 right-0 rounded-md bg-[var(--surface)] px-1 text-[10.5px] font-semibold text-slate-500">tavoite {Math.round(target)}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 grid grid-cols-7 gap-1.5 sm:gap-3" role="list" aria-label={mode === 'mvpa' ? 'Reipas ja rasittava liikunta päivittäin' : 'Kaikki liikunta päivittäin'}>
          {days.map((d, i) => {
            const future = d.date > today;
            const est = Math.max(0, d.total - d.logged);
            const isToday = d.date === today;
            return (
              <button
                key={d.date}
                type="button"
                role="listitem"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => setHover(i)}
                className="group flex flex-col items-center justify-end gap-2 focus-visible:outline-offset-4"
                aria-label={`${dayLabel(d.date)}: ${d.total} min${est ? `, josta arvio ${est}` : ''}`}
                style={{ height: h + 28 }}
              >
                <div key={mode} className="relative flex w-full max-w-9 flex-col-reverse items-stretch" style={{ height: h }}>
                  {future ? (
                    <div className="mt-auto h-1.5 rounded-full bg-[var(--viz-track)]" />
                  ) : d.total === 0 ? (
                    <div className="mt-auto h-1.5 rounded-full bg-[var(--viz-track)]" />
                  ) : (
                    <div
                      className="relative mt-auto flex flex-col-reverse gap-[2px] transition-transform duration-700 [transition-timing-function:var(--ease-out)]"
                      style={{ height: y(d.total), transform: mounted ? 'scaleY(1)' : 'scaleY(0)', transformOrigin: 'bottom', transitionDelay: `${i * 50 + 100}ms` }}
                    >
                      {d.logged > 0 && (
                        <div
                          className={`rounded-b-[4px] ${est ? '' : 'rounded-t-[6px]'} transition-opacity ${active === i ? '' : 'opacity-85'}`}
                          style={{ height: `${(d.logged / d.total) * 100}%`, background: 'var(--viz-logged)' }}
                        />
                      )}
                      {est > 0 && <div className={`flex-1 rounded-t-[6px] ${d.logged ? '' : 'rounded-b-[4px]'}`} style={{ background: 'var(--viz-estimate)' }} />}
                      {d.total > max && (
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-md bg-[var(--surface)] px-1 text-[10px] font-bold text-slate-700 tabular-nums">{d.total}</span>
                      )}
                    </div>
                  )}
                </div>
                <span className={`flex h-5 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${isToday ? 'bg-green-700 text-white' : active === i ? 'text-slate-900' : 'text-slate-500'}`}>
                  {WD[isoWeekday(d.date) - 1]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: 'var(--viz-logged)' }} /> Kirjattu
        </span>
        {anyEstimate && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: 'var(--viz-estimate)' }} /> Arkiliikunta (arvio)
          </span>
        )}
        {showTarget ? (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-[var(--viz-track-line)]" /> Päivätavoite
          </span>
        ) : (
          <span className="text-slate-500">Kesto minuutteina, myös kevyt liikunta</span>
        )}
      </div>
    </section>
  );
}

// ---------- viikon rytmi ----------

export function RhythmCard({ report, today }: { report: PeriodReport; today: ISODate }) {
  const group = report.group.group;
  if (group === 'early_years') return null;
  const min = report.vigorousDay.min;
  const rows = [
    ...(group === 'school_age'
      ? [{ key: 'vig', term: 'vigorous_day' as const, label: 'Rasittava päivä', sub: `≥ ${min} min`, Icon: IconBolt, on: (i: number) => report.allDays[i].logged.vigorous >= min, target: 3 }]
      : []),
    { key: 'mus', term: 'muscle' as const, label: 'Lihaksia vahvistava', sub: 'kirjattu kerta', Icon: IconLeaf, on: (i: number) => report.allDays[i].muscle, target: group === 'adult' ? 2 : 3 },
    ...(group === 'school_age' ? [{ key: 'bone', term: 'bone' as const, label: 'Luustoa vahvistava', sub: 'kirjattu kerta', Icon: IconBone, on: (i: number) => report.allDays[i].bone, target: 3 }] : []),
  ];

  return (
    <section className="card anim-rise p-4 sm:p-5 lg:p-6" style={{ ['--i' as string]: 3 }}>
      <SectionLabel>Viikon rytmi</SectionLabel>
      <h2 className="font-display text-lg font-semibold text-slate-900">Rasittava ja vahvistava</h2>
      <div className="mt-4 space-y-4">
        {rows.map((r, ri) => {
          const count = report.allDays.filter((_, i) => r.on(i)).length;
          return (
            <div key={r.key}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <r.Icon size="1rem" className="text-green-700 dark:text-green-400" />
                  <Term id={r.term} vigorousMin={min} align="left">
                    {r.label}
                  </Term>
                  <span className="text-xs font-medium text-slate-500">{r.sub}</span>
                </span>
                <span className={`stat text-lg font-semibold ${count >= r.target ? 'text-green-700 dark:text-green-400' : 'text-slate-900'}`}>
                  {count}
                  <span className="font-sans text-xs font-semibold tracking-normal text-slate-500">/{r.target}</span>
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {report.allDays.map((d, i) => {
                  const on = r.on(i);
                  const future = d.date > today;
                  return (
                    <div
                      key={d.date}
                      className={`anim-pop flex h-8 items-center justify-center rounded-xl text-[10.5px] font-bold ${
                        on ? 'bg-green-700 text-white shadow-[0_4px_10px_-4px_rgb(var(--accent-rgb)/0.6)]' : future ? 'border border-dashed border-slate-300 text-slate-400' : 'bg-[var(--surface-sunk)] text-slate-500'
                      }`}
                      style={{ animationDelay: `${ri * 120 + i * 40 + 200}ms` }}
                      title={`${dayLabel(d.date)}: ${on ? 'kyllä' : 'ei'}`}
                    >
                      {WD[i]}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- tulevat suunnitellut kerrat ----------

export function UpcomingCard({
  profile,
  today,
  types,
  onOpen,
}: {
  profile: Profile;
  today: ISODate;
  types: Map<UUID, ActivityType>;
  onOpen: (p: PlannedSession) => void;
}) {
  const to = addDays(today, 13);
  const plans = useLiveQuery(() => repo.plansInRange(profile.id, today, to), [profile.id, today, to]);
  const fixtures = useLiveQuery(() => repo.listFixtures(profile.id, today, to), [profile.id, today, to]);
  const fx = new Map((fixtures ?? []).filter((e) => e.fixture).map((e) => [e.plan.id, e.fixture!]));
  const [open, toggle] = useCollapsible('upcoming');
  const list = (plans ?? [])
    .filter((p) => p.status === 'open')
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '99').localeCompare(b.startTime ?? '99'))
    .slice(0, 5);

  return (
    <section className="card anim-rise p-4 sm:p-5" style={{ ['--i' as string]: 4 }}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <SectionLabel>Seuraavaksi</SectionLabel>
          <h2 className="font-display text-lg font-semibold text-slate-900">Tulevat kerrat</h2>
        </div>
        <div className="flex items-center gap-2">
          {!open && <span className="text-sm font-semibold text-slate-600">{list.length} tulossa</span>}
          <CollapseToggle open={open} onToggle={toggle} label="Tulevat kerrat" />
        </div>
      </div>
      <Collapse open={open}>
      {plans && list.length === 0 ? (
        <EmptyState icon={<IconCalendarClock size="1.4rem" />} title="Ei suunniteltuja kertoja">
          Lisää toistuvat treenit Asetusten Viikkorytmiin, niin ne näkyvät tässä valmiina kuitattaviksi.
        </EmptyState>
      ) : (
        <ul className="mt-3 space-y-1">
          {list.map((p) => {
            const t = types.get(p.activityTypeId);
            const f = fx.get(p.id);
            const isToday = p.date === today;
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onOpen(p)} className="press flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-[var(--surface-sunk)]">
                  <span className={`flex w-12 shrink-0 flex-col items-center rounded-xl py-1 ${isToday ? 'bg-green-700 text-white' : 'bg-[var(--surface-sunk)] text-slate-700'}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{isToday ? 'tänään' : formatDate(p.date, 'EEEEEE')}</span>
                    <span className="stat text-lg font-semibold">{Number(p.date.slice(8, 10))}</span>
                  </span>
                  <TypeIcon t={t} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{f?.opponent ? `vs ${f.opponent}` : f?.eventName ?? p.label ?? t?.name ?? 'Laji'}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {f || p.label ? `${t?.name ?? ''} · ` : ''}
                      {p.startTime ? `klo ${p.startTime} · ` : ''}
                      {p.durationMin} min
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      </Collapse>
    </section>
  );
}

// ---------- viimeisimmät kirjaukset ----------

export function RecentCard({ profile, today, types, onOpen }: { profile: Profile; today: ISODate; types: Map<UUID, ActivityType>; onOpen: (s: Session) => void }) {
  const from = addDays(today, -30);
  const sessions = useLiveQuery(() => repo.sessionsInRange(profile.id, from, today), [profile.id, from, today]);
  const [open, toggle] = useCollapsible('recent');
  const list = [...(sessions ?? [])].filter((s) => s.durationMin > 0).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <section className="card anim-rise p-4 sm:p-5" style={{ ['--i' as string]: 5 }}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <SectionLabel>Viimeksi</SectionLabel>
          <h2 className="font-display text-lg font-semibold text-slate-900">Viimeisimmät kirjaukset</h2>
        </div>
        <CollapseToggle open={open} onToggle={toggle} label="Viimeisimmät kirjaukset" />
      </div>
      <Collapse open={open}>
      {sessions && list.length === 0 ? (
        <EmptyState icon={<IconHistory size="1.4rem" />} title="Ei vielä kirjauksia">
          Kirjatut liikuntakerrat näkyvät tässä uusin ensin.
        </EmptyState>
      ) : (
        <ul className="mt-3 space-y-1">
          {list.map((s) => {
            const t = types.get(s.activityTypeId);
            return (
              <li key={s.id}>
                <button type="button" onClick={() => onOpen(s)} className="press flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-[var(--surface-sunk)]">
                  <TypeIcon t={t} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{s.label ?? t?.name ?? 'Laji'}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {dayLabel(s.date)}
                      {s.label && ` · ${t?.name ?? ''}`}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="stat block text-base font-semibold text-slate-900">
                      {s.durationMin}
                      <span className="font-sans text-[11px] font-semibold tracking-normal text-slate-500"> min</span>
                    </span>
                    <span className="block text-[11px] text-slate-500">{s.intensitySource === 'manual' ? '' : 'arvio '}reipas+ {mvpaOf(s.minutes)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      </Collapse>
    </section>
  );
}

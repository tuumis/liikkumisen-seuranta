// Jakson kohokohdat: yleisarvio suoritustasosta (vanhemman arviot suhteessa omaan tavalliseen
// tasoon), viihtyminen, harjoitellut asiat ja kommentit viikolta, kuukaudelta tai kaudelta.

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, monthPeriod, seasonPeriod } from '../../domain/dates';
import { seasonKey } from '../../domain/football';
import { highlights, ratingVerdict, type RatingVerdict } from '../../domain/highlights';
import type { ActivityType, Period, Profile, UUID } from '../../domain/types';
import { repo } from '../../db/repositories';
import { EmptyState, SectionLabel } from '../../ui/components';
import { dayLabel, formatDate } from '../../ui/format';
import { IconSparkle } from '../../ui/icons';
import { ENJOYMENT_LABEL, FOCUS_TAG_LABEL, goalsLabel } from '../../ui/labels';
import { useCountUp } from '../../ui/motion';
import { TypeIcon } from '../week/Dashboard';

type Scope = 'week' | 'month' | 'season';

const VERDICT: Record<RatingVerdict, { label: string; text: string; cls: string }> = {
  above: { label: 'Tavallista parempi', text: 'Arviot ovat olleet keskimäärin tavallista omaa tasoa parempia.', cls: 'bg-green-700 text-white' },
  usual: { label: 'Tavallinen oma taso', text: 'Arviot ovat olleet keskimäärin lapsen tavallisella tasolla.', cls: 'bg-green-100 text-green-900' },
  below: { label: 'Tavallista heikompi', text: 'Arviot ovat olleet keskimäärin tavallista matalampia – esim. väsymys tai uusi asia voi selittää.', cls: 'bg-amber-100 text-amber-900' },
};

const days = (p: Period) => Math.round((Date.parse(p.end) - Date.parse(p.start)) / 86_400_000) + 1;

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative text-xl leading-none text-slate-300">
            ★
            <span className="absolute inset-0 overflow-hidden text-amber-500" style={{ width: `${fill * 100}%` }}>
              ★
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function HighlightsCard({ profile, week, className = '' }: { profile: Profile; week: Period; className?: string }) {
  const [scope, setScope] = useState<Scope>('week');
  const [showAll, setShowAll] = useState(false);
  const period: Period = scope === 'week' ? week : scope === 'month' ? monthPeriod(addDays(week.start, 3)) : seasonPeriod(addDays(week.start, 3));
  const len = days(period);
  const prevFrom = addDays(period.start, -len);

  const data = useLiveQuery(async () => {
    const [sessions, types] = await Promise.all([repo.sessionsInRange(profile.id, prevFrom, period.end), repo.listActivityTypes({ includeArchived: true })]);
    const details = await repo.footballDetailsFor(sessions.map((s) => s.id));
    return { sessions, details, types: new Map<UUID, ActivityType>(types.map((t) => [t.id, t])) };
  }, [profile.id, prevFrom, period.end]);

  const h = useMemo(() => (data ? highlights(data.sessions, data.details, period.start, period.end) : null), [data, period.start, period.end]);
  const prev = useMemo(() => (data ? highlights(data.sessions, data.details, prevFrom, addDays(period.start, -1)) : null), [data, prevFrom, period.start]);
  const avgShown = useCountUp(h?.rating.avg ?? 0);

  const scopeLabel = scope === 'week' ? 'viikolta' : scope === 'month' ? formatDate(period.start, 'LLLL') + 'lta' : 'kaudelta';
  const trend = h?.rating.avg != null && prev?.rating.avg != null ? h.rating.avg - prev.rating.avg : null;
  const comments = h ? (showAll ? h.comments : h.comments.slice(0, 5)) : [];
  const verdict = h ? ratingVerdict(h.rating.avg) : null;

  return (
    <section className={`card anim-rise p-4 sm:p-5 lg:p-6 ${className}`} aria-labelledby="hl-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionLabel>Kohokohdat</SectionLabel>
          <h2 id="hl-title" className="font-display text-lg font-semibold text-slate-900">
            Kommentit ja yleisarvio
          </h2>
        </div>
        <div className="inline-flex rounded-xl bg-[var(--surface-sunk)] p-0.5 text-[11px] font-bold" role="radiogroup" aria-label="Jakso">
          {(
            [
              ['week', 'Viikko'],
              ['month', 'Kuukausi'],
              ['season', 'Kausi'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={scope === k}
              onClick={() => {
                setScope(k);
                setShowAll(false);
              }}
              className={`press min-h-8 rounded-[10px] px-3 py-1.5 ${scope === k ? 'bg-[var(--surface-raised)] text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {scope === 'season' ? seasonKey(period.start) : `${formatDate(period.start, 'd.M.')} – ${formatDate(period.end, 'd.M.yyyy')}`} · {h?.sessions ?? 0} kertaa
      </p>

      {!h ? (
        <div className="mt-4 space-y-3">
          <div className="skeleton h-24" />
          <div className="skeleton h-16" />
        </div>
      ) : h.rating.count === 0 && h.comments.length === 0 ? (
        <EmptyState icon={<IconSparkle size="1.4rem" />} title={`Ei arvioita eikä kommentteja ${scopeLabel}`}>
          Anna jalkapallokerralle tähtiarvio tai kirjoita kommentti (Lisätiedot), niin yhteenveto näkyy tässä.
        </EmptyState>
      ) : (
        <>
          {h.rating.count > 0 && verdict && (
            <div className="card-sunk mt-4 flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div>
                  <div className="stat text-[44px] font-semibold text-slate-900">{avgShown.toFixed(1).replace('.', ',')}</div>
                  <Stars value={h.rating.avg ?? 0} />
                </div>
                <div className="min-w-0">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${VERDICT[verdict].cls}`}>{VERDICT[verdict].label}</span>
                  <p className="mt-1.5 text-xs leading-snug text-slate-600">{VERDICT[verdict].text}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {h.rating.count} {h.rating.count === 1 ? 'arvio' : 'arviota'}
                    {trend !== null && Math.abs(trend) >= 0.3 && ` · ${trend > 0 ? '↗ nousussa' : '↘ laskussa'} edelliseen jaksoon`}
                    {trend !== null && Math.abs(trend) < 0.3 && ' · samaa tasoa kuin edellinen jakso'}
                  </p>
                </div>
              </div>
              {/* Arvioiden jakauma 1–5 */}
              <div className="flex h-14 flex-1 items-end gap-1.5 sm:max-w-44" role="img" aria-label={`Arvioiden jakauma: ${h.rating.dist.map((n, i) => `${i + 1} tähteä ${n}`).join(', ')}`}>
                {h.rating.dist.map((n, i) => {
                  const max = Math.max(1, ...h.rating.dist);
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div className="anim-grow-y w-full rounded-t-md" style={{ height: `${Math.max(4, (n / max) * 40)}px`, background: n ? 'var(--viz-logged)' : 'var(--viz-track)', ['--i' as string]: i }} />
                      <span className="text-[10px] font-bold text-slate-500">{i + 1}★</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {h.enjoyment.avg !== null && (
              <span className="rounded-full bg-[var(--surface-sage)] px-3 py-1.5 font-semibold text-green-900">
                {['', '🙁', '🙂', '😄'][Math.round(h.enjoyment.avg)]} Viihtyminen: {ENJOYMENT_LABEL[Math.round(h.enjoyment.avg) as 1 | 2 | 3].toLowerCase()}
              </span>
            )}
            {h.playerGoals > 0 && <span className="rounded-full bg-[var(--surface-sage)] px-3 py-1.5 font-semibold text-green-900">⚽ {goalsLabel(profile.name)} {h.playerGoals}</span>}
            {h.topTags.map((t) => (
              <span key={t.tag} className="rounded-full bg-[var(--surface-sunk)] px-3 py-1.5 font-semibold text-slate-700">
                {FOCUS_TAG_LABEL[t.tag]} ×{t.count}
              </span>
            ))}
          </div>

          {h.comments.length > 0 && (
            <ul className="mt-4 space-y-2">
              {comments.map((c, i) => (
                <li key={`${c.sessionId}-${c.source}-${c.gameIndex ?? 0}`} className="anim-rise flex gap-3 rounded-2xl p-2" style={{ ['--i' as string]: i }}>
                  <TypeIcon t={data?.types.get(c.activityTypeId)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {dayLabel(c.date)}
                      {c.source === 'game' && ` · peli ${c.gameIndex}${c.opponent ? ` vs ${c.opponent}` : ''}`}
                      {c.source === 'diary' && c.opponent && ` · vs ${c.opponent}`}
                    </div>
                    <p className="whitespace-pre-line text-sm leading-snug text-slate-800">“{c.text}”</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {h.comments.length > 5 && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="press mt-2 rounded-lg px-2 py-1 text-sm font-semibold text-green-800 hover:bg-green-50">
              {showAll ? 'Näytä vähemmän' : `Näytä kaikki ${h.comments.length} kommenttia`}
            </button>
          )}
          <p className="mt-3 text-[11px] text-slate-500">Yleisarvio on vanhemman antamien tähtien keskiarvo suhteessa lapsen omaan tavalliseen tasoon (3 = tavallinen). Ei vertailua muihin.</p>
        </>
      )}
    </section>
  );
}

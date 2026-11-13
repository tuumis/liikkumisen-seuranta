// Analyysin jalkapallo-osio (SPEC 8 "Mittarit"): viikko tai kuukausi (vahvistettu: oma valitsin osiossa).
// Osat näytetään erikseen eikä niitä yhdistetä pisteluvuksi. Viihtyminen ennen suoritusarviota.

import { useState } from 'react';
import { addDays, maxDate, minDate, monthPeriod, seasonPeriod } from '../../domain/dates';
import {
  footballPeriodSummary,
  footballTrend,
  seasonKey,
  trendRefDate,
  type GameSummary,
  type Trend,
} from '../../domain/football';
import type { FocusTag, Period, SkipReason } from '../../domain/types';
import { Button, Card, EmptyState } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { formatDate } from '../../ui/format';
import { ENJOYMENT_LABEL, FOCUS_TAG_LABEL, RATING_LABEL, SKIP_REASON_LABEL } from '../../ui/labels';
import { num1, percent } from '../../ui/statusText';
import { today as todayFn } from '../../ui/today';
import { useFootball } from './useFootball';

export function resultLine(g: GameSummary): string {
  const res = g.wins + g.draws + g.losses;
  if (!g.games) return 'Ei pelejä';
  return `${g.games} ${g.games === 1 ? 'peli' : 'peliä'}${res ? ` · V–T–H ${g.wins}–${g.draws}–${g.losses} · maalit ${g.goalsFor}–${g.goalsAgainst}` : ''}${g.noResult ? ` · ${g.noResult} ei tulosta` : ''}${g.playerGoalsGames ? ` · pelaajan maalit ${g.playerGoals}` : ''}`;
}

export function FootballSection({ profileId, week, onOpenGames }: { profileId: string; week: Period; onOpenGames: () => void }) {
  const today = todayFn();
  const [scope, setScope] = useState<'week' | 'month'>('week');
  // Kuukausi: viikon torstain kuukausi (ISO-viikon kuukausi).
  const month = monthPeriod(addDays(week.start, 3));
  const period = scope === 'week' ? week : month;
  const monthLabel = formatDate(month.start, 'LLLL').replace(/^./, (c) => c.toUpperCase());
  const ref = trendRefDate(period, today);
  const season = seasonPeriod(ref);
  const data = useFootball(profileId, minDate(period.start, season.start), maxDate(period.end, ref));

  if (!data) return null;
  if (data.sessions.length === 0 && !data.planned.some((p) => data.types.get(p.activityTypeId)?.sport === 'football')) return null;

  const sum = footballPeriodSummary(data, period);
  const enjoy = footballTrend(data, ref, 'enjoyment');
  const rating = footballTrend(data, ref, 'parentRating');
  const seasonTags = footballPeriodSummary(data, { ...season, end: ref });
  const p = sum.participation;
  const reasons = (Object.keys(SKIP_REASON_LABEL) as SkipReason[]).filter((r) => p.skippedByReason[r] > 0);

  return (
    <Card title="⚽ Jalkapallo">
      <div className="space-y-4">
        <Segmented
          label="Jalkapallon jakso"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'week', label: 'Viikko' },
            { value: 'month', label: monthLabel },
          ]}
        />

        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Osallistuminen ja peliaika</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-600">Treenit</dt>
            <dd className="text-right tabular-nums">
              {sum.training.count} kpl · {sum.training.minutes} min
            </dd>
            <dt className="text-slate-600">Pelit</dt>
            <dd className="text-right tabular-nums">{sum.games.games} kpl</dd>
            <dt className="text-slate-600">Pelatut minuutit</dt>
            <dd className="text-right tabular-nums">
              {sum.games.playedMinTotal} min{sum.games.playedMinAvg !== null && ` · ka. ${num1(Math.round(sum.games.playedMinAvg * 10) / 10)}/peli`}
            </dd>
            {p.done + p.skipped > 0 && (
              <>
                <dt className="text-slate-600">Osallistumisaste (perutut pois)</dt>
                <dd className="text-right tabular-nums">
                  {p.adherenceRate === null ? '–' : percent(p.adherenceRate)} ({p.done}/{p.done + p.skipped - p.skippedByReason.cancelled})
                </dd>
              </>
            )}
            {sum.attendance.partial > 0 && (
              <>
                <dt className="text-slate-600">Osittain osallistuttu</dt>
                <dd className="text-right tabular-nums">{sum.attendance.partial} kertaa</dd>
              </>
            )}
          </dl>
          {(reasons.length > 0 || p.skippedByReason.unspecified > 0) && (
            <p className="mt-1 text-xs text-slate-600">
              Poissaolot:{' '}
              {[...reasons.map((r) => `${SKIP_REASON_LABEL[r].toLowerCase()} ${p.skippedByReason[r]}`), p.skippedByReason.unspecified > 0 && `ei syytä ${p.skippedByReason.unspecified}`]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
          {sum.withoutDetails > 0 && <p className="mt-1 text-xs text-slate-500">{sum.withoutDetails} kerralta puuttuvat lisätiedot.</p>}
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Viihtyminen</h3>
          <TrendLine trend={enjoy} format={(m) => ENJOYMENT_LABEL[Math.round(m) as 1 | 2 | 3]} scale="1–3" declineText="Viihtyminen vähentynyt viime viikkoina." season={seasonKey(ref)} />
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Vanhemman arvio suorituksesta</h3>
          <TrendLine trend={rating} format={(m) => RATING_LABEL[Math.round(m) as 1 | 2 | 3 | 4 | 5].toLowerCase()} scale="1–5" season={seasonKey(ref)} />
          <p className="text-xs text-slate-400">Vanhemman arvio, ei mittaus. Suhteessa lapsen omaan tavalliseen tasoon.</p>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Harjoittelun sisältö · {seasonKey(ref)}</h3>
          <TagBars tagged={seasonTags.tags.tagged} counts={seasonTags.tags.counts} />
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">Pelitulokset</h3>
          <p className="text-sm text-slate-800">{resultLine(sum.games)}</p>
          <p className="text-xs text-slate-500">Joukkueen tuloksia; eivät vaikuta muihin mittareihin.</p>
          <Button variant="secondary" className="mt-2 w-full" onClick={onOpenGames}>
            Pelit ja tulokset ›
          </Button>
        </section>
      </div>
    </Card>
  );
}

function TrendLine({ trend, format, scale, declineText, season }: { trend: Trend; format: (m: number) => string; scale: string; declineText?: string; season: string }) {
  if (trend.median === null) {
    return (
      <p className="text-sm text-slate-500">
        {trend.count === 0 ? 'Ei arvioita' : `${trend.count} ${trend.count === 1 ? 'arvio' : 'arviota'}`} kaudella {season}. Trendi näytetään, kun arvioita on vähintään 5.
      </p>
    );
  }
  return (
    <>
      <p className="text-sm text-slate-800">
        Viimeisten {Math.min(8, trend.count)} kerran mediaani <strong className="tabular-nums">{num1(trend.median)}</strong> ({scale}) – {format(trend.median)}
      </p>
      {trend.declined && declineText && <p className="text-sm text-slate-700">{declineText}</p>}
      <p className="text-xs text-slate-500">
        Kausi {season}, {trend.count} arviota.
      </p>
    </>
  );
}

function TagBars({ tagged, counts }: { tagged: number; counts: Partial<Record<FocusTag, number>> }) {
  if (!tagged)
    return (
      <EmptyState art="notebook" title="Ei merkittyjä harjoiteltuja asioita" compact>
        Valitse treenin lisätiedoista, mitä harjoiteltiin (esim. syötöt), niin jakauma näkyy tässä.
      </EmptyState>
    );
  const rows = (Object.keys(FOCUS_TAG_LABEL) as FocusTag[]).filter((t) => counts[t]).sort((a, b) => counts[b]! - counts[a]!);
  return (
    <>
      <ul className="space-y-1.5">
        {rows.map((t) => {
          const share = counts[t]! / tagged;
          return (
            <li key={t}>
              <div className="flex justify-between text-sm text-slate-800">
                <span>{FOCUS_TAG_LABEL[t]}</span>
                <span className="tabular-nums text-slate-600">
                  {counts[t]} · {percent(share)}
                </span>
              </div>
              <div className="mt-0.5 h-2 rounded-sm bg-slate-100" aria-hidden>
                <div className="h-full rounded-sm" style={{ width: `${share * 100}%`, background: 'var(--viz-logged)' }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-xs text-slate-500">Osuus {tagged} tagitetusta kerrasta (kerralla voi olla useita tageja).</p>
    </>
  );
}

// Viikon huomiot (SPEC 16, 20.11.2026): Analyysin viikkonäkymän kortti ja Viime viikko lyhyesti -koosteen osio.
// Laskenta domain/insights.ts; tämä tiedosto vain hakee datan ja näyttää huomiot lähteineen.

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, isoWeek, weekPeriod } from '../../domain/dates';
import { weekInsights, type Insight, type InsightResult, type InsightTier } from '../../domain/insights';
import type { ActivityType, ISODate, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Card } from '../../ui/components';
import { IconTarget } from '../../ui/icons';
import { today as todayFn } from '../../ui/today';
import { useReport } from './useReport';

const TIER_LABEL: Record<InsightTier, string> = {
  official: 'Liikkumissuositus',
  research: 'Tutkimus',
  app: 'Sovelluksen tulkinta',
};

/** Viikon huomiot; undefined, kun data on vielä tulossa. */
export function useWeekInsights(profile: Profile | undefined, weekStart: ISODate): InsightResult | undefined {
  const today = todayFn();
  const report = useReport(profile, weekPeriod(weekStart));
  const prev1 = useReport(profile, weekPeriod(addDays(weekStart, -7)));
  const prev2 = useReport(profile, weekPeriod(addDays(weekStart, -14)));
  const items = useLiveQuery(() => (profile ? repo.listTemplateItems(profile.id) : []), [profile?.id]);
  const types = useLiveQuery(() => repo.listActivityTypes({ includeArchived: true }), []);
  return useMemo(() => {
    // Live-haku voi hetken palauttaa edellisen viikon raportin: vain oikean viikon tiedoista.
    if (!report || !items || !types || report.period.start !== weekStart) return undefined;
    const at = (r: typeof report | undefined, start: ISODate) => (r && r.period.start === start ? r : undefined);
    return weekInsights({
      report,
      previous: [at(prev1, addDays(weekStart, -7)), at(prev2, addDays(weekStart, -14))],
      today,
      templateItems: items,
      types: new Map<string, ActivityType>(types.map((t) => [t.id, t])),
    });
  }, [report, prev1, prev2, items, types, weekStart, today]);
}

/** Tilan viesti, kun huomioita ei näytetä. */
export function insightStateText(r: InsightResult): string | undefined {
  switch (r.state) {
    case 'current':
      return 'Huomiot tulevat, kun viikko on päättynyt.';
    case 'none':
      return 'Tältä viikolta ei ole vertailtavia päiviä.';
    case 'pending':
      return `Kuittaa ensin viikon ${r.unconfirmed} ${r.unconfirmed === 1 ? 'kerta' : 'kertaa'}, niin huomiot perustuvat toteumaan.`;
    case 'lowData':
      return 'Kirjauksia on liian vähän luotettaviin huomioihin.';
    case 'partial':
      return `Vertailussa oli vain ${r.validDays} päivää (esimerkiksi sairaus tai loma), joten huomioita ei anneta.`;
    case 'ok':
      return 'Hyvä viikko: ei huomautettavaa suosituksen osalta.';
    default:
      return undefined;
  }
}

const streakText = (n: number) => (n === 3 ? 'Kolmas viikko peräkkäin' : `${n}. viikko peräkkäin`);

export function InsightRow({ i }: { i: Insight }) {
  const [why, setWhy] = useState(false);
  return (
    <li className="rounded-xl bg-[var(--surface-sunk)] px-3 py-2.5 ring-1 ring-inset ring-[var(--line)]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{TIER_LABEL[i.tier]}</span>
        {i.streak && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">{streakText(i.streak)}</span>}
      </div>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{i.title}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{i.text}</p>
      {i.option && (
        <p className="mt-1.5 flex gap-1.5 text-sm text-slate-800">
          <IconTarget size="1rem" className="mt-0.5 shrink-0 text-green-800" aria-hidden />
          <span>{i.option}</span>
        </p>
      )}
      <button
        type="button"
        onClick={() => setWhy(!why)}
        aria-expanded={why}
        className="hit -ml-1 mt-1 min-h-8 rounded-lg px-1 text-xs font-semibold text-green-800 hover:underline"
      >
        {why ? 'Piilota perustelu' : 'Miksi?'}
      </button>
      {why && (
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          {i.why} Lähde: {i.source.title}.
        </p>
      )}
    </li>
  );
}

/** Analyysin viikkonäkymän kortti: kaikki huomiot. */
export function InsightsCard({ profile, weekStart }: { profile: Profile; weekStart: ISODate }) {
  const r = useWeekInsights(profile, weekStart);
  if (!r) return null;
  const msg = insightStateText(r);
  return (
    <Card title="Huomiot" eyebrow={`Viikko ${isoWeek(weekStart).week}`}>
      <p className="text-sm text-slate-600">Havainnot päättyneeltä viikolta liikkumissuositusta vasten. Perustelu ja lähde kohdasta Miksi?</p>
      {msg ? (
        <p className={`mt-3 rounded-xl px-3 py-2.5 text-sm ${r.state === 'ok' ? 'bg-green-50 font-semibold text-green-900' : 'bg-[var(--surface-sunk)] text-slate-600'}`}>{msg}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {r.insights.map((i) => (
            <InsightRow key={i.id} i={i} />
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Viime viikko lyhyesti -koosteen osio: kaksi tärkeintä, loput avattavissa. */
export function DigestInsights({ profile, weekStart }: { profile: Profile; weekStart: ISODate }) {
  const r = useWeekInsights(profile, weekStart);
  const [all, setAll] = useState(false);
  if (!r || !['insights', 'ok', 'pending'].includes(r.state)) return null;
  const msg = insightStateText(r);
  const shown = all ? r.insights : r.insights.slice(0, 2);
  return (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Viikon huomiot</h3>
      {msg ? (
        <p className={`mt-1 text-sm ${r.state === 'ok' ? 'font-semibold text-green-900' : 'text-slate-600'}`}>{msg}</p>
      ) : (
        <>
          <ul className="mt-2 grid gap-2 lg:grid-cols-2">
            {shown.map((i) => (
              <InsightRow key={i.id} i={i} />
            ))}
          </ul>
          {r.insights.length > 2 && (
            <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="hit mt-1 min-h-9 rounded-lg px-1 text-sm font-semibold text-green-800 hover:underline">
              {all ? 'Näytä vähemmän' : `Näytä kaikki (${r.insights.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// "Viime viikko lyhyesti" (SPEC 16): viikon ensimmäisellä avauksella edellisen viikon kooste
// Viikko-näkymän yläosassa. Kolme lukukorttia (24.11.2026): pääluku suhteessa suositukseen, liikunta
// yhteensä ja jalkapallotreenit, kussakin muutos edelliseen viikkoon. Suljettu kooste tallennetaan
// profiiliin (synkronoituu laitteiden välillä).

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, isoWeek, weekPeriod } from '../../domain/dates';
import { footballPeriodSummary } from '../../domain/football';
import { formatHours } from '../../domain/hours';
import { DEFAULT_SETTINGS } from '../../domain/recommendations';
import type { ISODate, Profile } from '../../domain/types';
import { previousWeekStart, shouldShowDigest } from '../../domain/weekDigest';
import { repo } from '../../db/repositories';
import { formatDate } from '../../ui/format';
import { useReport } from '../analysis/useReport';
import { useFootball } from '../football/useFootball';
import { useFootballEnabled } from '../football/useFootballEnabled';
import { weekModel } from './WeekSummary';
import { IconBall, IconBolt, IconCheck, IconClock, IconClose } from '../../ui/icons';
import { DigestInsights } from '../analysis/InsightsCard';

// Vanha laitekohtainen muisti (ennen profiiliin tallennusta); luetaan edelleen, ettei suljettu palaa.
const KEY = 'lastWeekSeen';
function readSeen(): Record<string, ISODate> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, ISODate>;
  } catch {
    return {};
  }
}
function writeSeen(profileId: string, week: ISODate) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readSeen(), [profileId]: week }));
  } catch {
    /* ei tallennusta: profiilin tieto riittää */
  }
}
const later = (...ds: (ISODate | undefined)[]) => ds.filter((d): d is ISODate => !!d).sort().pop();

const STATUS_TEXT = { met: 'Suositus täyttyi', near: 'Lähellä suositusta', below: 'Alle suosituksen' } as const;
// Pääkortin sävy suosituksen mukaan: tausta, palkin pohja ja täyttö, teksti.
const STATUS_TONE = {
  met: { card: 'bg-green-50 ring-1 ring-green-100', track: 'bg-green-100', fill: 'bg-green-700', text: 'text-green-900' },
  near: { card: 'bg-amber-50 ring-1 ring-amber-100', track: 'bg-amber-100', fill: 'bg-amber-600', text: 'text-amber-900' },
  below: { card: 'card-sunk', track: 'bg-slate-200', fill: 'bg-slate-500', text: 'text-slate-700' },
} as const;

/** Kesto tunteina ja minuutteina: "4 h 30 min", "45 min". */
function hm(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  return h ? `${h} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
}
const arrow = (d: number) => (d > 0 ? '↑' : '↓');

type Tile = { key: string; icon: React.ReactNode; label: string; value: string; unit?: string; sub?: string; delta?: string; up?: boolean };

/** Muutosrivi: nousu vihreällä, lasku neutraalina (ei arvottava). */
function Delta({ text, up }: { text?: string; up?: boolean }) {
  if (!text) return null;
  return <div className={`mt-0.5 text-xs ${up ? 'font-semibold text-green-800' : 'text-slate-600'}`}>{text}</div>;
}

export function LastWeekCard({ profile, today, onOpenWeek }: { profile: Profile; today: ISODate; onOpenWeek: (weekStart: ISODate) => void }) {
  const start = previousWeekStart(today);
  const period = weekPeriod(start);
  const prevPeriod = weekPeriod(addDays(start, -7));
  // Sulkeminen piilottaa heti (tila profiileittain); pysyvästi profiiliin ja laitteen muistiin.
  const [closedNow, setClosedNow] = useState<Record<string, ISODate>>({});
  const report = useReport(profile, period);
  const prev = useReport(profile, prevPeriod);
  const settings = useLiveQuery(() => repo.getSettings(), []) ?? DEFAULT_SETTINGS;
  const week = useLiveQuery(async () => (await repo.sessionsInRange(profile.id, period.start, period.end)).filter((s) => !s.deletedAt), [profile.id, period.start, period.end]);
  const footballOn = useFootballEnabled(profile);
  const football = useFootball(footballOn ? profile.id : undefined, period.start, period.end);
  const prevFootball = useFootball(footballOn ? profile.id : undefined, prevPeriod.start, prevPeriod.end);

  if (!report || !week) return null;
  const dismissedFor = later(profile.digestSeenWeek, readSeen()[profile.id], closedNow[profile.id]);
  const logged = week.filter((s) => !s.estimateConfirmed);
  if (!shouldShowDigest({ lastWeekStart: start, trackingStart: report.trackingStart, sessionCount: logged.length, dismissedFor })) return null;

  const close = () => {
    setClosedNow((c) => ({ ...c, [profile.id]: start }));
    writeSeen(profile.id, start);
    void repo.markDigestSeen(profile.id, start);
  };
  const { main, tiles: weekTiles } = weekModel(report, settings);
  const showMain = main && report.evaluation.evaluable;
  const prevMain = prev && prev.evaluation.evaluable ? weekModel(prev, settings).main : null;
  const delta = showMain && prevMain && prevMain.unit === main.unit ? Math.round(main.value) - Math.round(prevMain.value) : undefined;
  const deltaText =
    delta === undefined ? undefined : delta === 0 ? 'sama kuin edellisellä viikolla' : `${arrow(delta)} ${Math.abs(delta)}${main?.unit.startsWith('min') ? ' min' : ''} edelliseen viikkoon`;
  // Edellinen viikko vertailuun vain, jos seuranta oli jo alkanut.
  const prevTracked = !!prev && prevPeriod.end >= report.trackingStart;

  const tiles: Tile[] = [];
  const hoursDelta = prevTracked ? Math.round((report.hours.actualMin - prev!.hours.actualMin) / 6) / 10 : undefined;
  tiles.push({
    key: 'hours',
    icon: <IconClock size="1rem" />,
    label: 'Liikuntaa yhteensä',
    value: formatHours(report.hours.actualMin).replace(' h', ''),
    unit: 'h',
    delta:
      hoursDelta === undefined
        ? undefined
        : hoursDelta === 0
          ? 'sama kuin edellisellä viikolla'
          : `${arrow(hoursDelta)} ${Math.abs(hoursDelta).toFixed(1).replace('.', ',')} h edelliseen viikkoon`,
    up: (hoursDelta ?? 0) > 0,
  });
  if (footballOn) {
    // Jalkapallotreenit: määrä ja aika sekä muutos edelliseen viikkoon (määrä ja aika).
    const t = football?.sessions.length ? footballPeriodSummary(football, period).training : { count: 0, minutes: 0 };
    const pt = prevFootball ? (prevFootball.sessions.length ? footballPeriodSummary(prevFootball, prevPeriod).training : { count: 0, minutes: 0 }) : undefined;
    let fbDelta: string | undefined;
    if (pt && prevTracked) {
      const dc = t.count - pt.count;
      const dm = t.minutes - pt.minutes;
      const parts = [
        dc ? `${arrow(dc)} ${Math.abs(dc)} ${Math.abs(dc) === 1 ? 'treeni' : 'treeniä'}` : '',
        dm ? `${arrow(dm)} ${hm(Math.abs(dm))}` : '',
      ].filter(Boolean);
      fbDelta = parts.length ? `${parts.join(' · ')} edelliseen viikkoon` : 'sama kuin edellisellä viikolla';
    }
    tiles.push({
      key: 'football',
      icon: <IconBall size="1rem" />,
      label: 'Jalkapallotreenit',
      value: String(t.count),
      unit: t.count === 1 ? 'treeni' : 'treeniä',
      sub: t.minutes ? `yhteensä ${hm(t.minutes)}` : undefined,
      delta: fbDelta,
      up: !!pt && t.minutes > pt.minutes,
    });
  } else {
    const w = weekTiles[1];
    if (w) tiles.push({ key: 'extra', icon: <IconBolt size="1rem" />, label: w.label, value: w.value, sub: w.sub });
  }
  const tone = showMain ? STATUS_TONE[main.m.status] : undefined;
  const progress = showMain && main.m.target > 0 ? Math.min(1, main.m.actual / main.m.target) : 0;

  const open = () => {
    close();
    onOpenWeek(start);
  };

  return (
    <section className="card anim-rise p-4 sm:px-5" aria-label="Viime viikko lyhyesti">
      <div className="-mr-2 -mt-2 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Viime viikko · vk {isoWeek(start).week}
          <span className="max-sm:hidden">
            {' · '}
            {formatDate(period.start, 'd.M.')}–{formatDate(period.end, 'd.M.')}
          </span>
        </span>
        <button type="button" onClick={open} className="press hit min-h-10 shrink-0 rounded-xl px-2.5 text-sm font-semibold text-green-800 hover:bg-green-50">
          Avaa viikko
        </button>
        <button
          type="button"
          onClick={close}
          className="press hit flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-[var(--surface-sunk)] hover:text-slate-900"
          aria-label="Sulje viime viikon kooste"
          title="Sulje (ei näytetä uudelleen tältä viikolta)"
        >
          <IconClose size="1.1rem" />
        </button>
      </div>

      <div className={`mt-2 grid gap-2.5 ${tiles.length + (showMain ? 1 : 0) >= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
        {showMain && tone && (
          <div className={`col-span-2 min-w-0 rounded-2xl p-3.5 sm:col-span-1 ${tone.card}`}>
            <div className={`flex items-start gap-1.5 text-xs font-semibold leading-tight ${tone.text}`}>
              <IconBolt size="1rem" className="shrink-0" />
              <span className="min-w-0">{main.label}</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className={`stat text-[2.25rem] font-semibold leading-none tabular-nums ${tone.text}`}>{Math.round(main.value)}</span>
              <span className={`text-sm font-semibold ${tone.text} opacity-80`}>{main.unit}</span>
            </div>
            <div className={`mt-2.5 h-1.5 overflow-hidden rounded-full ${tone.track}`} role="img" aria-label={`${Math.round(progress * 100)} % suosituksesta`}>
              <div className={`h-full rounded-full ${tone.fill}`} style={{ width: `${progress * 100}%` }} />
            </div>
            <div className={`mt-1.5 flex flex-wrap items-center justify-between gap-x-2 text-xs ${tone.text}`}>
              <span className="flex items-center gap-1 font-semibold">
                {main.m.status === 'met' && <IconCheck size="0.85rem" />}
                {STATUS_TEXT[main.m.status]}
              </span>
              <span className="opacity-80">{main.target}</span>
            </div>
            <Delta text={deltaText} up={delta !== undefined && delta > 0} />
          </div>
        )}
        {tiles.map((t) => (
          <div key={t.key} className="card-sunk min-w-0 rounded-2xl p-3.5">
            <div className="flex items-start gap-1.5 text-xs font-semibold leading-tight text-slate-600">
              <span className="shrink-0">{t.icon}</span>
              <span className="min-w-0">{t.label}</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="stat text-[2.25rem] font-semibold leading-none tabular-nums text-slate-900">{t.value}</span>
              {t.unit && <span className="text-sm font-semibold text-slate-600">{t.unit}</span>}
            </div>
            {t.sub && <div className="mt-2 text-xs text-slate-600">{t.sub}</div>}
            <Delta text={t.delta} up={t.up} />
          </div>
        ))}
      </div>
      <DigestInsights profile={profile} weekStart={start} />
    </section>
  );
}

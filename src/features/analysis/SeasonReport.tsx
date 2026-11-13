// Jakson raportti tulostettavaksi tai PDF:ksi (SPEC 16): selaimen tulostus (window.print), ei
// lisäkirjastoja eikä verkkoliikennettä. Raportti on vaalea "paperi" myös tummassa tilassa, ja
// tulostuksessa näkyy vain se (index.css @media print).

import { useEffect, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { footballPeriodSummary, gameRows, playSummary, POSITION_LABEL, POSITIONS } from '../../domain/football';
import { highlights } from '../../domain/highlights';
import { periodName, type LongTermSummary } from '../../domain/longTerm';
import type { ActivityType, Context, Period, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { useFootballEnabled } from '../football/useFootballEnabled';
import { formatDate } from '../../ui/format';
import { FOCUS_TAG_LABEL, MOVEMENT_GROUP_LABEL } from '../../ui/labels';
import { today as todayFn } from '../../ui/today';
import { DAY_BAR_TARGET } from '../week/WeekView';

const pct = (x: number | null | undefined) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)} %`);
const min = (x: number | null | undefined) => (x === null || x === undefined ? '–' : `${Math.round(x)} min/pv`);
const hours = (m: number) => `${(m / 60).toFixed(1).replace('.', ',')} h`;
const CONTEXT_TEXT: Record<Context, string> = { organized: 'Ohjattu', self_directed: 'Omaehtoinen', everyday: 'Arki' };

function useExtras(profile: Profile, period: Period) {
  const today = todayFn();
  // Jalkapallo pois käytöstä: ei jalkapallo-osiota eikä jalkapallon arvioita/kommentteja kohokohdissa.
  const footballOn = useFootballEnabled(profile);
  return useLiveQuery(async () => {
    const [sessions, typesList, planned] = await Promise.all([
      repo.sessionsInRange(profile.id, period.start, period.end),
      repo.listActivityTypes({ includeArchived: true }),
      repo.plansInRange(profile.id, period.start, period.end),
    ]);
    const types = new Map<string, ActivityType>(typesList.map((t) => [t.id, t]));
    const live = sessions.filter((s) => !s.deletedAt);
    const footballIds = new Set(typesList.filter((t) => t.sport === 'football').map((t) => t.id));
    const fbSessions = footballOn ? live.filter((s) => footballIds.has(s.activityTypeId)) : [];
    const details = await repo.footballDetailsFor(fbSessions.map((s) => s.id));
    const fb = fbSessions.length ? footballPeriodSummary({ sessions: fbSessions, details, types, planned, today }, period) : undefined;
    const play = fb ? playSummary(gameRows(fbSessions, details, types)) : undefined;
    const hl = highlights(live, details, period.start, period.end);
    return { fb, play, hl, types };
  }, [profile.id, period.start, period.end, today, footballOn]);
}

export function SeasonReport({ profile, s, p, onClose }: { profile: Profile; s: LongTermSummary; p?: LongTermSummary; onClose: () => void }) {
  const extras = useExtras(profile, s.period);
  const name = periodName(s.period);
  const prevName = p ? periodName(p.period) : '';
  const hasPrev = !!p && p.validDays > 0;
  const target = DAY_BAR_TARGET[s.group];
  const maxBucket = Math.max(target, ...s.buckets.map((b) => b.mvpaCombined));
  const count = (x: LongTermSummary) => x.byType.reduce((a, t) => a + t.count, 0);
  const created = formatDate(todayFn(), 'd.M.yyyy');

  useEffect(() => {
    document.body.classList.add('print-report-open');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('print-report-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const print = () => {
    // Tiedostonimi PDF-tallennukseen sivun otsikosta; palautetaan tulostuksen jälkeen.
    const title = document.title;
    document.title = `Liikuntaraportti ${profile.name} ${name}`;
    const restore = () => {
      document.title = title;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  const comments = useMemo(() => extras?.hl.comments.slice(0, 6) ?? [], [extras]);
  const fb = extras?.fb;
  const g = fb?.games;
  const play = extras?.play;
  const tags = fb ? (Object.entries(fb.tags.counts) as [keyof typeof FOCUS_TAG_LABEL, number][]).sort((a, b) => b[1] - a[1]).slice(0, 5) : [];

  return createPortal(
    <div className="print-report fixed inset-0 z-[80] overflow-y-auto bg-[#d9d6cc]/95" role="dialog" aria-modal="true" aria-label={`Raportti ${name}`}>
      <div className="print-hide sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-[#26342e] px-4 py-3 text-white shadow-lg">
        <div className="min-w-0 flex-1 text-sm font-semibold">Raportti · {name}</div>
        <button type="button" onClick={print} className="press min-h-10 rounded-xl bg-white px-4 text-sm font-bold text-[#26342e]">
          Tulosta / tallenna PDF
        </button>
        <button type="button" onClick={onClose} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-white/90 ring-1 ring-white/30 hover:bg-white/10">
          Sulje
        </button>
      </div>
      <p className="print-hide mx-auto max-w-[210mm] px-4 pt-3 text-xs text-[#33403a]">
        Valitse tulostusikkunassa kohteeksi ”Tallenna PDF-muodossa”, jos haluat tiedoston. Raportti muodostetaan tällä laitteella.
      </p>

      <article className="report-paper mx-auto my-4 max-w-[210mm] bg-white px-6 py-7 text-[13px] leading-relaxed text-[#26342e] shadow-xl sm:px-10">
        <header className="border-b-2 border-[#26342e] pb-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5a645d]">Liikkumisen seuranta · raportti</div>
          <h1 className="font-display text-2xl font-semibold">
            {profile.name} · {name}
          </h1>
          <div className="text-xs text-[#5a645d]">
            {formatDate(s.period.start, 'd.M.yyyy')}–{formatDate(s.period.end, 'd.M.yyyy')} · {s.validDays} vertailtavaa päivää · laadittu {created}
          </div>
        </header>

        <Section title="Yhteenveto">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Reipas ja rasittava" value={min(s.mvpa?.combined)} sub={`josta kirjattu ${Math.round(s.mvpa?.logged ?? 0)}`} />
            <Tile label="Kaikki liikunta" value={min(s.total?.combined)} sub="kevyt mukaan" />
            <Tile label="Kirjattuja kertoja" value={String(count(s))} sub={`${s.variety.types} lajia`} />
            <Tile label="Kattavuus" value={pct(s.quality.coverage)} sub={`arvion osuus ${pct(s.quality.estimateShare)}`} />
          </div>
          <p className="mt-2 text-xs text-[#5a645d]">
            Suositusvertailu: {s.group === 'adult' ? 'tahti 150 min/vko (reipas + 2 × rasittava)' : `${target} min/pv reipasta ja rasittavaa keskimäärin`}.
          </p>
        </Section>

        <Section title={s.period.kind === 'week' ? 'Päivittäin' : 'Kehitys'}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-[11px] text-[#5a645d]">
                <th className="py-1 pr-2 font-semibold">{s.period.kind === 'week' ? 'Päivä' : s.period.kind === 'month' ? 'Viikko' : 'Kuukausi'}</th>
                <th className="w-1/2 py-1 pr-2 font-semibold">Reipas ja rasittava ka. (kirjattu + arvio)</th>
                <th className="py-1 pr-2 text-right font-semibold">min/pv</th>
                <th className="py-1 text-right font-semibold">Kattavuus</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {s.buckets.map((b) => (
                <tr key={b.key} className="border-t border-[#e5e2d8]">
                  <td className="py-1 pr-2">{b.label}</td>
                  <td className="py-1 pr-2">
                    {b.validDays > 0 && (
                      <div className="relative h-2.5 rounded-sm bg-[#efede6]">
                        <div className="absolute inset-y-0 left-0 rounded-sm bg-[#e6c9a3]" style={{ width: `${(b.mvpaCombined / maxBucket) * 100}%` }} />
                        <div className="absolute inset-y-0 left-0 rounded-sm bg-[#127a4e]" style={{ width: `${(b.mvpaLogged / maxBucket) * 100}%` }} />
                        <div className="absolute inset-y-[-3px] w-px bg-[#26342e]" style={{ left: `${(target / maxBucket) * 100}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="py-1 pr-2 text-right">{b.validDays ? `${Math.round(b.mvpaLogged)} + ${Math.round(b.mvpaCombined - b.mvpaLogged)}` : '–'}</td>
                  <td className="py-1 text-right">{b.validDays ? pct(b.coverage) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-[#5a645d]">Tumma palkki kirjattu, vaalea arkiliikunnan arvio, pystyviiva suositus.</p>
        </Section>

        <Section title={hasPrev ? `Vertailu: ${prevName}` : 'Vertailu'}>
          {hasPrev ? (
            <table className="w-full border-collapse tabular-nums">
              <thead>
                <tr className="text-left text-[11px] text-[#5a645d]">
                  <th className="py-1 font-semibold" />
                  <th className="py-1 text-right font-semibold">{name}</th>
                  <th className="py-1 text-right font-semibold">{prevName}</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Reipas ja rasittava (kirjattu + arvio)', min(s.mvpa?.combined), min(p!.mvpa?.combined)],
                    ['… josta kirjattu', min(s.mvpa?.logged), min(p!.mvpa?.logged)],
                    ['Kaikki liikunta', min(s.total?.combined), min(p!.total?.combined)],
                    ['Rasittavan osuus', pct(s.vigorousShare), pct(p!.vigorousShare)],
                    ['Ohjatun osuus', pct(s.context?.organized), pct(p!.context?.organized)],
                    ['Kirjattuja kertoja', String(count(s)), String(count(p!))],
                    ['Liikuntaryhmiä', String(s.variety.groups.length), String(p!.variety.groups.length)],
                    ['Kattavuus', pct(s.quality.coverage), pct(p!.quality.coverage)],
                  ] as const
                ).map(([l, a, b]) => (
                  <tr key={l} className="border-t border-[#e5e2d8]">
                    <td className="py-1">{l}</td>
                    <td className="py-1 text-right font-semibold">{a}</td>
                    <td className="py-1 text-right">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[#5a645d]">Edelliseltä jaksolta ei ole vertailtavia päiviä.</p>
          )}
        </Section>

        <div className="grid gap-x-8 sm:grid-cols-2">
          <Section title="Mistä liikunta kertyy">
            {s.context ? (
              <ul className="space-y-1">
                {(['organized', 'self_directed', 'everyday'] as Context[]).map((k) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span>{CONTEXT_TEXT[k]}</span>
                    <span className="font-semibold tabular-nums">{pct(s.context![k])}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[#5a645d]">Ei kirjattua reipasta tai rasittavaa.</p>
            )}
            <p className="mt-1 text-[11px] text-[#5a645d]">Osuudet kirjatusta reippaasta ja rasittavasta.</p>
          </Section>
          <Section title="Suositukset viikoittain">
            {s.weeks.evaluated ? (
              <ul className="space-y-1">
                {s.weeks.goals.map((gl) => (
                  <li key={gl.key} className="flex justify-between gap-2">
                    <span>{gl.label}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {gl.met}/{s.weeks.evaluated}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[#5a645d]">Ei viikkoja, joilla vähintään 4 vertailtavaa päivää.</p>
            )}
          </Section>
        </div>

        <Section title="Lajit ja monipuolisuus">
          <p className="mb-1">
            {s.variety.groups.length} liikuntaryhmää{s.variety.groups.length ? `: ${s.variety.groups.map((x) => MOVEMENT_GROUP_LABEL[x].toLowerCase()).join(', ')}` : ''}.
          </p>
          {s.byType.length > 0 && (
            <table className="w-full border-collapse tabular-nums">
              <tbody>
                {s.byType.slice(0, 10).map((t) => (
                  <tr key={t.typeId} className="border-t border-[#e5e2d8]">
                    <td className="py-1">{t.name}</td>
                    <td className="py-1 text-right">{t.count} krt</td>
                    <td className="py-1 text-right font-semibold">{hours(t.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {fb && (
          <Section title="Jalkapallo">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="Treenit" value={String(fb.training.count)} sub={hours(fb.training.minutes)} />
              <Tile label="Pelit" value={String(g!.games)} sub={g!.wins + g!.draws + g!.losses ? `V–T–H ${g!.wins}–${g!.draws}–${g!.losses}` : 'ei tuloksia'} />
              <Tile label="Maalit" value={g!.wins + g!.draws + g!.losses ? `${g!.goalsFor}–${g!.goalsAgainst}` : '–'} sub="joukkue" />
              <Tile label={`${profile.name}: maalit`} value={g!.playerGoalsGames ? String(g!.playerGoals) : '–'} sub={g!.playerGoalsGames ? `${g!.playerGoalsGames} pelistä kirjattu` : 'ei kirjattu'} />
            </div>
            <ul className="mt-2 space-y-0.5 text-[12.5px]">
              {fb.participation.adherenceRate !== null && <li>Osallistuminen suunniteltuihin: {pct(fb.participation.adherenceRate)}</li>}
              {play && play.share !== null && (
                <li>
                  Kentällä {pct(play.share)} peliajasta ({play.shareGames}/{play.games} pelistä tiedossa)
                </li>
              )}
              {play && play.positionGames > 0 && (
                <li>
                  Pelipaikat:{' '}
                  {POSITIONS.filter((x) => play.positions[x] > 0)
                    .map((x) => `${POSITION_LABEL[x].toLowerCase()} ${play.positions[x]}`)
                    .join(', ')}
                </li>
              )}
              {tags.length > 0 && <li>Treenien sisältö: {tags.map(([t, n]) => `${FOCUS_TAG_LABEL[t].toLowerCase()} ${n}`).join(', ')}</li>}
            </ul>
            <p className="mt-1 text-[11px] text-[#5a645d]">Tulokset ovat joukkueen tuloksia; ne eivät arvioi lasta.</p>
          </Section>
        )}

        {comments.length > 0 && (
          <Section title="Kommentteja">
            <ul className="space-y-1.5">
              {comments.map((c) => (
                <li key={`${c.sessionId}-${c.gameIndex ?? ''}`} className="break-inside-avoid">
                  <span className="text-[11px] font-semibold text-[#5a645d]">
                    {formatDate(c.date, 'd.M.')} · {extras?.types.get(c.activityTypeId)?.name ?? ''}
                    {c.opponent ? ` · ${c.opponent}` : ''}
                  </span>
                  <div>”{c.text}”</div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <footer className="mt-6 border-t border-[#e5e2d8] pt-2 text-[10.5px] leading-snug text-[#5a645d]">
          Minuutit ovat lajien tyypillisistä tehoista laskettuja arvioita, ja arkiliikunta (esim. välitunnit) on vanhemman perusarvio. Luvuista voi päätellä kirjatun
          liikunnan määrän ja jakauman muutoksia, ei kuntoa, terveyttä eikä vertailua muihin lapsiin. Vertailu: UKK-instituutin liikkumissuositukset.
        </footer>
      </article>
    </div>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="report-section mt-5 break-inside-avoid">
      <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#434f48]">{title}</h2>
      {children}
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#e5e2d8] px-2.5 py-1.5">
      <div className="text-[10.5px] font-semibold leading-tight text-[#5a645d]">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10.5px] leading-tight text-[#5a645d]">{sub}</div>}
    </div>
  );
}

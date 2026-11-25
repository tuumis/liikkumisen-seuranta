// Kokonaiskuormitus valmentajalle (25.11.2026): jakopaneeli (jakso ja kuvassa näytettävät tiedot), jakokuva ja
// PDF-tulostus. Kooste lasketaan laitteella kirjatuista kerroista (domain/coachSummary); sovellus ei lähetä
// mitään itse, vaan jako tehdään puhelimen jakovalikosta tai tallennetusta tiedostosta.

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { coachSummary, coachView, COACH_PART_LABEL, DEFAULT_COACH_OPTIONS, fi1, type CoachOptions, type CoachView } from '../../domain/coachSummary';
import { addDays, seasonPeriod, startOfIsoWeek } from '../../domain/dates';
import { displayTeamName } from '../../domain/opponent';
import type { ISODate, Profile, UUID } from '../../domain/types';
import { vigorousDayThreshold } from '../../domain/vigorous';
import { repo } from '../../db/repositories';
import { useBackClose } from '../../ui/backClose';
import { Button } from '../../ui/components';
import { Segmented, ToggleChip } from '../../ui/controls';
import { DateInput } from '../../ui/DateInput';
import { formatDate } from '../../ui/format';
import { IconReport, IconShare } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { currentReportPalette } from '../analysis/reportPalette';
import { loadStyleFonts } from '../share/drawResult';
import { drawCoachCard } from './drawCoach';

const OPEN_EVENT = 'coach-share';
const OPTIONS_KEY = 'coachShareOptions';

/** Avaa valmentajan koosteen profiilille (Jalkapallo-näkymä ja Analyysi). */
export function openCoachShare(profileId: UUID): void {
  window.dispatchEvent(new CustomEvent<UUID>(OPEN_EVENT, { detail: profileId }));
}

type Range = 'weeks' | 'season' | 'custom';

function readOptions(): CoachOptions {
  try {
    const o = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}') as Partial<CoachOptions>;
    const out = { ...DEFAULT_COACH_OPTIONS };
    for (const k of Object.keys(out) as (keyof CoachOptions)[]) if (typeof o[k] === 'boolean') out[k] = o[k]!;
    return out;
  } catch {
    return { ...DEFAULT_COACH_OPTIONS };
  }
}

/** Jakopaneeli (yksi koko sovelluksessa). */
export function CoachShareHost({ profiles }: { profiles: Profile[] | null }) {
  const [profileId, setProfileId] = useState<UUID | null>(null);
  useEffect(() => {
    const on = (e: Event) => setProfileId((e as CustomEvent<UUID>).detail);
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);
  const profile = profiles?.find((p) => p.id === profileId);
  return <CoachShareSheet profile={profile} onClose={() => setProfileId(null)} />;
}

export interface CoachData {
  view: CoachView;
  title: string;
  team?: string;
  start: ISODate;
  end: ISODate;
}

function useCoachData(profile: Profile | undefined, start: ISODate, end: ISODate, options: CoachOptions): CoachData | undefined {
  const raw = useLiveQuery(async () => {
    if (!profile || end < start) return undefined;
    const [sessions, plans, flags, types, settings, teams] = await Promise.all([
      repo.sessionsInRange(profile.id, start, end),
      repo.plansInRange(profile.id, start, end),
      repo.dayFlagsInRange(profile.id, start, end),
      repo.listActivityTypes({ includeArchived: true }),
      repo.getSettings(),
      repo.listTeams(profile.id),
    ]);
    const today = todayFn();
    const summary = coachSummary({
      start,
      end,
      today,
      sessions,
      plans,
      flags,
      types: new Map(types.map((t) => [t.id, t])),
      vigorousMin: vigorousDayThreshold(settings, profile, end > today ? today : end).min,
    });
    const team = teams.find((t) => !t.archived && t.kind !== 'group');
    return { summary, team: team ? displayTeamName(team.name) : undefined };
  }, [profile?.id, profile?.birthYear, profile?.birthMonth, start, end]);
  return useMemo(
    () => (raw ? { view: coachView(raw.summary, options), title: raw.summary.title, team: raw.team, start: raw.summary.start, end: raw.summary.end } : undefined),
    [raw, options],
  );
}

function CoachShareSheet({ profile, onClose }: { profile: Profile | undefined; onClose: () => void }) {
  const toast = useToast();
  const today = todayFn();
  const [range, setRange] = useState<Range>('weeks');
  const weeksStart = addDays(startOfIsoWeek(today), -21);
  const [custom, setCustom] = useState<{ start: ISODate; end: ISODate }>({ start: weeksStart, end: today });
  const [options, setOptionsState] = useState<CoachOptions>(readOptions);
  const [src, setSrc] = useState<string>();
  const [printing, setPrinting] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  const start = range === 'weeks' ? weeksStart : range === 'season' ? seasonPeriod(today).start : custom.start;
  const end = range === 'custom' ? custom.end : today;
  const data = useCoachData(profile, start, end, options);

  const setOption = (k: keyof CoachOptions, v: boolean) =>
    setOptionsState((prev) => {
      const next = { ...prev, [k]: v };
      if (k === 'absences' && !v) next.reasons = false;
      if (k === 'reasons' && v) next.absences = true;
      try {
        localStorage.setItem(OPTIONS_KEY, JSON.stringify(next));
      } catch {
        /* ei tallennusta */
      }
      return next;
    });

  useEffect(() => {
    if (!profile) {
      setSrc(undefined);
      canvas.current = null;
      setPrinting(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!profile || !data) return;
    let alive = true;
    void (async () => {
      await loadStyleFonts('brand');
      if (!alive) return;
      const c = drawCoachCard({ kicker: `Liikkuminen · ${data.title}`, name: profile.name, team: data.team }, data.view);
      canvas.current = c;
      setSrc(c.toDataURL('image/png'));
    })();
    return () => {
      alive = false;
    };
  }, [profile, data]);

  const fileName = `Liikkuminen ${profile?.name ?? ''} ${data?.title ?? ''}.png`.replace(/[\\/:*?"<>|–]/g, '-').replace(/\s+/g, ' ');
  const blob = () => new Promise<Blob | null>((res) => (canvas.current ? canvas.current.toBlob(res, 'image/png') : res(null)));
  async function save() {
    const b = await blob();
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Kuva tallennettu', undefined, 'success');
  }
  async function share() {
    const b = await blob();
    if (!b) return;
    const file = new File([b], fileName, { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] })) return save();
    try {
      await navigator.share({ files: [file] });
    } catch {
      /* peruttu */
    }
  }
  const canShare = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function';

  const chips: { k: keyof CoachOptions; label: string }[] = [
    { k: 'other', label: 'Muut lajit ja koululiikunta' },
    { k: 'own', label: 'Omatoiminen harjoittelu' },
    { k: 'days', label: 'Rasittavat päivät ja lepopäivät' },
    { k: 'absences', label: 'Poissaolot (määrä)' },
    { k: 'reasons', label: 'Poissaolojen syyt' },
    { k: 'notes', label: 'Muistiinpanot' },
  ];

  return (
    <>
      <Sheet open={!!profile} onClose={onClose} title="Jaa valmentajalle">
        {profile && (
          <div className="space-y-4">
            <div className="flex justify-center rounded-2xl bg-[var(--surface-sunk)] p-3">
              {src ? (
                <img src={src} alt={`Liikunnan kooste valmentajalle, ${data?.title ?? ''}`} className="h-auto max-h-[46dvh] w-auto max-w-full rounded-xl shadow-lg" />
              ) : (
                <div className="aspect-[4/5] h-[40dvh] animate-pulse rounded-xl bg-slate-200" />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">Jakso</div>
              <Segmented<Range>
                label="Jakso"
                value={range}
                onChange={setRange}
                options={[
                  { value: 'weeks', label: '4 viikkoa' },
                  { value: 'season', label: 'Kausi' },
                  { value: 'custom', label: 'Oma väli' },
                ]}
              />
              {range === 'custom' && (
                <div className="flex items-center gap-2">
                  <DateInput value={custom.start} max={custom.end} onChange={(v) => setCustom((c) => ({ ...c, start: v }))} aria-label="Alkaen" className="flex-1" />
                  <span className="text-slate-500">–</span>
                  <DateInput value={custom.end} min={custom.start} max={today} onChange={(v) => setCustom((c) => ({ ...c, end: v }))} aria-label="Päättyen" className="flex-1" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-700">Näytä kuvassa</div>
              <div className="flex flex-wrap gap-2">
                {chips.map((c) => (
                  <ToggleChip key={c.k} on={options[c.k]} onChange={(v) => setOption(c.k, v)}>
                    {c.label}
                  </ToggleChip>
                ))}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Jako tehdään puhelimen jakovalikosta (esim. WhatsApp tai sähköposti) tai tallennetusta tiedostosta. Sovellus ei lähetä mitään itse. Luvut lasketaan kirjatuista
              kerroista; arkiliikunnan arvio ei ole mukana.
            </p>
            <div className="sticky bottom-[calc(-1*max(1.25rem,env(safe-area-inset-bottom)))] z-10 -mx-5 -mb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-[var(--line)] bg-[var(--surface)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_18px_-14px_rgb(0_0_0/0.35)] lg:-bottom-7 lg:-mx-7 lg:-mb-7 lg:px-7 lg:pb-6">
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void (canShare ? share() : save())} disabled={!src}>
                  <IconShare size="1.1rem" />
                  {canShare ? 'Jaa kuvana' : 'Tallenna kuva'}
                </Button>
                <Button variant="secondary" onClick={() => setPrinting(true)} disabled={!data}>
                  <IconReport size="1.1rem" />
                  PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </Sheet>
      {printing && profile && data && <CoachPrint profile={profile} data={data} onClose={() => setPrinting(false)} />}
    </>
  );
}

/** PDF-paperin osavärit (vaalea pohja). */
const PAPER_COLOR = { football: '#2a64c9', own: '#c95420', other: '#13865f', school: '#7a58d4' } as const;

/** Tulostettava kooste (vaalea paperi; tulostusikkunasta Tallenna PDF-muodossa). */
function CoachPrint({ profile, data, onClose }: { profile: Profile; data: CoachData; onClose: () => void }) {
  useBackClose(true, onClose);
  const pal = useMemo(currentReportPalette, []);
  const v = data.view;
  const maxTotal = Math.max(60, ...v.buckets.map((b) => b.total));

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
    const title = document.title;
    document.title = `Liikkuminen ${profile.name} ${data.title}`;
    const restore = () => {
      document.title = title;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  return createPortal(
    <div className="print-report fixed inset-0 z-[80] overflow-y-auto bg-[#d9d6cc]/95 [color-scheme:light]" role="dialog" aria-modal="true" aria-label="Kooste valmentajalle">
      <div className="print-hide sticky top-0 z-10 flex flex-wrap items-center gap-2 px-4 py-3 text-[#ffffff] shadow-lg" style={{ background: pal.header }}>
        <div className="min-w-0 flex-1 text-sm font-semibold">Kooste valmentajalle · {data.title}</div>
        <button type="button" onClick={print} className="press min-h-10 rounded-xl bg-[#ffffff] px-4 text-sm font-bold" style={{ color: pal.header }}>
          Tulosta / tallenna PDF
        </button>
        <button type="button" onClick={onClose} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-[#ffffff]/90 ring-1 ring-[#ffffff]/30 hover:bg-[#ffffff]/10">
          Sulje
        </button>
      </div>
      <p className="print-hide mx-auto max-w-[210mm] px-4 pt-3 text-xs text-[#33403a]">
        Valitse tulostusikkunassa kohteeksi ”Tallenna PDF-muodossa”, jos haluat tiedoston. Kooste muodostetaan tällä laitteella.
      </p>

      <article className="report-paper mx-auto my-4 max-w-[210mm] bg-[#ffffff] text-[13px] leading-snug shadow-xl" style={{ color: pal.ink }}>
        <header className="px-6 py-5 text-[#ffffff] sm:px-9 print:rounded-xl print:px-6" style={{ background: pal.header }}>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.2em]" style={{ color: pal.headerKicker }}>
            Liikkuminen · {data.title}
          </div>
          <h1 className="font-display text-[26px] font-semibold leading-tight">{profile.name}</h1>
          <div className="text-xs text-[#ffffff]/75">
            {[data.team, `${formatDate(data.start, 'd.M.')}–${formatDate(data.end, 'd.M.yyyy')}`].filter(Boolean).join(' · ')}
          </div>
        </header>

        <div className="space-y-5 px-6 py-5 sm:px-9 print:px-1">
          <div className="grid grid-cols-3 gap-3">
            {v.tiles.map((t) => (
              <div key={t.label} className="rounded-xl px-4 py-3" style={{ background: pal.tint }}>
                <div className="font-display text-[28px] font-semibold leading-none tabular-nums">
                  {t.value}
                  {t.unit && <span className="ml-1 text-[13px] font-semibold" style={{ color: pal.soft }}>{t.unit}</span>}
                </div>
                <div className="mt-1 text-[11.5px] font-semibold" style={{ color: pal.soft }}>
                  {t.label}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] font-semibold" style={{ color: pal.soft }}>
              {v.parts.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-[3px]" style={{ background: PAPER_COLOR[p] }} />
                  {COACH_PART_LABEL[p]}
                </span>
              ))}
            </div>
            <div className="space-y-1.5">
              {v.buckets.map((b) => (
                <div key={b.label} className="flex items-center gap-3">
                  <div className="w-14 shrink-0 text-[11.5px] font-semibold uppercase" style={{ color: pal.soft }}>
                    {b.label}
                    {b.partial && <span className="block text-[9.5px] normal-case">kesken</span>}
                  </div>
                  <div className="flex h-4 min-w-0 flex-1 gap-[2px]" style={{ borderBottom: `1px solid ${pal.line}` }}>
                    {v.parts
                      .filter((p) => b.minutes[p] > 0)
                      .map((p, i, arr) => (
                        <div
                          key={p}
                          title={`${COACH_PART_LABEL[p]} ${fi1(b.minutes[p] / 60)} h`}
                          style={{ width: `${(b.minutes[p] / maxTotal) * 100}%`, background: PAPER_COLOR[p], borderRadius: i === arr.length - 1 ? '0 4px 4px 0' : 0, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                        />
                      ))}
                  </div>
                  <div className="w-14 shrink-0 text-right text-[12px] font-bold tabular-nums">{b.total > 0 ? `${fi1(b.total / 60)} h` : '–'}</div>
                </div>
              ))}
            </div>
          </div>

          <table className="w-full border-collapse">
            <tbody>
              {v.rows.map((r) => (
                <tr key={r.label} style={{ borderTop: `1px solid ${pal.line}` }}>
                  <td className="py-1.5 pr-4" style={{ color: pal.soft }}>
                    {r.label}
                  </td>
                  <td className="py-1.5 text-right font-semibold">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {v.notes.length > 0 && (
            <div>
              <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.16em]" style={{ color: pal.soft }}>
                Muistiinpanot
              </div>
              <ul className="space-y-0.5">
                {v.notes.map((n) => (
                  <li key={n.date + n.text}>
                    <span className="font-semibold">{formatDate(n.date, 'd.M.')}</span> {n.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {v.observations.length > 0 && (
            <ul className="space-y-1">
              {v.observations.map((o) => (
                <li key={o} className="flex gap-2">
                  <span className="mt-[0.45em] inline-block size-1.5 shrink-0 rounded-full" style={{ background: pal.header }} />
                  {o}
                </li>
              ))}
            </ul>
          )}

          <footer className="flex flex-wrap justify-between gap-2 border-t pt-2 text-[11px]" style={{ borderColor: pal.line, color: pal.soft }}>
            <span>Luvut ovat arvioita lajien tyypillisestä tehosta. Mukana kirjatut kerrat, ei arkiliikunnan arviota.</span>
            <span className="font-semibold">Liikkumisen seuranta</span>
          </footer>
        </div>
      </article>
    </div>,
    document.body,
  );
}

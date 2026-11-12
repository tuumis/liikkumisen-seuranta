// Kauden kooste kokoruudun tarinakortteina (SPEC 16): pyyhkäisy / napautus / nuolinäppäimet,
// automaattinen eteneminen, kortin tallennus kuvaksi ja jakaminen (laitteella, ei verkkoa).

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { minDate, seasonPeriod } from '../../domain/dates';
import { seasonKey } from '../../domain/football';
import { periodReport } from '../../domain/report';
import type { ActivityType, Profile } from '../../domain/types';
import { repo } from '../../db/repositories';
import { IconChevronLeft, IconChevronRight, IconClose } from '../../ui/icons';
import { prefersReducedMotion } from '../../ui/motion';
import { useToast } from '../../ui/Toast';
import { today as todayFn } from '../../ui/today';
import { subscribeCommands } from '../desktop/commands';
import { buildStory, type StorySlide } from './story';
import { drawSlide } from './drawSlide';

const SLIDE_MS = 6000;

/** Kiinnitetään kerran sovelluksen juureen; avautuu "story"-komennolla. */
export function StoryHost({ profile }: { profile?: Profile }) {
  const [open, setOpen] = useState(false);
  useEffect(() => subscribeCommands(['story'], () => (profile ? void setOpen(true) : false)), [profile]);
  if (!open || !profile) return null;
  return createPortal(<StoryViewer profile={profile} onClose={() => setOpen(false)} />, document.body);
}

function useStory(profile: Profile): StorySlide[] | undefined {
  const today = todayFn();
  const season = seasonPeriod(today);
  const end = minDate(season.end, today);
  return useLiveQuery(async () => {
    const [sessions, estimates, flags, planned, typesList, settings] = await Promise.all([
      repo.sessionsInRange(profile.id, season.start, end),
      repo.listEstimates(profile.id),
      repo.dayFlagsInRange(profile.id, season.start, end),
      repo.plansInRange(profile.id, season.start, end),
      repo.listActivityTypes({ includeArchived: true }),
      repo.getSettings(),
    ]);
    const types = new Map<string, ActivityType>(typesList.map((t) => [t.id, t]));
    const footballIds = sessions.filter((s) => types.get(s.activityTypeId)?.sport === 'football').map((s) => s.id);
    const footballDetails = await repo.footballDetailsFor(footballIds);
    const report = periodReport({ profile, period: { ...season, end }, sessions, estimates, flags, planned, types, settings, today });
    return buildStory({ name: profile.name, seasonLabel: seasonKey(today), report, sessions, types, footballDetails });
  }, [profile, season.start, end, today]);
}

function StoryViewer({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const slides = useStory(profile);
  const toast = useToast();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const n = slides?.length ?? 0;
  const slide = slides?.[Math.min(i, n - 1)];
  const reduce = prefersReducedMotion();
  const touch = useRef<{ x: number; t: number } | null>(null);

  const go = (d: number) => {
    setElapsed(0);
    setI((cur) => {
      const next = cur + d;
      if (next >= n) {
        onClose();
        return cur;
      }
      return Math.max(0, next);
    });
  };

  // Automaattinen eteneminen (ei, jos liikettä on vähennetty tai kortti on pysäytetty).
  useEffect(() => {
    if (!n || paused || reduce) return;
    const start = performance.now() - elapsed;
    let raf = 0;
    const tick = (now: number) => {
      const e = now - start;
      if (e >= SLIDE_MS) {
        go(1);
        return;
      }
      setElapsed(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, n, paused, reduce]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  async function imageBlob(): Promise<Blob | null> {
    if (!slide) return null;
    await document.fonts?.ready;
    const canvas = drawSlide(slide, { index: i, count: n });
    return new Promise((res) => canvas.toBlob(res, 'image/png'));
  }
  const fileName = () => `kooste-${seasonKey(todayFn()).toLowerCase().replace(' ', '-')}-${i + 1}.png`;

  async function save() {
    const blob = await imageBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Kuva tallennettu', undefined, 'success');
  }
  const canShare = typeof navigator.canShare === 'function';
  async function share() {
    const blob = await imageBlob();
    if (!blob) return;
    const file = new File([blob], fileName(), { type: 'image/png' });
    if (!navigator.canShare?.({ files: [file] })) return save();
    try {
      await navigator.share({ files: [file], title: 'Kauden kooste' });
    } catch {
      /* peruttu */
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-[#0b1411]/88 p-3 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Kauden kooste">
      <div
        className="story-card hero relative flex aspect-[9/16] w-[min(420px,100%,calc((100dvh-6.5rem)*0.5625))] select-none flex-col !rounded-[1.75rem] p-7"
        onPointerDown={(e) => {
          touch.current = { x: e.clientX, t: Date.now() };
          setPaused(true);
        }}
        onPointerUp={(e) => {
          setPaused(false);
          const s = touch.current;
          touch.current = null;
          if (!s) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 50) return go(dx < 0 ? 1 : -1);
          if (Date.now() - s.t > 400) return; // pitkä painallus = tauko
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          go(e.clientX - r.left < r.width / 3 ? -1 : 1);
        }}
        onPointerLeave={() => setPaused(false)}
      >
        {/* Etenemispalkit */}
        <div className="relative z-10 flex gap-1" aria-hidden>
          {Array.from({ length: n }, (_, k) => (
            <span key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <span className="block h-full rounded-full bg-white" style={{ width: k < i ? '100%' : k === i ? `${reduce ? 100 : (elapsed / SLIDE_MS) * 100}%` : '0%' }} />
            </span>
          ))}
        </div>
        {!slide ? (
          <div className="relative z-10 m-auto text-sm text-[var(--hero-ink-soft)]">Kootaan kautta…</div>
        ) : (
          <div key={slide.id} className="relative z-10 flex min-h-0 flex-1 flex-col justify-center" aria-live="polite">
            <div className="story-in text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--hero-accent)]" style={{ ['--d' as string]: '0ms' }}>
              {slide.kicker}
            </div>
            <h2 className="story-in mt-2 font-display text-[34px] font-semibold leading-[1.08] tracking-tight" style={{ ['--d' as string]: '80ms' }}>
              {slide.title}
            </h2>
            {slide.big && (
              <div className="story-in mt-6 flex items-baseline gap-2" style={{ ['--d' as string]: '180ms' }}>
                <span className="stat font-display text-[88px] font-semibold leading-none text-[var(--hero-accent)]">{slide.big}</span>
                {slide.bigUnit && <span className="text-sm font-semibold text-[var(--hero-ink-soft)]">{slide.bigUnit}</span>}
              </div>
            )}
            {slide.stats && (
              <dl className="story-in mt-6 grid grid-cols-3 gap-2" style={{ ['--d' as string]: '180ms' }}>
                {slide.stats.map((s) => (
                  <div key={s.label} className="rounded-2xl bg-white/[0.09] px-3 py-3 ring-1 ring-white/10">
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--hero-ink-soft)]">{s.label}</dt>
                    <dd className="stat mt-1 text-[28px] font-semibold">{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {slide.bars && slide.bars.length > 0 && (
              <ul className="mt-6 space-y-3">
                {slide.bars.map((b, k) => (
                  <li key={b.label} className="story-in" style={{ ['--d' as string]: `${200 + k * 90}ms` }}>
                    <div className="flex items-baseline justify-between gap-3 text-sm font-semibold">
                      <span className="truncate">
                        {b.icon && <span aria-hidden>{b.icon} </span>}
                        {b.label}
                      </span>
                      <span className="tabular-nums text-[var(--hero-ink-soft)]">{b.value}</span>
                    </div>
                    <span className="mt-1.5 block h-2.5 overflow-hidden rounded-full bg-white/12">
                      <span className="story-bar block h-full rounded-full bg-[var(--hero-accent)]" style={{ width: `${Math.max(6, b.pct * 100)}%`, ['--d' as string]: `${300 + k * 90}ms` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {slide.lines.length > 0 && (
              <div className="story-in mt-6 space-y-1.5 text-[15px] leading-snug text-[var(--hero-ink-soft)]" style={{ ['--d' as string]: '320ms' }}>
                {slide.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="relative z-10 flex items-center justify-between text-[11px] font-semibold text-[var(--hero-ink-soft)]">
          <span>Liikkumisen seuranta</span>
          <span className="tabular-nums">
            {Math.min(i + 1, n)} / {n}
          </span>
        </div>
      </div>

      <div className="flex w-full max-w-[420px] items-center gap-2">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} className="press flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40" aria-label="Edellinen kortti">
          <IconChevronLeft />
        </button>
        <button type="button" onClick={() => void save()} className="press min-h-11 flex-1 rounded-full bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20">
          Tallenna kuva
        </button>
        {canShare && (
          <button type="button" onClick={() => void share()} className="press min-h-11 flex-1 rounded-full bg-[var(--hero-accent)] px-4 text-sm font-bold text-[#1c2b24] hover:brightness-105">
            Jaa
          </button>
        )}
        <button type="button" onClick={() => go(1)} className="press flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Seuraava kortti">
          <IconChevronRight />
        </button>
        <button type="button" onClick={onClose} className="press flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Sulje kooste">
          <IconClose size="1.1rem" />
        </button>
      </div>
    </div>
  );
}


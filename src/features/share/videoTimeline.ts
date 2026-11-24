// Ennakkovideon ajoitus (19.11.2026): mikä osa tulee milloin ja miten. Puhdas laskenta, jotta
// ajoitusta voi testata ilman kangasta. Osat nimetään piirrossa (drawPreview: mark).

export type AnimKind = 'up' | 'left' | 'right' | 'pop' | 'rise';

export interface LayerAnim {
  /** Alkuhetki sekunteina. */
  start: number;
  dur: number;
  kind: AnimKind;
}

export interface VideoTimeline {
  anims: Map<string, LayerAnim>;
  /** Videon kesto sekunteina (lopussa valmis kuva pysyy hetken). */
  total: number;
}

/** Tempo: alla olevat ajat kerrotaan tällä (käyttäjän palaute 19.11.2026: ensimmäinen versio liian nopea). */
export const PACE = 1.6;
/** Lopun pysäytyskuva ja kesto rajoineen. */
export const HOLD = 3;
export const MIN_TOTAL = 7;
export const MAX_TOTAL = 13;

/**
 * Käyttäjän säädöt (24.11.2026, käyttäjän toive: nopeus ja pituus säädettäviksi). Tempo kertoo animaatioiden
 * ajat, pituus lopun pysäytyskuvan keston ja videon rajat. Normaali = aiempi video.
 */
export type VideoTempo = 'slow' | 'normal' | 'fast';
export type VideoLength = 'short' | 'normal' | 'long';
export interface VideoTiming {
  tempo: VideoTempo;
  length: VideoLength;
}
export const DEFAULT_TIMING: VideoTiming = { tempo: 'normal', length: 'normal' };
export const TEMPO_PACE: Record<VideoTempo, number> = { slow: 2.1, normal: PACE, fast: 1.1 };
export const LENGTH_HOLD: Record<VideoLength, { hold: number; min: number; max: number }> = {
  short: { hold: 1.5, min: 4, max: 9 },
  normal: { hold: HOLD, min: MIN_TOTAL, max: MAX_TOTAL },
  long: { hold: 6, min: 10, max: 20 },
};

/**
 * Ajoitus osien nimistä (piirtojärjestyksessä, toistot sallittu): tausta ensin, sitten tunniste ja päivä
 * ylös liukuen, joukkue vasemmalta ja vastustaja oikealta, VS ponnahtaen, turnauksen rivit yksi kerrallaan
 * ja lopuksi kommentti, ajat ja paikka.
 */
export function videoTimeline(names: readonly string[], timing: VideoTiming = DEFAULT_TIMING): VideoTimeline {
  const pace = TEMPO_PACE[timing.tempo] ?? PACE;
  const len = LENGTH_HOLD[timing.length] ?? LENGTH_HOLD.normal;
  const order = [...new Set(names)];
  const has = (n: string) => order.includes(n);
  const anims = new Map<string, LayerAnim>();
  let t = 0.25;
  const put = (name: string, dur: number, kind: AnimKind, step: number) => {
    if (!has(name)) return;
    anims.set(name, { start: round(t), dur, kind });
    t += step;
  };
  put('kicker', 0.5, 'up', 0.2);
  put('title', 0.55, 'up', 0.25);
  put('date', 0.5, 'up', 0.35);
  if (has('team') || has('opponent')) {
    if (has('team')) anims.set('team', { start: round(t), dur: 0.65, kind: 'left' });
    if (has('opponent')) anims.set('opponent', { start: round(t), dur: 0.65, kind: 'right' });
    t += 0.55;
  }
  put('vs', 0.55, 'pop', 0.45);
  put('label', 0.45, 'up', 0.2);
  const rows = order.filter((n) => n.startsWith('row:'));
  rows.forEach((n, i) => {
    anims.set(n, { start: round(t), dur: 0.5, kind: 'rise' });
    t += i === rows.length - 1 ? 0.3 : 0.18;
  });
  // Loput (kommentti, ajat, paikka ja tuntemattomat) järjestyksessä.
  for (const n of order) {
    if (n === 'bg' || anims.has(n)) continue;
    put(n, 0.5, 'up', 0.3);
  }
  for (const [n, a] of anims) anims.set(n, { ...a, start: round(a.start * pace), dur: round(a.dur * pace) });
  const end = Math.max(0, ...[...anims.values()].map((a) => a.start + a.dur));
  // Pitkä animaatio ei katkea: yläraja vähintään animaatio + lyhyt pysäytyskuva.
  const max = Math.max(len.max, round(end + 1));
  return { anims, total: Math.min(max, Math.max(len.min, round(end + len.hold))) };
}

const round = (v: number) => Math.round(v * 1000) / 1000;

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOutCubic = (u: number) => 1 - (1 - u) ** 3;
/** Ylitys ja paluu (ponnahdus). */
export function easeOutBack(u: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2;
}

export interface LayerPose {
  alpha: number;
  dx: number;
  dy: number;
  scale: number;
}

/** Osan asento hetkellä t (alpha 0 = ei vielä näkyvissä); `width` = kankaan leveys liukumille. */
export function poseAt(a: LayerAnim | undefined, t: number, width: number): LayerPose {
  if (!a || t >= a.start + a.dur) return { alpha: 1, dx: 0, dy: 0, scale: 1 };
  const u = clamp01((t - a.start) / a.dur);
  const e = easeOutCubic(u);
  switch (a.kind) {
    case 'left':
      return { alpha: clamp01(u * 2.5), dx: -(1 - e) * width * 0.55, dy: 0, scale: 1 };
    case 'right':
      return { alpha: clamp01(u * 2.5), dx: (1 - e) * width * 0.55, dy: 0, scale: 1 };
    case 'pop':
      return { alpha: clamp01(u * 3), dx: 0, dy: 0, scale: u >= 1 ? 1 : Math.max(0.01, easeOutBack(u)) };
    case 'rise':
      return { alpha: e, dx: (1 - e) * width * 0.12, dy: 0, scale: 1 };
    default:
      return { alpha: e, dx: 0, dy: (1 - e) * 36, scale: 1 };
  }
}

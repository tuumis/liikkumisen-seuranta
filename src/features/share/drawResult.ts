// Tuloskuva canvasille (SPEC 16): tarina 1080 × 1920 tai julkaisu 1080 × 1350, sovelluksen teemalla
// tai neutraalilla urheilutyylillä. Logot ovat käyttäjän lisäämiä kuvia (data URL); ei verkkoa.

import { HOME_AWAY_LABEL, type GameOutcome } from '../../domain/football';
import type { HomeAway } from '../../domain/types';
import { initials, OUTCOME_WORD, type ResultCard } from '../../domain/resultCard';
import { formatDate } from '../../ui/format';
import { drawFlag } from '../../ui/flags';
import { alpha, isLightColor, mix, resolveShareColor, type ShareColor } from './shareColors';

export type ShareSize = 'story' | 'post';
/**
 * Kuvan tyyli: Pehmeä, Urheilu, Kenttä, Juliste, Selkeä ja Tulostaulu (käyttäjän lista 17.11.2026; kaikki
 * sekä tulos- että ennakkokuvassa). Tyyli vaihtaa taustan, värit ja fontin; asettelu on sama.
 */
export type ShareStyle = 'theme' | 'sport' | 'field' | 'poster' | 'clean' | 'scoreboard';

export const SHARE_STYLE_LABEL: Record<ShareStyle, string> = {
  theme: 'Pehmeä',
  sport: 'Urheilu',
  field: 'Kenttä',
  poster: 'Juliste',
  clean: 'Selkeä',
  scoreboard: 'Tulostaulu',
};
/** Kaikki tyylit (tulos- ja ennakkokuva, 17.11.2026). */
export const ALL_SHARE_STYLES: readonly ShareStyle[] = ['theme', 'sport', 'field', 'poster', 'clean', 'scoreboard'];
export const isShareStyle = (v: unknown): v is ShareStyle => typeof v === 'string' && v in SHARE_STYLE_LABEL;

/** Otsikkofontin paksuus tyylin mukaan. */
export const heavyOf = (style: ShareStyle) => (style === 'sport' || style === 'poster' || style === 'field' ? 800 : style === 'scoreboard' ? 700 : 600);

export interface ShareLogos {
  team?: HTMLImageElement;
  opponents: (HTMLImageElement | undefined)[];
}

/** Seuran maa (lippu) ja kotipaikkakunta kuvaan. */
export interface Origin {
  country?: string;
  city?: string;
}
export interface ShareOrigins {
  team?: Origin;
  opponents: (Origin | undefined)[];
}

export const W = 1080;
export const HEIGHT: Record<ShareSize, number> = { story: 1920, post: 1350 };
export const PAD = 84;

/** Tuloksen värit (tekstinä myös V / T / H, joten väri ei ole ainoa tunniste). */
const OUTCOME_COLOR: Record<GameOutcome, string> = { W: '#15803d', D: '#b45309', L: '#b91c1c' };
const OUTCOME_LETTER: Record<GameOutcome, string> = { W: 'V', D: 'T', L: 'H' };

const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export interface Palette {
  ink: string;
  soft: string;
  accent: string;
  panel: string;
  display: string;
  sans: string;
  /** Vaalea tausta (tumma teksti). */
  light?: boolean;
}

export function loadImage(src: string | undefined): Promise<HTMLImageElement | undefined> {
  if (!src) return Promise.resolve(undefined);
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(undefined);
    img.src = src;
  });
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Teksti mahtumaan: fonttia pienennetään rajaan asti, sitten lyhennetään "…"-merkillä. */
export function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, font: (px: number) => string, size: number, min: number): string {
  let px = size;
  ctx.font = font(px);
  while (ctx.measureText(text).width > maxW && px > min) {
    px -= 2;
    ctx.font = font(px);
  }
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = test;
  }
  if (line) out.push(line);
  if (out.length > maxLines) {
    const head = out.slice(0, maxLines - 1);
    const rest = out.slice(maxLines - 1).join(' ');
    let t = rest;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
    return [...head, t === rest ? t : `${t.trimEnd()}…`];
  }
  return out;
}

/** Joukkueen nimi riveiksi erottimien kohdalta ("Seura · Ryhmä · 2018"), ei kesken osan. */
export function wrapName(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const parts = text.split(/\s+·\s+/);
  if (parts.length < 2) return wrap(ctx, text, maxW, maxLines);
  const out: string[] = [];
  for (const part of parts) {
    const last = out.at(-1);
    if (last !== undefined && ctx.measureText(`${last} · ${part}`).width <= maxW) out[out.length - 1] = `${last} · ${part}`;
    else out.push(...wrap(ctx, part, maxW, maxLines));
  }
  return out.length > maxLines ? wrap(ctx, text.replace(/\s+·\s+/g, ' '), maxW, maxLines) : out;
}

export function spaced(text: string) {
  return text.toUpperCase().split('').join(String.fromCharCode(8202));
}

/** Logo valkoisella pyöristetyllä pohjalla kokonaisena; puuttuessa seuran nimikirjaimet. */
export function drawLogo(ctx: CanvasRenderingContext2D, img: HTMLImageElement | undefined, name: string | undefined, x: number, y: number, size: number, sans: string) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.04;
  ctx.fillStyle = '#ffffff';
  rr(ctx, x, y, size, size, size * 0.24);
  ctx.fill();
  ctx.restore();
  if (img && img.width > 0 && img.height > 0) {
    const inner = size * 0.8;
    const s = Math.min(inner / img.width, inner / img.height);
    const w = img.width * s;
    const h = img.height * s;
    ctx.save();
    rr(ctx, x, y, size, size, size * 0.24);
    ctx.clip();
    ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
    ctx.restore();
  } else {
    const text = initials(name);
    ctx.fillStyle = '#1e293b';
    ctx.font = `800 ${Math.round(size * (text.length > 2 ? 0.3 : 0.38))}px ${sans}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + size / 2, y + size / 2 + size * 0.02);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

export function background(ctx: CanvasRenderingContext2D, H: number, style: ShareStyle, color?: ShareColor) {
  if (style === 'theme') {
    const light = color && isLightColor(color.base);
    const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
    g.addColorStop(0, color ? (light ? mix(color.base, '#ffffff', 0.12) : mix(color.base, '#000000', 0.08)) : css('--hero-from', '#2c5a46'));
    g.addColorStop(1, color ? (light ? mix(color.base, '#000000', 0.14) : mix(color.base, '#000000', 0.58)) : css('--hero-to', '#1a3a2d'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const glowColor = color ? (light ? '#ffffff' : (color.accent ?? '#ffffff')) : '#dda96e';
    const glow = ctx.createRadialGradient(W, 0, 0, W, 0, W * 1.1);
    glow.addColorStop(0, alpha(glowColor, color ? 0.16 : 0.22));
    glow.addColorStop(1, alpha(glowColor, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 3;
    for (let r = 60; r < 2600; r += 70) {
      ctx.beginPath();
      ctx.arc(W * 1.1, -H * 0.05, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  if (style === 'field') return fieldBackground(ctx, H, color);
  if (style === 'poster') return posterBackground(ctx, H, color);
  if (style === 'clean') return cleanBackground(ctx, H, color);
  if (style === 'scoreboard') return scoreboardBackground(ctx, H, color);
  // Urheilutyyli: tumma yönsininen, viistot raidat ja kirkas reunaviiva.
  const accent = sportAccent(color);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, color ? mix('#0b1220', color.base, 0.16) : '#0b1220');
  g.addColorStop(1, color ? mix('#111c33', color.base, 0.26) : '#111c33');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.42);
  ctx.fillStyle = 'rgba(255,255,255,0.028)';
  for (let x = -H; x < H; x += 160) ctx.fillRect(x, -H, 70, H * 2);
  ctx.restore();
  const spot = ctx.createRadialGradient(W * 0.15, H * 0.1, 0, W * 0.15, H * 0.1, W);
  spot.addColorStop(0, alpha(accent, 0.16));
  spot.addColorStop(1, alpha(accent, 0));
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 14, H);
}

/** Kenttä: nurmen leikkuuraidat, kentän valkoiset viivat himmeinä ja tummennus tekstin alle. */
function fieldBackground(ctx: CanvasRenderingContext2D, H: number, color?: ShareColor) {
  const grass = color && !isLightColor(color.base) && !isDark(color.base) ? mix('#2d6a31', color.base, 0.18) : '#2d6a31';
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, W, H);
  const band = H / 12;
  ctx.fillStyle = 'rgba(255,255,255,0.055)';
  for (let i = 0; i < 12; i += 2) ctx.fillRect(0, i * band, W, band);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 6;
  const m = 36;
  ctx.strokeRect(m, m, W - m * 2, H - m * 2);
  ctx.beginPath();
  ctx.moveTo(m, H / 2);
  ctx.lineTo(W - m, H / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, W * 0.17, 0, Math.PI * 2);
  ctx.stroke();
  const bw = W * 0.56;
  const bh = H * 0.09;
  ctx.strokeRect((W - bw) / 2, m, bw, bh);
  ctx.strokeRect((W - bw) / 2, H - m - bh, bw, bh);
  ctx.restore();
  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,0.28)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0.12)');
  shade.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
}

/** Juliste: tasainen joukkueen väri, rasteripisteet ja leveät viistoraidat oikeassa yläkulmassa. */
function posterBackground(ctx: CanvasRenderingContext2D, H: number, color?: ShareColor) {
  const base = color?.base ?? '#b42318';
  const light = isLightColor(base);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const dot = light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)';
  ctx.fillStyle = dot;
  for (let y = 0; y < H * 0.45; y += 30)
    for (let x = W * 0.35; x < W; x += 30) {
      const r = 9 * Math.max(0, 1 - Math.hypot(W - x, y) / (W * 0.85));
      if (r < 0.6) continue;
      ctx.beginPath();
      ctx.arc(x + ((y / 30) % 2) * 15, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  // Viistoraidat oikeaan yläkulmaan (otsikon viereen, ei laatikoiden päälle).
  ctx.fillStyle = alpha(posterAccent(color), 0.9);
  for (const d of [60, 140, 220]) {
    ctx.beginPath();
    ctx.moveTo(W - d, 0);
    ctx.lineTo(W - d - 44, 0);
    ctx.lineTo(W, d + 44);
    ctx.lineTo(W, d);
    ctx.closePath();
    ctx.fill();
  }
}
const posterAccent = (color?: ShareColor) => color?.accent ?? (color && isLightColor(color.base) ? '#111827' : '#facc15');

/** Selkeä: vaalea pohja, ohut värikaista ylhäällä; teksti tumma. */
function cleanBackground(ctx: CanvasRenderingContext2D, H: number, color?: ShareColor) {
  const base = color?.base ?? '#1f5137';
  ctx.fillStyle = mix(base, '#ffffff', 0.95);
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, 22);
  ctx.fillStyle = alpha(base, 0.35);
  ctx.fillRect(0, H - 10, W, 10);
}
const cleanAccent = (color?: ShareColor) => {
  const base = color?.base ?? '#1f5137';
  return isLightColor(base) ? (color?.accent && !isLightColor(color.accent) ? color.accent : mix(base, '#000000', 0.6)) : base;
};

/** Tulostaulu: musta pohja, LED-pisteruudukko ja tumma kehys. */
function scoreboardBackground(ctx: CanvasRenderingContext2D, H: number, color?: ShareColor) {
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  for (let y = 9; y < H; y += 18) for (let x = 9; x < W; x += 18) ctx.fillRect(x - 2, y - 2, 4, 4);
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#2a2a2e';
  rr(ctx, 22, 22, W - 44, H - 44, 36);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = alpha(scoreboardAccent(color), 0.5);
  rr(ctx, 40, 40, W - 80, H - 80, 26);
  ctx.stroke();
}
const scoreboardAccent = (color?: ShareColor) => (!color ? '#fbbf24' : isDark(color.base) ? (color.accent ?? '#fbbf24') : mix(color.base, '#ffffff', 0.2));

/** Urheilutyylin korostus: valittu väri (liian tumma vaalennetaan) tai vihreä. */
const sportAccent = (color?: ShareColor) => (!color ? '#4ade80' : color.accent && isDark(color.base) ? color.accent : isDark(color.base) ? mix(color.base, '#ffffff', 0.45) : mix(color.base, '#ffffff', 0.12));
const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 60;
};

export function palette(style: ShareStyle, color?: ShareColor): Palette {
  const display = css('--font-display', 'Georgia, serif');
  const sans = css('--font-sans', 'system-ui, sans-serif');
  if (style === 'theme') {
    if (!color) return { ink: css('--hero-ink', '#f6f5f0'), soft: css('--hero-ink-soft', '#c9dccb'), accent: css('--hero-accent', '#e6bd89'), panel: 'rgba(255,255,255,0.09)', display, sans };
    if (isLightColor(color.base))
      return { ink: '#111827', soft: 'rgba(17,24,39,0.72)', accent: color.accent && !isLightColor(color.accent) ? color.accent : mix(color.base, '#000000', 0.6), panel: 'rgba(0,0,0,0.07)', display, sans, light: true };
    return { ink: '#ffffff', soft: 'rgba(255,255,255,0.76)', accent: color.accent ?? mix(color.base, '#ffffff', 0.7), panel: 'rgba(255,255,255,0.1)', display, sans };
  }
  if (style === 'field')
    return { ink: '#ffffff', soft: 'rgba(255,255,255,0.84)', accent: color && !isDark(color.base) ? (isLightColor(color.base) ? color.base : mix(color.base, '#ffffff', 0.4)) : color?.accent && !isDark(color.accent) ? color.accent : '#fde047', panel: 'rgba(0,0,0,0.26)', display: sans, sans };
  if (style === 'poster') {
    const light = isLightColor(color?.base ?? '#b42318');
    return light
      ? { ink: '#111827', soft: 'rgba(17,24,39,0.74)', accent: posterAccent(color), panel: 'rgba(0,0,0,0.08)', display: sans, sans, light: true }
      : { ink: '#ffffff', soft: 'rgba(255,255,255,0.82)', accent: posterAccent(color), panel: 'rgba(0,0,0,0.2)', display: sans, sans };
  }
  if (style === 'clean') return { ink: '#0f172a', soft: '#475569', accent: cleanAccent(color), panel: alpha(color?.base ?? '#1f5137', 0.07), display: sans, sans, light: true };
  if (style === 'scoreboard')
    return { ink: '#ffffff', soft: 'rgba(255,255,255,0.7)', accent: scoreboardAccent(color), panel: 'rgba(255,255,255,0.065)', display: 'ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace', sans };
  return { ink: '#ffffff', soft: 'rgba(226,232,240,0.78)', accent: sportAccent(color), panel: 'rgba(255,255,255,0.07)', display: sans, sans };
}

/** Lippu ja kotipaikkakunta yhdellä rivillä (x vasen reuna tai keskikohta); palauttaa leveyden. */
export function drawOrigin(ctx: CanvasRenderingContext2D, o: Origin | undefined, x: number, baseline: number, px: number, p: Palette, align: 'left' | 'center' = 'left', maxW = W): number {
  if (!o?.country && !o?.city) return 0;
  const fw = o.country ? Math.round(px * 1.35) : 0;
  const gap = o.country && o.city ? Math.round(px * 0.4) : 0;
  ctx.font = `600 ${px}px ${p.sans}`;
  const city = o.city ? fit(ctx, o.city, maxW - fw - gap, (s) => `600 ${s}px ${p.sans}`, px, Math.max(14, px - 8)) : '';
  const tw = city ? ctx.measureText(city).width : 0;
  const w = fw + gap + tw;
  const left = align === 'center' ? x - w / 2 : x;
  if (o.country) drawFlag(ctx, o.country, left, baseline - px * 0.78, fw);
  if (city) {
    ctx.fillStyle = p.soft;
    ctx.textAlign = 'left';
    ctx.fillText(city, left + fw + gap, baseline);
  }
  return w;
}

export function chip(ctx: CanvasRenderingContext2D, text: string, color: string, x: number, y: number, h: number, p: Palette, align: 'left' | 'center' | 'right' = 'left') {
  ctx.font = `800 ${Math.round(h * 0.46)}px ${p.sans}`;
  const w = ctx.measureText(text).width + h * 0.9;
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.fillStyle = color;
  rr(ctx, left, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + h * 0.45, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  return w;
}

export interface DrawOptions {
  size: ShareSize;
  style: ShareStyle;
  logos: ShareLogos;
  /** Lapsen nimi, jos lapsen maalit näytetään. */
  player?: string;
  /** Tallennettu väriarvo (shareColors); puuttuessa sovelluksen värit. */
  color?: string;
  origins?: ShareOrigins;
  /** Koti/vieras-merkinnät kuvaan (18.11.2026); oletus näkyy, jos tieto on annettu. */
  homeAway?: boolean;
  /** Kommentti harmaalla paneelilla (oletus) vai pelkkänä tekstinä heti pelin alla (18.11.2026). */
  commentPanel?: boolean;
}

/** Kommentin mitat (0 = ei kommenttia): enintään kolme riviä; paneelissa sisennys ja reunat. */
export interface CommentBlock {
  lines: string[];
  h: number;
  px: number;
  panel: boolean;
}

export function commentLayout(ctx: CanvasRenderingContext2D, text: string | undefined, story: boolean, p: Palette, panel = true): CommentBlock {
  if (!text) return { lines: [], h: 0, px: 0, panel };
  const px = story ? 40 : 34;
  ctx.font = `500 ${px}px ${p.sans}`;
  const lines = wrap(ctx, text, W - PAD * 2 - (panel ? 90 : 0), 3);
  return { lines, h: lines.length * px * 1.3 + (panel ? (story ? 64 : 50) : 0), px, panel };
}

/** Kommentti: paneeli ja korostusviiva vasemmalla, tai pelkkä teksti (keskitetty VS-asettelussa). */
export function drawComment(ctx: CanvasRenderingContext2D, c: CommentBlock, y: number, p: Palette, align: 'left' | 'center' = 'left') {
  ctx.font = `500 ${c.px}px ${p.sans}`;
  if (!c.panel) {
    ctx.fillStyle = p.ink;
    ctx.textAlign = align;
    const x = align === 'center' ? W / 2 : PAD;
    c.lines.forEach((l, i) => ctx.fillText(l, x, y + c.px * 0.95 + i * c.px * 1.3));
    ctx.textAlign = 'left';
    return;
  }
  const maxW = W - PAD * 2;
  ctx.fillStyle = p.panel;
  rr(ctx, PAD, y, maxW, c.h, 30);
  ctx.fill();
  ctx.fillStyle = p.accent;
  rr(ctx, PAD + 24, y + 22, 8, c.h - 44, 4);
  ctx.fill();
  ctx.font = `500 ${c.px}px ${p.sans}`;
  ctx.fillStyle = p.ink;
  const top = y + (c.h - c.lines.length * c.px * 1.3) / 2 + c.px * 0.95;
  c.lines.forEach((l, i) => ctx.fillText(l, PAD + 60, top + i * c.px * 1.3));
}

/** Koti/vieras-merkinnät VS-asettelun nimien alle: [oma joukkue, vastustaja]. */
export function homeAwayTags(homeAway: HomeAway | undefined, show: boolean | undefined): [string, string] | undefined {
  if (!homeAway || show === false) return undefined;
  return homeAway === 'home' ? ['Koti', 'Vieras'] : ['Vieras', 'Koti'];
}

/** Kankaan, paletin ja taustan alustus (tulos- ja ennakkokuva). */
export function setup(opts: Pick<DrawOptions, 'size' | 'style' | 'color'>) {
  const H = HEIGHT[opts.size];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const color = resolveShareColor(opts.color);
  const p = palette(opts.style, color);
  background(ctx, H, opts.style, color);
  return { canvas, ctx, p, H, story: opts.size === 'story' };
}

export function dateLabelOf(date: string): string {
  const t = formatDate(date, 'cccc d.M.yyyy');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function drawResultCard(card: ResultCard, opts: DrawOptions): HTMLCanvasElement {
  const { canvas, ctx, p, H, story } = setup(opts);
  const maxW = W - PAD * 2;
  const dateLabel = dateLabelOf(card.date);
  const origins = opts.origins;

  // Yläosa: tunniste, otsikko ja päivä.
  let y = story ? 170 : 104;
  ctx.font = `700 ${story ? 32 : 28}px ${p.sans}`;
  ctx.fillStyle = p.accent;
  ctx.fillText(spaced(card.kind === 'tournament' ? 'Turnaus' : 'Ottelu'), PAD, y);
  y += story ? 34 : 26;

  if (card.kind === 'tournament') {
    const titlePx = story ? 104 : 84;
    ctx.font = `${heavyOf(opts.style)} ${titlePx}px ${p.display}`;
    const lines = wrap(ctx, card.eventName ?? 'Turnaus', maxW, 2);
    ctx.fillStyle = p.ink;
    lines.forEach((l) => {
      y += titlePx * 1.04;
      ctx.fillText(l, PAD, y);
    });
    y += story ? 74 : 58;
    ctx.font = `500 ${story ? 40 : 34}px ${p.sans}`;
    ctx.fillStyle = p.soft;
    ctx.fillText(dateLabel, PAD, y);
    const bh = levelBadges(ctx, card.level, card.format, PAD, y + (story ? 30 : 22), story, p, card.series);
    if (bh) y += (story ? 30 : 22) + bh - (story ? 14 : 10);

    // Oma joukkue, pelirivit, (kommentti), (lapsen maalit) ja yhteenveto yhtenä lohkona, joka keskitetään otsikon alle.
    const comment = commentLayout(ctx, card.comment, story, p, opts.commentPanel !== false);
    const commentGap = comment.panel ? (story ? 32 : 24) : story ? 76 : 60;
    const commentH = comment.h ? comment.h + commentGap : 0;
    y += story ? 64 : 44;
    const ls = story ? 112 : 92;
    const teamGap = story ? 44 : 28;
    const playerH = opts.player && card.playerGoals > 0 ? (story ? 96 : 80) : 0;
    const playerGap = story ? 28 : 20;
    const sumH = story ? 200 : 150;
    const sumGap = story ? 48 : 32;
    const bottom = H - (story ? 140 : 84);
    const n = card.games.length;
    const gap = story ? 18 : 14;
    const labelH = story ? 56 : 44;
    const fixedH = ls + teamGap + labelH + commentH + sumGap + (playerH ? playerH + playerGap : 0) + sumH;
    const rowH = Math.min(story ? 168 : 132, (bottom - y - fixedH - gap * (n - 1)) / n);
    const listH = n * rowH + (n - 1) * gap;
    y += Math.max(0, (bottom - y - fixedH - listH) / 2);

    drawLogo(ctx, opts.logos.team, card.team, PAD, y, ls, p.sans);
    ctx.fillStyle = p.ink;
    const teamText = fit(ctx, card.team ?? 'Oma joukkue', maxW - ls - 32, (px) => `700 ${px}px ${p.sans}`, story ? 52 : 46, 30);
    const teamOrigin = origins?.team?.country || origins?.team?.city;
    ctx.fillText(teamText, PAD + ls + 32, y + ls / 2 + (teamOrigin ? -4 : 17));
    if (teamOrigin) drawOrigin(ctx, origins?.team, PAD + ls + 32, y + ls / 2 + (story ? 46 : 40), story ? 30 : 26, p, 'left', maxW - ls - 32);
    y += ls + teamGap;
    ctx.font = `700 ${story ? 28 : 24}px ${p.sans}`;
    ctx.fillStyle = p.accent;
    ctx.fillText(spaced('Tulokset'), PAD, y + (story ? 30 : 24));
    y += labelH;
    const sumTop = y + listH + commentH + sumGap + (playerH ? playerH + playerGap : 0);
    if (comment.h) drawComment(ctx, comment, y + listH + commentGap, p);
    card.games.forEach((g, k) => {
      const top = y + k * (rowH + gap);
      ctx.fillStyle = p.panel;
      rr(ctx, PAD, top, maxW, rowH, Math.min(36, rowH * 0.28));
      ctx.fill();
      const lsz = Math.min(rowH - 36, story ? 112 : 92);
      const lx = PAD + 22;
      drawLogo(ctx, opts.logos.opponents[k], g.opponent, lx, top + (rowH - lsz) / 2, lsz, p.sans);
      // Tulos ja V/T/H oikealla
      const chipH = Math.min(68, rowH * 0.48);
      const right = PAD + maxW - 24;
      let scoreRight = right;
      if (g.outcome) {
        ctx.fillStyle = OUTCOME_COLOR[g.outcome];
        rr(ctx, right - chipH, top + (rowH - chipH) / 2, chipH, chipH, chipH * 0.3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${Math.round(chipH * 0.52)}px ${p.sans}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(OUTCOME_LETTER[g.outcome], right - chipH / 2, top + rowH / 2 + 1);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        scoreRight = right - chipH - 24;
      }
      const score = g.outcome ? `${g.goalsFor}–${g.goalsAgainst}` : '–';
      ctx.font = `${heavyOf(opts.style)} ${Math.round(Math.min(rowH * 0.46, story ? 72 : 60))}px ${p.display}`;
      ctx.fillStyle = g.outcome ? p.ink : p.soft;
      const sw = ctx.measureText(score).width;
      ctx.fillText(score, scoreRight - sw, top + rowH / 2 + rowH * 0.15);
      // Vastustaja ja pelin numero
      const tx = lx + lsz + 26;
      const tw = scoreRight - sw - 30 - tx;
      ctx.fillStyle = p.ink;
      const name = fit(ctx, g.opponent ?? 'Vastustaja', tw, (px) => `700 ${px}px ${p.sans}`, Math.round(Math.min(44, rowH * 0.3)), 24);
      ctx.fillText(name, tx, top + rowH / 2 - 2);
      const ha = opts.homeAway !== false && g.homeAway ? HOME_AWAY_LABEL[g.homeAway] : undefined;
      const sub = [`${k + 1}. peli`, g.time && `klo ${g.time}`, ha, opts.player && g.playerGoals ? `⚽ ${g.playerGoals}` : undefined].filter(Boolean).join('  ·  ');
      const subPx = Math.round(Math.min(30, rowH * 0.21));
      const subY = top + rowH / 2 + Math.min(40, rowH * 0.3);
      ctx.font = `500 ${subPx}px ${p.sans}`;
      ctx.fillStyle = p.soft;
      ctx.fillText(sub, tx, subY);
      const o = origins?.opponents[k];
      if (o?.country || o?.city) {
        const after = tx + ctx.measureText(sub).width + subPx;
        drawOrigin(ctx, o, after, subY, subPx, p, 'left', tw - (after - tx));
      }
    });

    if (playerH) {
      const py = sumTop - playerH - playerGap;
      drawPlayer(ctx, opts.player!, card.playerGoals, PAD, py, playerH, p);
    }
    // Yhteenvetolaatikot
    const stats: [string, string][] = [
      ['Pelit', String(card.games.length - card.noResult)],
      ['V – T – H', `${card.wins}–${card.draws}–${card.losses}`],
      ['Maalit', `${card.goalsFor}–${card.goalsAgainst}`],
    ];
    const cw = (maxW - 2 * 20) / 3;
    stats.forEach(([label, value], k) => {
      const x = PAD + k * (cw + 20);
      ctx.fillStyle = p.panel;
      rr(ctx, x, sumTop, cw, sumH, 34);
      ctx.fill();
      ctx.font = `700 ${story ? 26 : 23}px ${p.sans}`;
      ctx.fillStyle = p.soft;
      ctx.fillText(spaced(label), x + 30, sumTop + (story ? 62 : 48));
      ctx.fillStyle = p.ink;
      ctx.font = `${heavyOf(opts.style)} ${story ? 80 : 62}px ${p.display}`;
      ctx.fillText(fit(ctx, value, cw - 60, (px) => `${heavyOf(opts.style)} ${px}px ${p.display}`, story ? 80 : 62, 40), x + 30, sumTop + sumH - (story ? 40 : 30));
    });
    return canvas;
  }

  // Yksittäinen ottelu: logo – tulos – logo yhtenä rivinä, nimet logojen alla; lohko keskitetään.
  const g = card.games[0];
  y += story ? 92 : 70;
  ctx.font = `${heavyOf(opts.style)} ${story ? 64 : 54}px ${p.display}`;
  ctx.fillStyle = p.ink;
  ctx.fillText(dateLabel, PAD, y);
  const bh = levelBadges(ctx, card.level, card.format, PAD, y + (story ? 34 : 24), story, p, card.series);
  if (bh) y += (story ? 34 : 24) + bh;

  // Alareunan laatikot kuten ennakossa: pelin alku ja paikka (jos tiedossa); lapsen maalit niiden yläpuolella.
  const boxH = story ? 180 : 140;
  const placeH = story ? 190 : 150;
  const times: [string, string][] = card.kickoff ? [['Peli alkoi', card.kickoff]] : [];
  const playerH = opts.player && card.playerGoals > 0 ? (story ? 96 : 80) : 0;
  let boxesTop = H - (story ? 140 : 84);
  if (card.location) boxesTop -= placeH;
  if (times.length) boxesTop -= boxH + (card.location ? 20 : 0);
  const playerTop = boxesTop - (playerH ? playerH + (times.length || card.location ? 28 : 0) : 0);
  // Kommentti: paneeli laatikoiden yläpuolelle tai pelkkä teksti heti ottelun alle.
  const comment = commentLayout(ctx, card.comment, story, p, opts.commentPanel !== false);
  const commentGap = story ? 32 : 24;
  const plainGap = story ? 76 : 60;
  const commentTop = comment.h && comment.panel ? playerTop - comment.h - (playerH || times.length || card.location ? commentGap : 0) : playerTop;

  const heavy = heavyOf(opts.style);
  const display = (px: number) => `${heavy} ${px}px ${p.display}`;
  const tags = homeAwayTags(g.homeAway, opts.homeAway);
  const below = comment.h && !comment.panel ? comment.h + plainGap : 0;
  const nameBottom = drawMatchup(ctx, { team: card.team, opponent: g.opponent, logos: opts.logos, origins, y, boxesTop: commentTop, story, p, tags, belowH: below }, (top, ls) => {
    // Tulos logojen välissä, tulossana sen alla.
    const midW = W - PAD * 2 - ls * 2 - 70;
    const score = `${g.goalsFor ?? '–'}–${g.goalsAgainst ?? '–'}`;
    let px = story ? 190 : 150;
    ctx.font = display(px);
    while (ctx.measureText(score).width > midW && px > 80) {
      px -= 6;
      ctx.font = display(px);
    }
    const chipH = story ? 66 : 56;
    const scoreBase = top + ls / 2 + px * 0.3 - (g.outcome ? chipH * 0.55 : 0);
    ctx.textAlign = 'center';
    ctx.fillStyle = p.ink;
    ctx.fillText(score, W / 2, scoreBase);
    ctx.textAlign = 'left';
    if (g.outcome) chip(ctx, OUTCOME_WORD[g.outcome].toUpperCase(), OUTCOME_COLOR[g.outcome], W / 2, scoreBase + (story ? 34 : 28), chipH, p, 'center');
  });
  if (comment.h) drawComment(ctx, comment, comment.panel ? commentTop : nameBottom + plainGap, p, comment.panel ? 'left' : 'center');

  if (playerH) drawPlayer(ctx, opts.player!, card.playerGoals, PAD, playerTop, playerH, p);
  let by = boxesTop;
  if (times.length) {
    infoBoxes(ctx, times, by, boxH, story, p, display);
    by += boxH + 20;
  }
  if (card.location) placeBox(ctx, card.location, by, placeH, story, p);
  return canvas;
}

export function drawPlayer(ctx: CanvasRenderingContext2D, name: string, goals: number, x: number, y: number, h: number, p: Palette) {
  const text = `⚽  ${name}: ${goals} ${goals === 1 ? 'maali' : 'maalia'}`;
  ctx.font = `700 ${Math.round(h * 0.4)}px ${p.sans}`;
  const w = Math.min(W - PAD * 2, ctx.measureText(text).width + h * 0.9);
  ctx.fillStyle = p.panel;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = p.ink;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + h * 0.45, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

/**
 * Sarjataso ja pelimuoto selkeinä merkkeinä päivän alla (käyttäjän toive 14.11.2026): taso täytettynä
 * korostusvärillä ("ELITE"), pelimuoto ääriviivoin ("5v5"). Yläreuna y; palauttaa korkeuden (0 = ei merkkejä).
 */
export function levelBadges(ctx: CanvasRenderingContext2D, level: string | undefined, format: string | undefined, x: number, y: number, story: boolean, p: Palette, series?: string): number {
  // Sarja (esim. P9) ensimmäisenä ääriviivamerkkinä (18.11.2026).
  const items = [series ? { text: series, fill: false } : undefined, level ? { text: spaced(level), fill: true } : undefined, format ? { text: format, fill: false } : undefined].filter((i): i is { text: string; fill: boolean } => !!i);
  if (!items.length) return 0;
  const h = story ? 68 : 58;
  const px = Math.round(h * 0.46);
  let cx = x;
  for (const it of items) {
    ctx.font = `800 ${px}px ${p.sans}`;
    const w = ctx.measureText(it.text).width + h * 0.9;
    rr(ctx, cx + (it.fill ? 0 : 1.5), y + (it.fill ? 0 : 1.5), w - (it.fill ? 0 : 3), h - (it.fill ? 0 : 3), h / 2);
    if (it.fill) {
      ctx.fillStyle = p.accent;
      ctx.fill();
    } else {
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.ink;
      ctx.stroke();
    }
    // Tekstin väri: korostuksen päällä tumma (vaalealla pohjalla korostus on tumma, jolloin valkoinen).
    ctx.fillStyle = it.fill ? (p.light ? '#ffffff' : '#0f172a') : p.ink;
    ctx.textBaseline = 'middle';
    ctx.fillText(it.text, cx + h * 0.45, y + h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    cx += w + (story ? 16 : 12);
  }
  return h;
}

/** Tietolaatikot rivissä: otsikko pienellä, arvo isolla (kuten tuloskuvan yhteenveto). */
export function infoBoxes(ctx: CanvasRenderingContext2D, items: [string, string][], y: number, h: number, story: boolean, p: Palette, display: (px: number) => string) {
  const maxW = W - PAD * 2;
  const gap = 20;
  const cw = (maxW - gap * (items.length - 1)) / items.length;
  items.forEach(([label, value], k) => {
    const x = PAD + k * (cw + gap);
    ctx.fillStyle = p.panel;
    rr(ctx, x, y, cw, h, 34);
    ctx.fill();
    ctx.font = `700 ${story ? 26 : 23}px ${p.sans}`;
    ctx.fillStyle = p.soft;
    ctx.fillText(spaced(label), x + 30, y + (story ? 58 : 46));
    ctx.fillStyle = p.ink;
    const px = items.length > 2 ? (story ? 66 : 54) : story ? 80 : 62;
    ctx.fillText(fit(ctx, value, cw - 60, display, px, 34), x + 30, y + h - (story ? 38 : 28));
  });
}

/** Paikka omana leveänä laatikkonaan (kaksi riviä tarvittaessa). */
export function placeBox(ctx: CanvasRenderingContext2D, place: string, y: number, h: number, story: boolean, p: Palette) {
  const maxW = W - PAD * 2;
  ctx.fillStyle = p.panel;
  rr(ctx, PAD, y, maxW, h, 34);
  ctx.fill();
  ctx.font = `700 ${story ? 26 : 23}px ${p.sans}`;
  ctx.fillStyle = p.soft;
  ctx.fillText(spaced('Paikka'), PAD + 30, y + (story ? 58 : 46));
  const px = story ? 46 : 40;
  ctx.font = `700 ${px}px ${p.sans}`;
  ctx.fillStyle = p.ink;
  const lines = wrap(ctx, place, maxW - 60, 2);
  const startY = y + (story ? 58 : 46) + (h - (story ? 58 : 46) - lines.length * px * 1.15) / 2 + px * 0.9;
  lines.forEach((l, i) => ctx.fillText(l, PAD + 30, startY + i * px * 1.15));
}

/**
 * Ottelun asettelu (ennakko ja tulos samalla mallilla): logo – keskiosa – logo, nimet logojen alla
 * (enintään 3 riviä) ja niiden alla lippu ja kotipaikkakunta. Lohko keskitetään y:n ja boxesTop:n väliin;
 * `center` piirtää keskiosan (VS tai tulos) logojen korkeudelle.
 */
export function drawMatchup(
  ctx: CanvasRenderingContext2D,
  m: {
    team?: string;
    opponent?: string;
    logos: ShareLogos;
    origins?: ShareOrigins;
    y: number;
    boxesTop: number;
    story: boolean;
    p: Palette;
    /** Koti/vieras-merkinnät nimien alle (18.11.2026). */
    tags?: [string, string];
    /** Lohkon alle varattava tila (esim. kommentti pelkkänä tekstinä), jotta kokonaisuus keskitetään. */
    belowH?: number;
  },
  center: (top: number, ls: number) => void,
): number {
  const { story, p, origins } = m;
  const ls = story ? 250 : 210;
  const namePx = story ? 40 : 34;
  const nameW = story ? 340 : 300;
  ctx.font = `700 ${namePx}px ${p.sans}`;
  const names = [wrapName(ctx, m.team ?? 'Oma joukkue', nameW, 3), wrapName(ctx, m.opponent ?? 'Vastustaja', nameW, 3)];
  const hasOrigin = [origins?.team, origins?.opponents[0]].some((o) => o?.country || o?.city);
  const rowStep = story ? 50 : 42;
  const nameH = Math.max(...names.map((l) => l.length)) * namePx * 1.2 + ((hasOrigin ? 1 : 0) + (m.tags ? 1 : 0)) * rowStep;
  const blockH = ls + 36 + nameH + (m.belowH ?? 0);
  const top = m.y + Math.max(story ? 70 : 40, (m.boxesTop - (story ? 40 : 24) - m.y - blockH) / 2);
  const centers = [PAD + ls / 2 + (story ? 0 : 10), W - PAD - ls / 2 - (story ? 0 : 10)];
  drawLogo(ctx, m.logos.team, m.team, centers[0] - ls / 2, top, ls, p.sans);
  drawLogo(ctx, m.logos.opponents[0], m.opponent, centers[1] - ls / 2, top, ls, p.sans);
  ctx.textAlign = 'center';
  names.forEach((lines, k) => {
    ctx.font = `700 ${namePx}px ${p.sans}`;
    ctx.fillStyle = p.ink;
    lines.forEach((l, i) => ctx.fillText(l, centers[k], top + ls + 36 + namePx + i * namePx * 1.2));
    const originY = top + ls + 36 + namePx + lines.length * namePx * 1.2 + (story ? 10 : 6);
    drawOrigin(ctx, k === 0 ? origins?.team : origins?.opponents[0], centers[k], originY, story ? 30 : 26, p, 'center', nameW);
    ctx.textAlign = 'center';
    if (m.tags) {
      ctx.font = `800 ${story ? 28 : 24}px ${p.sans}`;
      ctx.fillStyle = p.accent;
      // Molemmat merkinnät samalle riville pisimmän nimen alle.
      const maxLines = Math.max(...names.map((l) => l.length));
      const tagY = top + ls + 36 + namePx + maxLines * namePx * 1.2 + (story ? 10 : 6) + (hasOrigin ? rowStep - 4 : 0);
      ctx.fillText(spaced(m.tags[k]), centers[k], tagY);
    }
  });
  ctx.textAlign = 'left';
  center(top, ls);
  return top + ls + 36 + nameH;
}

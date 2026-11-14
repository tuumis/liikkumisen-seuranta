// Tuloskuva canvasille (SPEC 16): tarina 1080 × 1920 tai julkaisu 1080 × 1350, sovelluksen teemalla
// tai neutraalilla urheilutyylillä. Logot ovat käyttäjän lisäämiä kuvia (data URL); ei verkkoa.

import type { GameOutcome } from '../../domain/football';
import { initials, OUTCOME_WORD, type ResultCard } from '../../domain/resultCard';
import { formatDate } from '../../ui/format';
import { drawFlag } from '../../ui/flags';
import { alpha, isLightColor, mix, resolveShareColor, type ShareColor } from './shareColors';

export type ShareSize = 'story' | 'post';
export type ShareStyle = 'theme' | 'sport';

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

/** Urheilutyylin korostus: valittu väri (liian tumma vaalennetaan) tai vihreä. */
const sportAccent = (color?: ShareColor) => (!color ? '#4ade80' : color.id === 'black' && color.accent ? color.accent : isDark(color.base) ? mix(color.base, '#ffffff', 0.45) : mix(color.base, '#ffffff', 0.12));
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
    ctx.font = `${opts.style === 'sport' ? 800 : 600} ${titlePx}px ${p.display}`;
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
    const bh = levelBadges(ctx, card.level, card.format, PAD, y + (story ? 30 : 22), story, p);
    if (bh) y += (story ? 30 : 22) + bh - (story ? 14 : 10);

    // Oma joukkue, pelirivit, (lapsen maalit) ja yhteenveto yhtenä lohkona, joka keskitetään otsikon alle.
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
    const fixedH = ls + teamGap + labelH + sumGap + (playerH ? playerH + playerGap : 0) + sumH;
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
    const sumTop = y + listH + sumGap + (playerH ? playerH + playerGap : 0);
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
      ctx.font = `${opts.style === 'sport' ? 800 : 600} ${Math.round(Math.min(rowH * 0.46, story ? 72 : 60))}px ${p.display}`;
      ctx.fillStyle = g.outcome ? p.ink : p.soft;
      const sw = ctx.measureText(score).width;
      ctx.fillText(score, scoreRight - sw, top + rowH / 2 + rowH * 0.15);
      // Vastustaja ja pelin numero
      const tx = lx + lsz + 26;
      const tw = scoreRight - sw - 30 - tx;
      ctx.fillStyle = p.ink;
      const name = fit(ctx, g.opponent ?? 'Vastustaja', tw, (px) => `700 ${px}px ${p.sans}`, Math.round(Math.min(44, rowH * 0.3)), 24);
      ctx.fillText(name, tx, top + rowH / 2 - 2);
      const sub = [`${k + 1}. peli`, g.time && `klo ${g.time}`, opts.player && g.playerGoals ? `⚽ ${g.playerGoals}` : undefined].filter(Boolean).join('  ·  ');
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
      ctx.font = `${opts.style === 'sport' ? 800 : 600} ${story ? 80 : 62}px ${p.display}`;
      ctx.fillText(fit(ctx, value, cw - 60, (px) => `${opts.style === 'sport' ? 800 : 600} ${px}px ${p.display}`, story ? 80 : 62, 40), x + 30, sumTop + sumH - (story ? 40 : 30));
    });
    return canvas;
  }

  // Yksittäinen ottelu: logo – tulos – logo yhtenä rivinä, nimet logojen alla; lohko keskitetään.
  const g = card.games[0];
  y += story ? 92 : 70;
  ctx.font = `${opts.style === 'sport' ? 800 : 600} ${story ? 64 : 54}px ${p.display}`;
  ctx.fillStyle = p.ink;
  ctx.fillText(dateLabel, PAD, y);
  const bh = levelBadges(ctx, card.level, card.format, PAD, y + (story ? 34 : 24), story, p);
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

  const heavy = opts.style === 'sport' ? 800 : 600;
  const display = (px: number) => `${heavy} ${px}px ${p.display}`;
  drawMatchup(ctx, { team: card.team, opponent: g.opponent, logos: opts.logos, origins, y, boxesTop: playerTop, story, p }, (top, ls) => {
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
export function levelBadges(ctx: CanvasRenderingContext2D, level: string | undefined, format: string | undefined, x: number, y: number, story: boolean, p: Palette): number {
  const items = [level ? { text: spaced(level), fill: true } : undefined, format ? { text: format, fill: false } : undefined].filter((i): i is { text: string; fill: boolean } => !!i);
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
  m: { team?: string; opponent?: string; logos: ShareLogos; origins?: ShareOrigins; y: number; boxesTop: number; story: boolean; p: Palette },
  center: (top: number, ls: number) => void,
) {
  const { story, p, origins } = m;
  const ls = story ? 250 : 210;
  const namePx = story ? 40 : 34;
  const nameW = story ? 340 : 300;
  ctx.font = `700 ${namePx}px ${p.sans}`;
  const names = [wrapName(ctx, m.team ?? 'Oma joukkue', nameW, 3), wrapName(ctx, m.opponent ?? 'Vastustaja', nameW, 3)];
  const hasOrigin = [origins?.team, origins?.opponents[0]].some((o) => o?.country || o?.city);
  const nameH = Math.max(...names.map((l) => l.length)) * namePx * 1.2 + (hasOrigin ? (story ? 50 : 42) : 0);
  const blockH = ls + 36 + nameH;
  const top = m.y + Math.max(story ? 70 : 40, (m.boxesTop - (story ? 40 : 24) - m.y - blockH) / 2);
  const centers = [PAD + ls / 2 + (story ? 0 : 10), W - PAD - ls / 2 - (story ? 0 : 10)];
  drawLogo(ctx, m.logos.team, m.team, centers[0] - ls / 2, top, ls, p.sans);
  drawLogo(ctx, m.logos.opponents[0], m.opponent, centers[1] - ls / 2, top, ls, p.sans);
  ctx.textAlign = 'center';
  names.forEach((lines, k) => {
    ctx.font = `700 ${namePx}px ${p.sans}`;
    ctx.fillStyle = p.ink;
    lines.forEach((l, i) => ctx.fillText(l, centers[k], top + ls + 36 + namePx + i * namePx * 1.2));
    drawOrigin(ctx, k === 0 ? origins?.team : origins?.opponents[0], centers[k], top + ls + 36 + namePx + lines.length * namePx * 1.2 + (story ? 10 : 6), story ? 30 : 26, p, 'center', nameW);
    ctx.textAlign = 'center';
  });
  ctx.textAlign = 'left';
  center(top, ls);
}

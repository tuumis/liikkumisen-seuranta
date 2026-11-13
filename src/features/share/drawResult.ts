// Tuloskuva canvasille (SPEC 16): tarina 1080 × 1920 tai julkaisu 1080 × 1350, sovelluksen teemalla
// tai neutraalilla urheilutyylillä. Logot ovat käyttäjän lisäämiä kuvia (data URL); ei verkkoa.

import type { GameOutcome } from '../../domain/football';
import { initials, OUTCOME_WORD, resultKicker, type ResultCard } from '../../domain/resultCard';
import { formatDate } from '../../ui/format';

export type ShareSize = 'story' | 'post';
export type ShareStyle = 'theme' | 'sport';

export interface ShareLogos {
  team?: HTMLImageElement;
  opponents: (HTMLImageElement | undefined)[];
}

const W = 1080;
const HEIGHT: Record<ShareSize, number> = { story: 1920, post: 1350 };
const PAD = 84;

/** Tuloksen värit (tekstinä myös V / T / H, joten väri ei ole ainoa tunniste). */
const OUTCOME_COLOR: Record<GameOutcome, string> = { W: '#15803d', D: '#b45309', L: '#b91c1c' };
const OUTCOME_LETTER: Record<GameOutcome, string> = { W: 'V', D: 'T', L: 'H' };

const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

interface Palette {
  ink: string;
  soft: string;
  accent: string;
  panel: string;
  display: string;
  sans: string;
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

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Teksti mahtumaan: fonttia pienennetään rajaan asti, sitten lyhennetään "…"-merkillä. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, font: (px: number) => string, size: number, min: number): string {
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

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
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
function wrapName(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
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

function spaced(text: string) {
  return text.toUpperCase().split('').join(String.fromCharCode(8202));
}

/** Logo valkoisella pyöristetyllä pohjalla kokonaisena; puuttuessa seuran nimikirjaimet. */
function drawLogo(ctx: CanvasRenderingContext2D, img: HTMLImageElement | undefined, name: string | undefined, x: number, y: number, size: number, sans: string) {
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

function background(ctx: CanvasRenderingContext2D, H: number, style: ShareStyle) {
  if (style === 'theme') {
    const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
    g.addColorStop(0, css('--hero-from', '#2c5a46'));
    g.addColorStop(1, css('--hero-to', '#1a3a2d'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W, 0, 0, W, 0, W * 1.1);
    glow.addColorStop(0, 'rgba(221,169,110,0.22)');
    glow.addColorStop(1, 'rgba(221,169,110,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 3;
    for (let r = 60; r < 2600; r += 70) {
      ctx.beginPath();
      ctx.arc(W * 1.1, -H * 0.05, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  // Urheilutyyli: tumma yönsininen, viistot raidat ja kirkas reunaviiva.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b1220');
  g.addColorStop(1, '#111c33');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.42);
  ctx.fillStyle = 'rgba(255,255,255,0.028)';
  for (let x = -H; x < H; x += 160) ctx.fillRect(x, -H, 70, H * 2);
  ctx.restore();
  const spot = ctx.createRadialGradient(W * 0.15, H * 0.1, 0, W * 0.15, H * 0.1, W);
  spot.addColorStop(0, 'rgba(74,222,128,0.16)');
  spot.addColorStop(1, 'rgba(74,222,128,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(0, 0, 14, H);
}

function palette(style: ShareStyle): Palette {
  const display = css('--font-display', 'Georgia, serif');
  const sans = css('--font-sans', 'system-ui, sans-serif');
  if (style === 'theme')
    return { ink: css('--hero-ink', '#f6f5f0'), soft: css('--hero-ink-soft', '#c9dccb'), accent: css('--hero-accent', '#e6bd89'), panel: 'rgba(255,255,255,0.09)', display, sans };
  return { ink: '#ffffff', soft: 'rgba(226,232,240,0.78)', accent: '#4ade80', panel: 'rgba(255,255,255,0.07)', display: sans, sans };
}

function chip(ctx: CanvasRenderingContext2D, text: string, color: string, x: number, y: number, h: number, p: Palette, align: 'left' | 'center' | 'right' = 'left') {
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
}

export function drawResultCard(card: ResultCard, opts: DrawOptions): HTMLCanvasElement {
  const H = HEIGHT[opts.size];
  const story = opts.size === 'story';
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const p = palette(opts.style);
  background(ctx, H, opts.style);
  const maxW = W - PAD * 2;
  const dateText = formatDate(card.date, 'cccc d.M.yyyy');
  const dateLabel = dateText.charAt(0).toUpperCase() + dateText.slice(1);

  // Yläosa: tunniste, otsikko ja päivä.
  let y = story ? 170 : 104;
  ctx.font = `700 ${story ? 32 : 28}px ${p.sans}`;
  ctx.fillStyle = p.accent;
  ctx.fillText(spaced(resultKicker(card)), PAD, y);
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
    y += story ? 66 : 54;
    ctx.font = `500 ${story ? 40 : 34}px ${p.sans}`;
    ctx.fillStyle = p.soft;
    ctx.fillText(dateLabel, PAD, y);

    // Oma joukkue, pelirivit, (lapsen maalit) ja yhteenveto yhtenä lohkona, joka keskitetään otsikon alle.
    y += story ? 64 : 44;
    const ls = story ? 112 : 92;
    const teamGap = story ? 48 : 32;
    const playerH = opts.player && card.playerGoals > 0 ? (story ? 96 : 80) : 0;
    const playerGap = story ? 28 : 20;
    const sumH = story ? 200 : 150;
    const sumGap = story ? 48 : 32;
    const bottom = H - (story ? 140 : 84);
    const n = card.games.length;
    const gap = story ? 18 : 14;
    const fixedH = ls + teamGap + sumGap + (playerH ? playerH + playerGap : 0) + sumH;
    const rowH = Math.min(story ? 168 : 132, (bottom - y - fixedH - gap * (n - 1)) / n);
    const listH = n * rowH + (n - 1) * gap;
    y += Math.max(0, (bottom - y - fixedH - listH) / 2);

    drawLogo(ctx, opts.logos.team, card.team, PAD, y, ls, p.sans);
    ctx.fillStyle = p.ink;
    const teamText = fit(ctx, card.team ?? 'Oma joukkue', maxW - ls - 32, (px) => `700 ${px}px ${p.sans}`, story ? 52 : 46, 30);
    ctx.fillText(teamText, PAD + ls + 32, y + ls / 2 + 17);
    y += ls + teamGap;
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
      ctx.font = `500 ${Math.round(Math.min(30, rowH * 0.21))}px ${p.sans}`;
      ctx.fillStyle = p.soft;
      ctx.fillText(sub, tx, top + rowH / 2 + Math.min(40, rowH * 0.3));
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

  const ls = story ? 250 : 220;
  const namePx = story ? 40 : 34;
  const nameW = story ? 320 : 290;
  ctx.font = `700 ${namePx}px ${p.sans}`;
  const names = [wrapName(ctx, card.team ?? 'Oma joukkue', nameW, 2), wrapName(ctx, g.opponent ?? 'Vastustaja', nameW, 2)];
  const nameH = Math.max(...names.map((l) => l.length)) * namePx * 1.2;
  const playerH = opts.player && card.playerGoals > 0 ? (story ? 96 : 80) : 0;
  const bottomLimit = H - (story ? 140 : 84) - (playerH ? playerH + 40 : 0);
  const blockH = ls + 36 + nameH;
  const top = y + Math.max(story ? 80 : 50, (bottomLimit - y - blockH) / 2);
  const centers = [PAD + ls / 2, W - PAD - ls / 2];
  drawLogo(ctx, opts.logos.team, card.team, centers[0] - ls / 2, top, ls, p.sans);
  drawLogo(ctx, opts.logos.opponents[0], g.opponent, centers[1] - ls / 2, top, ls, p.sans);
  ctx.textAlign = 'center';
  names.forEach((lines, k) => {
    ctx.font = `700 ${namePx}px ${p.sans}`;
    ctx.fillStyle = p.ink;
    lines.forEach((l, i) => ctx.fillText(l, centers[k], top + ls + 36 + namePx + i * namePx * 1.2));
  });

  // Tulos logojen välissä, tulossana sen alla.
  const midW = W - PAD * 2 - ls * 2 - 90;
  const score = `${g.goalsFor ?? '–'}–${g.goalsAgainst ?? '–'}`;
  const scoreFont = (px: number) => `${opts.style === 'sport' ? 800 : 600} ${px}px ${p.display}`;
  let px = story ? 190 : 160;
  ctx.font = scoreFont(px);
  while (ctx.measureText(score).width > midW && px > 80) {
    px -= 6;
    ctx.font = scoreFont(px);
  }
  const chipH = story ? 66 : 56;
  const scoreBase = top + ls / 2 + px * 0.3 - (g.outcome ? chipH * 0.55 : 0);
  ctx.fillStyle = p.ink;
  ctx.fillText(score, W / 2, scoreBase);
  ctx.textAlign = 'left';
  if (g.outcome) chip(ctx, OUTCOME_WORD[g.outcome].toUpperCase(), OUTCOME_COLOR[g.outcome], W / 2, scoreBase + (story ? 34 : 28), chipH, p, 'center');

  if (playerH) drawPlayer(ctx, opts.player!, card.playerGoals, PAD, H - (story ? 140 : 84) - playerH, playerH, p);
  return canvas;
}

function drawPlayer(ctx: CanvasRenderingContext2D, name: string, goals: number, x: number, y: number, h: number, p: Palette) {
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

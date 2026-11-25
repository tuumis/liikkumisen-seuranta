// Valmentajan koosteen jakokuva (25.11.2026): Brändi-tyylin tumma pohja, kapea otsikkofontti ja Work Sans.
// Kuva syntyy laitteella; mitään ei lähetetä ennen kuin käyttäjä jakaa sen itse.

import { COACH_PART_LABEL, fi1, type CoachPart, type CoachView } from '../../domain/coachSummary';
import { PAD, spaced, W, wrap } from '../share/drawResult';

type Ctx = CanvasRenderingContext2D;

/** Osien värit tummalla pohjalla (sininen, oranssi, vihreä, violetti, harmaa); tunnistus myös selitteestä. */
export const COACH_COLOR: Record<CoachPart, string> = { football: '#4c8ff0', own: '#ea7a3f', other: '#33b886', school: '#a98bf5', everyday: '#8f969e' };

const BG = '#0c0c0c';
const INK = '#f5f5f5';
const SOFT = 'rgba(245,245,245,0.62)';
const MUTED = 'rgba(245,245,245,0.42)';
const HAIR = 'rgba(245,245,245,0.14)';
const ACCENT = '#e64773';
const DISPLAY = "'Bebas Neue', 'Arial Narrow', sans-serif";
const SANS = "'Work Sans', system-ui, sans-serif";
const big = (px: number) => `400 ${Math.round(px)}px ${DISPLAY}`;
const sans = (px: number, w = 500) => `${w} ${Math.round(px)}px ${SANS}`;
const MIN_H = 1350;
const MAX_H = 2400;

export interface CoachCardText {
  /** "Liikkuminen · vk 45–48" */
  kicker: string;
  name: string;
  /** Joukkue (valinnainen). */
  team?: string;
}

function fitText(ctx: Ctx, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export function drawCoachCard(head: CoachCardText, v: CoachView): HTMLCanvasElement {
  const work = document.createElement('canvas');
  work.width = W;
  work.height = MAX_H;
  const ctx = work.getContext('2d')!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, MAX_H);
  const maxW = W - PAD * 2;
  const right = W - PAD;

  // Otsikko: tunniste korostusvärillä, nimi isolla ja joukkue.
  let y = 120;
  ctx.font = sans(28, 700);
  ctx.fillStyle = ACCENT;
  ctx.fillText(spaced(head.kicker), PAD, y);
  y += 132;
  ctx.font = big(150);
  ctx.fillStyle = INK;
  ctx.fillText(fitText(ctx, head.name.toUpperCase(), maxW), PAD, y);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 70, 16, y - 70);
  if (head.team) {
    y += 58;
    ctx.font = sans(34, 600);
    ctx.fillStyle = SOFT;
    ctx.fillText(fitText(ctx, head.team, maxW), PAD, y);
  }

  // Luvut kolmessa ruudussa.
  y += 64;
  const gap = 24;
  const tw = (maxW - gap * 2) / 3;
  const th = 176;
  v.tiles.forEach((t, i) => {
    const x = PAD + i * (tw + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(x, y, tw, th, 22);
    ctx.fill();
    ctx.font = big(104);
    ctx.fillStyle = INK;
    ctx.fillText(t.value, x + 28, y + 108);
    const vw = ctx.measureText(t.value).width;
    if (t.unit) {
      ctx.font = sans(28, 600);
      ctx.fillStyle = SOFT;
      ctx.fillText(t.unit, x + 28 + vw + 10, y + 108);
    }
    ctx.font = sans(26, 600);
    ctx.fillStyle = SOFT;
    ctx.fillText(fitText(ctx, t.label, tw - 56), x + 28, y + 150);
  });
  y += th + 66;

  // Selite (vain näkyvät osat).
  ctx.font = sans(26, 600);
  let lx = PAD;
  for (const p of v.parts) {
    const label = COACH_PART_LABEL[p];
    const w = 22 + 12 + ctx.measureText(label).width;
    if (lx + w > right) {
      lx = PAD;
      y += 44;
    }
    ctx.fillStyle = COACH_COLOR[p];
    ctx.beginPath();
    ctx.roundRect(lx, y - 20, 22, 22, 5);
    ctx.fill();
    ctx.fillStyle = SOFT;
    ctx.fillText(label, lx + 34, y);
    lx += w + 34;
  }
  y += 44;

  // Vaakapylväät jaksoittain: tunniste, pinottu pylväs ja yhteensä tunteina.
  const labelW = 120;
  const totalW = 120;
  const barX = PAD + labelW;
  const barW = maxW - labelW - totalW;
  const maxTotal = Math.max(60, ...v.buckets.map((b) => b.total));
  const rowH = v.buckets.length > 6 ? 58 : 72;
  const barH = rowH - 28;
  for (const b of v.buckets) {
    ctx.font = sans(28, 600);
    ctx.fillStyle = SOFT;
    ctx.textAlign = 'left';
    ctx.fillText(b.label.toUpperCase(), PAD, y + barH / 2 + 10);
    // Pohjaviiva (tyhjäkin jakso näkyy).
    ctx.fillStyle = HAIR;
    ctx.fillRect(barX, y + barH / 2 - 1, barW, 2);
    let x = barX;
    const segs = v.parts.filter((p) => b.minutes[p] > 0);
    segs.forEach((p, i) => {
      const w = (b.minutes[p] / maxTotal) * barW;
      const last = i === segs.length - 1;
      ctx.fillStyle = COACH_COLOR[p];
      ctx.beginPath();
      // 2 px väli osien välissä, pyöristetty pää vain viimeisessä.
      ctx.roundRect(x, y, Math.max(2, w - (last ? 0 : 3)), barH, last ? [0, 8, 8, 0] : 0);
      ctx.fill();
      x += w;
    });
    if (b.partial) {
      ctx.font = sans(22, 600);
      ctx.fillStyle = MUTED;
      ctx.fillText('kesken', x + 14, y + barH / 2 + 8);
    }
    ctx.font = sans(30, 700);
    ctx.fillStyle = INK;
    ctx.textAlign = 'right';
    ctx.fillText(b.total > 0 ? `${fi1(b.total / 60)} h` : '–', right, y + barH / 2 + 11);
    ctx.textAlign = 'left';
    y += rowH;
  }
  y += 24;

  // Tietorivit: nimi vasemmalla, arvo oikealla (pitkä arvo rivitetään).
  for (const r of v.rows) {
    ctx.fillStyle = HAIR;
    ctx.fillRect(PAD, y, maxW, 2);
    y += 54;
    ctx.font = sans(30, 500);
    ctx.fillStyle = SOFT;
    const lw = ctx.measureText(r.label).width;
    ctx.fillText(r.label, PAD, y);
    ctx.font = sans(30, 700);
    ctx.fillStyle = INK;
    ctx.textAlign = 'right';
    // Arvo samalle riville, jos se mahtuu nimen viereen; muuten nimen alle (enintään kaksi riviä).
    const room = maxW - lw - 40;
    if (ctx.measureText(r.value).width <= room) ctx.fillText(r.value, right, y);
    else
      wrap(ctx, r.value, maxW, 2).forEach((l) => {
        y += 44;
        ctx.fillText(l, right, y);
      });
    ctx.textAlign = 'left';
    y += 30;
  }

  // Muistiinpanot (valinnainen).
  if (v.notes.length) {
    ctx.fillStyle = HAIR;
    ctx.fillRect(PAD, y, maxW, 2);
    y += 52;
    ctx.font = sans(24, 700);
    ctx.fillStyle = MUTED;
    ctx.fillText(spaced('Muistiinpanot'), PAD, y);
    for (const n of v.notes) {
      ctx.font = sans(28, 500);
      ctx.fillStyle = SOFT;
      const [, mm, dd] = n.date.split('-').map(Number);
      const lines = wrap(ctx, `${dd}.${mm}. ${n.text}`, maxW, 2);
      for (const l of lines) {
        y += 42;
        ctx.fillText(l, PAD, y);
      }
    }
    y += 24;
  }

  // Huomiot neutraalisti.
  for (const o of v.observations) {
    y += 48;
    ctx.font = sans(28, 500);
    const lines = wrap(ctx, o, maxW - 40, 2);
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(PAD + 9, y - 10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    lines.forEach((l, i) => ctx.fillText(l, PAD + 40, y + i * 40));
    y += (lines.length - 1) * 40;
  }

  // Alatunniste.
  const footerY = Math.max(MIN_H - 70, y + 110);
  const H = Math.min(MAX_H, footerY + 70);
  ctx.fillStyle = HAIR;
  ctx.fillRect(PAD, footerY - 52, maxW, 2);
  ctx.font = sans(24, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText(fitText(ctx, 'Luvut ovat arvioita lajien tyypillisestä tehosta.', maxW - 320), PAD, footerY);
  ctx.textAlign = 'right';
  ctx.font = sans(24, 700);
  ctx.fillText('Liikkumisen seuranta', right, footerY);
  ctx.textAlign = 'left';

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  out.getContext('2d')!.drawImage(work, 0, 0);
  return out;
}

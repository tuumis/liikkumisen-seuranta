// Otteluennakko canvasille (SPEC 16, 14.11.2026): sama pohja, tyylit ja värit kuin tuloskuvassa.
// Ottelu: logo – VS – logo, nimet, liput ja kotipaikkakunnat, aloitusaika, paikalla-aika ja paikka.
// Turnaus: nimi, päivä, oma joukkue ja otteluohjelma (kellonaika, vastustaja, lippu, paikka).

import type { PreviewCard } from '../../domain/previewCard';
import { dateLabelOf, drawLogo, drawMatchup, drawOrigin, fit, infoBoxes, levelBadges, PAD, placeBox, rr, setup, spaced, W, wrap, type DrawOptions } from './drawResult';

type PreviewOptions = Omit<DrawOptions, 'player'>;

export function drawPreviewCard(card: PreviewCard, opts: PreviewOptions): HTMLCanvasElement {
  const { canvas, ctx, p, H, story } = setup(opts);
  const maxW = W - PAD * 2;
  const heavy = opts.style === 'sport' ? 800 : 600;
  const display = (px: number) => `${heavy} ${px}px ${p.display}`;
  const origins = opts.origins;
  const bottom = H - (story ? 140 : 84);

  let y = story ? 170 : 104;
  ctx.font = `700 ${story ? 32 : 28}px ${p.sans}`;
  ctx.fillStyle = p.accent;
  ctx.fillText(spaced(card.kind === 'tournament' ? 'Turnausennakko' : 'Otteluennakko'), PAD, y);
  y += story ? 34 : 26;

  const boxH = story ? 180 : 140;
  const placeH = story ? 190 : 150;
  const times: [string, string][] = [];
  if (card.arrival) times.push(['Paikalla', card.arrival]);
  if (card.kickoff) times.push([card.kind === 'tournament' ? '1. peli' : 'Peli alkaa', card.kickoff]);

  if (card.kind === 'tournament') {
    const titlePx = story ? 104 : 84;
    ctx.font = display(titlePx);
    const lines = wrap(ctx, card.eventName ?? 'Turnaus', maxW, 2);
    ctx.fillStyle = p.ink;
    lines.forEach((l) => {
      y += titlePx * 1.04;
      ctx.fillText(l, PAD, y);
    });
    y += story ? 74 : 58;
    ctx.font = `500 ${story ? 40 : 34}px ${p.sans}`;
    ctx.fillStyle = p.soft;
    ctx.fillText(dateLabelOf(card.date), PAD, y);
    const bh = levelBadges(ctx, card.level, card.format, PAD, y + (story ? 30 : 22), story, p);
    if (bh) y += (story ? 30 : 22) + bh - (story ? 14 : 10);
    y += story ? 64 : 44;

    // Laatikot alareunaan: ajat (ja pelien määrä) sekä paikka.
    const n = card.games.length;
    const items: [string, string][] = [...times];
    if (n > 0) items.push(['Pelit', String(n)]);
    let boxesTop = bottom;
    if (card.location) boxesTop -= placeH;
    if (items.length) boxesTop -= boxH + (card.location ? 20 : 0);

    // Oma joukkue
    const ls = story ? 112 : 92;
    const teamGap = story ? 44 : 28;
    const listGap = story ? 48 : 32;
    const labelH = n ? (story ? 56 : 44) : 0;
    const gap = story ? 16 : 12;
    const rowH = n ? Math.min(story ? 150 : 118, (boxesTop - listGap - y - ls - teamGap - labelH - gap * (n - 1)) / n) : 0;
    const blockH = ls + teamGap + labelH + (n ? n * rowH + (n - 1) * gap : 0);
    y += Math.max(0, (boxesTop - listGap - y - blockH) / 2);

    drawLogo(ctx, opts.logos.team, card.team, PAD, y, ls, p.sans);
    ctx.fillStyle = p.ink;
    const teamText = fit(ctx, card.team ?? 'Oma joukkue', maxW - ls - 32, (px) => `700 ${px}px ${p.sans}`, story ? 52 : 46, 30);
    const teamOrigin = origins?.team?.country || origins?.team?.city;
    ctx.fillText(teamText, PAD + ls + 32, y + ls / 2 + (teamOrigin ? -4 : 17));
    if (teamOrigin) drawOrigin(ctx, origins?.team, PAD + ls + 32, y + ls / 2 + (story ? 46 : 40), story ? 30 : 26, p, 'left', maxW - ls - 32);
    y += ls + teamGap;

    if (n) {
      ctx.font = `700 ${story ? 28 : 24}px ${p.sans}`;
      ctx.fillStyle = p.accent;
      ctx.fillText(spaced('Otteluohjelma'), PAD, y + (story ? 30 : 24));
      y += labelH;
      const timeW = story ? 190 : 160;
      card.games.forEach((g, k) => {
        const top = y + k * (rowH + gap);
        ctx.fillStyle = p.panel;
        rr(ctx, PAD, top, maxW, rowH, Math.min(34, rowH * 0.28));
        ctx.fill();
        // Kellonaika vasemmalla
        ctx.fillStyle = g.time ? p.ink : p.soft;
        const tText = g.time ?? `${k + 1}.`;
        ctx.font = display(Math.round(Math.min(rowH * 0.4, story ? 58 : 48)));
        ctx.fillText(fit(ctx, tText, timeW - 40, display, Math.round(Math.min(rowH * 0.4, story ? 58 : 48)), 28), PAD + 28, top + rowH / 2 + rowH * 0.14);
        const lsz = Math.min(rowH - 32, story ? 104 : 84);
        const lx = PAD + timeW;
        drawLogo(ctx, opts.logos.opponents[k], g.opponent, lx, top + (rowH - lsz) / 2, lsz, p.sans);
        const tx = lx + lsz + 24;
        const tw = PAD + maxW - 24 - tx;
        ctx.fillStyle = g.opponent ? p.ink : p.soft;
        const namePx = Math.round(Math.min(42, rowH * 0.3));
        const name = fit(ctx, g.opponent ?? 'Vastustaja selviää', tw, (px) => `700 ${px}px ${p.sans}`, namePx, 22);
        const o = origins?.opponents[k];
        const hasSub = !!(o?.country || o?.city || g.location);
        ctx.fillText(name, tx, hasSub ? top + rowH / 2 - 2 : top + rowH / 2 + namePx * 0.35);
        const subPx = Math.round(Math.min(29, rowH * 0.21));
        const subY = top + rowH / 2 + Math.min(38, rowH * 0.3);
        let x = tx;
        if (o?.country || o?.city) x += drawOrigin(ctx, o, tx, subY, subPx, p, 'left', tw) + subPx * 0.4;
        if (g.location && x < tx + tw - 40) {
          ctx.font = `500 ${subPx}px ${p.sans}`;
          ctx.fillStyle = p.soft;
          ctx.fillText(fit(ctx, (x > tx ? '· ' : '') + g.location, tx + tw - x, (px) => `500 ${px}px ${p.sans}`, subPx, 16), x, subY);
        }
      });
    }

    let by = boxesTop;
    if (items.length) {
      infoBoxes(ctx, items, by, boxH, story, p, display);
      by += boxH + 20;
    }
    if (card.location) placeBox(ctx, card.location, by, placeH, story, p);
    return canvas;
  }

  // Yksittäinen ottelu
  const g = card.games[0];
  y += story ? 92 : 70;
  ctx.font = display(story ? 64 : 54);
  ctx.fillStyle = p.ink;
  ctx.fillText(dateLabelOf(card.date), PAD, y);
  const bh = levelBadges(ctx, card.level, card.format, PAD, y + (story ? 34 : 24), story, p);
  if (bh) y += (story ? 34 : 24) + bh;

  let boxesTop = bottom;
  if (card.location) boxesTop -= placeH;
  if (times.length) boxesTop -= boxH + (card.location ? 20 : 0);

  drawMatchup(ctx, { team: card.team, opponent: g.opponent, logos: opts.logos, origins, y, boxesTop, story, p }, (top, ls) => {
    // VS logojen välissä
    ctx.textAlign = 'center';
    ctx.font = display(story ? 120 : 100);
    ctx.fillStyle = p.accent;
    ctx.fillText('VS', W / 2, top + ls / 2 + (story ? 42 : 35));
    ctx.textAlign = 'left';
  });

  let by = boxesTop;
  if (times.length) {
    infoBoxes(ctx, times, by, boxH, story, p, display);
    by += boxH + 20;
  }
  if (card.location) placeBox(ctx, card.location, by, placeH, story, p);
  return canvas;
}

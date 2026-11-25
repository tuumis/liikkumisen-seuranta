// Otteluennakko canvasille (SPEC 16, 14.11.2026): sama pohja, tyylit ja värit kuin tuloskuvassa.
// Ottelu: logo – VS – logo, nimet, liput ja kotipaikkakunnat, aloitusaika, paikalla-aika ja paikka.
// Turnaus: nimi, päivä, oma joukkue ja otteluohjelma (kellonaika, vastustaja, lippu, paikka).

import { previewTimeBoxes, previewTitleOf, type PreviewBox, type PreviewCard } from '../../domain/previewCard';
import { HOME_AWAY_LABEL } from '../../domain/football';
import { commentLayout, dateLabelOf, drawComment, drawLogo, drawMatchup, drawOrigin, fit, heavyOf, homeAwayTags, infoBoxes, levelBadges, nameFont, PAD, placeBox, rr, setup, spaced, W, wrap, type DrawOptions } from './drawResult';

import { drawBrandPreview } from './drawBrand';

type PreviewOptions = Omit<DrawOptions, 'player'> & {
  /** Piilotetut laatikot (Paikalla, 1. peli / Peli alkaa, Pelit, Paikka). */
  hidden?: ReadonlySet<PreviewBox>;
};

export function drawPreviewCard(card: PreviewCard, opts: PreviewOptions): HTMLCanvasElement {
  // Brändi-tyylillä oma asettelu (18.11.2026).
  if (opts.style === 'brand') return drawBrandPreview(card, opts);
  const { canvas, ctx, p, H, story } = setup(opts);
  const maxW = W - PAD * 2;
  const heavy = heavyOf(opts.style);
  const hidden = opts.hidden ?? new Set<PreviewBox>();
  const place = hidden.has('place') ? undefined : card.location;
  // Kommentti: harmaa paneeli laatikoiden yläpuolella tai pelkkä teksti heti pelin alla (18.11.2026).
  const comment = commentLayout(ctx, card.comment, story, p, opts.commentPanel !== false);
  const commentGap = story ? 32 : 24;
  // Pelkkä teksti tarvitsee enemmän ilmaa joukkuetietojen alle kuin paneeli (18.11.2026).
  const plainGap = story ? 76 : 60;
  const scale = p.displayScale ?? 1;
  const display = (px: number) => `${heavy} ${Math.round(px * scale)}px ${p.display}`;
  const origins = opts.origins;
  const bottom = H - (story ? 140 : 84);
  const mark = (name: string) => opts.mark?.(name, ctx);

  let y = story ? 170 : 104;
  mark('kicker');
  ctx.font = `700 ${story ? 32 : 28}px ${p.sans}`;
  ctx.fillStyle = p.accent;
  ctx.fillText(spaced(previewTitleOf(card)), PAD, y);
  y += story ? 34 : 26;

  const boxH = story ? 180 : 140;
  const placeH = story ? 190 : 150;
  // Aikalaatikot (turnauksessa myös pelien määrä) käyttäjän valintojen mukaan.
  const times = previewTimeBoxes(card, hidden);

  // Turnaus ja usean vastustajan harjoituspeli ("pelitälli"): joukkue ja lista; muuten VS-asettelu.
  const list = card.kind === 'tournament' || (card.kind === 'friendly' && card.games.length > 1);
  if (list) {
    const titlePx = story ? 104 : 84;
    mark('title');
    ctx.font = display(titlePx);
    const lines = wrap(ctx, card.kind === 'friendly' ? 'Pelitälli' : (card.eventName ?? 'Turnaus'), maxW, 2);
    ctx.fillStyle = p.ink;
    lines.forEach((l) => {
      y += titlePx * 1.04;
      ctx.fillText(l, PAD, y);
    });
    y += story ? 74 : 58;
    mark('date');
    ctx.font = `500 ${story ? 40 : 34}px ${p.sans}`;
    ctx.fillStyle = p.soft;
    ctx.fillText(dateLabelOf(card.date), PAD, y);
    const bh = levelBadges(ctx, card.level, card.format, PAD, y + (story ? 30 : 22), story, p, card.series);
    if (bh) y += (story ? 30 : 22) + bh - (story ? 14 : 10);
    y += story ? 64 : 44;

    // Laatikot alareunaan: ajat (ja pelien määrä) sekä paikka; kommentti niiden yläpuolelle.
    const n = card.games.length;
    const items = times;
    let boxesTop = bottom;
    if (place) boxesTop -= placeH;
    if (items.length) boxesTop -= boxH + (place ? 20 : 0);
    const commentTop = comment.h && comment.panel ? boxesTop - comment.h - (items.length || place ? commentGap : 0) : boxesTop;
    const plainH = comment.h && !comment.panel ? comment.h + plainGap : 0;

    // Oma joukkue
    const ls = story ? 112 : 92;
    const teamGap = story ? 44 : 28;
    const listGap = story ? 48 : 32;
    const labelH = n ? (story ? 56 : 44) : 0;
    const gap = story ? 16 : 12;
    const rowH = n ? Math.min(story ? 150 : 118, (commentTop - listGap - y - ls - teamGap - labelH - plainH - gap * (n - 1)) / n) : 0;
    const blockH = ls + teamGap + labelH + (n ? n * rowH + (n - 1) * gap : 0) + plainH;
    y += Math.max(0, (commentTop - listGap - y - blockH) / 2);

    mark('team');
    drawLogo(ctx, opts.logos.team, card.team, PAD, y, ls, p.sans);
    ctx.fillStyle = p.ink;
    const teamText = fit(ctx, card.team ?? 'Oma joukkue', maxW - ls - 32, nameFont(p), story ? 52 : 46, 30);
    const teamOrigin = origins?.team?.country || origins?.team?.city;
    ctx.fillText(teamText, PAD + ls + 32, y + ls / 2 + (teamOrigin ? -4 : 17));
    if (teamOrigin) drawOrigin(ctx, origins?.team, PAD + ls + 32, y + ls / 2 + (story ? 46 : 40), story ? 30 : 26, p, 'left', maxW - ls - 32);
    y += ls + teamGap;

    if (n) {
      mark('label');
      ctx.font = `700 ${story ? 28 : 24}px ${p.sans}`;
      ctx.fillStyle = p.accent;
      ctx.fillText(spaced(card.kind === 'friendly' ? 'Vastustajat' : 'Otteluohjelma'), PAD, y + (story ? 30 : 24));
      y += labelH;
      const timeW = story ? 190 : 160;
      card.games.forEach((g, k) => {
        const top = y + k * (rowH + gap);
        mark(`row:${k}`);
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
        const name = fit(ctx, g.opponent ?? 'Vastustaja selviää', tw, nameFont(p), namePx, 22);
        const o = origins?.opponents[k];
        // Kentän vieressä koti/vieras (18.11.2026).
        const ha = opts.homeAway !== false && g.homeAway ? HOME_AWAY_LABEL[g.homeAway] : undefined;
        const extra = [g.internal ? 'Sisäinen' : undefined, ha, g.location].filter(Boolean).join(' · ');
        const hasSub = !!(o?.country || o?.city || extra);
        ctx.fillText(name, tx, hasSub ? top + rowH / 2 - 2 : top + rowH / 2 + namePx * 0.35);
        const subPx = Math.round(Math.min(29, rowH * 0.21));
        const subY = top + rowH / 2 + Math.min(38, rowH * 0.3);
        let x = tx;
        if (o?.country || o?.city) x += drawOrigin(ctx, o, tx, subY, subPx, p, 'left', tw) + subPx * 0.4;
        if (extra && x < tx + tw - 40) {
          ctx.font = `500 ${subPx}px ${p.sans}`;
          ctx.fillStyle = p.soft;
          ctx.fillText(fit(ctx, (x > tx ? '· ' : '') + extra, tx + tw - x, (px) => `500 ${px}px ${p.sans}`, subPx, 16), x, subY);
        }
      });
    }

    mark('comment');
    if (comment.h) drawComment(ctx, comment, comment.panel ? commentTop : y + (n ? n * rowH + (n - 1) * gap : 0) + plainGap, p);
    let by = boxesTop;
    mark('times');
    if (items.length) {
      infoBoxes(ctx, items, by, boxH, story, p, display);
      by += boxH + 20;
    }
    mark('place');
    if (place) placeBox(ctx, place, by, placeH, story, p);
    return canvas;
  }

  // Yksittäinen ottelu
  const g = card.games[0];
  y += story ? 92 : 70;
  mark('date');
  ctx.font = display(story ? 64 : 54);
  ctx.fillStyle = p.ink;
  ctx.fillText(fit(ctx, dateLabelOf(card.date), maxW, display, story ? 64 : 54, 36), PAD, y);
  const bh = levelBadges(ctx, card.level, card.format, PAD, y + (story ? 34 : 24), story, p, card.series);
  if (bh) y += (story ? 34 : 24) + bh;

  let boxesTop = bottom;
  if (place) boxesTop -= placeH;
  if (times.length) boxesTop -= boxH + (place ? 20 : 0);
  const commentTop = comment.h && comment.panel ? boxesTop - comment.h - (times.length || place ? commentGap : 0) : boxesTop;
  const below = comment.h && !comment.panel ? comment.h + plainGap : 0;

  const nameBottom = drawMatchup(ctx, { team: card.team, opponent: g.opponent, logos: opts.logos, origins, y, boxesTop: commentTop, story, p, tags: homeAwayTags(g.homeAway, opts.homeAway), belowH: below, mark }, (top, ls) => {
    // VS logojen välissä
    ctx.textAlign = 'center';
    ctx.font = display(story ? 120 : 100);
    ctx.fillStyle = p.accent;
    ctx.fillText('VS', W / 2, top + ls / 2 + (story ? 42 : 35) * scale);
    ctx.textAlign = 'left';
  });

  mark('comment');
  if (comment.h) drawComment(ctx, comment, comment.panel ? commentTop : nameBottom + plainGap, p, comment.panel ? 'left' : 'center');
  let by = boxesTop;
  mark('times');
  if (times.length) {
    infoBoxes(ctx, times, by, boxH, story, p, display);
    by += boxH + 20;
  }
  mark('place');
  if (place) placeBox(ctx, place, by, placeH, story, p);
  return canvas;
}

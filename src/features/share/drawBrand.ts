// Brändi-tyyli (käyttäjän valinta 18.11.2026): oma asettelu tulos- ja ennakkokuvalle seurojen
// brändikirjojen tapaan. Kapea otsikkofontti isoina kirjaimina, joukkueet päällekkäin, ohuet
// erotinviivat laatikoiden sijaan ja yksi korostusväri tummalla pohjalla. Fontit ja värit kuten
// Kapea-tyylissä (palette 'brand'); seurojen tunnuksia ei käytetä, logot ovat käyttäjän omia.

import { HOME_AWAY_LABEL, type GameOutcome } from '../../domain/football';
import { previewKicker, previewTimeBoxes, type PreviewBox, type PreviewCard } from '../../domain/previewCard';
import { OUTCOME_WORD, type ResultCard } from '../../domain/resultCard';
import { drawFlag } from '../../ui/flags';
import { formatDate } from '../../ui/format';
import { commentLayout, dateLabelOf, drawComment, drawLogo, PAD, rr, setup, spaced, W, wrap, type DrawOptions, type Origin, type Palette } from './drawResult';

type Ctx = CanvasRenderingContext2D;
type PreviewOptions = Omit<DrawOptions, 'player'> & { hidden?: ReadonlySet<PreviewBox> };

// Funktiona: drawResult tuo tämän tiedoston, joten sen vakiot eivät ole vielä alustettuja latauksessa.
const maxW = () => W - PAD * 2;
const OUTCOME_COLOR: Record<GameOutcome, string> = { W: '#15803d', D: '#b45309', L: '#b91c1c' };
const OUTCOME_LETTER: Record<GameOutcome, string> = { W: 'V', D: 'T', L: 'H' };

const big = (p: Palette) => (px: number) => `400 ${Math.round(px)}px ${p.display}`;
const small = (p: Palette, w = 700) => (px: number) => `${w} ${Math.round(px)}px ${p.sans}`;
/** Kapean fontin isojen kirjainten korkeus suhteessa fonttikokoon. */
const CAP = 0.7;
const hair = (p: Palette) => (p.light ? 'rgba(0,0,0,0.16)' : 'rgba(245,245,245,0.16)');

/** Teksti mahtumaan: palauttaa tekstin ja lopullisen fonttikoon (fit, mutta koko tiedossa). */
function fitPx(ctx: Ctx, text: string, maxW: number, font: (px: number) => string, size: number, min: number): { text: string; px: number } {
  let px = size;
  ctx.font = font(px);
  while (ctx.measureText(text).width > maxW && px > min) {
    px -= 2;
    ctx.font = font(px);
  }
  if (ctx.measureText(text).width <= maxW) return { text, px };
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return { text: `${t.trimEnd()}…`, px };
}

/** "Seura · Ryhmä · 2016" → iso nimi seurasta, loput pieneen riviin. */
function splitName(name: string | undefined, fallback: string): { main: string; rest: string[] } {
  const parts = (name ?? fallback).split(/\s+·\s+/).filter(Boolean);
  return { main: (parts[0] ?? fallback).toUpperCase(), rest: parts.slice(1) };
}

const shortDate = (date: string) => formatDate(date, 'EEEEEE d.M.').toUpperCase();

/** Pieni, väljästi välistetty rivi (lippu, osat " · " -erottimin ja korostettu merkintä); palauttaa leveyden. */
function subLine(ctx: Ctx, parts: string[], country: string | undefined, tag: string | undefined, x: number, baseline: number, px: number, p: Palette, maxW: number, align: 'left' | 'right' = 'left'): number {
  const text = parts.length ? spaced(parts.join(' · ')) : '';
  const tagText = tag ? spaced(tag) : '';
  const fw = country ? Math.round(px * 1.4) : 0;
  const gap = Math.round(px * 0.6);
  ctx.font = small(p, 600)(px);
  const tagW = tagText ? ctx.measureText(tagText).width : 0;
  const room = maxW - fw - (fw && (text || tagText) ? gap : 0) - (tagW ? tagW + gap : 0);
  const shown = text ? fitPx(ctx, text, Math.max(40, room), small(p, 600), px, Math.max(14, px - 8)) : { text: '', px };
  ctx.font = small(p, 600)(shown.px);
  const tw = shown.text ? ctx.measureText(shown.text).width : 0;
  const total = fw + (fw && (tw || tagW) ? gap : 0) + tw + (tagW ? (tw ? gap : 0) + tagW : 0);
  let cx = align === 'right' ? x - total : x;
  if (country && drawFlag(ctx, country, cx, baseline - px * 0.82, fw)) cx += fw + (tw || tagW ? gap : 0);
  ctx.textAlign = 'left';
  if (shown.text) {
    ctx.fillStyle = p.soft;
    ctx.fillText(shown.text, cx, baseline);
    cx += tw + (tagW ? gap : 0);
  }
  if (tagText) {
    ctx.font = small(p, 700)(px);
    ctx.fillStyle = p.accent;
    ctx.fillText(tagText, cx, baseline);
  }
  return total;
}

/** Tunnisterivi korostusvärillä (enintään kaksi riviä); palauttaa viimeisen rivin perusviivan. */
function kicker(ctx: Ctx, text: string, y: number, px: number, p: Palette): number {
  ctx.font = small(p, 700)(px);
  ctx.fillStyle = p.accent;
  const lines = wrap(ctx, spaced(text), maxW(), 2);
  lines.forEach((l, i) => ctx.fillText(l, PAD, y + i * px * 1.35));
  return y + (lines.length - 1) * px * 1.35;
}

/** Korostuspalkki vasempaan reunaan otsikon kohdalle. */
function bar(ctx: Ctx, bottom: number, p: Palette) {
  ctx.fillStyle = p.accent;
  ctx.fillRect(0, 0, 16, bottom);
}

function hline(ctx: Ctx, y: number, p: Palette, x = PAD, w = maxW()) {
  ctx.fillStyle = hair(p);
  ctx.fillRect(x, y, w, 2);
}

/** Joukkuerivi: logo vasemmalla, iso nimi ja sen alla pieni rivi; palauttaa rivin korkeuden. */
function teamRow(
  ctx: Ctx,
  t: { name?: string; fallback: string; logo?: HTMLImageElement; origin?: Origin; tag?: string; soft?: boolean },
  top: number,
  m: { ls: number; namePx: number; subPx: number; gap: number },
  p: Palette,
): number {
  const { main, rest } = splitName(t.name, t.fallback);
  const sub = [...rest, ...(t.origin?.city ? [t.origin.city] : [])];
  const hasSub = sub.length > 0 || !!t.origin?.country || !!t.tag;
  const nx = PAD + m.ls + m.gap;
  const name = fitPx(ctx, main, PAD + maxW() - nx, big(p), m.namePx, Math.round(m.namePx * 0.45));
  const capH = name.px * CAP;
  const blockH = capH + (hasSub ? m.subPx * 1.75 : 0);
  const R = Math.max(m.ls, blockH);
  drawLogo(ctx, t.logo, t.name, PAD, top + (R - m.ls) / 2, m.ls, p.sans);
  const base = top + (R - blockH) / 2 + capH;
  ctx.font = big(p)(name.px);
  ctx.fillStyle = t.soft ? p.soft : p.ink;
  ctx.textAlign = 'left';
  ctx.fillText(name.text, nx, base);
  if (hasSub) subLine(ctx, sub, t.origin?.country, t.tag, nx, base + m.subPx * 1.75, m.subPx, p, PAD + maxW() - nx);
  return R;
}

/** Alareunan ajat sarakkeina ja paikka: ohuet viivat, otsikko pienellä, arvo isolla. Palauttaa yläreunan. */
function infoGrid(ctx: Ctx, items: { label: string; value: string; accent?: boolean }[], place: string | undefined, bottom: number, k: number, p: Palette, mark: (n: string) => void): number {
  const labelPx = Math.round(26 * k);
  const valuePx = Math.round(136 * k);
  const placePx = Math.round(100 * k);
  const pad = Math.round(24 * k);
  ctx.font = big(p)(placePx);
  const placeLines = place ? wrap(ctx, place.toUpperCase(), maxW(), 2) : [];
  const placeH = placeLines.length ? pad + labelPx + Math.round(36 * k) + placeLines.length * placePx * 1.0 : 0;
  const timesH = items.length ? pad + labelPx + Math.round(16 * k) + valuePx * 0.78 + pad : 0;
  const top = bottom - placeH - timesH;
  if (!items.length && !placeLines.length) return bottom;
  mark('times');
  hline(ctx, top, p);
  if (items.length) {
    const cw = maxW() / items.length;
    items.forEach((it, i) => {
      const x = PAD + i * cw + (i ? Math.round(30 * k) : 0);
      if (i) {
        ctx.fillStyle = hair(p);
        ctx.fillRect(PAD + i * cw, top, 2, timesH);
      }
      ctx.font = small(p, 700)(labelPx);
      ctx.fillStyle = p.soft;
      ctx.fillText(spaced(it.label), x, top + pad + labelPx);
      const v = fitPx(ctx, it.value, cw - Math.round(40 * k), big(p), valuePx, 40);
      ctx.font = big(p)(v.px);
      ctx.fillStyle = it.accent ? p.accent : p.ink;
      ctx.fillText(v.text, x, top + pad + labelPx + Math.round(16 * k) + valuePx * 0.78);
    });
  }
  if (placeLines.length) {
    mark('place');
    const py = top + timesH;
    if (timesH) hline(ctx, py, p);
    ctx.font = small(p, 700)(labelPx);
    ctx.fillStyle = p.soft;
    ctx.fillText(spaced('Paikka'), PAD, py + pad + labelPx);
    ctx.font = big(p)(placePx);
    ctx.fillStyle = p.ink;
    placeLines.forEach((l, i) => ctx.fillText(l, PAD, py + pad + labelPx + Math.round(36 * k) + placePx * 0.72 + i * placePx * 1.0));
  }
  return top;
}

/** Otsikko (turnaus tai pelitälli) kapealla fontilla; palauttaa viimeisen rivin perusviivan. */
function title(ctx: Ctx, text: string, y: number, px: number, p: Palette): number {
  ctx.font = big(p)(px);
  ctx.fillStyle = p.ink;
  const lines = wrap(ctx, text.toUpperCase(), maxW(), 2);
  lines.forEach((l, i) => ctx.fillText(l, PAD, y + px * CAP + i * px * 1.0));
  return y + px * CAP + (lines.length - 1) * px * 1.0;
}

/** Pelirivit (turnauksen ohjelma tai tulokset) ohuin viivoin; `right` piirtää rivin oikean reunan (tulos). */
function listRows(
  ctx: Ctx,
  rows: { opponent?: string; logo?: HTMLImageElement; lead?: string; sub: string[]; origin?: Origin }[],
  top: number,
  rowH: number,
  k: number,
  p: Palette,
  mark: (n: string) => void,
  right?: (i: number, cy: number, rowH: number) => number,
) {
  const leadW = rows.some((r) => r.lead) ? Math.round(170 * k) : 0;
  rows.forEach((r, i) => {
    mark(`row:${i}`);
    const y = top + i * rowH;
    hline(ctx, y, p);
    const cy = y + rowH / 2;
    if (r.lead) {
      const lp = fitPx(ctx, r.lead, leadW - Math.round(24 * k), big(p), Math.min(rowH * 0.5, 80 * k), 28);
      ctx.font = big(p)(lp.px);
      ctx.fillStyle = p.ink;
      ctx.fillText(lp.text, PAD, cy + lp.px * CAP * 0.5);
    }
    const lsz = Math.round(Math.min(rowH - 28 * k, 96 * k));
    const lx = PAD + leadW;
    drawLogo(ctx, r.logo, r.opponent, lx, cy - lsz / 2, lsz, p.sans);
    const nx = lx + lsz + Math.round(26 * k);
    const rightW = right ? right(i, cy, rowH) : 0;
    const nw = PAD + maxW() - rightW - nx - Math.round(16 * k);
    const { main, rest } = splitName(r.opponent, 'Vastustaja selviää');
    const sub = [...rest, ...r.sub, ...(r.origin?.city ? [r.origin.city] : [])];
    const hasSub = sub.length > 0 || !!r.origin?.country;
    const n = fitPx(ctx, main, nw, big(p), Math.min(rowH * 0.46, 74 * k), 26);
    const subPx = Math.round(Math.min(24 * k, rowH * 0.17));
    const capH = n.px * CAP;
    const blockH = capH + (hasSub ? subPx * 1.7 : 0);
    const base = cy - blockH / 2 + capH;
    ctx.font = big(p)(n.px);
    ctx.fillStyle = r.opponent ? p.ink : p.soft;
    ctx.fillText(n.text, nx, base);
    if (hasSub) subLine(ctx, sub, r.origin?.country, undefined, nx, base + subPx * 1.7, subPx, p, nw);
  });
  hline(ctx, top + rows.length * rowH, p);
}

// ---------- ennakko ----------

export function drawBrandPreview(card: PreviewCard, opts: PreviewOptions): HTMLCanvasElement {
  const { canvas, ctx, p, H, story } = setup(opts);
  const k = story ? 1 : 0.84;
  const mark = (name: string) => opts.mark?.(name, ctx);
  const hidden = opts.hidden ?? new Set<PreviewBox>();
  const place = hidden.has('place') ? undefined : card.location;
  const origins = opts.origins;
  const times = previewTimeBoxes(card, hidden).map(([label, value]) => ({ label, value, accent: value === card.kickoff }));
  const bottom = H - (story ? 120 : 72);

  let y = story ? 150 : 100;
  mark('kicker');
  y = kicker(ctx, previewKicker(card), y, Math.round(34 * k), p);
  const list = card.kind === 'tournament' || (card.kind === 'friendly' && card.games.length > 1);

  const gridTop = infoGrid(ctx, times, place, bottom, k, p, mark);
  const comment = commentLayout(ctx, card.comment, story, p, opts.commentPanel !== false);
  const commentGap = Math.round(36 * k);
  const contentBottom = comment.h ? gridTop - commentGap - comment.h - commentGap : gridTop - Math.round(40 * k);
  mark('comment');
  if (comment.h) drawComment(ctx, comment, gridTop - commentGap - comment.h, p);

  if (list) {
    mark('title');
    y = title(ctx, card.kind === 'friendly' ? 'Pelitälli' : (card.eventName ?? 'Turnaus'), y + Math.round(52 * k), Math.round(150 * k), p);
    bar(ctx, y + Math.round(30 * k), p);
    mark('date');
    y += Math.round(84 * k);
    ctx.font = big(p)(Math.round(68 * k));
    ctx.fillStyle = p.soft;
    ctx.fillText(dateLabelOf(card.date).toUpperCase(), PAD, y);
    y += Math.round(64 * k);
    mark('team');
    const R = teamRow(ctx, { name: card.team, fallback: 'Oma joukkue', logo: opts.logos.team, origin: origins?.team }, y, { ls: Math.round(110 * k), namePx: Math.round(116 * k), subPx: Math.round(28 * k), gap: Math.round(32 * k) }, p);
    y += R + Math.round(76 * k);
    const n = card.games.length;
    if (n) {
      mark('label');
      ctx.font = small(p, 700)(Math.round(28 * k));
      ctx.fillStyle = p.accent;
      ctx.fillText(spaced(card.kind === 'friendly' ? 'Vastustajat' : 'Otteluohjelma'), PAD, y);
      y += Math.round(28 * k);
      const rowH = Math.max(60, Math.min(150 * k, (contentBottom - y) / n));
      listRows(
        ctx,
        card.games.map((g, i) => ({
          opponent: g.opponent,
          logo: opts.logos.opponents[i],
          lead: g.time ?? `${i + 1}.`,
          sub: [opts.homeAway !== false && g.homeAway ? HOME_AWAY_LABEL[g.homeAway] : undefined, g.location].filter((s): s is string => !!s),
          origin: origins?.opponents[i],
        })),
        y,
        rowH,
        k,
        p,
        mark,
      );
    }
    return canvas;
  }

  // Ottelu tai yhden vastustajan harjoituspeli: päivä isona, joukkueet päällekkäin ja VS niiden välissä.
  mark('date');
  const datePx = Math.round(184 * k);
  y += Math.round(56 * k) + datePx * CAP;
  ctx.font = big(p)(datePx);
  ctx.fillStyle = p.ink;
  ctx.fillText(shortDate(card.date), PAD, y);
  bar(ctx, y + Math.round(30 * k), p);
  const g = card.games[0] ?? {};
  const tags = opts.homeAway !== false && g.homeAway ? (g.homeAway === 'home' ? ['Koti', 'Vieras'] : ['Vieras', 'Koti']) : undefined;
  const m = { ls: Math.round(150 * k), namePx: Math.round(196 * k), subPx: Math.round(30 * k), gap: Math.round(36 * k) };
  const vsPx = Math.round(120 * k);
  const vsGap = Math.round(46 * k);
  // Rivien korkeus: logo tai nimi + pieni rivi; keskitetään päivän ja alaosan väliin.
  const rowH = Math.max(m.ls, m.namePx * CAP + m.subPx * 1.75);
  const blockH = rowH * 2 + vsGap * 2 + vsPx * CAP;
  const start = y + Math.max(Math.round(70 * k), (contentBottom - y - blockH) / 2);
  mark('team');
  const r1 = teamRow(ctx, { name: card.team, fallback: 'Oma joukkue', logo: opts.logos.team, origin: origins?.team, tag: tags?.[0] }, start, m, p);
  mark('vs');
  ctx.font = big(p)(vsPx);
  ctx.fillStyle = p.accent;
  ctx.fillText('VS', PAD + m.ls + m.gap, start + r1 + vsGap + vsPx * CAP);
  mark('opponent');
  teamRow(ctx, { name: g.opponent, fallback: 'Vastustaja selviää', logo: opts.logos.opponents[0], origin: origins?.opponents[0], tag: tags?.[1] }, start + r1 + vsGap * 2 + vsPx * CAP, m, p);
  return canvas;
}

// ---------- tulos ----------

export function drawBrandResult(card: ResultCard, opts: DrawOptions): HTMLCanvasElement {
  const { canvas, ctx, p, H, story } = setup(opts);
  const k = story ? 1 : 0.84;
  const mark = (name: string) => opts.mark?.(name, ctx);
  const origins = opts.origins;
  const bottom = H - (story ? 120 : 72);
  const kick = [card.kind === 'tournament' ? 'Turnaus' : 'Ottelu', card.series, card.level, card.format].filter(Boolean).join(' · ');

  let y = story ? 150 : 100;
  mark('kicker');
  y = kicker(ctx, kick, y, Math.round(34 * k), p);

  // Alaosa: lapsen maalit (valinnainen) ja turnauksessa yhteenveto; kommentti niiden yläpuolelle.
  const player = opts.player && card.playerGoals > 0 ? opts.player : undefined;
  let lowTop = bottom;
  if (card.kind === 'tournament') {
    const stats = [
      { label: 'Pelit', value: String(card.games.length - card.noResult) },
      { label: 'V – T – H', value: `${card.wins}–${card.draws}–${card.losses}`, accent: true },
      { label: 'Maalit', value: `${card.goalsFor}–${card.goalsAgainst}` },
    ];
    lowTop = infoGrid(ctx, stats, undefined, bottom, k, p, mark);
  }
  if (player) {
    mark('player');
    lowTop = drawPlayerLine(ctx, player, card.playerGoals, lowTop, k, p, card.kind === 'tournament');
  }
  const comment = commentLayout(ctx, card.comment, story, p, opts.commentPanel !== false);
  const commentGap = Math.round(36 * k);
  const contentBottom = comment.h ? lowTop - commentGap - comment.h - commentGap : lowTop - Math.round(40 * k);
  mark('comment');
  if (comment.h) drawComment(ctx, comment, lowTop - commentGap - comment.h, p);

  if (card.kind === 'tournament') {
    mark('title');
    y = title(ctx, card.eventName ?? 'Turnaus', y + Math.round(52 * k), Math.round(150 * k), p);
    bar(ctx, y + Math.round(30 * k), p);
    mark('date');
    y += Math.round(84 * k);
    ctx.font = big(p)(Math.round(68 * k));
    ctx.fillStyle = p.soft;
    ctx.fillText(dateLabelOf(card.date).toUpperCase(), PAD, y);
    y += Math.round(64 * k);
    mark('team');
    const R = teamRow(ctx, { name: card.team, fallback: 'Oma joukkue', logo: opts.logos.team, origin: origins?.team }, y, { ls: Math.round(110 * k), namePx: Math.round(116 * k), subPx: Math.round(28 * k), gap: Math.round(32 * k) }, p);
    y += R + Math.round(76 * k);
    mark('label');
    ctx.font = small(p, 700)(Math.round(28 * k));
    ctx.fillStyle = p.accent;
    ctx.fillText(spaced('Tulokset'), PAD, y);
    y += Math.round(28 * k);
    const n = card.games.length;
    const rowH = Math.max(60, Math.min(150 * k, (contentBottom - y) / n));
    listRows(
      ctx,
      card.games.map((g, i) => ({
        opponent: g.opponent,
        logo: opts.logos.opponents[i],
        sub: [`${i + 1}. peli`, g.time && `klo ${g.time}`, opts.homeAway !== false && g.homeAway ? HOME_AWAY_LABEL[g.homeAway] : undefined, player && g.playerGoals ? `${player} ${g.playerGoals}` : undefined].filter((s): s is string => !!s),
        origin: origins?.opponents[i],
      })),
      y,
      rowH,
      k,
      p,
      mark,
      (i, cy, h) => {
        const g = card.games[i];
        const chip = Math.round(Math.min(64 * k, h * 0.5));
        let right = PAD + maxW();
        if (g.outcome) {
          ctx.fillStyle = OUTCOME_COLOR[g.outcome];
          rr(ctx, right - chip, cy - chip / 2, chip, chip, chip * 0.28);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = `800 ${Math.round(chip * 0.52)}px ${p.sans}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(OUTCOME_LETTER[g.outcome], right - chip / 2, cy + 1);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          right -= chip + Math.round(24 * k);
        }
        const score = g.outcome ? `${g.goalsFor}–${g.goalsAgainst}` : '–';
        const px = Math.round(Math.min(h * 0.5, 84 * k));
        ctx.font = big(p)(px);
        ctx.fillStyle = g.outcome ? p.ink : p.soft;
        const sw = ctx.measureText(score).width;
        ctx.fillText(score, right - sw, cy + px * CAP * 0.5);
        return PAD + maxW() - (right - sw);
      },
    );
    return canvas;
  }

  // Yksittäinen ottelu: päivä, aika ja paikka; tulossana, iso tulos ja joukkueet sen alla.
  const g = card.games[0];
  mark('date');
  const info = [shortDate(card.date), card.kickoff && `klo ${card.kickoff}`, card.location].filter(Boolean).join(' · ').toUpperCase();
  const ip = fitPx(ctx, info, maxW(), big(p), Math.round(80 * k), Math.round(44 * k));
  y += Math.round(40 * k) + ip.px * CAP;
  ctx.font = big(p)(ip.px);
  ctx.fillStyle = p.soft;
  ctx.fillText(ip.text, PAD, y);
  bar(ctx, y + Math.round(30 * k), p);

  const wordPx = Math.round(240 * k);
  const teamsH = Math.round(150 * k);
  const gapA = Math.round(60 * k);
  const gapB = Math.round(64 * k);
  const avail = contentBottom - y - Math.round(80 * k);
  const score = `${g.goalsFor ?? '–'}–${g.goalsAgainst ?? '–'}`;
  // Tulos niin isona kuin mahtuu leveyteen ja korkeuteen.
  const maxScore = Math.max(160, (avail - wordPx * CAP - gapA - gapB - teamsH) / CAP);
  const sp = fitPx(ctx, score, maxW(), big(p), Math.min(Math.round(600 * k), maxScore), 120);
  const blockH = wordPx * CAP + gapA + sp.px * CAP + gapB + teamsH;
  let by = y + Math.round(80 * k) + Math.max(0, (avail - blockH) / 2);
  mark('vs');
  if (g.outcome) {
    ctx.font = big(p)(wordPx);
    ctx.fillStyle = p.accent;
    ctx.fillText(OUTCOME_WORD[g.outcome].toUpperCase(), PAD - Math.round(4 * k), by + wordPx * CAP);
  }
  by += wordPx * CAP + gapA;
  ctx.font = big(p)(sp.px);
  ctx.fillStyle = p.ink;
  ctx.fillText(sp.text, PAD - Math.round(8 * k), by + sp.px * CAP);
  by += sp.px * CAP + gapB;

  // Joukkueet rinnakkain tuloksen alla: oma vasemmalla, vastustaja oikealla.
  const tags = opts.homeAway !== false && g.homeAway ? (g.homeAway === 'home' ? ['Koti', 'Vieras'] : ['Vieras', 'Koti']) : undefined;
  const ls = Math.round(96 * k);
  const colW = (maxW() - Math.round(40 * k)) / 2;
  const sides = [
    { name: card.team, fallback: 'Oma joukkue', logo: opts.logos.team, origin: origins?.team, tag: tags?.[0], right: false },
    { name: g.opponent, fallback: 'Vastustaja', logo: opts.logos.opponents[0], origin: origins?.opponents[0], tag: tags?.[1], right: true },
  ];
  sides.forEach((s, i) => {
    mark(i ? 'opponent' : 'team');
    const { main, rest } = splitName(s.name, s.fallback);
    const lx = s.right ? PAD + maxW() - ls : PAD;
    drawLogo(ctx, s.logo, s.name, lx, by, ls, p.sans);
    const nameW = colW - ls - Math.round(24 * k);
    const np = fitPx(ctx, main, nameW, big(p), Math.round(96 * k), Math.round(40 * k));
    ctx.font = big(p)(np.px);
    ctx.fillStyle = i ? p.soft : p.ink;
    ctx.textAlign = s.right ? 'right' : 'left';
    const nx = s.right ? lx - Math.round(24 * k) : lx + ls + Math.round(24 * k);
    const subPx = Math.round(24 * k);
    const sub = [...rest, ...(s.origin?.city ? [s.origin.city] : [])];
    const hasSub = sub.length > 0 || !!s.origin?.country || !!s.tag;
    const capH = np.px * CAP;
    const blockH2 = capH + (hasSub ? subPx * 1.7 : 0);
    const base = by + (ls - blockH2) / 2 + capH;
    ctx.fillText(np.text, nx, base);
    ctx.textAlign = 'left';
    if (hasSub) subLine(ctx, sub, s.origin?.country, s.tag, nx, base + subPx * 1.7, subPx, p, nameW, s.right ? 'right' : 'left');
  });
  return canvas;
}

/** Lapsen nimi isona ja maalit pienenä korostettuna numerona (yläindeksinä), ohut viiva yläpuolella. */
function drawPlayerLine(ctx: Ctx, name: string, goals: number, bottom: number, k: number, p: Palette, aboveGrid: boolean): number {
  const px = Math.round(130 * k);
  const pad = Math.round(28 * k);
  const h = pad + px * CAP + pad;
  const top = bottom - h - (aboveGrid ? Math.round(24 * k) : 0);
  hline(ctx, top, p);
  const n = fitPx(ctx, name.toUpperCase(), maxW() * 0.7, big(p), px, 48);
  ctx.font = big(p)(n.px);
  ctx.fillStyle = p.ink;
  const base = top + pad + n.px * CAP;
  ctx.fillText(n.text, PAD, base);
  let x = PAD + ctx.measureText(n.text).width + Math.round(10 * k);
  const gp = Math.round(n.px * 0.5);
  ctx.font = big(p)(gp);
  ctx.fillStyle = p.accent;
  ctx.fillText(String(goals), x, base - n.px * CAP + gp * CAP);
  x += ctx.measureText(String(goals)).width + Math.round(22 * k);
  ctx.font = small(p, 700)(Math.round(26 * k));
  ctx.fillStyle = p.soft;
  ctx.fillText(spaced(goals === 1 ? 'maali' : 'maalia'), x, base - n.px * CAP * 0.35);
  return top;
}

// Tarinakortti kuvaksi (1080 × 1920, 9:16): piirretään canvasille samoista tiedoista kuin näkymä,
// teeman väreillä ja sovelluksen fonteilla. Ei verkkoa; kuva jää laitteelle tai jaetaan käyttäjän valitsemaan paikkaan.

import type { StorySlide } from './story';

const W = 1080;
const H = 1920;
const PAD = 96;

const css = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
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
  return out;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawSlide(slide: StorySlide, opts: { index: number; count: number }): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const from = css('--hero-from', '#2c5a46');
  const to = css('--hero-to', '#1a3a2d');
  const ink = css('--hero-ink', '#f6f5f0');
  const soft = css('--hero-ink-soft', '#c9dccb');
  const accent = css('--hero-accent', '#e6bd89');
  const display = css('--font-display', 'Georgia, serif');
  const sans = css('--font-sans', 'system-ui, sans-serif');

  // Tausta: liukuväri, lämmin hehku ja korkeuskäyrät kuten sankarikortissa.
  const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, W * 1.1);
  glow.addColorStop(0, 'rgba(221,169,110,0.22)');
  glow.addColorStop(1, 'rgba(221,169,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 3;
  for (let r = 60; r < 2400; r += 70) {
    ctx.beginPath();
    ctx.arc(W * 1.1, -H * 0.05, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Etenemispalkit
  const gap = 12;
  const bw = (W - PAD * 2 - gap * (opts.count - 1)) / opts.count;
  for (let k = 0; k < opts.count; k++) {
    ctx.fillStyle = k <= opts.index ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.25)';
    roundRect(ctx, PAD + k * (bw + gap), 90, bw, 8, 4);
    ctx.fill();
  }

  // Sisällön korkeus ensin, jotta se voidaan keskittää pystysuunnassa.
  const blocks: { h: number; draw: (y: number) => void }[] = [];
  const maxW = W - PAD * 2;

  ctx.font = `700 34px ${sans}`;
  blocks.push({
    h: 60,
    draw: (y) => {
      ctx.font = `700 34px ${sans}`;
      ctx.fillStyle = accent;
      ctx.fillText(slide.kicker.toUpperCase().split('').join(' '), PAD, y + 34);
    },
  });
  ctx.font = `600 104px ${display}`;
  const titleLines = wrap(ctx, slide.title, maxW);
  blocks.push({
    h: titleLines.length * 112 + 10,
    draw: (y) => {
      ctx.font = `600 104px ${display}`;
      ctx.fillStyle = ink;
      titleLines.forEach((l, k) => ctx.fillText(l, PAD, y + 96 + k * 112));
    },
  });
  if (slide.big) {
    blocks.push({
      h: 300,
      draw: (y) => {
        ctx.font = `600 250px ${display}`;
        ctx.fillStyle = accent;
        ctx.fillText(slide.big!, PAD, y + 250);
        const w = ctx.measureText(slide.big!).width;
        if (slide.bigUnit) {
          ctx.font = `600 40px ${sans}`;
          ctx.fillStyle = soft;
          ctx.fillText(slide.bigUnit, PAD + w + 28, y + 250);
        }
      },
    });
  }
  if (slide.stats?.length) {
    blocks.push({
      h: 250,
      draw: (y) => {
        const n = slide.stats!.length;
        const cw = (maxW - 24 * (n - 1)) / n;
        slide.stats!.forEach((s, k) => {
          const x = PAD + k * (cw + 24);
          ctx.fillStyle = 'rgba(255,255,255,0.09)';
          roundRect(ctx, x, y + 40, cw, 190, 36);
          ctx.fill();
          ctx.font = `700 28px ${sans}`;
          ctx.fillStyle = soft;
          ctx.fillText(s.label.toUpperCase(), x + 32, y + 100);
          ctx.font = `600 84px ${display}`;
          ctx.fillStyle = ink;
          ctx.fillText(s.value, x + 32, y + 196);
        });
      },
    });
  }
  if (slide.bars?.length) {
    blocks.push({
      h: 40 + slide.bars.length * 120,
      draw: (y) => {
        slide.bars!.forEach((b, k) => {
          const yy = y + 60 + k * 120;
          ctx.font = `600 40px ${sans}`;
          ctx.fillStyle = ink;
          ctx.fillText(`${b.icon ? `${b.icon}  ` : ''}${b.label}`, PAD, yy);
          ctx.fillStyle = soft;
          const vw = ctx.measureText(b.value).width;
          ctx.fillText(b.value, W - PAD - vw, yy);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          roundRect(ctx, PAD, yy + 24, maxW, 22, 11);
          ctx.fill();
          ctx.fillStyle = accent;
          roundRect(ctx, PAD, yy + 24, Math.max(0.06, b.pct) * maxW, 22, 11);
          ctx.fill();
        });
      },
    });
  }
  if (slide.lines.length) {
    ctx.font = `500 42px ${sans}`;
    const lines = slide.lines.flatMap((l) => wrap(ctx, l, maxW));
    blocks.push({
      h: 50 + lines.length * 60,
      draw: (y) => {
        ctx.font = `500 42px ${sans}`;
        ctx.fillStyle = soft;
        lines.forEach((l, k) => ctx.fillText(l, PAD, y + 80 + k * 60));
      },
    });
  }
  const total = blocks.reduce((a, b) => a + b.h, 0);
  let y = Math.max(200, (H - total) / 2 - 40);
  for (const b of blocks) {
    b.draw(y);
    y += b.h;
  }

  // Alatunniste
  ctx.font = `600 32px ${sans}`;
  ctx.fillStyle = soft;
  ctx.fillText('Liikkumisen seuranta', PAD, H - 90);
  const pg = `${opts.index + 1} / ${opts.count}`;
  ctx.fillText(pg, W - PAD - ctx.measureText(pg).width, H - 90);
  return canvas;
}

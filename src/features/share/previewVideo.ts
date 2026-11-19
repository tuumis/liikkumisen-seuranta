// Ennakko- ja tulosvideo (19.11.2026): piirto erotetaan osiin (tausta, tunniste, joukkueet, VS, rivit, laatikot),
// osat animoidaan ajoituksen mukaan ja video tehdään kuva kerrallaan (WebCodecs + Mediabunny, 19.11.2026).
// Vanhoissa selaimissa varatienä kangas tallennetaan reaaliajassa MediaRecorderilla.
// Kaikki tapahtuu laitteella; mitään ei lähetetä ennen kuin käyttäjä jakaa tiedoston.

import type { LayerMark } from './drawResult';
import { poseAt, videoTimeline, type VideoTimeline } from './videoTimeline';

interface Segment {
  name: string;
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
}

export interface VideoScene {
  width: number;
  height: number;
  bg: HTMLCanvasElement;
  segments: Segment[];
  timeline: VideoTimeline;
}

/**
 * Kerää piirron osat: jokainen `mark` leikkaa siihen asti piirretyn omaksi kuvakseen ja tyhjentää kankaan.
 * Ensimmäinen osa on tausta. Piirron tila (fontti, värit) säilyy, koska kangas pysyy samana.
 */
export function layerCollector() {
  let ctx: CanvasRenderingContext2D | undefined;
  let current = 'bg';
  let bg: HTMLCanvasElement | undefined;
  const segments: Segment[] = [];

  const cut = () => {
    if (!ctx) return;
    const c = ctx.canvas;
    if (current === 'bg') {
      bg = copy(c, 0, 0, c.width, c.height);
    } else {
      const box = bounds(ctx);
      if (box) segments.push({ name: current, canvas: copy(c, box.x, box.y, box.w, box.h), x: box.x, y: box.y });
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
  };

  const mark: LayerMark = (name, c) => {
    ctx = c;
    cut();
    current = name;
  };

  /** Viimeinen osa talteen; undefined, jos piirto ei merkinnyt osia. */
  const finish = (): VideoScene | undefined => {
    cut();
    if (!ctx || !bg) return undefined;
    return {
      width: ctx.canvas.width,
      height: ctx.canvas.height,
      bg,
      segments,
      timeline: videoTimeline(['bg', ...segments.map((s) => s.name)]),
    };
  };
  return { mark, finish };
}

function copy(src: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(src, x, y, w, h, 0, 0, w, h);
  return c;
}

/** Piirretyn alueen rajat (läpinäkymättömät pikselit) pienellä reunalla; undefined = tyhjä. */
function bounds(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = ctx.canvas;
  const data = new Uint32Array(ctx.getImageData(0, 0, w, h).data.buffer);
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let first = -1;
    for (let x = 0; x < w; x++) {
      if (data[row + x] !== 0) {
        first = x;
        break;
      }
    }
    if (first < 0) continue;
    let last = first;
    for (let x = w - 1; x > first; x--) {
      if (data[row + x] !== 0) {
        last = x;
        break;
      }
    }
    if (first < minX) minX = first;
    if (last > maxX) maxX = last;
    if (y < minY) minY = y;
    maxY = y;
  }
  if (maxX < 0) return undefined;
  const pad = 2;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return { x, y, w: Math.min(w, maxX + pad + 1) - x, h: Math.min(h, maxY + pad + 1) - y };
}

/** Yksi kuva hetkellä t (sekunteina); t ≥ kesto = valmis ennakkokuva. */
export function drawFrame(ctx: CanvasRenderingContext2D, scene: VideoScene, t: number) {
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(scene.bg, 0, 0);
  for (const s of scene.segments) {
    const pose = poseAt(scene.timeline.anims.get(s.name), t, scene.width);
    if (pose.alpha <= 0) continue;
    ctx.globalAlpha = pose.alpha;
    if (pose.scale !== 1) {
      const cx = s.x + s.canvas.width / 2;
      const cy = s.y + s.canvas.height / 2;
      ctx.setTransform(pose.scale, 0, 0, pose.scale, cx + pose.dx - cx * pose.scale, cy + pose.dy - cy * pose.scale);
      ctx.drawImage(s.canvas, s.x, s.y);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(s.canvas, s.x + pose.dx, s.y + pose.dy);
    }
  }
  ctx.globalAlpha = 1;
}

export interface VideoFormat {
  mime: string;
  ext: 'mp4' | 'webm';
}

// MP4 ensin (iPhone, WhatsApp ja Instagram); 1080×1920 vaatii H.264-tason 4.0, joten tasot erikseen.
const CANDIDATES = [
  'video/mp4;codecs=avc1.640028',
  'video/mp4;codecs=avc1.4d0028',
  'video/mp4;codecs=avc1.420028',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

/** Paras tuettu videomuoto; undefined = selain ei osaa tallentaa kangasta videoksi. */
export function pickVideoFormat(): VideoFormat | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) return undefined;
  const mime = CANDIDATES.find((m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  });
  return mime ? { mime, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' } : undefined;
}

/**
 * Toistaa animaation näkyvällä kankaalla ja tallentaa sen samalla videoksi (30 kuvaa/s, ei ääntä).
 * Kangas on sivulla, koska osa selaimista ei tallenna piilossa olevaa kangasta.
 */
export function recordScene(
  canvas: HTMLCanvasElement,
  scene: VideoScene,
  format: VideoFormat,
  onProgress: (share: number) => void,
  signal: AbortSignal,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const ctx = canvas.getContext('2d')!;
    drawFrame(ctx, scene, 0);
    const stream = canvas.captureStream(30);
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 12_000_000 });
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    const chunks: Blob[] = [];
    let raf = 0;
    let failed = false;
    const stopAll = () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
    };
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onerror = () => {
      failed = true;
      stopAll();
      reject(new Error('Videon tallennus keskeytyi'));
    };
    rec.onstop = () => {
      stopAll();
      if (failed) return;
      if (signal.aborted) return reject(new DOMException('Peruttu', 'AbortError'));
      const type = (rec.mimeType || format.mime).split(';')[0];
      const blob = new Blob(chunks, { type });
      if (!blob.size) return reject(new Error('Video jäi tyhjäksi'));
      resolve(blob);
    };
    signal.addEventListener('abort', () => rec.state !== 'inactive' && rec.stop(), { once: true });
    rec.start(500);
    const t0 = performance.now();
    const total = scene.timeline.total;
    const tick = () => {
      if (signal.aborted || rec.state === 'inactive') return;
      const t = (performance.now() - t0) / 1000;
      drawFrame(ctx, scene, t);
      onProgress(Math.min(1, t / total));
      if (t >= total + 0.15) {
        rec.stop();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}

/** Kuva kerrallaan tehdyn videon kuvataajuus ja bittinopeus (paikallaan olevat kuvat pakkautuvat pieniksi). */
const FPS = 30;
const BITRATE = 16_000_000;

/**
 * Voiko selain tehdä videon kuva kerrallaan (WebCodecs, H.264 MP4). Tällöin video on tasainen ja terävä
 * laitteen nopeudesta riippumatta, eikä tallennus tapahdu reaaliajassa.
 */
export async function canEncodeFrames(width: number, height: number): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return false;
  try {
    const { canEncodeVideo, Quality } = await import('mediabunny');
    return await canEncodeVideo('avc', { width, height, quality: new Quality({ bitrate: BITRATE }), frameRate: FPS });
  } catch {
    return false;
  }
}

/** Tekee videon kuva kerrallaan piilossa olevalla kankaalla; Mediabunny ladataan vasta tarvittaessa. */
export async function encodeScene(scene: VideoScene, onProgress: (share: number) => void, signal: AbortSignal): Promise<Blob> {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, Quality } = await import('mediabunny');
  const canvas = document.createElement('canvas');
  canvas.width = scene.width;
  canvas.height = scene.height;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec: 'avc', quality: new Quality({ bitrate: BITRATE }), keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: FPS });
  const frames = Math.ceil(scene.timeline.total * FPS) + 1;
  try {
    await output.start();
    for (let i = 0; i < frames; i++) {
      if (signal.aborted) throw new DOMException('Peruttu', 'AbortError');
      drawFrame(ctx, scene, i / FPS);
      await source.add(i / FPS, 1 / FPS);
      onProgress((i + 1) / frames);
      // Välillä tauko, jotta edistymispalkki ehtii piirtyä.
      if (i % 6 === 5) await new Promise((r) => setTimeout(r, 0));
    }
    await output.finalize();
  } catch (e) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => undefined);
    throw e;
  }
  const buf = output.target.buffer;
  if (!buf?.byteLength) throw new Error('Video jäi tyhjäksi');
  return new Blob([buf], { type: 'video/mp4' });
}

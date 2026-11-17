// Generoi PWA-kuvakkeet public/-kansioon ilman lisäriippuvuuksia (Node zlib).
// Aja: node scripts/generate-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// Vuono-väriteema (oletusteema, 17.11.2026): tumma sinivihreä pohja, persikka kaari (vrt. App.tsx BrandMark).
const BG = [31, 74, 91]; // #1f4a5b
const ARC = [239, 191, 148]; // #efbf94
const DOT = [246, 245, 240]; // #f6f5f0
const TRACK_ALPHA = 0.22;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Merkki 40 × 40 -ruudukossa (sama kuin favicon.svg ja BrandMark): rengas r = 10,5, viiva 3,2, kaari
// ylhäältä myötäpäivään pisteeseen (10,1; 23,5) pyöreillä päillä, keskellä piste r = 3,4.
const R = 10.5 / 40;
const HALF_W = 3.2 / 80;
const DOT_R = 3.4 / 40;
const A0 = -Math.PI / 2;
const A1 = Math.atan2(23.5 - 20, 10.1 - 20); // ≈ 160,5°
const SWEEP = (A1 - A0 + 2 * Math.PI) % (2 * Math.PI);
const END = [Math.cos(A1) * R, Math.sin(A1) * R];
const START = [0, -R];

function sample(u, v, { rounded, scale }) {
  if (rounded) {
    const r = 0.3;
    const ax = Math.max(Math.abs(u) - (0.5 - r), 0);
    const ay = Math.max(Math.abs(v) - (0.5 - r), 0);
    if (Math.hypot(ax, ay) > r) return null;
  }
  const x = u / scale;
  const y = v / scale;
  const d = Math.hypot(x, y);
  if (d < DOT_R) return DOT;
  const onRing = Math.abs(d - R) < HALF_W;
  const ang = (Math.atan2(y, x) - A0 + 2 * Math.PI) % (2 * Math.PI);
  const cap = Math.hypot(x - START[0], y - START[1]) < HALF_W || Math.hypot(x - END[0], y - END[1]) < HALF_W;
  if ((onRing && ang <= SWEEP) || cap) return ARC;
  if (onRing) return BG.map((c) => Math.round(c + (255 - c) * TRACK_ALPHA));
  return BG;
}

// Reunanpehmennys: 4 × 4 näytettä pikseliä kohden.
function icon(opts) {
  return (x, y, s) => {
    let r = 0, g = 0, b = 0, a = 0;
    const N = 4;
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const c = sample((x - 0.5 + (i + 0.5) / N) / s - 0.5, (y - 0.5 + (j + 0.5) / N) / s - 0.5, opts);
        if (!c) continue;
        r += c[0];
        g += c[1];
        b += c[2];
        a++;
      }
    if (!a) return [0, 0, 0, 0];
    return [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round((a / (N * N)) * 255)];
  };
}

mkdirSync('public', { recursive: true });
writeFileSync('public/pwa-192.png', png(192, icon({ rounded: true, scale: 1 })));
writeFileSync('public/pwa-512.png', png(512, icon({ rounded: true, scale: 1 })));
writeFileSync('public/pwa-maskable-512.png', png(512, icon({ rounded: false, scale: 0.95 })));
writeFileSync('public/apple-touch-icon.png', png(180, icon({ rounded: false, scale: 1 })));
console.log('Kuvakkeet luotu public/-kansioon');

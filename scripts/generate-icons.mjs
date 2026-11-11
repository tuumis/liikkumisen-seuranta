// Generoi PWA-kuvakkeet public/-kansioon ilman lisäriippuvuuksia (Node zlib).
// Aja: node scripts/generate-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const GREEN = [21, 128, 61];
const WHITE = [255, 255, 255];

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

// Kuvio: valkoinen rengas (juoksurata) ja täysi ympyrä keskellä, vihreällä pohjalla.
function icon({ rounded, scale }) {
  return (x, y, s) => {
    const u = x / s - 0.5;
    const v = y / s - 0.5;
    if (rounded) {
      const r = 0.22;
      const ax = Math.max(Math.abs(u) - (0.5 - r), 0);
      const ay = Math.max(Math.abs(v) - (0.5 - r), 0);
      if (Math.hypot(ax, ay) > r) return [0, 0, 0, 0];
    }
    const d = Math.hypot(u, v) / scale;
    const white = (d > 0.26 && d < 0.36) || d < 0.12;
    return [...(white ? WHITE : GREEN), 255];
  };
}

mkdirSync('public', { recursive: true });
writeFileSync('public/pwa-192.png', png(192, icon({ rounded: true, scale: 1 })));
writeFileSync('public/pwa-512.png', png(512, icon({ rounded: true, scale: 1 })));
writeFileSync('public/pwa-maskable-512.png', png(512, icon({ rounded: false, scale: 0.8 })));
writeFileSync('public/apple-touch-icon.png', png(180, icon({ rounded: false, scale: 0.9 })));
console.log('Kuvakkeet luotu public/-kansioon');

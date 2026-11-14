// Maaliput sovelluksen omina piirroksina (14.11.2026): Windows ei näytä lippuemojeja, joten liput
// kuvataan yksinkertaisina muotoina 30 × 20 -ruudukossa. Sama kuvaus piirretään SVG:nä (Flag-komponentti)
// ja canvasille (drawFlag, jakokuvat). Yksinkertaistettuja: vaakunat ja pienet yksityiskohdat jätetään pois.

export type FlagShape =
  | { r: [number, number, number, number]; c: string }
  | { o: [number, number, number]; c: string }
  | { p: number[]; c: string };

const W = 30;
const H = 20;

const h = (...colors: string[]): FlagShape[] => colors.map((c, i) => ({ r: [0, (H / colors.length) * i, W, H / colors.length + 0.05], c }));
const v = (...colors: string[]): FlagShape[] => colors.map((c, i) => ({ r: [(W / colors.length) * i, 0, W / colors.length + 0.05, H], c }));
/** Pohjoismainen risti: pohja, risti ja valinnainen sisempi risti. */
const nordic = (bg: string, cross: string, inner?: string): FlagShape[] => {
  const out: FlagShape[] = [{ r: [0, 0, W, H], c: bg }, { r: [8, 0, 4.4, H], c: cross }, { r: [0, 7.8, W, 4.4], c: cross }];
  if (inner) out.push({ r: [9.1, 0, 2.2, H], c: inner }, { r: [0, 8.9, W, 2.2], c: inner });
  return out;
};
/** Viisisakarainen tähti (keskipiste, säde). */
const star = (cx: number, cy: number, R: number, c: string): FlagShape => {
  const p: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? R * 0.4 : R;
    p.push(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  return { p, c };
};
const centerCross = (bg: string, c: string): FlagShape[] => [{ r: [0, 0, W, H], c: bg }, { r: [12.5, 4, 5, 12], c }, { r: [9, 7.5, 12, 5], c }];

export interface Country {
  code: string;
  name: string;
  shapes: FlagShape[];
}

const LIST: Country[] = [
  { code: 'FI', name: 'Suomi', shapes: nordic('#ffffff', '#002f6c') },
  { code: 'AX', name: 'Ahvenanmaa', shapes: nordic('#0053a5', '#ffce00', '#d21034') },
  { code: 'SE', name: 'Ruotsi', shapes: nordic('#006aa7', '#fecc00') },
  { code: 'NO', name: 'Norja', shapes: nordic('#ba0c2f', '#ffffff', '#00205b') },
  { code: 'DK', name: 'Tanska', shapes: nordic('#c8102e', '#ffffff') },
  { code: 'IS', name: 'Islanti', shapes: nordic('#02529c', '#ffffff', '#dc1e35') },
  { code: 'FO', name: 'Färsaaret', shapes: nordic('#ffffff', '#0065bd', '#ed2939') },
  { code: 'EE', name: 'Viro', shapes: h('#0072ce', '#000000', '#ffffff') },
  { code: 'LV', name: 'Latvia', shapes: [{ r: [0, 0, W, H], c: '#9e3039' }, { r: [0, 8, W, 4], c: '#ffffff' }] },
  { code: 'LT', name: 'Liettua', shapes: h('#fdb913', '#006a44', '#c1272d') },
  { code: 'RU', name: 'Venäjä', shapes: h('#ffffff', '#0039a6', '#d52b1e') },
  { code: 'DE', name: 'Saksa', shapes: h('#000000', '#dd0000', '#ffce00') },
  { code: 'NL', name: 'Alankomaat', shapes: h('#ae1c28', '#ffffff', '#21468b') },
  { code: 'BE', name: 'Belgia', shapes: v('#000000', '#fdda24', '#ef3340') },
  { code: 'LU', name: 'Luxemburg', shapes: h('#ed2939', '#ffffff', '#00a1de') },
  { code: 'FR', name: 'Ranska', shapes: v('#002395', '#ffffff', '#ed2939') },
  { code: 'IT', name: 'Italia', shapes: v('#009246', '#ffffff', '#ce2b37') },
  { code: 'ES', name: 'Espanja', shapes: [{ r: [0, 0, W, H], c: '#aa151b' }, { r: [0, 5, W, 10], c: '#f1bf00' }] },
  { code: 'PT', name: 'Portugali', shapes: [{ r: [0, 0, 12, H], c: '#006600' }, { r: [12, 0, 18, H], c: '#ff0000' }, { o: [12, 10, 3.6], c: '#ffcc00' }] },
  { code: 'IE', name: 'Irlanti', shapes: v('#169b62', '#ffffff', '#ff883e') },
  { code: 'GB-ENG', name: 'Englanti', shapes: [{ r: [0, 0, W, H], c: '#ffffff' }, { r: [13, 0, 4, H], c: '#ce1124' }, { r: [0, 8, W, 4], c: '#ce1124' }] },
  {
    code: 'GB-SCT',
    name: 'Skotlanti',
    shapes: [{ r: [0, 0, W, H], c: '#005eb8' }, { p: [0, 0, 2.5, 0, W, 18.3, W, H, 27.5, H, 0, 1.7], c: '#ffffff' }, { p: [W, 0, W, 1.7, 2.5, H, 0, H, 0, 18.3, 27.5, 0], c: '#ffffff' }],
  },
  { code: 'CH', name: 'Sveitsi', shapes: centerCross('#da291c', '#ffffff') },
  { code: 'AT', name: 'Itävalta', shapes: h('#ed2939', '#ffffff', '#ed2939') },
  { code: 'PL', name: 'Puola', shapes: h('#ffffff', '#dc143c') },
  { code: 'CZ', name: 'Tšekki', shapes: [...h('#ffffff', '#d7141a'), { p: [0, 0, 15, 10, 0, H], c: '#11457e' }] },
  { code: 'SK', name: 'Slovakia', shapes: h('#ffffff', '#0b4ea2', '#ee1c25') },
  { code: 'HU', name: 'Unkari', shapes: h('#ce2939', '#ffffff', '#477050') },
  { code: 'SI', name: 'Slovenia', shapes: h('#ffffff', '#005da4', '#ed1c24') },
  { code: 'HR', name: 'Kroatia', shapes: [...h('#ff0000', '#ffffff', '#171796'), { r: [12.5, 5, 5, 7], c: '#ff0000' }, { r: [13.75, 6, 2.5, 2.5], c: '#ffffff' }, { r: [12.5, 8.5, 1.25, 2.5], c: '#ffffff' }, { r: [16.25, 8.5, 1.25, 2.5], c: '#ffffff' }] },
  { code: 'RS', name: 'Serbia', shapes: h('#c6363c', '#0c4076', '#ffffff') },
  { code: 'RO', name: 'Romania', shapes: v('#002b7f', '#fcd116', '#ce1126') },
  { code: 'BG', name: 'Bulgaria', shapes: h('#ffffff', '#00966e', '#d62612') },
  { code: 'UA', name: 'Ukraina', shapes: h('#0057b7', '#ffd700') },
  {
    code: 'GR',
    name: 'Kreikka',
    shapes: [
      ...h('#0d5eaf', '#ffffff', '#0d5eaf', '#ffffff', '#0d5eaf', '#ffffff', '#0d5eaf', '#ffffff', '#0d5eaf'),
      { r: [0, 0, 11.1, 11.1], c: '#0d5eaf' },
      { r: [4.45, 0, 2.2, 11.1], c: '#ffffff' },
      { r: [0, 4.45, 11.1, 2.2], c: '#ffffff' },
    ],
  },
  { code: 'TR', name: 'Turkki', shapes: [{ r: [0, 0, W, H], c: '#e30a17' }, { o: [11, 10, 5], c: '#ffffff' }, { o: [12.3, 10, 4], c: '#e30a17' }, star(17.3, 10, 2.3, '#ffffff')] },
  { code: 'US', name: 'Yhdysvallat', shapes: [...h('#b22234', '#ffffff', '#b22234', '#ffffff', '#b22234', '#ffffff', '#b22234'), { r: [0, 0, 12, 10.8], c: '#3c3b6e' }] },
  { code: 'CA', name: 'Kanada', shapes: [...v('#d52b1e', '#ffffff', '#ffffff', '#d52b1e'), { p: [15, 4, 17, 8, 19.5, 7.5, 18.5, 11.5, 16, 12, 16, 15, 14, 15, 14, 12, 11.5, 11.5, 10.5, 7.5, 13, 8], c: '#d52b1e' }] },
  { code: 'MX', name: 'Meksiko', shapes: [...v('#006847', '#ffffff', '#ce1126'), { o: [15, 10, 2.4], c: '#8c6a3b' }] },
  { code: 'BR', name: 'Brasilia', shapes: [{ r: [0, 0, W, H], c: '#009c3b' }, { p: [15, 2, 28, 10, 15, 18, 2, 10], c: '#ffdf00' }, { o: [15, 10, 4.6], c: '#002776' }] },
  { code: 'AR', name: 'Argentiina', shapes: [...h('#74acdf', '#ffffff', '#74acdf'), { o: [15, 10, 2], c: '#f6b40e' }] },
  { code: 'JP', name: 'Japani', shapes: [{ r: [0, 0, W, H], c: '#ffffff' }, { o: [15, 10, 6], c: '#bc002d' }] },
  { code: 'KR', name: 'Etelä-Korea', shapes: [{ r: [0, 0, W, H], c: '#ffffff' }, { o: [15, 10, 5], c: '#0047a0' }, { p: [10, 10, 10.3, 8.2, 11.4, 6.5, 13, 5.3, 15, 5, 17, 5.3, 18.6, 6.5, 19.7, 8.2, 20, 10], c: '#cd2e3a' }] },
  { code: 'CN', name: 'Kiina', shapes: [{ r: [0, 0, W, H], c: '#ee1c25' }, star(5, 5, 3, '#ffff00'), star(10, 2, 1, '#ffff00'), star(12, 4, 1, '#ffff00'), star(12, 7, 1, '#ffff00'), star(10, 9, 1, '#ffff00')] },
  { code: 'AU', name: 'Australia', shapes: [{ r: [0, 0, W, H], c: '#012169' }, star(7.5, 15, 2.2, '#ffffff'), star(22.5, 4, 1.2, '#ffffff'), star(20, 9, 1.2, '#ffffff'), star(25, 8, 1.2, '#ffffff'), star(22.5, 16, 1.2, '#ffffff')] },
  { code: 'MA', name: 'Marokko', shapes: [{ r: [0, 0, W, H], c: '#c1272d' }, star(15, 10, 4.5, '#006233'), star(15, 10, 3, '#c1272d')] },
  { code: 'NG', name: 'Nigeria', shapes: v('#008751', '#ffffff', '#008751') },
  { code: 'GH', name: 'Ghana', shapes: [...h('#ce1126', '#fcd116', '#006b3f'), star(15, 10, 3, '#000000')] },
  { code: 'SN', name: 'Senegal', shapes: [...v('#00853f', '#fdef42', '#e31b23'), star(15, 10, 2.6, '#00853f')] },
  { code: 'SO', name: 'Somalia', shapes: [{ r: [0, 0, W, H], c: '#4189dd' }, star(15, 10, 5, '#ffffff')] },
  { code: 'VN', name: 'Vietnam', shapes: [{ r: [0, 0, W, H], c: '#da251d' }, star(15, 10, 6, '#ffff00')] },
];

/** Maat aakkosjärjestyksessä, Suomi ensin. */
export const COUNTRIES: readonly Country[] = Object.freeze([LIST[0], ...LIST.slice(1).sort((a, b) => a.name.localeCompare(b.name, 'fi'))]);
const BY_CODE = new Map(LIST.map((c) => [c.code, c]));

export function countryOf(code: string | undefined): Country | undefined {
  return code ? BY_CODE.get(code) : undefined;
}

/** Lippu canvasille (jakokuvat): suorakulmio x, y, leveys w (korkeus w × 2/3); ohut reunus vaalealle pohjalle. */
export function drawFlag(ctx: CanvasRenderingContext2D, code: string | undefined, x: number, y: number, w: number): boolean {
  const c = countryOf(code);
  if (!c) return false;
  const k = w / W;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, H * k);
  ctx.clip();
  for (const s of c.shapes) {
    ctx.fillStyle = s.c;
    if ('r' in s) ctx.fillRect(x + s.r[0] * k, y + s.r[1] * k, s.r[2] * k, s.r[3] * k);
    else if ('o' in s) {
      ctx.beginPath();
      ctx.arc(x + s.o[0] * k, y + s.o[1] * k, s.o[2] * k, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      for (let i = 0; i < s.p.length; i += 2) ctx[i ? 'lineTo' : 'moveTo'](x + s.p[i] * k, y + s.p[i + 1] * k);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = Math.max(1, w / 40);
  ctx.strokeRect(x, y, w, H * k);
  return true;
}

export const FLAG_VIEWBOX = `0 0 ${W} ${H}`;

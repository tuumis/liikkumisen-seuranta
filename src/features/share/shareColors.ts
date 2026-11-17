// Jakokuvien värit (14.11.2026): valmiit väriteemat ja oma väri. Valinta muistetaan joukkueittain
// (oman joukkueen seuralle, `Club.shareColor`): arvo on teeman tunniste tai oma väri muodossa #rrggbb.
// Puuttuva arvo = sovelluksen värit (kuten ennen).

export interface ShareColor {
  id: string;
  label: string;
  base: string;
  /** Korostusväri (tunniste, viivat); puuttuessa johdetaan perusväristä. */
  accent?: string;
}

export const SHARE_COLORS: readonly ShareColor[] = [
  { id: 'navy', label: 'Sininen', base: '#1d4ed8', accent: '#fde047' },
  { id: 'sky', label: 'Vaaleansininen', base: '#0284c7', accent: '#ffffff' },
  { id: 'red', label: 'Punainen', base: '#c81e1e', accent: '#fde68a' },
  { id: 'black', label: 'Musta ja kulta', base: '#1f2328', accent: '#fbbf24' },
  // Mustavalkoiset seurat (esim. FC Lahti, käyttäjän toive 17.11.2026): raidat ja korosteet valkoisina tai mustina.
  { id: 'blackwhite', label: 'Musta ja valkoinen', base: '#141414', accent: '#ffffff' },
  { id: 'whiteblack', label: 'Valkoinen ja musta', base: '#f4f4f2', accent: '#141414' },
  { id: 'green', label: 'Vihreä', base: '#15803d', accent: '#d9f99d' },
  { id: 'purple', label: 'Violetti', base: '#6d28d9', accent: '#f5d0fe' },
  { id: 'orange', label: 'Oranssi', base: '#ea580c', accent: '#fff7ed' },
  { id: 'yellow', label: 'Keltainen', base: '#facc15', accent: '#1e3a8a' },
];

export const isHexColor = (v: string | undefined): v is string => !!v && /^#[0-9a-f]{6}$/i.test(v);

/** Tallennettu arvo väriksi; tuntematon tai puuttuva → undefined (sovelluksen värit). */
export function resolveShareColor(v: string | undefined): ShareColor | undefined {
  if (!v) return undefined;
  const preset = SHARE_COLORS.find((c) => c.id === v);
  if (preset) return preset;
  return isHexColor(v) ? { id: v, label: 'Oma väri', base: v.toLowerCase() } : undefined;
}

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: number[]) => `#${c.map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('')}`;

/** Värien sekoitus: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Suhteellinen luminanssi (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Vaalea perusväri (esim. keltainen) saa tumman tekstin, jotta teksti erottuu. */
export const isLightColor = (hex: string) => luminance(hex) > 0.4;

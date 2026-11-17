// Tulostettavien raporttien värit (SPEC 16, 17.11.2026): raportti on aina vaalea paperi, myös tummassa
// teemassa, ja käyttää valitun väriteeman VAALEAN tilan kaaviovärejä kuten sovelluksen kaaviot:
// teeman väri = kirjatut kerrat, oranssi = arkiliikunta; tehot teeman sävyinä vaaleasta tummaan.

export interface ReportPalette {
  ink: string;
  soft: string;
  line: string;
  /** Otsikkonauha ja summarivi (teeman tumma sävy). */
  header: string;
  /** Otsikkonauhan pieni korostusteksti. */
  headerKicker: string;
  /** Päivän otsikkorivin taustasävy. */
  tint: string;
  /** Kirjatut kerrat (sovelluksen --viz-logged). */
  logged: string;
  /** Arkiliikunta (sovelluksen --viz-estimate). */
  estimate: string;
  /** Tehot: kevyt, reipas, rasittava (yksi sävy vaaleasta tummaan). */
  light: string;
  moderate: string;
  vigorous: string;
}

type Accent = 'forest' | 'fjord' | 'heather' | 'graphite';

// Arvot index.css:n vaaleista teemoista (--accent, --viz-logged, --band-1…6).
const ACCENTS: Record<Accent, Pick<ReportPalette, 'header' | 'headerKicker' | 'tint' | 'logged' | 'light' | 'moderate' | 'vigorous'>> = {
  forest: { header: '#244c3b', headerKicker: '#c3d8c6', tint: '#eef4ed', logged: '#127a4e', light: '#c3d8c6', moderate: '#6f9e7d', vigorous: '#244c3b' },
  fjord: { header: '#1f4a5b', headerKicker: '#b7d3de', tint: '#ecf3f6', logged: '#00779c', light: '#b7d3de', moderate: '#5e94a9', vigorous: '#1f4a5b' },
  heather: { header: '#4a2f55', headerKicker: '#d9c6de', tint: '#f5eff6', logged: '#7b4b94', light: '#d9c6de', moderate: '#9d76a8', vigorous: '#4a2f55' },
  graphite: { header: '#2f3a40', headerKicker: '#cbd2d6', tint: '#f0f2f3', logged: '#2a64a3', light: '#cbd2d6', moderate: '#7f8c93', vigorous: '#2f3a40' },
};

export function reportPalette(accent?: string | null): ReportPalette {
  const a = (accent && accent in ACCENTS ? accent : 'forest') as Accent;
  return { ink: '#22302b', soft: '#5a645d', line: '#e5e2d8', estimate: '#c4823f', ...ACCENTS[a] };
}

/** Sivun nykyinen väriteema (html[data-accent]; puuttuessa CSS:n oletus eli metsä). */
export function currentReportPalette(): ReportPalette {
  return reportPalette(typeof document === 'undefined' ? undefined : document.documentElement.dataset.accent);
}

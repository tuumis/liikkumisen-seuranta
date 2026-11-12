import { Card } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { ACCENT_THEMES, useAccent, useThemeChoice, useViewMode, type ThemeChoice, type ViewMode } from '../../ui/theme';

const VIEW_MODES: { id: ViewMode; label: string; text: string }[] = [
  { id: 'full', label: 'Kattava', text: 'Kaikki tiedot ja kaaviot: viikon tilanne, päiväkaavio, rytmi, liikuntatunnit, tulevat ja viimeisimmät kerrat.' },
  { id: 'simple', label: 'Yksinkertainen', text: 'Vain tärkein: viikon tilanne ja päivät. Kirjaus, kuittaus ja muokkaus toimivat kuten ennenkin.' },
];

export function AppearanceSection() {
  const [choice, setChoice] = useThemeChoice();
  const [accent, setAccent] = useAccent();
  const [view, setView] = useViewMode();
  return (
    <div className="space-y-5">
      <Card title="Näkymä">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Näkymä">
          {VIEW_MODES.map((m) => {
            const on = view === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setView(m.id)}
                className={`press card-interactive rounded-[1.25rem] p-4 text-left ${on ? 'bg-[var(--surface-raised)] shadow-md ring-2 ring-green-700' : 'card'}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-base font-semibold text-slate-900">{m.label}</span>
                  {on && <span className="rounded-full bg-green-700 px-2 py-0.5 text-[11px] font-bold text-white">Käytössä</span>}
                </span>
                <span className="mt-1 block text-xs leading-snug text-slate-500">{m.text}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Valinta koskee Viikko-näkymää tällä laitteella. Analyysin sisällön voi valita Analyysi-sivulla.</p>
      </Card>

      <Card title="Vaalea vai tumma">
        <Segmented<ThemeChoice>
          label="Teema"
          value={choice}
          onChange={setChoice}
          options={[
            { value: 'system', label: 'Järjestelmä' },
            { value: 'light', label: 'Vaalea' },
            { value: 'dark', label: 'Tumma' },
          ]}
        />
        <p className="mt-2 text-xs text-slate-500">"Järjestelmä" seuraa laitteen asetusta. Valinta koskee vain tätä laitetta.</p>
      </Card>

      <Card title="Väriteema">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Väriteema">
          {ACCENT_THEMES.map((t) => {
            const on = accent === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setAccent(t.id)}
                className={`press card-interactive flex items-center gap-3 rounded-[1.25rem] p-3 text-left ${on ? 'bg-[var(--surface-raised)] shadow-md ring-2 ring-green-700' : 'card'}`}
              >
                <span className="relative flex size-14 shrink-0 overflow-hidden rounded-2xl shadow-sm" aria-hidden>
                  <span className="h-full w-1/2" style={{ background: t.swatch[0] }} />
                  <span className="flex h-full w-1/2 flex-col">
                    <span className="h-1/2" style={{ background: t.swatch[1] }} />
                    <span className="h-1/2" style={{ background: t.swatch[2] }} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-semibold text-slate-900">{t.label}</span>
                  <span className="block text-xs text-slate-500">{t.text}</span>
                </span>
                {on && (
                  <span className="anim-pop flex size-7 items-center justify-center rounded-full bg-green-700 text-white" aria-hidden>
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12.5 4.2 4.2L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Väriteema vaihtaa korostevärit, navigaation ja kaavioiden pääsävyn. Kaaviovärit on tarkistettu erottuviksi myös värisokeille.</p>
      </Card>
    </div>
  );
}

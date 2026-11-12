import { Card } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { ACCENT_THEMES, useAccent, useThemeChoice, type ThemeChoice } from '../../ui/theme';

export function AppearanceSection() {
  const [choice, setChoice] = useThemeChoice();
  const [accent, setAccent] = useAccent();
  return (
    <div className="space-y-5">
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

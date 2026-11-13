// Aloitusopas uudelle käyttäjälle: kolme askelta, jotka vievät suoraan oikeaan paikkaan.

import type { SettingsSectionId } from '../settings/SettingsView';
import { IconChevronRight, IconPlus, IconRepeat, IconSparkle, IconSun } from '../../ui/icons';

const STEPS: { Icon: typeof IconPlus; title: string; text: string; action: 'add' | SettingsSectionId }[] = [
  { Icon: IconPlus, title: 'Kirjaa liikuntakerta', text: 'Laji, kesto ja tallenna – vie alle 15 sekuntia.', action: 'add' },
  { Icon: IconRepeat, title: 'Lisää toistuvat treenit', text: 'Esim. harrastus ti ja to klo 17.30. Ne näkyvät viikolla valmiina kuitattaviksi.', action: 'routine' },
  { Icon: IconSun, title: 'Arvioi tavallinen arkiliikunta', text: 'Välitunnit ja koulumatkat, joita ei kirjata joka päivä.', action: 'everyday' },
];

export function GettingStarted({ onAdd, onOpenSettings }: { onAdd: () => void; onOpenSettings: (s?: SettingsSectionId) => void }) {
  return (
    <section className="card-sage anim-rise p-5 lg:p-6">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-green-800">
        <IconSparkle size="1rem" /> Tervetuloa
      </div>
      <h2 className="font-display text-2xl font-semibold text-slate-900">Aloita näistä</h2>
      <p className="mt-0.5 text-sm text-slate-600">Kolme askelta, ja viikon tilanne alkaa näkyä. Kaikki muu on vapaaehtoista.</p>
      <ol className="mt-4 grid gap-2 lg:grid-cols-3 lg:gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => (s.action === 'add' ? onAdd() : onOpenSettings(s.action))}
              className="press card card-interactive anim-rise flex h-full w-full items-center gap-3 !rounded-2xl p-3.5 text-left lg:flex-col lg:items-start"
              style={{ ['--i' as string]: i + 1 }}
            >
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${i === 0 ? 'bg-green-700 text-white' : 'bg-[var(--surface-sage)] text-green-800'}`} aria-hidden>
                <s.Icon size="1.3rem" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Askel {i + 1}</span>
                <span className="block text-sm font-semibold text-slate-900">{s.title}</span>
                <span className="block text-xs leading-snug text-slate-500">{s.text}</span>
              </span>
              <IconChevronRight className="shrink-0 text-slate-400 lg:hidden" />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Aloitusopas uudelle käyttäjälle: kolme askelta, jotka vievät suoraan oikeaan paikkaan.

import type { SettingsSectionId } from '../settings/SettingsView';

const STEPS: { icon: string; title: string; text: string; action: 'add' | SettingsSectionId }[] = [
  { icon: '➕', title: 'Kirjaa liikuntakerta', text: 'Laji, kesto ja tallenna – vie alle 15 sekuntia.', action: 'add' },
  { icon: '🔁', title: 'Lisää toistuvat treenit', text: 'Esim. jalkapallo ti ja to klo 17.30. Ne näkyvät viikolla valmiina kuitattaviksi.', action: 'routine' },
  { icon: '🏫', title: 'Arvioi tavallinen arkiliikunta', text: 'Välitunnit ja koulumatkat, joita ei kirjata joka päivä.', action: 'everyday' },
];

export function GettingStarted({ onAdd, onOpenSettings }: { onAdd: () => void; onOpenSettings: (s?: SettingsSectionId) => void }) {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-green-50 to-white p-4 ring-1 ring-green-200 lg:p-5 dark:from-[#10291d] dark:to-[#121a2a]">
      <h2 className="text-base font-semibold text-slate-900">Aloita näistä</h2>
      <p className="mt-0.5 text-sm text-slate-600">Kolme askelta, ja viikon tilanne alkaa näkyä. Kaikki muu on vapaaehtoista.</p>
      <ol className="mt-3 space-y-2">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => (s.action === 'add' ? onAdd() : onOpenSettings(s.action))}
              className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-900">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">
                  {s.icon} {s.title}
                </span>
                <span className="block text-xs text-slate-600">{s.text}</span>
              </span>
              <span className="text-slate-400" aria-hidden>
                ›
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

import { Button, Card } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { playSound, soundsSupported, useSoundsEnabled } from '../../ui/sound';
import { ACCENT_THEMES, BACKGROUNDS, useAccent, useBackground, useThemeChoice, useViewMode, type BackgroundId, type ThemeChoice, type ViewMode } from '../../ui/theme';
import { useRef, useState } from 'react';
import { resizeBackground } from '../../ui/image';
import { useToast } from '../../ui/Toast';
import { Switch } from './DesktopSection';

const VIEW_MODES: { id: ViewMode; label: string; text: string }[] = [
  { id: 'full', label: 'Kattava', text: 'Kaikki tiedot ja kaaviot: viikon tilanne, päiväkaavio, rytmi, liikuntatunnit, tulevat ja viimeisimmät kerrat.' },
  { id: 'simple', label: 'Yksinkertainen', text: 'Vain tärkein: viikon tilanne ja päivät. Kirjaus, kuittaus ja muokkaus toimivat kuten ennenkin.' },
];

export function AppearanceSection() {
  const [choice, setChoice] = useThemeChoice();
  const [accent, setAccent] = useAccent();
  const [view, setView] = useViewMode();
  const [sounds, setSounds] = useSoundsEnabled();
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
        <p className="mt-2 text-xs text-slate-500">Oletus on vaalea. "Järjestelmä" seuraa laitteen asetusta. Valinta koskee vain tätä laitetta.</p>
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

      <BackgroundCard />

      {soundsSupported() && (
        <Card title="Äänet">
          <Switch
            on={sounds}
            onChange={setSounds}
            label="Äänet"
            text="Lyhyt, hiljainen ääni, kun kuittaat kerran tehdyksi, kun läpikäynti tyhjenee ja kun päivän tavoite tai viikon suositus täyttyy. iPhonella äänetön tila hiljentää äänet. Valinta koskee vain tätä laitetta."
          />
          {sounds && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="secondary" onClick={() => playSound('confirm')}>
                Kuittaus
              </Button>
              <Button variant="secondary" onClick={() => playSound('allDone')}>
                Läpikäynti valmis
              </Button>
              <Button variant="secondary" onClick={() => playSound('goal')}>
                Tavoite täyttyi
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

const CHECK = (
  <span className="anim-pop absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-green-700 text-white shadow" aria-hidden>
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  </span>
);

/** Sovelluksen tausta (17.11.2026): piirretyt taustat (vaalea ja tumma) ja oma kuva himmennettynä, vain tällä laitteella. */
function BackgroundCard() {
  const toast = useToast();
  const b = useBackground();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const tile = (on: boolean) =>
    `press card-interactive relative flex flex-col overflow-hidden rounded-2xl text-left ring-1 ${on ? 'ring-2 ring-green-700 shadow-md' : 'ring-[var(--line)]'}`;

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      b.setPhoto(await resizeBackground(file));
      toast('Taustakuva asetettu', undefined, 'success');
    } catch (e) {
      const quota = e instanceof DOMException && /quota/i.test(e.name + e.message);
      toast(quota ? 'Kuva on liian suuri tämän laitteen muistiin. Kokeile pienempää kuvaa.' : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const choose = (id: BackgroundId) => b.setBackground(id);
  return (
    <Card title="Tausta">
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 xl:grid-cols-7" role="radiogroup" aria-label="Tausta">
        {BACKGROUNDS.map((t) => {
          const on = b.bg === t.id;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => choose(t.id)} className={tile(on)}>
              <span className="bg-sample block h-20 w-full" data-bg-sample={t.id} aria-hidden />
              <span className="bg-[var(--surface)] px-2.5 py-1.5 text-sm font-semibold text-slate-900">{t.label}</span>
              {on && CHECK}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={b.bg === 'photo'}
          onClick={() => (b.photo ? choose('photo') : input.current?.click())}
          className={tile(b.bg === 'photo')}
          disabled={busy}
        >
          {b.photo ? (
            <span className="bg-sample block h-20 w-full" data-bg-sample="photo" aria-hidden />
          ) : (
            <span className="flex h-20 w-full items-center justify-center bg-[var(--surface-sunk)] text-2xl text-slate-400" aria-hidden>
              +
            </span>
          )}
          <span className="bg-[var(--surface)] px-2.5 py-1.5 text-sm font-semibold text-slate-900">{busy ? 'Ladataan…' : 'Oma kuva'}</span>
          {b.bg === 'photo' && CHECK}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} aria-label="Taustakuva: valitse tiedosto" />

      {b.photo && (
        <div className="mt-4 space-y-3 rounded-2xl bg-[var(--surface-sunk)] p-3">
          {b.bg === 'photo' && (
            <label className="block">
              <span className="flex items-center justify-between text-sm font-medium text-slate-700">
                Himmennys <span className="tabular-nums text-slate-500">{b.dim} %</span>
              </span>
              <input type="range" min={30} max={90} step={5} value={b.dim} onChange={(e) => b.setDim(Number(e.target.value))} className="mt-1 w-full accent-green-700" aria-label="Taustakuvan himmennys" />
              <span className="block text-xs text-slate-500">Mitä suurempi himmennys, sitä paremmin teksti ja kaaviot erottuvat kuvan päältä.</span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
              Vaihda kuva
            </Button>
            <Button variant="secondary" onClick={() => b.setPhoto(undefined)} disabled={busy}>
              Poista kuva
            </Button>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Piirretyillä taustoilla on vaalea ja tumma versio. Oma kuva tallentuu vain tälle laitteelle: se ei siirry synkronoinnissa eikä varmuuskopiossa. Valinta koskee vain tätä laitetta.
      </p>
    </Card>
  );
}

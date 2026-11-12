// Sovelluksen päivitys (SPEC 10, 16): service worker rekisteröidään kerran sovelluksen juuressa, ja
// "Uusi versio saatavilla" näkyy Viikko-näkymän ilmoituksena sekä PC:n sivupalkissa.

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../../ui/components';
import { IconSparkle } from '../../ui/icons';

interface AppUpdate {
  available: boolean;
  /** Viikko-näkymän ilmoitus piilotettu ("Myöhemmin"); sivupalkin painike jää näkyviin. */
  dismissed: boolean;
  update: () => void;
  dismiss: () => void;
}

const Ctx = createContext<AppUpdate>({ available: false, dismissed: false, update: () => {}, dismiss: () => {} });

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  // "Myöhemmin" piilottaa vain ilmoituksen; tieto uudesta versiosta säilyy sivupalkkia varten.
  const [dismissed, setDismissed] = useState(false);
  const value: AppUpdate = {
    available: needRefresh,
    dismissed,
    update: () => void updateServiceWorker(true), // lataa sivun uudelleen uudella versiolla
    dismiss: () => setDismissed(true),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAppUpdate = () => useContext(Ctx);

/** Viikko-näkymän ilmoitus. */
export function UpdateBanner() {
  const u = useAppUpdate();
  if (!u.available || u.dismissed) return null;
  return (
    <div className="anim-rise flex items-center gap-3 rounded-[1.5rem] bg-green-100 p-3 pl-4 shadow-sm">
      <span className="flex-1 text-sm font-semibold text-green-900">Uusi versio saatavilla</span>
      <Button onClick={u.update}>Päivitä</Button>
      <Button variant="ghost" onClick={u.dismiss}>
        Myöhemmin
      </Button>
    </div>
  );
}

/** PC:n sivupalkki: näkyy aina, kun uusi versio on odottamassa. */
export function SidebarUpdate() {
  const u = useAppUpdate();
  if (!u.available) return null;
  return (
    <button
      type="button"
      onClick={u.update}
      className="press anim-rise flex w-full items-center gap-3 rounded-2xl bg-[var(--hero-accent)] px-4 py-2.5 text-left text-[var(--side-from)] shadow-md hover:brightness-105"
      aria-label="Päivitä sovellus uuteen versioon"
    >
      <IconSparkle size="1.25rem" />
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-semibold">Päivitä</span>
        <span className="block truncate text-[11px] font-medium opacity-80">Uusi versio saatavilla</span>
      </span>
    </button>
  );
}

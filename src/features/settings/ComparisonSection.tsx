// Suositusvertailun asetukset (synkronoituva settings-rivi): ensisijainen luku ja rasittavan päivän raja
// (iän mukaan taulukosta tai kiinteä). Raja on oma tavoite, ei virallinen suositus.

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { APP_INTERPRETATIONS, VIGOROUS_DAY_BY_AGE_DEFAULT } from '../../domain/recommendations';
import type { Settings } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Button, Card, inputClass } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { useToast } from '../../ui/Toast';

const AGES = Object.keys(VIGOROUS_DAY_BY_AGE_DEFAULT);

export function ComparisonSection() {
  const toast = useToast();
  const settings = useLiveQuery(() => repo.getSettings(), []);
  const [vig, setVig] = useState('');
  const [table, setTable] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!settings) return;
    setVig(String(settings.vigorousDayMin));
    setTable(Object.fromEntries(AGES.map((a) => [a, String(settings.vigorousDayByAge[a] ?? VIGOROUS_DAY_BY_AGE_DEFAULT[a])])));
  }, [settings]);

  if (!settings) return null;

  const saveVig = () => {
    const n = Number(vig);
    if (Number.isInteger(n) && n >= 1 && n <= 120) void repo.updateSettings({ vigorousDayMin: n });
    else setVig(String(settings.vigorousDayMin));
  };

  const saveTable = async () => {
    const next: Record<string, number> = {};
    for (const a of AGES) {
      const n = Number(table[a]);
      if (!Number.isInteger(n) || n < 1 || n > 120) return toast(`Tarkista ${a} v. minuutit (1–120)`);
      next[a] = n;
    }
    await repo.updateSettings({ vigorousDayByAge: next });
    toast('Rasittavan päivän rajat tallennettu');
  };

  const tableChanged = AGES.some((a) => String(settings.vigorousDayByAge[a]) !== table[a]);

  return (
    <Card title="Suositusvertailu">
      <div className="space-y-4">
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Ensisijainen luku</div>
          <Segmented<Settings['primaryView']>
            label="Ensisijainen luku"
            value={settings.primaryView}
            onChange={(v) => void repo.updateSettings({ primaryView: v })}
            options={[
              { value: 'logged_plus_estimate', label: 'Kirjattu + perusarvio' },
              { value: 'logged', label: 'Vain kirjattu' },
            ]}
          />
          <p className="mt-1 text-xs text-slate-500">Molemmat luvut näytetään aina; valinta ratkaisee, kumpi on pääluku.</p>
        </div>

        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Rasittava päivä</div>
          <Segmented<Settings['vigorousDayRule']>
            label="Rasittavan päivän raja"
            value={settings.vigorousDayRule}
            onChange={(v) => void repo.updateSettings({ vigorousDayRule: v })}
            options={[
              { value: 'age', label: 'Iän mukaan' },
              { value: 'fixed', label: 'Kiinteä raja' },
            ]}
          />
          <p className="mt-1 text-xs text-slate-500">
            Kouluikäisten suositus: rasittavaa liikuntaa vähintään kolmena päivänä viikossa, mutta suositus ei anna päivälle minuuttirajaa. Raja on <strong>oma tavoite</strong>, ei virallinen suositus.
          </p>
        </div>

        {settings.vigorousDayRule === 'age' ? (
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Rasittavaa vähintään (min/pv) iän mukaan</div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {AGES.map((a) => (
                <label key={a} className="block">
                  <span className="mb-0.5 block text-xs text-slate-600">{a} v.</span>
                  <input
                    className={`${inputClass} min-h-10 px-2 text-center`}
                    inputMode="numeric"
                    value={table[a] ?? ''}
                    onChange={(e) => setTable((t) => ({ ...t, [a]: e.target.value }))}
                    aria-label={`${a}-vuotiaan raja minuutteina`}
                  />
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Alle 7-vuotiailla käytetään 7 v. rajaa ja yli 17-vuotiailla 17 v. rajaa. Ikä lasketaan jakson viimeisenä päivänä.</p>
            <div className="mt-2 flex gap-2">
              <Button disabled={!tableChanged} onClick={saveTable}>
                Tallenna rajat
              </Button>
              <Button
                variant="ghost"
                onClick={() => void repo.updateSettings({ vigorousDayByAge: { ...VIGOROUS_DAY_BY_AGE_DEFAULT } })}
              >
                Palauta taulukko
              </Button>
            </div>
          </div>
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Rasittavaa vähintään (min/pv)</span>
            <input
              className={`${inputClass} max-w-28`}
              inputMode="numeric"
              value={vig}
              onChange={(e) => setVig(e.target.value)}
              onBlur={saveVig}
              onKeyDown={(e) => e.key === 'Enter' && saveVig()}
            />
            <span className="mt-1 block text-xs text-slate-500">Sovelluksen lähtöoletus {APP_INTERPRETATIONS.VIGOROUS_DAY_MIN} min.</span>
          </label>
        )}
      </div>
    </Card>
  );
}

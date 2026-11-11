// Suositusvertailun asetukset (synkronoituva settings-rivi): rasittavan päivän raja ja ensisijainen luku.

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { APP_INTERPRETATIONS } from '../../domain/recommendations';
import type { Settings } from '../../domain/types';
import { repo } from '../../db/repositories';
import { Card, inputClass } from '../../ui/components';
import { Segmented } from '../../ui/controls';

export function ComparisonSection() {
  const settings = useLiveQuery(() => repo.getSettings(), []);
  const [vig, setVig] = useState('');
  useEffect(() => {
    if (settings) setVig(String(settings.vigorousDayMin));
  }, [settings]);

  if (!settings) return null;

  const saveVig = () => {
    const n = Number(vig);
    if (Number.isInteger(n) && n >= 1 && n <= 120) void repo.updateSettings({ vigorousDayMin: n });
    else setVig(String(settings.vigorousDayMin));
  };

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
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Rasittavan päivän raja (min)</span>
          <input
            className={`${inputClass} max-w-28`}
            inputMode="numeric"
            value={vig}
            onChange={(e) => setVig(e.target.value)}
            onBlur={saveVig}
            onKeyDown={(e) => e.key === 'Enter' && saveVig()}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Suositus sanoo rasittavaa liikuntaa "vähintään kolmena päivänä viikossa" mutta ei anna päivälle minuuttirajaa. Raja on sovelluksen oma tulkinta (oletus {APP_INTERPRETATIONS.VIGOROUS_DAY_MIN} min).
          </span>
        </label>
      </div>
    </Card>
  );
}

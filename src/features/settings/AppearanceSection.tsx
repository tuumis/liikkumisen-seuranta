import { Card } from '../../ui/components';
import { Segmented } from '../../ui/controls';
import { useThemeChoice, type ThemeChoice } from '../../ui/theme';

export function AppearanceSection() {
  const [choice, setChoice] = useThemeChoice();
  return (
    <Card title="Ulkoasu">
      <Segmented<ThemeChoice>
        label="Teema"
        value={choice}
        onChange={setChoice}
        options={[
          { value: 'system', label: 'Järjestelmä' },
          { value: 'light', label: '☀️ Vaalea' },
          { value: 'dark', label: '🌙 Tumma' },
        ]}
      />
      <p className="mt-2 text-xs text-slate-500">"Järjestelmä" seuraa laitteen asetusta. Valinta koskee vain tätä laitetta.</p>
    </Card>
  );
}

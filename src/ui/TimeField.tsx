// 24 tunnin kellonaika. Selaimen oma <input type="time"> näyttää laitteen kieliasetuksen mukaan
// AM/PM-muodon, joten kellonaika valitaan kahdesta valikosta (tunnit 00–23, minuutit 5 min välein).
// Arvo on aina "HH:mm" tai tyhjä (ei kellonaikaa).

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

export function TimeField({
  value,
  onChange,
  label,
  optional = true,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  /** Saavutettava nimi (näkyvä otsikko tulee Field-komponentista). */
  label: string;
  /** Sallitaanko tyhjä arvo ("ei kellonaikaa"). */
  optional?: boolean;
  className?: string;
}) {
  const [h, m] = /^\d{2}:\d{2}$/.test(value) ? value.split(':') : ['', ''];
  // Olemassa oleva minuutti, joka ei ole 5 min välein (esim. 17:32), säilyy valittavana.
  const minutes = m && !MINUTES.includes(m) ? [...MINUTES, m].sort() : MINUTES;
  const select =
    'min-h-11 appearance-none bg-transparent text-center text-base tabular-nums text-[var(--ink)] focus:outline-none cursor-pointer';

  return (
    <div
      className={`field-shell flex min-h-11 items-center justify-center gap-0.5 px-2 ${className}`}
      role="group"
      aria-label={label}
    >
      <select
        className={`${select} w-10`}
        value={h}
        aria-label={`${label}: tunnit`}
        onChange={(e) => {
          const nh = e.target.value;
          if (!nh) return onChange('');
          onChange(`${nh}:${m || '00'}`);
        }}
      >
        {(optional || !h) && <option value="">--</option>}
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <span className="text-[var(--ink-muted)]" aria-hidden>
        :
      </span>
      <select
        className={`${select} w-10`}
        value={m}
        aria-label={`${label}: minuutit`}
        disabled={!h}
        onChange={(e) => onChange(`${h || '00'}:${e.target.value}`)}
      >
        {!h && <option value="">--</option>}
        {minutes.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      {optional && h && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="ml-1 flex size-7 items-center justify-center rounded-full text-sm text-[var(--ink-muted)] hover:bg-[var(--surface-sunk)]"
          aria-label={`Tyhjennä ${label.toLowerCase()}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

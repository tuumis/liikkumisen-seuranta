// Profiili- tai joukkuekuva: kuva, jos sellainen on lisätty, muuten värillinen pallo nimikirjaimella.

import { useRef, useState } from 'react';
import { isPhotoDataUrl, resizePhoto } from './image';

const SIZES = {
  xs: 'size-5 text-[10px]',
  sm: 'size-7 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-16 text-xl',
} as const;

export function Avatar({
  name,
  photo,
  color,
  size = 'sm',
  fallback,
  className = '',
}: {
  name: string;
  photo?: string;
  color?: string;
  size?: keyof typeof SIZES;
  /** Näytetään nimikirjaimen sijaan, kun kuvaa ei ole (esim. 👕). */
  fallback?: string;
  className?: string;
}) {
  const base = `${SIZES[size]} shrink-0 rounded-full ${className}`;
  if (isPhotoDataUrl(photo)) return <img src={photo} alt="" className={`${base} object-cover`} aria-hidden />;
  return (
    <span
      className={`${base} inline-flex items-center justify-center font-semibold ${color ? 'text-white' : 'bg-slate-100 text-slate-600'}`}
      style={color ? { backgroundColor: color } : undefined}
      aria-hidden
    >
      {fallback ?? (name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

/** Kuvan valinta: avaa kameran tai kuvakirjaston, pienentää kuvan ja palauttaa data-URL:n. */
export function PhotoPicker({
  name,
  value,
  color,
  fallback,
  onChange,
  label = 'Kuva',
}: {
  name: string;
  value?: string;
  color?: string;
  fallback?: string;
  onChange: (photo: string | undefined) => void;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      onChange(await resizePhoto(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label} (valinnainen)</span>
      <div className="flex items-center gap-3">
        <Avatar name={name || '?'} photo={value} color={color} fallback={fallback} size="lg" />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="min-h-11 rounded-xl bg-white px-3 text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? 'Käsitellään…' : value ? 'Vaihda kuva' : 'Lisää kuva'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(undefined)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-red-700 hover:bg-red-50">
              Poista kuva
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} aria-label={`${label}: valitse tiedosto`} />
      </div>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      <p className="mt-1 text-xs text-slate-500">Kuva pienennetään ja tallennetaan vain tälle laitteelle sekä omiin varmuuskopioihin.</p>
    </div>
  );
}

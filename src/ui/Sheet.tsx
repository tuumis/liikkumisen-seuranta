import { useEffect, useRef, type ReactNode } from 'react';

/** Alapaneeli (bottom sheet). Sulkeutuu taustan napautuksella ja Esc-näppäimellä. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    panel.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center lg:items-center lg:p-6" role="presentation">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-xl focus:outline-none lg:max-w-lg lg:rounded-3xl lg:px-6 lg:pb-6 lg:pt-5"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 lg:hidden" aria-hidden />
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-full text-xl text-slate-500 active:bg-slate-100" aria-label="Sulje">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

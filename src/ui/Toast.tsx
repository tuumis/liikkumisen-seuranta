import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}
type ToastKind = 'info' | 'success' | 'error';
interface ToastState {
  id: number;
  text: string;
  action?: ToastAction;
  kind: ToastKind;
}

/** kind 'success' näyttää piirtyvän valintamerkin (onnistunut tallennus). */
type Show = (text: string, action?: ToastAction, kind?: ToastKind) => void;

const ToastContext = createContext<Show>(() => {});

/** Ilmoitus alareunassa, valinnainen toiminto (esim. "Kumoa"); näkyy 5 s (SPEC 10, 12). */
export const TOAST_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0);

  const show = useCallback<Show>((text, action, kind = 'info') => {
    clearTimeout(timer.current);
    const id = ++seq.current;
    setToast({ id, text, action, kind });
    timer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), TOAST_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.75rem)] z-[60] flex justify-center px-4 lg:bottom-8 lg:left-72" aria-live="polite">
        {toast && (
          <div
            key={toast.id}
            className="anim-pop pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-[var(--toast-bg)] px-4 py-2.5 text-sm font-medium text-[#f6f5f0] shadow-xl ring-1 ring-white/10"
          >
            {toast.kind !== 'info' && (
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full ${toast.kind === 'success' ? 'bg-[var(--hero-pill-bg)] text-[var(--accent)]' : 'bg-red-200 text-red-900'}`}
                aria-hidden
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  {toast.kind === 'success' ? (
                    <path d="m5 12.5 4.2 4.2L19 7" className="anim-draw" style={{ strokeDasharray: 22, ['--len' as string]: 22 }} />
                  ) : (
                    <path d="M12 7v6M12 17v.01" />
                  )}
                </svg>
              </span>
            )}
            <span className="flex-1 py-1">{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="press min-h-10 rounded-lg px-3 font-semibold text-[var(--hero-accent)] hover:bg-white/10"
                onClick={async () => {
                  const a = toast.action!;
                  clearTimeout(timer.current);
                  setToast(null);
                  await a.run();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

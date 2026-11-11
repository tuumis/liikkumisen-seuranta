import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}
interface ToastState {
  id: number;
  text: string;
  action?: ToastAction;
}

type Show = (text: string, action?: ToastAction) => void;

const ToastContext = createContext<Show>(() => {});

/** Ilmoitus alareunassa, valinnainen toiminto (esim. "Kumoa"); näkyy 5 s (SPEC 10, 12). */
export const TOAST_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0);

  const show = useCallback<Show>((text, action) => {
    clearTimeout(timer.current);
    const id = ++seq.current;
    setToast({ id, text, action });
    timer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), TOAST_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6 lg:left-64" aria-live="polite">
        {toast && (
          <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
            <span className="flex-1">{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="min-h-11 rounded-lg px-3 font-semibold text-green-300 active:bg-white/10"
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

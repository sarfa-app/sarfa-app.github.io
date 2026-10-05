import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** мс, по умолчанию 5000 */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const Ctx = createContext<(t: ToastOptions) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const seq = useRef(0);

  const show = useCallback((t: ToastOptions) => {
    clearTimeout(timer.current);
    seq.current += 1;
    const item = { ...t, id: seq.current };
    setToast(item);
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === item.id ? null : cur)), t.duration ?? 5000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {/* Контейнер всегда в DOM, чтобы диктор объявлял новые сообщения. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
        style={{ bottom: 'calc(var(--nav-h) + var(--safe-bottom) + 12px)' }}
      >
        {toast && (
          <div key={toast.id} className="anim-toast pointer-events-auto flex w-full max-w-[520px] items-center gap-3 rounded-xl bg-ink py-1 pl-4 pr-1 text-white shadow-lg">
            <span className="flex-1 py-2 text-[15px] leading-snug">{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                className="tap rounded-lg px-3 text-[15px] font-semibold text-[#9FE0C4] active:bg-white/10"
                onClick={() => {
                  clearTimeout(timer.current);
                  setToast(null);
                  toast.onAction?.();
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

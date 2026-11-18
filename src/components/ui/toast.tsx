"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

type Toast = { id: number; message: string; actionLabel?: string; onAction?: () => void };
type ToastInput = Omit<Toast, "id">;

const ToastContext = createContext<(t: ToastInput | string) => void>(() => {});

/** Muestra un aviso breve (se cierra solo). Con `actionLabel` y `onAction` ofrece, p. ej., "Deshacer". */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (input: ToastInput | string) => {
      const id = next.current++;
      const t: Toast = typeof input === "string" ? { id, message: input } : { id, ...input };
      setToasts((list) => [...list.slice(-2), t]);
    },
    [],
  );
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Se cierra solo, pero el temporizador se pausa mientras el cursor o el foco están encima (WCAG 2.2.1). */
function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  // Con acción se deja más tiempo para poder pulsarla.
  const remaining = useRef(t.onAction ? 7000 : 3500);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(t.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(1500, remaining.current - (Date.now() - started));
    };
  }, [paused, t.id, onDismiss]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-border bg-foreground px-4 py-3 text-sm text-background shadow-lg"
    >
      <span className="min-w-0 flex-1">{t.message}</span>
      {t.onAction ? (
        <button
          type="button"
          className="shrink-0 rounded-md px-3 py-2 font-medium underline underline-offset-2"
          onClick={() => {
            t.onAction?.();
            onDismiss(t.id);
          }}
        >
          {t.actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Cerrar aviso"
        className="flex size-9 shrink-0 items-center justify-center rounded-md opacity-80 hover:opacity-100"
        onClick={() => onDismiss(t.id)}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

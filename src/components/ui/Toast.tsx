"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckIcon, XIcon } from "@/components/icons";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; message: string; kind: ToastKind };

type ToastCtx = {
  toast: (message: string, kind?: ToastKind) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = ++seq.current;
      setToasts((t) => [...t, { id, message, kind }]);
      setTimeout(() => remove(id), 3200);
    },
    [remove],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-center gap-2.5 rounded-pill border border-border bg-surface-2 px-4 py-2.5 text-[13px] text-fg-soft shadow-[0_8px_30px_rgba(0,0,0,0.5)] [animation:toast-in_.22s_ease-out]"
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  t.kind === "error" ? "#3a3a3a" : "var(--color-primary)",
                color: t.kind === "error" ? "#e8e8e8" : "#141414",
              }}
            >
              {t.kind === "error" ? <XIcon size={11} /> : <CheckIcon size={11} />}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

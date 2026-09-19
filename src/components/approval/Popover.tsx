"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";

/**
 * Menu flutuante ancorado ao botão que o abriu — o mesmo padrão do
 * `FilterMenu`/`DisplayMenu` das Tarefas, trazido para as telas de aprovação.
 *
 * O véu `fixed inset-0` fecha ao clicar fora, e o Escape fecha pelo teclado
 * (o menu esconde conteúdo real: sem isso, quem navega sem mouse ficaria preso).
 */
export function Popover({
  open,
  onClose,
  trigger,
  children,
  align = "right",
}: {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className="relative shrink-0">
      {trigger}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div
            className={cn(
              "absolute top-[calc(100%+8px)] z-50",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { cn } from "@/lib/cn";

/**
 * Ancora um menu flutuante ao botão que o abriu, com uma capa transparente
 * por trás para o clique fora fechar. `align` decide a borda de encosto: um
 * painel largo ancorado à direita de um botão que está à esquerda da tela
 * vazaria para fora do `overflow-hidden` do shell, e vice-versa.
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
  return (
    <div className="relative">
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

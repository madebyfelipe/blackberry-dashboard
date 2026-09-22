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
  side = "bottom",
}: {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  /** `center` é para gatilho no meio da tela (os controles da chamada). */
  align?: "left" | "right" | "center";
  /** `top` quando o gatilho mora no pé de um painel e não há chão embaixo. */
  side?: "top" | "bottom";
}) {
  return (
    <div className="relative">
      {trigger}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div
            className={cn(
              "absolute z-50",
              side === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]",
              align === "right"
                ? "right-0"
                : align === "left"
                  ? "left-0"
                  : "left-1/2 -translate-x-1/2",
            )}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { XIcon } from "@/components/icons";

/*
 * A barra que flutua sobre a lista quando há linhas marcadas (export
 * "Clientes · Painel (Lista)"): um botão de fechar de 44px e, ao lado, a
 * pílula com a contagem, uma régua e os botões de ação de 34px.
 *
 * Ela existe porque a lista tem caixa de seleção — sem ela, marcar uma linha
 * não leva a lugar nenhum. As ações ficam a cargo de quem usa a barra.
 */

export type SelectionAction = {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
};

export function SelectionBar({
  count,
  noun,
  actions,
  onClear,
}: {
  count: number;
  /** ["cliente", "clientes"] — o texto da pílula. */
  noun: [string, string];
  actions: SelectionAction[];
  onClear: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClear();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClear]);

  if (count === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Ações da seleção"
      className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center"
    >
      <div className="pointer-events-auto flex animate-rise-in items-center gap-2.5">
        <button
          type="button"
          aria-label="Limpar seleção"
          onClick={onClear}
          className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-nav border border-border-soft bg-overlay text-fg-3 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.5)] transition-colors hover:text-fg-soft"
        >
          <XIcon size={16} />
        </button>

        <div className="flex h-11 items-center gap-1.5 rounded-nav border border-border-soft bg-overlay px-2 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.5)]">
          <span className="flex h-full items-center whitespace-nowrap px-2.5 text-[13px] font-medium text-fg-soft">
            {count} {count === 1 ? noun[0] : noun[1]}
          </span>
          <span className="h-[22px] w-px shrink-0 bg-border-soft" aria-hidden="true" />
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              aria-label={a.label}
              title={a.label}
              onClick={a.onSelect}
              className={cn(
                "tap flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-chip transition-colors",
                a.danger
                  ? "text-danger hover:bg-border"
                  : "text-fg-3 hover:bg-border hover:text-fg-soft",
              )}
            >
              {a.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

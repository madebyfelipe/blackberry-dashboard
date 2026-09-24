"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/*
 * A folha de ações que sobe de baixo, no celular — o lugar do menu "⋯" e do
 * hover, que no toque não existem ou ficam pequenos demais para o dedo.
 *
 * Linhas de 52px (alvo de toque confortável), respeita a área segura do
 * iPhone, fecha tocando fora, no "Cancelar" ou com Esc. Mesmo vocabulário
 * dos menus do produto (superfície `surface-2`, divisória `border`, ação
 * destrutiva em `danger`) — só que no formato do celular.
 */

export type SheetAction = {
  label: string;
  icon?: React.ReactNode;
  /** Texto pequeno à direita ("até 23:03"). */
  hint?: string;
  danger?: boolean;
  onSelect: () => void;
};

export function ActionSheet({
  open,
  onClose,
  title,
  preview,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** O que a folha é sobre (a mensagem, a conversa), acima das ações. */
  preview?: React.ReactNode;
  actions: SheetAction[];
}) {
  /*
   * Quando nasce de um "segurar", o dedo ainda está na tela: soltar pode
   * chegar como clique no fundo e fechar a folha no mesmo instante. Os
   * primeiros 400ms não contam.
   */
  const openedAt = useRef(0);
  useEffect(() => {
    if (!open) return;
    openedAt.current = Date.now();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // A página atrás não rola enquanto a folha está aberta.
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="presentation">
      <div
        className="absolute inset-0 animate-fade-in bg-black/60"
        onClick={() => Date.now() - openedAt.current > 400 && onClose()}
      />
      <div
        role="menu"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] animate-sheet-up flex-col gap-2 px-2 pb-[max(8px,env(safe-area-inset-bottom))]"
      >
        <div className="flex min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface-2">
          <div className="flex justify-center pt-2" aria-hidden="true">
            <span className="h-1 w-9 rounded-pill bg-border-strong" />
          </div>
          {(title || preview) && (
            <div className="flex flex-col gap-1 border-b border-border px-4 pb-3 pt-2">
              {title && <p className="text-[12px] font-semibold text-muted">{title}</p>}
              {preview}
            </div>
          )}
          <div className="overflow-y-auto py-1">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  onClose();
                  a.onSelect();
                }}
                className={cn(
                  "flex min-h-[52px] w-full items-center gap-3.5 px-4 text-left text-[15px] transition-colors active:bg-border",
                  a.danger ? "text-danger" : "text-fg-soft",
                )}
              >
                {a.icon && <span className={a.danger ? "text-danger" : "text-muted"}>{a.icon}</span>}
                <span className="flex-1">{a.label}</span>
                {a.hint && <span className="text-[12px] text-muted">{a.hint}</span>}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[52px] rounded-card border border-border bg-surface-2 text-[15px] font-semibold text-fg-soft transition-colors active:bg-border"
        >
          Cancelar
        </button>
      </div>
    </div>,
    document.body,
  );
}

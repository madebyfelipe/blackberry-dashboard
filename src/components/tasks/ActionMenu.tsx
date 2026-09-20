"use client";

import { useState } from "react";
import { EllipsisIcon } from "@/components/icons";
import { useMenuKeys } from "@/components/ui/useMenuKeys";
import { cn } from "@/lib/cn";

export type MenuItem = {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  /** Linha separadora acima do item — agrupa ações de naturezas diferentes. */
  divider?: boolean;
};

export function ActionMenu({
  items,
  align = "right",
  triggerClassName,
  menuClassName,
}: {
  items: MenuItem[];
  align?: "left" | "right";
  /** sobrescreve o fundo/cor do gatilho (ex.: o redondo sobre a superfície) */
  triggerClassName?: string;
  /** sobrescreve a largura do painel quando os rótulos são mais longos */
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const { menuRef, triggerRef, onKeyDown } = useMenuKeys(open, () =>
    setOpen(false),
  );

  return (
    <div className="relative shrink-0">
      {/*
       * O gatilho tem o alvo de toque da casa (`--spacing-control`, 40px) em
       * vez dos 28px de antes. Quem usa o menu — a linha da lista, o card do
       * quadro — envolve o botão num contêiner de altura fixa, então o alvo
       * maior sobra por cima do respiro da linha sem esticá-la.
       */}
      <button
        ref={triggerRef}
        type="button"
        aria-label="Ações"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          "flex h-control w-control items-center justify-center rounded-full text-muted transition-colors hover:bg-border hover:text-fg-soft",
          triggerClassName,
        )}
      >
        <EllipsisIcon size={18} />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            ref={menuRef}
            role="menu"
            aria-label="Ações"
            className={cn(
              "absolute z-50 mt-1 w-[176px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface-2 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]",
              align === "right" ? "right-0" : "left-0",
              menuClassName,
            )}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            {items.map((it, i) => (
              <div
                key={i}
                role="none"
                style={{ ["--d" as string]: i }}
                className="stagger-item"
              >
                {it.divider && (
                  <div className="my-1 h-px bg-border" aria-hidden="true" />
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    it.onSelect();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-mark px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-border focus:bg-border focus:outline-none",
                    it.danger ? "text-danger" : "text-fg-soft",
                  )}
                >
                  {it.icon}
                  <span>{it.label}</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

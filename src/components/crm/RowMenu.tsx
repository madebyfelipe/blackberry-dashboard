"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { anchorMenu, useCloseOnScroll, type MenuPosition } from "@/components/ui/anchoredMenu";
import { EllipsisIcon } from "@/components/icons";

export type RowMenuItem = { label: string; onSelect: () => void; danger?: boolean; href?: string };

/**
 * O "⋯" de uma linha ou cartão da ficha (fatura, arquivo). Abre por portal,
 * ancorado ao botão — dentro da tabela com rolagem o menu seria cortado (ver
 * `ui/anchoredMenu`).
 */
export function RowMenu({
  label,
  items,
  className,
}: {
  label: string;
  items: RowMenuItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPosition | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useCloseOnScroll(open, close);

  useLayoutEffect(() => {
    if (!open || !trigger.current || !menu.current) return;
    const t = trigger.current.getBoundingClientRect();
    setPos(anchorMenu(t, { width: menu.current.offsetWidth, height: menu.current.offsetHeight }, "right"));
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setPos(null);
          setOpen((o) => !o);
        }}
        className={cn(
          "tap flex h-7 w-7 items-center justify-center rounded-mark text-muted transition-colors hover:bg-border hover:text-fg-soft",
          className,
        )}
      >
        <EllipsisIcon size={15} />
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={close} />
            <div
              ref={menu}
              role="menu"
              onKeyDown={(e) => e.key === "Escape" && close()}
              style={pos ? { top: pos.top, left: pos.left, maxHeight: pos.maxHeight } : { visibility: "hidden", top: 0, left: 0 }}
              className="fixed z-50 w-[200px] animate-pop-in overflow-y-auto rounded-menu border border-border bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
            >
              {items.map((it) =>
                it.href ? (
                  <a
                    key={it.label}
                    role="menuitem"
                    href={it.href}
                    download
                    onClick={close}
                    className="flex w-full items-center rounded-mark px-2.5 py-[7px] text-left text-[12.5px] text-fg-soft hover:bg-row-raised"
                  >
                    {it.label}
                  </a>
                ) : (
                  <button
                    key={it.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close();
                      it.onSelect();
                    }}
                    className={cn(
                      "flex w-full items-center rounded-mark px-2.5 py-[7px] text-left text-[12.5px] hover:bg-row-raised",
                      it.danger ? "text-danger" : "text-fg-soft",
                    )}
                  >
                    {it.label}
                  </button>
                ),
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

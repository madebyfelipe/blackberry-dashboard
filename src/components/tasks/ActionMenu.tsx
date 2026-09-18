"use client";

import { useState } from "react";
import { EllipsisIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type MenuItem = {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
};

export function ActionMenu({
  items,
  align = "right",
}: {
  items: MenuItem[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Ações"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-border hover:text-fg-soft"
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
            className={cn(
              "absolute z-50 mt-1 w-[176px] animate-pop-in overflow-hidden rounded-[16px] border border-border bg-surface-2 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]",
              align === "right" ? "right-0" : "left-0",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-[13px] hover:bg-border",
                  it.danger ? "text-[#e88]" : "text-fg-soft",
                )}
              >
                {it.icon}
                <span>{it.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

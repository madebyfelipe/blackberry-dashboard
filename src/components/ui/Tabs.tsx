"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { EllipsisIcon } from "@/components/icons";

/*
 * A tira de abas do design system v3: pílulas de 10px/24px, ativa em
 * `border-strong` com texto branco e a sombra de 1px do export, inativa só
 * com o texto em `muted`.
 *
 * O que não cabe na tira vai para o "..." do desenho — um menu com o resto.
 */

export type TabOption = {
  id: string;
  label: string;
  /** Contador opcional; sem valor, a pílula mostra só o rótulo. */
  count?: number;
};

export function TabStrip({
  tabs,
  overflow = [],
  active,
  onSelect,
  overflowLabel = "Mais",
}: {
  tabs: TabOption[];
  /** Abas que só aparecem dentro do "..." (ou na tira, quando são a ativa). */
  overflow?: TabOption[];
  active: string;
  onSelect: (id: string) => void;
  overflowLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // A aba ativa nunca some de vista: se está entre as escondidas, ela volta
  // para a tira até a pessoa escolher outra.
  const activeHidden = overflow.find((t) => t.id === active);

  return (
    <div className="flex min-w-0 items-center gap-2">
      {/*
       * Só a tira rola. Um menu dentro de um `overflow-x-auto` herda o corte
       * no eixo Y (um eixo "visible" ao lado de outro que não é vira "auto")
       * e o painel que abre para baixo some — por isso o "..." é irmão da
       * área rolável, não filho dela.
       */}
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <Tab
            key={t.id}
            {...t}
            active={active === t.id}
            onClick={() => onSelect(t.id)}
          />
        ))}
        {activeHidden && (
          <Tab {...activeHidden} active onClick={() => onSelect(activeHidden.id)} />
        )}
      </div>

      {overflow.length > 0 && (
        <div className="relative shrink-0" ref={ref}>
          <button
            type="button"
            aria-label={overflowLabel}
            title={overflowLabel}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "tap flex h-10 w-10 shrink-0 items-center justify-center rounded-pill transition-colors",
              open || activeHidden
                ? "bg-border-strong text-fg"
                : "text-muted hover:bg-surface-2 hover:text-fg-soft",
            )}
          >
            <EllipsisIcon size={16} />
          </button>

          {open && (
            <div
              role="menu"
              className="absolute left-0 top-[calc(100%+8px)] z-50 w-[200px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface-2 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
            >
              {overflow.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active === t.id}
                  onClick={() => {
                    onSelect(t.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-mark px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-border",
                    active === t.id ? "text-fg-soft" : "text-muted",
                  )}
                >
                  <span className="truncate">{t.label}</span>
                  {t.count !== undefined && (
                    <span className="shrink-0 text-[11px] text-muted">
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Tab({
  label,
  count,
  active,
  onClick,
}: TabOption & { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "tap flex shrink-0 items-center gap-2 rounded-pill px-6 py-2.5 text-[14px] leading-5 transition-colors",
        active
          ? "bg-border-strong text-fg shadow-[0_1px_3.5px_-1px_rgba(0,0,0,0.06)]"
          : "text-muted hover:bg-surface-2 hover:text-fg-soft",
      )}
    >
      {label}
      {count !== undefined && (
        <span
          // `key` no contador: ele remonta a cada mudança e entra com a
          // animação curta — é como a aba avisa que ganhou ou perdeu item.
          key={count}
          className={cn(
            "animate-rise-in-sm text-[12px]",
            active ? "text-fg-soft" : "text-muted",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

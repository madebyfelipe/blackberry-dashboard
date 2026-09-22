"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ChevronDownIcon } from "@/components/icons";

/*
 * As peças do menu de visualização — o painel de 300px dos exports
 * "Menu de Filtros" (Tarefas) e "Menu de Visualização" (Clientes).
 *
 * Os dois menus são o mesmo desenho com conteúdo diferente: título de seção,
 * linha rótulo/controle, dropdown de pílula, chave liga-desliga, seletor
 * Lista/Grade e chips de coluna. Estava tudo duplicado dentro de
 * `tasks/DisplayMenu`; agora mora aqui e os dois leem daqui — o que garante
 * que um ajuste de forma não conserte um menu e esqueça o outro.
 */

export function MenuPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[300px] animate-pop-in overflow-hidden rounded-panel border border-border bg-surface pb-3 pt-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
      {children}
    </div>
  );
}

/** Título de seção: "Filtros", "Organização", "Opções da lista", "Colunas". */
export function MenuTitle({
  children,
  first,
}: {
  children: React.ReactNode;
  /** A primeira seção do painel não precisa do respiro de cima. */
  first?: boolean;
}) {
  return (
    <div className={cn("px-3 pb-0.5", first ? "pt-0.5" : "pt-2.5")}>
      <p className="text-[13px] font-semibold text-fg-soft">{children}</p>
    </div>
  );
}

export function MenuRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-[7px]">
      <span className="text-[13px] text-fg-3">{label}</span>
      <span className="flex shrink-0 items-center gap-2.5">{children}</span>
    </div>
  );
}

export function MenuDivider() {
  return (
    <div className="py-1.5">
      <div className="h-px bg-border" />
    </div>
  );
}

export function MenuDropdown({
  value,
  options,
  onSelect,
  label,
}: {
  value: string;
  options: { id: string | number; label: string }[];
  onSelect: (id: string) => void;
  /** Para leitor de tela: "Agrupamento", "Ordenação"… */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => String(o.id) === value);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-mark bg-border px-2.5 py-[5px] text-[13px] text-fg-soft transition-colors hover:bg-border-strong"
      >
        {current?.label ?? value}
        <ChevronDownIcon size={12} className="text-muted" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label={label}
            className="absolute right-0 z-50 mt-1 w-[180px] animate-pop-in overflow-hidden rounded-menu border border-border bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          >
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={String(o.id) === value}
                onClick={() => {
                  onSelect(String(o.id));
                  setOpen(false);
                }}
                className={cn(
                  "block w-full rounded-mark px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-2",
                  String(o.id) === value ? "text-fg-soft" : "text-fg-3",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function MenuToggle({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-4 w-7 items-center rounded-pill p-0.5 transition-colors",
        on
          ? "justify-end bg-primary"
          : "justify-start border border-border-strong bg-border",
      )}
    >
      <span
        className={cn(
          "h-3 w-3 rounded-full transition-colors",
          on ? "bg-surface" : "bg-muted",
        )}
      />
    </button>
  );
}

/** O seletor Lista/Grade (ou Lista/Quadro): pílula com dois botões. */
export function MenuSegmented({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-2.5 pt-0.5">
      <div className="flex gap-1 rounded-pill bg-surface-2 p-1">{children}</div>
    </div>
  );
}

export function MenuSegButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-pill px-2 py-1.5 text-[13px] transition-colors",
        active ? "bg-border font-medium text-fg-soft" : "text-muted hover:text-fg-soft",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/** Chip de coluna visível: aceso é sólido, apagado é só contorno. */
export function MenuChip({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-pill px-3 py-1.5 text-[12px] transition-colors",
        on
          ? "bg-border font-medium text-fg-soft"
          : "border border-border text-muted hover:text-fg-soft",
      )}
    >
      {label}
    </button>
  );
}

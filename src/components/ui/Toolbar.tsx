"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { SearchIcon, XIcon } from "@/components/icons";

/*
 * A barra de ferramentas do corpo, comum às quatro telas de lista do design
 * v3: 48px de altura, régua embaixo, "Filtros" e a busca à esquerda,
 * "Personalizar" à direita.
 *
 * Ela não guarda estado de filtro nem de visualização — só oferece os dois
 * gatilhos e o campo de busca. Quem decide o que cada um abre é a view.
 */

export function Toolbar({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex h-12 w-full shrink-0 items-center justify-between gap-3 border-b border-rule px-4 sm:gap-4">
      <div className="flex h-full min-w-0 flex-1 items-center gap-2.5 sm:flex-initial sm:gap-3.5">
        {children}
      </div>
      {right && <div className="flex shrink-0 items-center gap-3.5">{right}</div>}
    </div>
  );
}

export function ToolbarDivider() {
  return <span className="h-[18px] w-px shrink-0 bg-divider" aria-hidden="true" />;
}

/** "Filtros" / "Personalizar": ícone + rótulo de 13px medium, sem caixa. */
export function ToolbarButton({
  icon,
  label,
  active,
  badge,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
}) {
  return (
    <button
      type="button"
      // O rótulo some abaixo de `sm` para os três controles caberem na barra
      // de 390px; o `aria-label` fica sempre, então o botão nunca vira um
      // ícone mudo para quem usa leitor de tela.
      aria-label={label}
      title={label}
      className={cn(
        "tap relative flex shrink-0 items-center gap-[7px] text-[13px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-strong",
        active ? "text-fg-soft" : "text-fg-3 hover:text-fg-soft",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="hidden whitespace-nowrap sm:inline">{label}</span>
      {!!badge && (
        <span className="flex h-4 min-w-4 animate-scale-in items-center justify-center rounded-pill bg-primary px-1 text-[10px] font-semibold text-on-primary">
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * A busca do desenho é texto solto ao lado de uma lupa — nada de caixa. Aqui
 * ela é um `input` transparente com essa mesma aparência: o placeholder faz o
 * papel do texto do export e o campo cresce um pouco quando recebe foco.
 */
export function ToolbarSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex min-w-0 shrink items-center gap-2">
      <button
        type="button"
        aria-label={placeholder}
        onClick={() => ref.current?.focus()}
        className="tap shrink-0 text-fg-3 transition-colors hover:text-fg-soft"
      >
        <SearchIcon size={15} />
      </button>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onChange("");
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        className={cn(
          "min-w-0 bg-transparent text-[13px] text-fg-soft transition-[width] duration-200",
          "placeholder:text-placeholder focus:outline-none",
          // No celular o campo ocupa o que sobrar; no desktop ele tem a
          // largura do desenho e cresce um pouco ao receber foco.
          "w-full sm:w-auto",
          focused || value ? "sm:w-[200px]" : "sm:w-[112px]",
        )}
      />
      {value && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => onChange("")}
          className="tap shrink-0 text-muted transition-colors hover:text-fg-soft"
        >
          <XIcon size={13} />
        </button>
      )}
    </div>
  );
}

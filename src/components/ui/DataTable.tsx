"use client";

import { cn } from "@/lib/cn";
import { CheckIcon } from "@/components/icons";

/*
 * A lista do design system v3 — a mesma nas Tarefas e nos Clientes.
 *
 * Medidas do export, e elas são o contrato: cabeçalho de 40px, linha de 44px,
 * 16px de respiro lateral, 16px entre células. A régua do cabeçalho é `rule`
 * (#232323) e a de entre linhas é `rule-soft` (#191919) — duas réguas
 * diferentes de propósito, para o cabeçalho separar mais do que as linhas.
 *
 * Não é `<table>`: as células têm larguras fixas e a primeira cresce, o que
 * em flex é uma linha de código e em tabela é briga com `table-layout`.
 */

/**
 * O quadro da tabela.
 *
 * As colunas têm largura fixa e o desenho é de 1440px, então no celular elas
 * não cabem. Em vez de empilhar a linha (o que desmonta a leitura por coluna
 * que é o ponto da tela), a tabela inteira ganha rolagem horizontal a partir
 * de `minWidth`: as medidas do export ficam intactas e o dedo arrasta. O
 * cabeçalho rola junto com as linhas, que é o que mantém rótulo e valor
 * alinhados.
 */
export function TableFrame({
  minWidth,
  children,
}: {
  /** Largura mínima da linha, somando as colunas do desenho. */
  minWidth: number;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-card">
      <div className="flex h-full min-h-0 w-full flex-col overflow-x-auto">
        <div
          style={{ minWidth }}
          className="flex h-full min-h-0 w-full flex-col"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-full shrink-0 items-center gap-4 border-b border-rule px-4">
      {children}
    </div>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>;
}

export function TableRow({
  selected,
  index = 0,
  onClick,
  children,
}: {
  selected?: boolean;
  index?: number;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{ ["--d" as string]: index }}
      className={cn(
        "stagger-item group flex h-11 w-full shrink-0 items-center gap-4 border-b border-rule-soft px-4 transition-colors",
        onClick && "cursor-pointer",
        selected ? "bg-row-raised" : "hover:bg-row-raised",
      )}
    >
      {children}
    </div>
  );
}

/**
 * Caixa de seleção de 18px do export: vazia com contorno `badge` (#3a3a3a),
 * marcada em `primary` com o "✓" escuro.
 */
export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  const on = checked || !!indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "tap flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-check border transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-3",
        on
          ? "border-primary bg-primary text-on-primary"
          : "border-badge text-transparent hover:border-border-strong",
      )}
    >
      {indeterminate ? (
        <span className="h-[2px] w-2.5 rounded-pill bg-on-primary" />
      ) : (
        checked && <CheckIcon size={12} strokeWidth={3} />
      )}
    </button>
  );
}

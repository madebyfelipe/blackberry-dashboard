"use client";

import { createContext, useContext, useRef } from "react";
import { cn } from "@/lib/cn";
import { CheckIcon } from "@/components/icons";
import {
  COLUMN_MAX,
  COLUMN_MIN,
  columnWidth,
  type ColumnSpec,
} from "@/lib/ui/columns";
import type { ColumnWidthsApi } from "./useColumnWidths";

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

/* ------------------------------------------------------- colunas e larguras */

/*
 * A largura das colunas é a mesma no cabeçalho e em toda linha, então ela não
 * viaja por prop célula a célula: quem monta a lista abre um `ColumnsProvider`
 * com o que o `useColumnWidths` devolve e as células leem daí.
 */
const ColumnsContext = createContext<ColumnWidthsApi | null>(null);

export function ColumnsProvider({
  value,
  children,
}: {
  value: ColumnWidthsApi;
  children: React.ReactNode;
}) {
  return (
    <ColumnsContext.Provider value={value}>{children}</ColumnsContext.Provider>
  );
}

function useColumns(): ColumnWidthsApi {
  const ctx = useContext(ColumnsContext);
  if (!ctx) {
    throw new Error("Célula de coluna fora de um <ColumnsProvider>.");
  }
  return ctx;
}

/**
 * O estilo de uma coluna. A que cresce (`flex`) só ganha largura fixa depois
 * de alguém arrastá-la — até então ela ocupa o que sobra, como no desenho.
 */
function styleFor(spec: ColumnSpec, api: ColumnWidthsApi): React.CSSProperties {
  if (spec.flex && api.widths[spec.id] === undefined) {
    return { flex: "1 1 0%", minWidth: spec.width };
  }
  return { width: columnWidth(api.widths, spec), flexShrink: 0 };
}

/** Célula do cabeçalho: o rótulo, o que vier junto, e a divisória de arrasto. */
export function HeadCell({
  spec,
  children,
}: {
  spec: ColumnSpec;
  children: React.ReactNode;
}) {
  const api = useColumns();
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      style={styleFor(spec, api)}
      className="relative flex min-w-0 items-center gap-[5px]"
    >
      {children}
      <ColumnResizer spec={spec} api={api} cell={ref} />
    </div>
  );
}

/** Célula de linha — mesma largura da coluna do cabeçalho. */
export function Cell({
  spec,
  className,
  children,
}: {
  spec: ColumnSpec;
  className?: string;
  children: React.ReactNode;
}) {
  const api = useColumns();
  return (
    <div
      style={styleFor(spec, api)}
      className={cn("flex min-w-0 items-center", className)}
    >
      {children}
    </div>
  );
}

/**
 * A divisória entre duas colunas.
 *
 * Fica sobre o vão de 16px entre as células (daí o `-right-2 w-4`), aparece
 * quando o ponteiro chega perto e acompanha o arrasto. Não é só mouse: ela
 * recebe foco e as setas movem 16px por toque, porque redimensionar coluna com
 * teclado é a única forma de fazer isso sem ponteiro. Duplo clique — ou
 * `Home` — devolve a medida do desenho.
 */
function ColumnResizer({
  spec,
  api,
  cell,
}: {
  spec: ColumnSpec;
  api: ColumnWidthsApi;
  cell: React.RefObject<HTMLDivElement | null>;
}) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  function begin(e: React.PointerEvent<HTMLDivElement>) {
    // A linha inteira abre o registro e o cabeçalho ordena: o arrasto não é
    // nem um clique nem o outro.
    e.preventDefault();
    e.stopPropagation();
    const startWidth = cell.current?.offsetWidth ?? spec.width;
    drag.current = { startX: e.clientX, startWidth };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    api.resize(spec, d.startWidth, e.clientX - d.startX);
  }

  function end(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Redimensionar coluna ${spec.label}`}
      aria-valuemin={COLUMN_MIN}
      aria-valuemax={COLUMN_MAX}
      aria-valuenow={api.widths[spec.id] ?? spec.width}
      tabIndex={0}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        api.reset(spec);
      }}
      onKeyDown={(e) => {
        const width = cell.current?.offsetWidth ?? spec.width;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          api.resize(spec, width, 16);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          api.resize(spec, width, -16);
        } else if (e.key === "Home") {
          e.preventDefault();
          api.reset(spec);
        }
      }}
      className={cn(
        "group/resize absolute -right-2 top-0 z-10 flex h-full w-4 cursor-col-resize touch-none items-center justify-center",
        "focus-visible:outline-none",
      )}
    >
      <span
        aria-hidden="true"
        className="h-3.5 w-px bg-transparent transition-colors group-hover/resize:bg-border-strong group-focus-visible/resize:bg-primary"
      />
    </div>
  );
}

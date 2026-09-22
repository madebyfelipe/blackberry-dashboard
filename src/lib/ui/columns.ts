/*
 * Largura de coluna das listas do produto.
 *
 * As listas nasceram com as larguras do export cravadas em classes
 * (`w-[150px]`), e isso resolvia o desenho mas não o uso: nome de cliente
 * longo cortava, "Faturamento" sobrava. A partir daqui a largura é dado —
 * começa na medida do desenho e a pessoa arrasta a divisória do cabeçalho.
 *
 * Toda a regra é pura e mora aqui: a tabela (`components/ui/DataTable`) só
 * desenha e o hook (`components/ui/useColumnWidths`) só guarda no navegador.
 */

export type ColumnSpec = {
  /** Chave estável — é o que vai para o `localStorage`. */
  id: string;
  label: string;
  /** Largura do export, em px. É o padrão e o valor do duplo clique. */
  width: number;
  /**
   * Mínimo desta coluna. Sem valor, vale `COLUMN_MIN`: menos que isso o
   * rótulo do cabeçalho já não cabe.
   */
  min?: number;
  /**
   * A coluna que cresce (CLIENTE, TAREFA). Enquanto ninguém a arrasta ela
   * ocupa o espaço que sobra; arrastada uma vez, passa a ter largura fixa
   * como as outras.
   */
  flex?: boolean;
};

/** Larguras escolhidas pela pessoa. Coluna ausente = largura do desenho. */
export type ColumnWidths = Readonly<Record<string, number>>;

export const COLUMN_MIN = 72;
export const COLUMN_MAX = 560;

function minOf(spec: ColumnSpec): number {
  return Math.max(COLUMN_MIN, spec.min ?? COLUMN_MIN);
}

export function clampColumnWidth(spec: ColumnSpec, width: number): number {
  if (!Number.isFinite(width)) return spec.width;
  return Math.round(Math.min(COLUMN_MAX, Math.max(minOf(spec), width)));
}

/** Largura em uso: a escolhida, ou a do desenho. */
export function columnWidth(widths: ColumnWidths, spec: ColumnSpec): number {
  const chosen = widths[spec.id];
  return chosen === undefined ? spec.width : clampColumnWidth(spec, chosen);
}

/**
 * Arrasto: `startWidth` é a largura no instante em que a divisória foi
 * pegada (medida na tela, porque a coluna que cresce não tem largura própria)
 * e `delta`, o quanto o ponteiro andou desde então.
 */
export function resizeColumn(
  widths: ColumnWidths,
  spec: ColumnSpec,
  startWidth: number,
  delta: number,
): ColumnWidths {
  return { ...widths, [spec.id]: clampColumnWidth(spec, startWidth + delta) };
}

/** Duplo clique na divisória: a coluna volta à medida do desenho. */
export function resetColumn(
  widths: ColumnWidths,
  spec: ColumnSpec,
): ColumnWidths {
  if (widths[spec.id] === undefined) return widths;
  const next = { ...widths };
  delete next[spec.id];
  return next;
}

/**
 * Largura mínima da linha, para a rolagem horizontal no celular: o respiro
 * das pontas + tudo que vem antes das colunas (caixa de seleção, espaços) +
 * a soma das colunas.
 */
export function tableMinWidth(
  specs: readonly ColumnSpec[],
  widths: ColumnWidths,
  lead: number,
): number {
  return specs.reduce(
    (sum, spec) => sum + columnWidth(widths, spec) + 16,
    lead,
  );
}

/**
 * Lê o que o navegador guardou. Nada aqui confia no conteúdo: id que não
 * existe mais, valor que não é número e JSON quebrado são descartados em
 * silêncio — largura de coluna não é motivo para a tela não abrir.
 */
export function parseColumnWidths(
  raw: string | null | undefined,
  specs: readonly ColumnSpec[],
): ColumnWidths {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: Record<string, number> = {};
  for (const spec of specs) {
    const value = (parsed as Record<string, unknown>)[spec.id];
    if (typeof value === "number" && Number.isFinite(value)) {
      out[spec.id] = clampColumnWidth(spec, value);
    }
  }
  return out;
}

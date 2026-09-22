"use client";

import { useCallback, useEffect, useState } from "react";
import {
  parseColumnWidths,
  resetColumn,
  resizeColumn,
  type ColumnSpec,
  type ColumnWidths,
} from "@/lib/ui/columns";

/*
 * Guarda a largura das colunas por lista, no navegador de quem usa.
 *
 * Não vai para o servidor de propósito: é preferência de quem está olhando a
 * tela, não dado da agência — e um PATCH por pixel arrastado seria caro sem
 * necessidade. A leitura acontece depois da primeira pintura (o servidor não
 * tem `localStorage`, e ler durante o render faria a hidratação divergir).
 */

const PREFIX = "bb.colunas.";

export type ColumnWidthsApi = {
  widths: ColumnWidths;
  /** Fim de um arrasto (ou de uma seta do teclado): grava a largura nova. */
  resize: (spec: ColumnSpec, startWidth: number, delta: number) => void;
  /** Duplo clique na divisória: volta à medida do desenho. */
  reset: (spec: ColumnSpec) => void;
};

export function useColumnWidths(
  /** Nome da lista ("clientes.lista"), que compõe a chave guardada. */
  key: string,
  specs: readonly ColumnSpec[],
): ColumnWidthsApi {
  const [widths, setWidths] = useState<ColumnWidths>({});

  useEffect(() => {
    try {
      setWidths(parseColumnWidths(localStorage.getItem(PREFIX + key), specs));
    } catch {
      // Navegador sem armazenamento (aba privada, permissão negada): a lista
      // abre nas medidas do desenho, que é o padrão de qualquer jeito.
    }
    // `specs` é constante de módulo em quem chama; a lista depende só da chave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /** Aplica a mudança na tela e tenta guardá-la; falha de escrita não trava. */
  const apply = useCallback(
    (change: (prev: ColumnWidths) => ColumnWidths) =>
      setWidths((prev) => {
        const next = change(prev);
        if (next === prev) return prev;
        try {
          localStorage.setItem(PREFIX + key, JSON.stringify(next));
        } catch {
          // Sem armazenamento a largura vale só para esta visita.
        }
        return next;
      }),
    [key],
  );

  return {
    widths,
    resize: useCallback(
      (spec, startWidth, delta) =>
        apply((prev) => resizeColumn(prev, spec, startWidth, delta)),
      [apply],
    ),
    reset: useCallback((spec) => apply((prev) => resetColumn(prev, spec)), [apply]),
  };
}

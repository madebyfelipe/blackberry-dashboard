import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  COLUMN_MAX,
  COLUMN_MIN,
  clampColumnWidth,
  columnWidth,
  parseColumnWidths,
  resetColumn,
  resizeColumn,
  tableMinWidth,
  type ColumnSpec,
} from "../src/lib/ui/columns";

const CLIENTE: ColumnSpec = { id: "cliente", label: "Cliente", width: 240, flex: true };
const SEGMENTO: ColumnSpec = { id: "segmento", label: "Segmento", width: 150 };
const STATUS: ColumnSpec = { id: "status", label: "Status", width: 130, min: 110 };
const SPECS = [CLIENTE, SEGMENTO, STATUS];

describe("largura de coluna", () => {
  test("a coluna começa na medida do desenho", () => {
    assert.equal(columnWidth({}, SEGMENTO), 150);
  });

  test("o arrasto soma ao que a coluna media quando foi pega", () => {
    const next = resizeColumn({}, SEGMENTO, 150, 60);
    assert.equal(columnWidth(next, SEGMENTO), 210);
    // Arrastar uma não mexe nas outras.
    assert.equal(columnWidth(next, STATUS), 130);
  });

  test("arrastar para trás para antes do mínimo para no mínimo da coluna", () => {
    assert.equal(clampColumnWidth(STATUS, 10), 110);
    assert.equal(clampColumnWidth(SEGMENTO, 10), COLUMN_MIN);
  });

  test("arrastar adiante sem parar para no máximo", () => {
    assert.equal(clampColumnWidth(SEGMENTO, 5000), COLUMN_MAX);
  });

  test("largura sempre inteira — meio pixel de arrasto não vira meia coluna", () => {
    const next = resizeColumn({}, SEGMENTO, 150, 10.4);
    assert.equal(next.segmento, 160);
  });

  test("duplo clique devolve a medida do desenho", () => {
    const arrastada = resizeColumn({}, SEGMENTO, 150, 60);
    const limpa = resetColumn(arrastada, SEGMENTO);
    assert.equal(limpa.segmento, undefined);
    assert.equal(columnWidth(limpa, SEGMENTO), 150);
  });

  test("resetar coluna intocada devolve o mesmo objeto", () => {
    const widths = { segmento: 200 };
    assert.equal(resetColumn(widths, STATUS), widths);
  });

  test("a linha mínima cresce com o que foi arrastado", () => {
    const lead = 32 + 18 + 16;
    const base = tableMinWidth(SPECS, {}, lead);
    assert.equal(base, lead + (240 + 16) + (150 + 16) + (130 + 16));
    const maior = tableMinWidth(SPECS, resizeColumn({}, SEGMENTO, 150, 100), lead);
    assert.equal(maior, base + 100);
  });
});

describe("larguras guardadas no navegador", () => {
  test("lê o que foi guardado", () => {
    const widths = parseColumnWidths('{"segmento":200,"status":140}', SPECS);
    assert.deepEqual(widths, { segmento: 200, status: 140 });
  });

  test("JSON quebrado, vazio ou não-objeto não derruba a lista", () => {
    for (const raw of ["{", "", null, undefined, "[]", '"200"', "7"]) {
      assert.deepEqual(parseColumnWidths(raw, SPECS), {});
    }
  });

  test("coluna que não existe mais e valor que não é número são descartados", () => {
    const widths = parseColumnWidths(
      '{"fantasma":200,"segmento":"largo","status":null,"cliente":300}',
      SPECS,
    );
    assert.deepEqual(widths, { cliente: 300 });
  });

  test("valor fora da faixa entra corrigido, não cru", () => {
    assert.deepEqual(parseColumnWidths('{"status":4}', SPECS), { status: 110 });
    assert.deepEqual(parseColumnWidths('{"status":9000}', SPECS), {
      status: COLUMN_MAX,
    });
  });
});

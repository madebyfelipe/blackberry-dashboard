import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  batchesOfClient,
  clientInitials,
  clientNameFromSlug,
  listClientSummaries,
  slugify,
} from "../src/lib/approval/clients";
import type { Batch, Piece, PieceStatus } from "../src/lib/approval/types";
import { AGENCIA_A } from "./helpers/agency";

function peca(id: string, status: PieceStatus): Piece {
  return {
    id,
    name: `Peça ${id}`,
    size: "1080 x 1080",
    date: "2026-09-10T08:00:00.000Z",
    status,
    kind: "Feed · imagem única",
    history: [],
  };
}

function lote(over: Partial<Batch> = {}): Batch {
  return {
    id: "monte-bar-set",
    agencyId: AGENCIA_A.agencyId,
    client: "Montê bar",
    label: "Lote setembro · 01-30 set",
    token: "Mn7bQrLZ2kTv0aX",
    pieces: [],
    ...over,
  };
}

describe("slugify", () => {
  test("tira acento, maiúscula e espaço", () => {
    assert.equal(slugify("Clínica Aurora"), "clinica-aurora");
    assert.equal(slugify("Montê bar"), "monte-bar");
    assert.equal(slugify("  Açaí & Cia.  "), "acai-cia");
  });

  test("texto sem letra nem número vira string vazia", () => {
    assert.equal(slugify("—"), "");
    assert.equal(slugify(""), "");
  });
});

describe("clientInitials", () => {
  test("usa até duas palavras", () => {
    assert.equal(clientInitials("Clínica Aurora"), "CA");
    assert.equal(clientInitials("Montê bar"), "MB");
    assert.equal(clientInitials("Aurora"), "A");
    assert.equal(clientInitials("Estúdio Norte Publicidade"), "EN");
  });

  test("nome vazio não quebra o card", () => {
    assert.equal(clientInitials("   "), "?");
  });
});

describe("listClientSummaries", () => {
  const batches = [
    lote({
      id: "aurora-set",
      client: "Clínica Aurora",
      pieces: [peca("1", "aprovado"), peca("2", "pendente"), peca("3", "ajuste")],
    }),
    lote({
      id: "aurora-out",
      client: "Clínica Aurora",
      pieces: [peca("4", "pendente")],
    }),
    lote({ id: "monte-set", client: "Montê bar", pieces: [peca("5", "aprovado")] }),
  ];

  test("um card por cliente, somando lotes, peças e pendentes", () => {
    const [aurora, monte] = listClientSummaries(batches);

    assert.deepEqual(
      { ...aurora },
      {
        name: "Clínica Aurora",
        slug: "clinica-aurora",
        initials: "CA",
        lotes: 2,
        pecas: 4,
        pendentes: 2,
      },
    );
    assert.equal(monte.slug, "monte-bar");
    assert.equal(monte.lotes, 1);
    assert.equal(monte.pendentes, 0);
  });

  test("ordena por nome", () => {
    const ordered = listClientSummaries([
      lote({ id: "z", client: "Zebra bar" }),
      lote({ id: "a", client: "Açaí Cia" }),
      lote({ id: "m", client: "Montê bar" }),
    ]);
    assert.deepEqual(
      ordered.map((c) => c.name),
      ["Açaí Cia", "Montê bar", "Zebra bar"],
    );
  });

  test("mesmo cliente escrito de dois jeitos é um card só", () => {
    const summaries = listClientSummaries([
      lote({ id: "a", client: "Montê bar" }),
      lote({ id: "b", client: "montê BAR" }),
    ]);
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].lotes, 2);
    // O nome exibido é o do primeiro lote — o jeito que a agência escreveu antes.
    assert.equal(summaries[0].name, "Montê bar");
  });

  test("cliente sem nome não vira card fantasma", () => {
    assert.deepEqual(listClientSummaries([lote({ id: "a", client: "  " })]), []);
  });
});

describe("batchesOfClient", () => {
  const batches = [
    lote({ id: "aurora-set", client: "Clínica Aurora" }),
    lote({ id: "monte-set", client: "Montê bar" }),
    lote({ id: "monte-out", client: "montê bar" }),
  ];

  test("filtra pelo slug, não pelo texto cru", () => {
    assert.deepEqual(
      batchesOfClient(batches, "monte-bar").map((b) => b.id),
      ["monte-set", "monte-out"],
    );
  });

  test("slug desconhecido devolve lista vazia", () => {
    assert.deepEqual(batchesOfClient(batches, "padaria-do-ze"), []);
  });
});

describe("clientNameFromSlug", () => {
  const batches = [lote({ client: "Clínica Aurora" })];

  test("devolve o nome como a agência escreveu", () => {
    assert.equal(clientNameFromSlug(batches, "clinica-aurora"), "Clínica Aurora");
  });

  test("slug de outro cliente não inventa nome", () => {
    assert.equal(clientNameFromSlug(batches, "monte-bar"), undefined);
  });
});

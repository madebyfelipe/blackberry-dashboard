import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

// Antes de qualquer import do store: diretório de dados só deste teste, vazio.
usarDataDirTemporario("approval-public");
escreverData("batches.json", []);
escreverData("clients.json", []);

const { addPiece, createBatch, decidePiece, getBatchByToken, regenerateBatchToken } = await import(
  "../src/lib/approval/repository"
);
const {
  PIECE_HISTORY_MAX,
  PUBLIC_BODY_MAX,
  PUBLIC_REASON_MAX,
  PUBLIC_WHO_MAX,
  PUBLIC_WRITES_MAX,
  PUBLIC_WRITES_WINDOW_MS,
  parsePublicDecision,
  toPublicBatch,
} = await import("../src/lib/approval/public");
const { createAttempts } = await import("../src/lib/auth/attempts");

/*
 * O link público de aprovação (issue #77): a única porta sem login do
 * produto. O token tem de ser imprevisível, a escrita tem teto e a tela do
 * cliente só leva o que mostra.
 */

const novoLote = () => createBatch(AGENCIA_A, { client: "Clínica Aurora", title: "Lote outubro" });

describe("token do link", () => {
  test("sai do crypto: 128 bits em base64url, e não repete", async () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const lote = await novoLote();
      assert.match(lote!.token, /^[A-Za-z0-9_-]{22}$/);
      tokens.add(lote!.token);
    }
    assert.equal(tokens.size, 20);
  });

  test("regenerar também troca por um token do crypto", async () => {
    const lote = await novoLote();
    const novo = await regenerateBatchToken(AGENCIA_A, lote!.id);
    assert.match(novo!.token, /^[A-Za-z0-9_-]{22}$/);
    assert.notEqual(novo!.token, lote!.token);
  });

  test("ids de peça e de evento também saem do crypto", async () => {
    const lote = await novoLote();
    const peca = await addPiece(AGENCIA_A, lote!.id);
    assert.match(peca!.id, /^p[0-9a-f]{10}$/);
    assert.match(peca!.history[0].id, /^h[0-9a-f]{10}$/);
  });
});

describe("parsePublicDecision — o que entra pelo POST", () => {
  const corpo = (o: Record<string, unknown>) => JSON.stringify(o);

  test("decisão válida passa", () => {
    const r = parsePublicDecision(corpo({ pieceId: "p1", decision: "ajuste", reason: "Trocar a cor", who: "Cliente" }));
    assert.deepEqual(r, { ok: true, value: { pieceId: "p1", decision: "ajuste", reason: "Trocar a cor", who: "Cliente" } });
  });

  test("corpo gigante é recusado com 413 antes de virar JSON", () => {
    const r = parsePublicDecision(corpo({ pieceId: "p1", decision: "ajuste", reason: "x".repeat(3 * 1024 * 1024) }));
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.status, 413);
    assert.equal(parsePublicDecision(" ".repeat(PUBLIC_BODY_MAX + 1)).ok, false);
  });

  test("motivo e nome acima do teto: 422", () => {
    const longo = parsePublicDecision(corpo({ pieceId: "p1", decision: "ajuste", reason: "x".repeat(PUBLIC_REASON_MAX + 1) }));
    assert.equal(!longo.ok && longo.status, 422);
    const nome = parsePublicDecision(corpo({ pieceId: "p1", decision: "aprovado", who: "x".repeat(PUBLIC_WHO_MAX + 1) }));
    assert.equal(!nome.ok && nome.status, 422);
    const noTeto = parsePublicDecision(corpo({ pieceId: "p1", decision: "ajuste", reason: "x".repeat(PUBLIC_REASON_MAX) }));
    assert.equal(noTeto.ok, true);
  });

  test("JSON quebrado, decisão fora da lista e ajuste sem motivo", () => {
    const quebrado = parsePublicDecision("{");
    assert.equal(!quebrado.ok && quebrado.status, 400);
    for (const decision of ["constructor", "apagar", ""]) {
      const r = parsePublicDecision(corpo({ pieceId: "p1", decision }));
      assert.equal(!r.ok && r.status, 422, decision);
    }
    const semMotivo = parsePublicDecision(corpo({ pieceId: "p1", decision: "ajuste", reason: "   " }));
    assert.equal(!semMotivo.ok && semMotivo.status, 422);
  });
});

describe("decidePiece — a escrita tem teto", () => {
  test("o histórico da peça não passa do teto, por mais que se repita", async () => {
    const lote = await novoLote();
    const peca = await addPiece(AGENCIA_A, lote!.id);
    let ultima;
    for (let i = 0; i < PIECE_HISTORY_MAX + 20; i++) {
      ultima = await decidePiece(lote!.token, peca!.id, i % 2 ? "aprovado" : "ajuste", { reason: "de novo" });
    }
    assert.ok(ultima && ultima !== "inactive-link");
    assert.equal(ultima.history.length, PIECE_HISTORY_MAX);
    assert.equal(ultima.history[0].title, "Aprovada pelo cliente", "o mais novo fica, o mais antigo sai");
  });

  test("motivo, nome e IP são cortados mesmo se a rota deixar passar", async () => {
    const lote = await novoLote();
    const peca = await addPiece(AGENCIA_A, lote!.id);
    const r = await decidePiece(lote!.token, peca!.id, "ajuste", {
      reason: "m".repeat(3 * 1024 * 1024),
      who: "w".repeat(3 * 1024 * 1024),
      ip: "1".repeat(10_000),
    });
    assert.ok(r && r !== "inactive-link");
    assert.equal(r.reason?.length, PUBLIC_REASON_MAX);
    assert.ok(r.history[0].who.length < PUBLIC_WHO_MAX + 20);
    assert.equal(r.history[0].ip?.length, 64);
  });
});

describe("freio por token + IP", () => {
  test("bloqueia depois do teto e libera quando a janela passa", () => {
    let t = 0;
    const w = createAttempts(() => t, { max: PUBLIC_WRITES_MAX, windowMs: PUBLIC_WRITES_WINDOW_MS });
    for (let i = 0; i < PUBLIC_WRITES_MAX - 1; i++) w.reserve("tok|1.2.3.4");
    assert.equal(w.blockedFor("tok|1.2.3.4"), 0);
    w.reserve("tok|1.2.3.4");
    assert.ok(w.blockedFor("tok|1.2.3.4") > 0);
    assert.equal(w.blockedFor("tok|5.6.7.8"), 0, "outro IP não herda o freio");
    t += PUBLIC_WRITES_WINDOW_MS + 1;
    assert.equal(w.blockedFor("tok|1.2.3.4"), 0);
  });
});

describe("toPublicBatch — o que vai para a tela do cliente", () => {
  test("sem IP, ids internos, briefing, histórico nem pathname do Blob", async () => {
    const lote = await createBatch(AGENCIA_A, {
      client: "Clínica Aurora",
      title: "Lote novembro",
      description: "Briefing interno do lote",
    });
    const media = {
      id: "m1",
      url: "/api/media/m1",
      kind: "image" as const,
      mime: "image/png",
      name: "capa.png",
      size: 10,
      width: 1080,
      height: 1080,
      createdAt: new Date().toISOString(),
      blobUrl: "https://segredo.blob.vercel-storage.com/media/capa.png",
      blobPathname: "media/capa-SEGREDO.png",
    };
    const peca = await addPiece(AGENCIA_A, lote!.id, media);
    await decidePiece(lote!.token, peca!.id, "ajuste", { reason: "Trocar a cor", ip: "203.0.113.9" });
    const batch = await getBatchByToken(lote!.token);
    batch!.pieces[0].briefing = "Briefing interno da peça";

    const publico = toPublicBatch(batch!);
    const html = JSON.stringify(publico);
    for (const segredo of [
      "203.0.113.9",
      batch!.agencyId,
      "Briefing interno",
      "segredo.blob",
      "SEGREDO",
      '"history"',
      '"clientId"',
      '"agencyId"',
      '"description"',
      '"briefing"',
      '"mime"',
    ]) {
      assert.ok(!html.includes(segredo), `vazou: ${segredo}`);
    }
    assert.deepEqual(Object.keys(publico).sort(), ["client", "label", "pieces", "token"]);
    assert.equal(publico.pieces[0].reason, "Trocar a cor", "o motivo do próprio cliente continua");
    assert.equal(publico.pieces[0].media?.[0].url, "/api/media/m1");
  });
});

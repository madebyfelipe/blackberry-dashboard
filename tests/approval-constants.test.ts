import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  batchLinkStatus,
  batchProgress,
  formatFromDimensions,
  isBatchLinkActive,
  pieceChannel,
  pieceFormat,
  pieceFormatLabel,
  progressCaption,
  shareMessage,
  shareSubject,
  sizeFromDimensions,
} from "../src/lib/approval/constants";
import type { Batch, Piece, PieceStatus } from "../src/lib/approval/types";
import { AGENCIA_A } from "./helpers/agency";

function peca(id: string, status: PieceStatus, over: Partial<Piece> = {}): Piece {
  return {
    id,
    name: `Peça ${id}`,
    size: "1080 x 1080",
    date: "2026-09-10T08:00:00.000Z",
    status,
    kind: "Feed · imagem única",
    history: [],
    ...over,
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

describe("formatFromDimensions", () => {
  test("quadrado vira Feed", () => {
    assert.equal(formatFromDimensions(1080, 1080, "image"), "feed");
    assert.equal(formatFromDimensions(1000, 1000, "video"), "feed");
  });

  test("retrato 4:5 vira Carrossel", () => {
    assert.equal(formatFromDimensions(1080, 1350, "image"), "carrossel");
    assert.equal(formatFromDimensions(1080, 1350, "video"), "carrossel");
  });

  test("vertical alto: Stories para imagem, Reels para vídeo", () => {
    assert.equal(formatFromDimensions(1080, 1920, "image"), "stories");
    assert.equal(formatFromDimensions(1080, 1920, "video"), "reels");
  });

  test("paisagem cai em Feed, que é o formato que aceita", () => {
    assert.equal(formatFromDimensions(1920, 1080, "image"), "feed");
    assert.equal(formatFromDimensions(1200, 628, "image"), "feed");
  });

  test("dimensão ausente ou zerada não quebra: Feed", () => {
    assert.equal(formatFromDimensions(0, 1080, "image"), "feed");
    assert.equal(formatFromDimensions(1080, 0, "video"), "feed");
    assert.equal(formatFromDimensions(0, 0, "image"), "feed");
  });

  test("as bordas da régua (0,95 e 0,62) caem do lado documentado", () => {
    // Logo abaixo de 0,95 é retrato → Carrossel.
    assert.equal(formatFromDimensions(949, 1000, "image"), "carrossel");
    /*
     * Em 0,95 exato as duas comparações são estritas (`> 0.95` e `< 0.95`),
     * então a proporção escapa das duas janelas e cai no Feed do fim da
     * função. Na prática ninguém entrega 950x1000, mas o teste registra onde
     * a borda está para quem for mexer na régua.
     */
    assert.equal(formatFromDimensions(950, 1000, "image"), "feed");
    // Acima de 0,95 é a janela do quadrado.
    assert.equal(formatFromDimensions(960, 1000, "image"), "feed");
    // 0,62 exato ainda é Carrossel; abaixo disso é vertical alto.
    assert.equal(formatFromDimensions(620, 1000, "image"), "carrossel");
    assert.equal(formatFromDimensions(619, 1000, "image"), "stories");
    assert.equal(formatFromDimensions(619, 1000, "video"), "reels");
  });

  test("sizeFromDimensions escreve como o editor mostra", () => {
    assert.equal(sizeFromDimensions(1080, 1350), "1080 x 1350");
  });
});

describe("formato da peça a partir do kind antigo", () => {
  test("usa o campo novo quando existe", () => {
    assert.equal(pieceFormat(peca("p1", "pendente", { format: "reels" })), "reels");
    assert.equal(pieceFormatLabel(peca("p1", "pendente", { format: "reels" })), "Reels");
  });

  test("cai para o texto livre quando o campo novo não foi preenchido", () => {
    assert.equal(pieceFormat(peca("p1", "pendente", { kind: "Reels · vídeo" })), "reels");
    assert.equal(pieceFormat(peca("p1", "pendente", { kind: "Story · sequência de 2" })), "stories");
    assert.equal(pieceFormat(peca("p1", "pendente", { kind: "Feed · carrossel" })), "carrossel");
    assert.equal(pieceFormat(peca("p1", "pendente", { kind: "Feed · imagem única" })), "feed");
    assert.equal(pieceFormat(peca("p1", "pendente", { kind: "sei lá" })), "feed");
  });

  test("canal padrão é Instagram", () => {
    assert.equal(pieceChannel(peca("p1", "pendente")), "instagram");
    assert.equal(pieceChannel(peca("p1", "pendente", { channel: "tiktok" })), "tiktok");
  });
});

describe("progresso do lote", () => {
  test("conta aprovadas, ajustes e pendentes", () => {
    const b = lote({
      pieces: [
        peca("1", "aprovado"),
        peca("2", "aprovado"),
        peca("3", "ajuste"),
        peca("4", "pendente"),
      ],
    });
    assert.deepEqual(batchProgress(b), {
      total: 4,
      aprovadas: 2,
      ajuste: 1,
      pendentes: 1,
      decided: 3,
      pct: 75,
    });
    assert.equal(progressCaption(b), "2 aprovadas · 1 com ajuste pedido · 1 pendentes");
  });

  test("lote vazio não divide por zero", () => {
    assert.deepEqual(batchProgress(lote()), {
      total: 0,
      aprovadas: 0,
      ajuste: 0,
      pendentes: 0,
      decided: 0,
      pct: 0,
    });
  });

  test("tudo decidido é 100%", () => {
    assert.equal(batchProgress(lote({ pieces: [peca("1", "aprovado")] })).pct, 100);
  });
});

describe("estado do link público", () => {
  test("sem expiração e sem revogação, o link está ativo", () => {
    assert.equal(batchLinkStatus(lote()), "ativo");
    assert.equal(isBatchLinkActive(lote()), true);
  });

  test("revogado vence a expiração", () => {
    const b = lote({ tokenRevoked: true, tokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString() });
    assert.equal(batchLinkStatus(b), "revogado");
    assert.equal(isBatchLinkActive(b), false);
  });

  test("expirado quando a data já passou", () => {
    const b = lote({ tokenExpiresAt: new Date(Date.now() - 1000).toISOString() });
    assert.equal(batchLinkStatus(b), "expirado");
    assert.equal(isBatchLinkActive(b), false);
  });

  test("data futura segue ativo; null não expira", () => {
    assert.equal(batchLinkStatus(lote({ tokenExpiresAt: new Date(Date.now() + 1000).toISOString() })), "ativo");
    assert.equal(batchLinkStatus(lote({ tokenExpiresAt: null })), "ativo");
  });
});

describe("mensagem de envio do link", () => {
  test("leva o rótulo do lote, a contagem e a URL exata", () => {
    const b = lote({ pieces: [peca("1", "pendente"), peca("2", "pendente")] });
    const url = "https://blackberry.app/a/Mn7bQrLZ2kTv0aX";
    const msg = shareMessage(b, url);
    assert.ok(msg.includes(b.label), "cita o lote");
    assert.ok(msg.includes("2 peças"), "plural");
    assert.ok(msg.includes(url), "leva o link");
  });

  test("uma peça só é escrito no singular", () => {
    const msg = shareMessage(lote({ pieces: [peca("1", "pendente")] }), "https://x/a/y");
    assert.ok(msg.includes("1 peça"), msg);
    assert.ok(!msg.includes("1 peças"), msg);
  });

  test("o assunto do e-mail identifica cliente e lote", () => {
    assert.equal(
      shareSubject(lote()),
      "Montê bar · Lote setembro · 01-30 set — aprovação de conteúdo",
    );
  });
});

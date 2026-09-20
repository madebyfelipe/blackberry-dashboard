import { read, transaction } from "./store";
import {
  formatFromDimensions,
  isBatchLinkActive,
  PIECE_FORMATS,
  sizeFromDimensions,
} from "./constants";
import { slugify } from "./clients";
import { deleteMedia } from "@/lib/media/store";
import type { AgencyScope } from "@/lib/agency/types";
import type { MediaAsset } from "@/lib/media/types";
import type {
  Batch,
  DecisionEvent,
  Piece,
  PieceDraftPatch,
  PieceStatus,
} from "./types";

/*
 * Lotes e peças. Duas portas, e só duas:
 *
 * 1. A agência, que exige `AgencyScope` — vindo da sessão do servidor, nunca
 *    da requisição. Todo lote é procurado por id *e* agência, em leitura e em
 *    escrita; lote de outra agência responde como inexistente (404), nunca
 *    403, que confirmaria a existência do id.
 *
 * 2. O cliente pelo link público (`/a/<token>`), que roda sem sessão nenhuma.
 *    Ali quem autoriza é o token, e o alcance dele é um lote só — as duas
 *    funções dessa porta estão isoladas no fim do arquivo, sem escopo por
 *    desenho.
 */

export async function listBatches(scope: AgencyScope): Promise<Batch[]> {
  return (await read()).filter((b) => b.agencyId === scope.agencyId);
}

export async function getBatch(
  scope: AgencyScope,
  id: string,
): Promise<Batch | undefined> {
  return (await read()).find(
    (b) => b.id === id && b.agencyId === scope.agencyId,
  );
}

/** O lote da agência dentro de uma transação — o filtro de escrita. */
function ownedBatch(
  batches: Batch[],
  scope: AgencyScope,
  id: string,
): Batch | undefined {
  return batches.find((b) => b.id === id && b.agencyId === scope.agencyId);
}

function nowStamp(): string {
  const M = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const d = new Date();
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${String(d.getDate()).padStart(2, "0")} ${M[d.getMonth()]} · ${time}`;
}

/* --- Editor de lote (visão agência) --- */

/** Salva o rascunho de uma peça (legenda, hashtags, formato, canal, data). */
export async function updatePieceDraft(
  scope: AgencyScope,
  batchId: string,
  pieceId: string,
  patch: PieceDraftPatch,
): Promise<{ batch: Batch; piece: Piece } | undefined> {
  return transaction((batches) => {
    const batch = ownedBatch(batches, scope, batchId);
    const piece = batch?.pieces.find((p) => p.id === pieceId);
    if (!batch || !piece) return undefined;

    if (patch.caption !== undefined) piece.caption = patch.caption;
    if (patch.hashtags !== undefined) piece.hashtags = patch.hashtags;
    if (patch.channel !== undefined) piece.channel = patch.channel;
    if (patch.name !== undefined) piece.name = patch.name;
    if (patch.date !== undefined) piece.date = patch.date;
    if (patch.format !== undefined) {
      piece.format = patch.format;
      // O formato manda no tamanho da arte — mantém `size` e `kind` coerentes.
      const meta = PIECE_FORMATS.find((f) => f.id === patch.format);
      if (meta) {
        piece.size = patch.size ?? meta.size;
        piece.kind = meta.label;
      }
    } else if (patch.size !== undefined) {
      piece.size = patch.size;
    }

    batch.draftSavedAt = new Date().toISOString();
    return { batch: { ...batch }, piece: { ...piece } };
  });
}

/**
 * Cria uma peça no fim do lote ("Adicionar peça" no editor).
 *
 * Com `media`, a peça nasce da arte enviada: nome do arquivo, tamanho real e
 * formato deduzido das dimensões — é o caminho do "Subir artes".
 */
export async function addPiece(
  scope: AgencyScope,
  batchId: string,
  media?: MediaAsset,
): Promise<Piece | undefined> {
  return transaction((batches) => {
    const batch = ownedBatch(batches, scope, batchId);
    if (!batch) return undefined;
    const n = batch.pieces.length + 1;
    const format =
      media?.width && media?.height
        ? formatFromDimensions(media.width, media.height, media.kind)
        : "feed";
    const meta = PIECE_FORMATS.find((f) => f.id === format) ?? PIECE_FORMATS[0];
    const piece: Piece = {
      id: "p" + Math.random().toString(36).slice(2, 8),
      name: media ? fileLabel(media.name) : `Peça ${String(n).padStart(2, "0")}`,
      size:
        media?.width && media?.height
          ? sizeFromDimensions(media.width, media.height)
          : meta.size,
      date: new Date().toISOString(),
      status: "pendente",
      kind: meta.label,
      format,
      channel: "instagram",
      caption: "",
      hashtags: "",
      media,
      history: [
        {
          id: "h" + Math.random().toString(36).slice(2, 8),
          title: media ? "Arte enviada para o lote" : "Peça criada no lote",
          who: agencyStamp(scope),
        },
      ],
    };
    batch.pieces.push(piece);
    batch.stage = "rascunho";
    batch.draftSavedAt = new Date().toISOString();
    return { ...piece };
  });
}

/**
 * O "quem" das linhas de histórico feitas pela agência. Sai do escopo da
 * sessão: antes era o nome de uma agência fixa no código, o que escrevia
 * "Estúdio Norte" dentro do histórico de todas as outras.
 */
function agencyStamp(scope: AgencyScope): string {
  return `${scope.agencyName} · ${nowStamp()}`;
}

/** "capa-lancamento.png" → "Capa lancamento" (nome que o time reconhece). */
function fileLabel(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  if (!base) return "Nova peça";
  return base.charAt(0).toUpperCase() + base.slice(1).slice(0, 60);
}

/**
 * Troca (ou remove) a arte de uma peça. A arte anterior é apagada do
 * armazenamento — o histórico guarda a decisão, não o arquivo velho.
 */
export async function setPieceMedia(
  scope: AgencyScope,
  batchId: string,
  pieceId: string,
  media: MediaAsset | null,
): Promise<{ batch: Batch; piece: Piece } | undefined> {
  const result = await transaction((batches) => {
    const batch = ownedBatch(batches, scope, batchId);
    const piece = batch?.pieces.find((p) => p.id === pieceId);
    if (!batch || !piece) return undefined;

    const previous = piece.media;
    piece.media = media ?? undefined;

    if (media?.width && media?.height) {
      piece.size = sizeFromDimensions(media.width, media.height);
      const format = formatFromDimensions(media.width, media.height, media.kind);
      piece.format = format;
      const meta = PIECE_FORMATS.find((f) => f.id === format);
      if (meta) piece.kind = meta.label;
    }

    piece.history = [
      {
        id: "h" + Math.random().toString(36).slice(2, 8),
        title: media
          ? previous
            ? "Arte substituída"
            : "Arte enviada"
          : "Arte removida",
        who: agencyStamp(scope),
      },
      ...piece.history,
    ];

    batch.draftSavedAt = new Date().toISOString();
    return {
      batch: { ...batch },
      piece: { ...piece },
      previousMediaId: previous?.id,
    };
  });

  /*
   * A arte só é apagada depois de a peça deixar de apontar para ela — e só se
   * a peça era mesmo desta agência. Apagar antes de conferir o dono deixaria
   * qualquer sessão derrubar a arte de qualquer lote pela URL.
   */
  if (!result) return undefined;
  if (result.previousMediaId && result.previousMediaId !== media?.id) {
    await deleteMedia(result.previousMediaId);
  }
  return { batch: result.batch, piece: result.piece };
}

/** Fecha o rascunho: o lote passa a valer para o link público do cliente. */
export async function sendBatchForApproval(
  scope: AgencyScope,
  batchId: string,
): Promise<Batch | undefined> {
  return transaction((batches) => {
    const batch = ownedBatch(batches, scope, batchId);
    if (!batch) return undefined;
    batch.stage = "em-aprovacao";
    batch.draftSavedAt = new Date().toISOString();
    const who = agencyStamp(scope);
    for (const piece of batch.pieces) {
      if (piece.status !== "pendente") continue;
      piece.history = [
        {
          id: "h" + Math.random().toString(36).slice(2, 8),
          title: "Enviada para aprovação",
          who,
        },
        ...piece.history,
      ];
    }
    return { ...batch };
  });
}

/**
 * Cria um lote vazio para um cliente da agência — o "Novo lote" da lista de
 * lotes. Nasce como rascunho e já com link público próprio: quem decide
 * quando ele sai é o "Enviar para aprovação" do editor, não a criação.
 *
 * O cliente chega como texto (ainda não é entidade); o id do lote sai do
 * cliente + título, com sufixo quando já existe — dois "Lote setembro" do
 * mesmo cliente são normais, e um id repetido faria o segundo responder no
 * lugar do primeiro.
 */
export async function createBatch(
  scope: AgencyScope,
  input: {
    client: string;
    title: string;
    /** "01-30 set" — vira a segunda metade do rótulo. */
    period?: string;
    description?: string;
  },
): Promise<Batch | undefined> {
  const client = input.client.trim();
  const title = input.title.trim();
  const period = input.period?.trim();
  const description = input.description?.trim();
  if (!client || !title) return undefined;

  return transaction((batches) => {
    const base = slugify(`${client}-${title}`) || "lote";
    let id = base;
    for (let n = 2; batches.some((b) => b.id === id); n++) id = `${base}-${n}`;

    let token = randomToken();
    while (batches.some((b) => b.token === token)) token = randomToken();

    const batch: Batch = {
      id,
      agencyId: scope.agencyId,
      client,
      label: period ? `${title} · ${period}` : title,
      description: description || undefined,
      stage: "rascunho",
      token,
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      pieces: [],
    };
    batches.push(batch);
    return { ...batch };
  });
}

/** Generate a fresh public token for a batch, clearing any revocation and extending expiry 30 days out. */
export async function regenerateBatchToken(
  scope: AgencyScope,
  batchId: string,
): Promise<Batch | undefined> {
  return transaction((batches) => {
    const batch = ownedBatch(batches, scope, batchId);
    if (!batch) return undefined;
    /*
     * O token é a autorização inteira do link público, e ele é procurado na
     * base toda — sem a garantia de ser único, um sorteio repetido abriria o
     * lote de outra agência (ou, pior, deixaria os dois inacessíveis).
     */
    let token = randomToken();
    while (batches.some((b) => b.token === token)) token = randomToken();
    batch.token = token;
    batch.tokenRevoked = false;
    batch.tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return { ...batch };
  });
}

/** Manually disable (or re-enable) a batch's public link without changing the token. */
export async function setBatchLinkRevoked(
  scope: AgencyScope,
  batchId: string,
  revoked: boolean,
): Promise<Batch | undefined> {
  return transaction((batches) => {
    const batch = ownedBatch(batches, scope, batchId);
    if (!batch) return undefined;
    batch.tokenRevoked = revoked;
    return { ...batch };
  });
}

function randomToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 15; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Agency action: aprovar a peça pela própria agência ("Aprovar peça" no painel
 * de detalhe do export "Clínica Aurora - Lote"). Fica registrado como decisão
 * da agência — a decisão do cliente continua vindo só pelo link público.
 */
export async function approvePieceByAgency(
  scope: AgencyScope,
  batchId: string,
  pieceId: string,
): Promise<Piece | undefined> {
  return transaction((batches) => {
    const batch = ownedBatch(batches, scope, batchId);
    const piece = batch?.pieces.find((p) => p.id === pieceId);
    if (!piece) return undefined;
    if (piece.status === "aprovado") return { ...piece };
    piece.status = "aprovado";
    piece.reason = undefined;
    piece.history = [
      {
        id: "h" + Math.random().toString(36).slice(2, 8),
        title: "Aprovada pela agência",
        who: agencyStamp(scope),
        snapshot: { caption: piece.caption, kind: piece.kind, size: piece.size },
      },
      ...piece.history,
    ];
    return { ...piece };
  });
}

/** Agency action: mark an "ajuste" piece as redone → back to pendente for re-review. */
export async function markPieceRedone(
  scope: AgencyScope,
  batchId: string,
  pieceId: string,
): Promise<Piece | undefined> {
  return transaction((batches) => {
    const batch = ownedBatch(batches, scope, batchId);
    const piece = batch?.pieces.find((p) => p.id === pieceId);
    if (!piece) return undefined;
    piece.status = "pendente";
    piece.reason = undefined;
    piece.history = [
      {
        id: "h" + Math.random().toString(36).slice(2, 8),
        title: "Marcada como refeita",
        who: agencyStamp(scope),
      },
      ...piece.history,
    ];
    return { ...piece };
  });
}

/* --- Link público do cliente (`/a/<token>`) — sem sessão --- */

/*
 * A exceção do produto: aqui não há agência da sessão para conferir, porque
 * não há sessão. Quem autoriza é o token, e o que ele autoriza é um lote — por
 * isso as duas funções abaixo não recebem `AgencyScope` e nunca devem receber:
 * um escopo aqui seria um escopo vindo da requisição.
 */

/**
 * Lote de um token. Resolve um lote e só um: dois lotes com o mesmo token
 * seria ambíguo, e no escuro entre duas agências a resposta certa é não abrir
 * nenhum. (`regenerateBatchToken` já impede que isso aconteça; esta é a rede
 * embaixo, para dados vindos de qualquer outra origem.)
 */
function findByToken(batches: Batch[], token: string): Batch | undefined {
  if (!token) return undefined;
  const found = batches.filter((b) => b.token === token);
  return found.length === 1 ? found[0] : undefined;
}

export async function getBatchByToken(token: string): Promise<Batch | undefined> {
  return findByToken(await read(), token);
}

/** Record a client decision on a piece (used by the public approval link). */
export async function decidePiece(
  token: string,
  pieceId: string,
  decision: PieceStatus,
  opts?: { reason?: string; who?: string; ip?: string },
): Promise<Piece | undefined | "inactive-link"> {
  return transaction((batches) => {
    const batch = findByToken(batches, token);
    if (!batch) return undefined;
    if (!isBatchLinkActive(batch)) return "inactive-link" as const;
    const piece = batch.pieces.find((p) => p.id === pieceId);
    if (!piece) return undefined;

    piece.status = decision;
    if (decision === "ajuste" && opts?.reason) piece.reason = opts.reason;

    const who = (opts?.who || "Cliente") + " · " + nowStamp();
    const title =
      decision === "aprovado"
        ? "Aprovada pelo cliente"
        : decision === "ajuste"
          ? "Ajuste pedido pelo cliente"
          : "Marcada como pendente";
    const event: DecisionEvent = {
      id: "h" + Math.random().toString(36).slice(2, 8),
      title,
      who,
      ip: opts?.ip,
      // Exact content the client saw when deciding — protects against later edits.
      snapshot: { caption: piece.caption, kind: piece.kind, size: piece.size },
    };
    piece.history = [event, ...piece.history];
    return { ...piece };
  });
}

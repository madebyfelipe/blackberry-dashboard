import { LEGACY_AGENCY_ID, LEGACY_AGENCY_NAME } from "@/lib/agency/id";
import type { Batch } from "./types";

/** Seed mirrors the "Clínica Aurora - Lote" export, plus a second demo lote. */
export function seedBatches(): Batch[] {
  return [
    {
      id: "clinica-aurora-set",
      // Os dois lotes de demonstração são da agência semeada.
      agencyId: LEGACY_AGENCY_ID,
      client: "Clínica Aurora",
      label: "Lote setembro · 01-30 set",
      token: "BJnMavwFGlmU67F",
      pieces: [
        piece("p1", "Peça 01", "1080 x 1080", "2026-09-02", "aprovado", "Feed · imagem única"),
        piece("p2", "Peça 02", "1080 x 1350", "2026-09-05", "aprovado", "Feed · retrato"),
        piece("p3", "Peça 03", "1080 x 1080", "2026-09-09", "aprovado", "Feed · imagem única"),
        {
          ...piece("p4", "Peça 04", "1080 x 1920", "2026-09-12", "ajuste", "Story · sequência de 2"),
          caption: "Cuide da sua pele nesta primavera 🌸 Agende sua avaliação.",
          reason: "Trocar a cor do texto para melhorar leitura.",
          history: [
            { id: "h1", title: "Ajuste pedido pelo cliente", who: "Marina Duarte · 11 set · 21:14" },
            { id: "h2", title: "Enviada para aprovação", who: LEGACY_AGENCY_NAME + " · 11 set · 17:02" },
            { id: "h3", title: "Peça criada no lote", who: LEGACY_AGENCY_NAME + " · 09 set · 10:40" },
          ],
        },
        piece("p5", "Peça 05", "1080 x 1920", "2026-09-16", "ajuste", "Story · sequência de 2"),
        piece("p6", "Peça 06", "1080 x 1080", "2026-09-18", "pendente", "Feed · imagem única"),
        piece("p7", "Peça 07", "1080 x 1350", "2026-09-23", "pendente", "Feed · retrato"),
        piece("p8", "Peça 08", "1080 x 1920", "2026-09-26", "pendente", "Reels · vídeo"),
      ],
    },
    {
      id: "monte-bar-set",
      agencyId: LEGACY_AGENCY_ID,
      client: "Montê bar",
      label: "Lote setembro · 01-30 set",
      token: "Mn7bQrLZ2kTv0aX",
      pieces: [
        piece("m1", "Peça 01", "1080 x 1080", "2026-09-03", "aprovado", "Feed · imagem única"),
        piece("m2", "Peça 02", "1080 x 1350", "2026-09-07", "pendente", "Feed · retrato"),
        piece("m3", "Peça 03", "1080 x 1920", "2026-09-11", "pendente", "Story · sequência de 3"),
        piece("m4", "Peça 04", "1080 x 1080", "2026-09-15", "pendente", "Feed · carrossel"),
        piece("m5", "Peça 05", "1080 x 1920", "2026-09-19", "pendente", "Reels · vídeo"),
        piece("m6", "Peça 06", "1080 x 1080", "2026-09-24", "pendente", "Feed · imagem única"),
      ],
    },
  ];
}

function piece(
  id: string,
  name: string,
  size: string,
  date: string,
  status: import("./types").PieceStatus,
  kind: string,
): import("./types").Piece {
  return {
    id,
    name,
    size,
    date: date + "T08:00:00.000Z",
    status,
    kind,
    caption: "Legenda da peça — texto de apoio para o cliente avaliar.",
    history: [
      { id: id + "-c", title: "Peça criada no lote", who: LEGACY_AGENCY_NAME + " · " + shortPt(date) },
    ],
  };
}

function shortPt(iso: string): string {
  const M = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const d = new Date(iso + "T08:00:00.000Z");
  return `${String(d.getDate()).padStart(2, "0")} ${M[d.getMonth()]}`;
}

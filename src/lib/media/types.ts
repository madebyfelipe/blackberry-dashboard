import type { AgencyId } from "@/lib/agency/types";

export type MediaKind = "image" | "video" | "audio" | "file";

/** Arte enviada pela agência e anexada a uma peça do lote. */
export type MediaAsset = {
  id: string;
  /** URL servida pelo próprio app (`/api/media/<id>`). */
  url: string;
  kind: MediaKind;
  mime: string;
  /** Nome do arquivo original, como o time reconhece. */
  name: string;
  /** Bytes. */
  size: number;
  /** Dimensões, quando dá para ler do cabeçalho do arquivo. */
  width?: number;
  height?: number;
  /**
   * Só áudio de conversa: duração (s) e forma de onda, que o navegador de
   * quem subiu mede antes de mandar — ver `src/lib/inbox/voice.ts`.
   */
  duration?: number;
  waveform?: number[];
  createdAt: string;
  /**
   * Agência dona do arquivo, quando ele **não** pode ser servido sem sessão
   * (contrato/arquivo da ficha do cliente, anexo de conversa — issue #111).
   * `GET /api/media/<id>` confere isto contra a sessão de quem pede; ausente
   * para o que precisa continuar público: arte do lote (link de aprovação),
   * foto de perfil e logo da agência.
   */
  agencyId?: AgencyId;
  /** URL do objeto no Vercel Blob, quando `BLOB_READ_WRITE_TOKEN` está configurado. */
  blobUrl?: string;
  /**
   * Pathname do objeto dentro do store (`media/<algo>.<ext>`). O store é
   * privado (issue #39): é a partir daqui que se assina a URL de download de
   * curta duração — a `blobUrl` sozinha não abre mais o arquivo.
   */
  blobPathname?: string;
  /**
   * De quem é o arquivo, quando ele é anexo de conversa. A arte do lote não
   * tem dono aqui (ela mora na peça). O anexo tem: é isso que impede alguém
   * de pôr o id de uma arte alheia numa mensagem e apagá-la junto com ela.
   */
  owner?: {
    agencyId: string;
    uploaderId: string;
    conversationId: string;
    /** O id da mensagem que levou o anexo — um anexo vai numa mensagem só. */
    messageId: string | null;
  };
};

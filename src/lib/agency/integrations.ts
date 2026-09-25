import "server-only";
import { ablyEnabled, livekitEnabled } from "@/lib/realtime/server";

/*
 * O status das integrações (Configurações › Agência › Integrações): só se a
 * variável está definida no servidor. A chave em si nunca sai daqui — a tela
 * recebe um booleano por serviço.
 */

export type IntegrationId = "tempo-real" | "chamadas" | "gifs" | "armazenamento" | "banco";

export type IntegrationStatus = { id: IntegrationId; configured: boolean; provider: string };

function has(name: string): boolean {
  return !!process.env[name]?.trim();
}

export function integrationStatus(): IntegrationStatus[] {
  return [
    { id: "tempo-real", configured: ablyEnabled(), provider: "Ably" },
    { id: "chamadas", configured: livekitEnabled(), provider: "LiveKit" },
    {
      id: "gifs",
      configured: has("GIPHY_API_KEY") || has("TENOR_API_KEY"),
      provider: has("GIPHY_API_KEY") || !has("TENOR_API_KEY") ? "Giphy" : "Tenor",
    },
    { id: "armazenamento", configured: has("BLOB_READ_WRITE_TOKEN"), provider: "Vercel Blob" },
    { id: "banco", configured: has("DATABASE_URL"), provider: "Postgres" },
  ];
}

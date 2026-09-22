import "server-only";
import type { AgencyScope } from "@/lib/agency/types";
import {
  callRoom,
  capabilityFor,
  conversationChannel,
  memberChannel,
  type RealtimeEvent,
} from "./channels";

/*
 * O lado servidor do tempo real. Dois serviços, dois trabalhos diferentes:
 *
 * - **Ably** carrega os eventos (mensagem nova, chamada começando, presença).
 *   Conexão sempre ligada, barata por mensagem — é o que a Vercel não faz,
 *   porque função serverless não segura socket.
 * - **LiveKit** carrega a mídia (áudio e tela). Só existe enquanto há
 *   chamada, e é ele que resolve o TURN que faria a chamada falhar em rede
 *   fechada.
 *
 * Os dois são **opcionais**. Sem as variáveis de ambiente, `enabled` é falso
 * e o Inbox continua funcionando como antes — releitura a cada 12s e a
 * chamada só marcando o tempo. Mesma regra do `DATABASE_URL` e do
 * `BLOB_READ_WRITE_TOKEN`: a ausência degrada, não quebra.
 *
 * As chaves ficam só aqui. A do Ably é a chave-raiz da conta (dá para tudo),
 * então o navegador nunca a vê: ele recebe um token assinado, com permissão
 * só para os canais das conversas dele (ver `channels.ts`).
 */

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function ablyEnabled(): boolean {
  return !!env("ABLY_API_KEY");
}

export function livekitEnabled(): boolean {
  return !!(env("LIVEKIT_URL") && env("LIVEKIT_API_KEY") && env("LIVEKIT_API_SECRET"));
}

/**
 * O pedido de token do Ably para quem abriu o app: identidade é o id do
 * membro (não a conta), e a permissão é a das conversas que ele tem.
 */
export async function ablyTokenRequest(
  scope: AgencyScope,
  memberId: string,
  conversationIds: string[],
) {
  const key = env("ABLY_API_KEY");
  if (!key) return undefined;
  const { Rest } = await import("ably");
  const rest = new Rest({ key });
  return rest.auth.createTokenRequest({
    clientId: memberId,
    capability: capabilityFor(scope.agencyId, conversationIds, memberId),
    // Curto de propósito: a permissão envelhece junto com a lista de
    // conversas, e o cliente renova sozinho pelo authUrl.
    ttl: 60 * 60 * 1000,
  });
}

/** Teto para o empurrão do tempo real — ver a nota dentro da função. */
const PUBLISH_TIMEOUT_MS = 2000;

/**
 * Avisa quem está com a conversa aberta. Chamado **depois** da gravação, e
 * nunca no lugar dela: o tempo real é entrega, não é a verdade. Se o Ably
 * estiver fora do ar, a mensagem já está salva e a releitura a mostra.
 */
export async function publishToConversation(
  scope: AgencyScope,
  conversationId: string,
  event: RealtimeEvent,
): Promise<void> {
  await publish([conversationChannel(scope.agencyId, conversationId)], event);
}

/**
 * Avisa cada pessoa, no canal dela, que a lista de conversas dela mudou (um
 * grupo novo, ou ela entrou num). Mesmas regras do aviso da conversa: depois
 * de gravar, com teto de tempo, e falhar aqui não desfaz nada.
 */
export async function notifyMembers(
  scope: AgencyScope,
  memberIds: string[],
  conversationId: string,
): Promise<void> {
  if (memberIds.length === 0) return;
  await publish(
    memberIds.map((id) => memberChannel(scope.agencyId, id)),
    { tipo: "conversas", conversationId },
  );
}

async function publish(channels: string[], event: RealtimeEvent): Promise<void> {
  const key = env("ABLY_API_KEY");
  if (!key) return;
  try {
    const { Rest } = await import("ably");
    const rest = new Rest({ key });
    const enviar = Promise.all(
      channels.map((c) => rest.channels.get(c).publish(event.tipo, event)),
    );
    /*
     * Com teto de tempo. A mensagem já está gravada quando chegamos aqui: um
     * provedor lento não pode segurar a resposta de quem apertou enviar —
     * isso transformaria um aviso que se perde num envio que trava. Quem não
     * recebeu o empurrão descobre na releitura seguinte.
     */
    await Promise.race([
      enviar,
      new Promise((resolve) => setTimeout(resolve, PUBLISH_TIMEOUT_MS)),
    ]);
  } catch {
    // Publicar é o melhor esforço. Falhar aqui não pode derrubar a resposta
    // de uma escrita que já aconteceu.
  }
}

/** O crachá da chamada: sala da conversa, identidade do membro, 2h de validade. */
export async function livekitToken(
  scope: AgencyScope,
  conversationId: string,
  member: { id: string; name: string },
): Promise<{ url: string; token: string; room: string } | undefined> {
  const url = env("LIVEKIT_URL");
  const apiKey = env("LIVEKIT_API_KEY");
  const apiSecret = env("LIVEKIT_API_SECRET");
  if (!url || !apiKey || !apiSecret) return undefined;

  const { AccessToken } = await import("livekit-server-sdk");
  const room = callRoom(scope.agencyId, conversationId);
  const at = new AccessToken(apiKey, apiSecret, {
    identity: member.id,
    name: member.name,
    ttl: "2h",
  });
  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    // Sem isso não existe "mudo" que o outro lado enxergue, nem qualquer
    // sinal leve trocado dentro da chamada.
    canPublishData: true,
  });
  return { url, token: await at.toJwt(), room };
}

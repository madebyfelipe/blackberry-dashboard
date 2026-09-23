import "server-only";
import { after } from "next/server";
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

/*
 * A chave existe, mas pode? Uma chave do Ably criada só com "Subscribe" (foi
 * o caso em produção, 2026-09-23) deixava o app achando que o tempo real
 * estava ligado: o servidor não conseguia publicar ("Unauthorized to
 * publish", 40160), o navegador não entrava na presença, e o Inbox relaxava
 * a releitura para 60s — mensagem demorando um minuto e o status de todo
 * mundo sumindo um segundo depois de abrir a tela.
 *
 * Então, antes de dizer "tempo real ligado", o servidor pergunta ao Ably o
 * que a chave concede: um crachá pedindo publish + presence + subscribe num
 * canal de teste. Faltou alguma, o tempo real conta como desligado (o app
 * volta à releitura de 12s e ao status gravado) e o log diz o que ligar.
 * O resultado fica guardado 10 min por instância: consertar a chave no
 * painel religa sozinho, sem deploy.
 */
let ablyCheck: { ok: boolean; at: number } | null = null;
const ABLY_CHECK_MS = 10 * 60_000;

export async function ablyReady(): Promise<boolean> {
  const key = env("ABLY_API_KEY");
  if (!key) return false;
  if (ablyCheck && Date.now() - ablyCheck.at < ABLY_CHECK_MS) return ablyCheck.ok;
  try {
    const client = await rest(key);
    const token = await client.auth.requestToken({
      clientId: "bb-verificacao",
      capability: { "bb:verificacao": ["publish", "presence", "subscribe"] },
    });
    const granted = JSON.parse(String(token.capability ?? "{}"))["bb:verificacao"] ?? [];
    const ok = ["publish", "presence", "subscribe"].every((op) => granted.includes(op) || granted.includes("*"));
    if (!ok) {
      console.error(
        "[realtime] ABLY_API_KEY sem permissão suficiente (concede: " +
          JSON.stringify(granted) +
          "). No painel do Ably, ligue Publish, Subscribe e Presence na chave. Até lá o app usa a releitura periódica.",
      );
    }
    ablyCheck = { ok, at: Date.now() };
    return ok;
  } catch (err) {
    console.error("[realtime] não deu para conferir a chave do Ably", err);
    ablyCheck = { ok: false, at: Date.now() };
    return false;
  }
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

/** Um cliente REST por instância: a Fluid Compute reaproveita a função entre pedidos. */
let restClient: Promise<import("ably").Rest> | undefined;
function rest(key: string) {
  restClient ??= import("ably").then(({ Rest }) => new Rest({ key }));
  return restClient;
}

/*
 * O empurrão sai **depois** da resposta, pelo `after()` do Next.
 *
 * Antes ele corria contra um teto de 2s dentro da própria requisição. Numa
 * função fria da Vercel, carregar a biblioteca do Ably e abrir a conexão
 * passa disso com folga: o teto vencia, a resposta ia embora, a função
 * congelava e o aviso morria no meio — quem estava do outro lado só via a
 * mensagem na releitura de 60s, e o "tempo real" parecia desligado. Com o
 * `after()` a plataforma segura a função viva até o aviso sair, e quem
 * apertou enviar continua sem esperar por ele.
 */
async function publish(channels: string[], event: RealtimeEvent): Promise<void> {
  const key = env("ABLY_API_KEY");
  if (!key) return;
  const enviar = async () => {
    try {
      const client = await rest(key);
      await Promise.all(
        channels.map((c) => client.channels.get(c).publish(event.tipo, event)),
      );
    } catch (err) {
      // Melhor esforço — a escrita já aconteceu. Mas no log, não em silêncio:
      // era esse silêncio que escondia o tempo real parado.
      restClient = undefined;
      console.error("[realtime] publicar falhou", channels, err);
    }
  };
  try {
    after(enviar);
  } catch {
    // Fora de uma requisição (script, teste): manda na hora.
    await enviar();
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

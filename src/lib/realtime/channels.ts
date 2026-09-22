import type { AgencyId } from "@/lib/agency/types";

/*
 * Os nomes dos canais e das salas do tempo real, e a permissão que cada
 * pessoa recebe neles.
 *
 * Tudo aqui é função pura, e é de propósito: é a régua que decide **quem
 * consegue ouvir o quê**. Um canal com nome errado (ou uma permissão com
 * curinga a mais) vaza conversa de um time para outro sem erro nenhum
 * aparecer na tela — então isso fica num lugar só, testado em
 * `tests/realtime-channels.test.ts`, e não espalhado por rota.
 *
 * O prefixo `bb:` existe porque a conta do Ably pode um dia servir outra
 * coisa; a agência vem logo depois porque toda separação do produto começa
 * por ela.
 */

/**
 * As permissões que um canal aceita — o mesmo vocabulário do Ably, escrito
 * aqui para a régua não depender do tipo de uma biblioteca.
 */
export type ChannelOp = "subscribe" | "publish" | "presence";

/** Canal de presença da agência: quem está com o app aberto, e como. */
export function presenceChannel(agencyId: AgencyId): string {
  return `bb:${agencyId}:presenca`;
}

/** Canal de uma conversa: mensagem nova e início/fim de chamada. */
export function conversationChannel(
  agencyId: AgencyId,
  conversationId: string,
): string {
  return `bb:${agencyId}:conversa:${conversationId}`;
}

/** Sala da chamada no LiveKit. Não é segredo — quem autoriza é o token. */
export function callRoom(agencyId: AgencyId, conversationId: string): string {
  return `bb-${agencyId}-${conversationId}`;
}

/**
 * A permissão do token do Ably, montada a partir das conversas de que a
 * pessoa participa.
 *
 * Duas decisões que não são detalhe:
 *
 * - **Nada de curinga.** `conversa:*` seria uma linha mais curta e deixaria
 *   qualquer pessoa da agência ouvir qualquer conversa dela — inclusive as
 *   que não são dela. Os ids entram um por um.
 * - **Ninguém publica.** No canal da conversa a pessoa só assina; quem
 *   publica é o servidor, depois de gravar. Assim não existe caminho para
 *   forjar mensagem de outra pessoa pelo tempo real.
 */
export function capabilityFor(
  agencyId: AgencyId,
  conversationIds: string[],
): Record<string, ChannelOp[]> {
  const capability: Record<string, ChannelOp[]> = {
    // Presença é o único lugar em que o navegador escreve: ele anuncia a si
    // mesmo. O que ele anuncia (o status) é dele por definição.
    [presenceChannel(agencyId)]: ["subscribe", "presence"],
  };
  for (const id of conversationIds) {
    capability[conversationChannel(agencyId, id)] = ["subscribe"];
  }
  return capability;
}

/** Os eventos que o servidor publica no canal de uma conversa. */
export type RealtimeEvent =
  | { tipo: "mensagem"; conversationId: string }
  | { tipo: "chamada"; conversationId: string; memberIds: string[] };

import type { AgencyId } from "@/lib/agency/types";
import { callRoom } from "./channels";

/*
 * Quanto tempo vale um crachá do tempo real, e como tirá-lo de quem saiu do
 * time (issue #94).
 *
 * Arquivar tira o acesso às telas na hora (`memberAccess`), e com ele a
 * renovação dos crachás — a rota do token e a de entrar na chamada passam
 * pela mesma trava. Mas o crachá que já estava na mão continuava valendo até
 * vencer: uma hora de eventos do Ably e duas de reentrada no LiveKit. Duas
 * defesas, uma em cima da outra:
 *
 * - **Revogar na hora.** O token do Ably pelo `clientId` (o id do membro) e a
 *   pessoa tirada de toda sala do LiveKit em que estiver.
 * - **Crachá curto.** Se a revogação falhar — Ably fora do ar, chave sem
 *   "Revocable tokens" —, o que sobra de janela é o TTL daqui.
 *
 * Fica fora de `server.ts` (que é `server-only`) para os testes exercitarem
 * a regra com clientes de mentira: quem chama entrega os clientes de
 * verdade, ou nenhum quando a variável de ambiente não existe.
 */

/**
 * Validade do token do Ably. O cliente renova sozinho pelo `authUrl` antes de
 * vencer, então encurtar custa só uma ida à rota do token a cada 10 min.
 */
export const ABLY_TOKEN_TTL_MS = 10 * 60_000;

/**
 * Validade do crachá do LiveKit (formato do `AccessToken`). Ele só é
 * conferido na entrada: quem já está na sala segue com os crachás que o
 * próprio LiveKit renova. É a janela de reentrada de quem foi tirado.
 */
export const LIVEKIT_TOKEN_TTL = "10m";

/** O pedaço do cliente REST do Ably que a revogação usa. */
export type AblyRevoker = {
  revokeTokens(specifiers: { type: string; value: string }[]): Promise<unknown>;
};

/** O pedaço do `RoomServiceClient` do LiveKit que a revogação usa. */
export type LivekitRooms = {
  listRooms(names?: string[]): Promise<{ name: string }[]>;
  removeParticipant(room: string, identity: string): Promise<void>;
};

export type RevokeResult = {
  /** O Ably aceitou a revogação. `false` sem Ably ou quando falhou. */
  ably: boolean;
  /** As salas de onde a pessoa saiu. */
  rooms: string[];
  /** O que deu errado, para o log — revogar é melhor esforço. */
  errors: string[];
};

/**
 * Tira alguém do tempo real agora: revoga o token do Ably e remove a pessoa
 * das salas das conversas dela que estão abertas no LiveKit. Nunca lança — o
 * arquivamento já foi gravado, e o TTL curto cobre o que falhar aqui.
 */
export async function revokeMember(
  clients: { ably?: AblyRevoker; livekit?: LivekitRooms },
  agencyId: AgencyId,
  memberId: string,
  conversationIds: string[],
): Promise<RevokeResult> {
  const result: RevokeResult = { ably: false, rooms: [], errors: [] };

  const ably = async () => {
    if (!clients.ably) return;
    try {
      const res = (await clients.ably.revokeTokens([{ type: "clientId", value: memberId }])) as
        | { failureCount?: number; results?: { error?: { message?: string } }[] }
        | undefined;
      if (res?.failureCount) {
        const why = res.results?.find((r) => r.error)?.error?.message ?? "sem detalhe";
        result.errors.push(`ably: ${why}`);
        return;
      }
      result.ably = true;
    } catch (err) {
      result.errors.push(`ably: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const livekit = async () => {
    const lk = clients.livekit;
    if (!lk || conversationIds.length === 0) return;
    try {
      // Só as salas que existem agora: sala de conversa sem chamada não há.
      const wanted = conversationIds.map((id) => callRoom(agencyId, id));
      const open = await lk.listRooms(wanted);
      await Promise.all(
        open
          .filter((r) => wanted.includes(r.name))
          .map(async (r) => {
            try {
              await lk.removeParticipant(r.name, memberId);
              result.rooms.push(r.name);
            } catch {
              // A sala está aberta, mas a pessoa não está nela — nada a tirar.
            }
          }),
      );
    } catch (err) {
      result.errors.push(`livekit: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  await Promise.all([ably(), livekit()]);
  return result;
}

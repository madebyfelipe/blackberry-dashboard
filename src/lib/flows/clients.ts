import { setFlowClients } from "@/lib/clients/repository";
import { setPendingClients } from "./repository";
import type { AgencyScope } from "@/lib/agency/types";
import type { Flow } from "./types";
import { isFlowReady } from "./view";

/*
 * Os "Clientes específicos" de um fluxo, gravados pelo Novo fluxo e pelo
 * Editar. Fica fora dos dois repositórios porque costura os dois (fluxo e
 * cliente), como o motor em `automation.ts`.
 *
 * Cliente fica em um fluxo só: entrar neste o tira do fluxo em que estava.
 * Isso só pode acontecer quando este estiver pronto para receber trabalho
 * (`isFlowReady`: ativo e com etapa ligada). Antes disso — rascunho, inativo,
 * "Começar do zero" ainda sem etapa — a lista fica guardada no fluxo
 * (`pendingClientIds`) e ninguém sai de onde está; o criativo desses clientes
 * continua indo para o fluxo de antes. No dia em que o fluxo fica pronto
 * (ativado, ou ganhando a primeira etapa), a lista guardada é aplicada.
 */

/**
 * Chamada depois de cada gravação do fluxo. `clientIds` é a lista que a tela
 * mandou; ausente, a tela não mexeu nela — só a lista guardada, se houver,
 * é aplicada quando o fluxo acabou de ficar pronto. Devolve o fluxo como
 * ficou.
 */
export async function syncFlowClients(
  scope: AgencyScope,
  flow: Flow,
  clientIds?: string[],
): Promise<Flow> {
  if (!isFlowReady(flow)) {
    if (clientIds === undefined) return flow;
    return (await setPendingClients(scope, flow.id, clientIds)) ?? flow;
  }
  const wanted = clientIds ?? flow.pendingClientIds;
  if (wanted) await setFlowClients(scope, flow.id, wanted);
  if (flow.pendingClientIds === null) return flow;
  return (await setPendingClients(scope, flow.id, null)) ?? flow;
}

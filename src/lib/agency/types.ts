/*
 * A agência é o tenant do produto: toda tarefa e todo lote pertence a uma, e
 * nenhuma leitura ou escrita atravessa essa fronteira.
 *
 * Mora fora de `auth/` de propósito — tarefas e aprovação precisam do tipo sem
 * arrastar junto a camada de contas (e o `node:crypto` que vem com ela).
 */

/**
 * Id da agência. É `string` em tempo de execução, mas marcado no tipo: uma
 * string qualquer (query, corpo, header) não vira `AgencyId` sem um `as`
 * explícito — e um `as` é exatamente o que se quer enxergar numa revisão. Quem
 * produz um id legítimo são `agencyIdFromName`/`newAgencyId` (cadastro e
 * migração) e a sessão do servidor.
 */
export type AgencyId = string & { readonly __agency: unique symbol };

/**
 * O primeiro argumento obrigatório de toda função de repository. Nasce só da
 * sessão do servidor (`auth/session.ts`): é o que impede "listar tarefas" sem
 * dizer de qual agência, e o que impede a agência vir da requisição.
 *
 * `agencyId` é o que filtra. `agencyName` é só rótulo — o "quem" do histórico
 * das peças. Filtrar por nome seria um bug: o nome muda quando a agência se
 * renomeia, o id não.
 */
export type AgencyScope = {
  readonly agencyId: AgencyId;
  readonly agencyName: string;
};

/** A agência como entidade — a linha que vira tabela quando entrar o banco. */
export type Agency = {
  id: AgencyId;
  name: string;
};

import { createJsonStore } from "@/lib/store/json-file";
import { agencyIdFromName, LEGACY_AGENCY_NAME } from "@/lib/agency/id";
import type { User } from "./types";
import { seedUsers } from "./seed";

/*
 * Contas. Mesma mecânica dos outros stores (`lib/store/json-file.ts`) — e o
 * primeiro candidato a virar tabela quando entrar o multi-tenant.
 */

/**
 * Migração de leitura: contas gravadas antes de existir `passwordVersion`
 * entram na versão 1, que é a inicial de todo usuário. Sem isso, um arquivo
 * antigo deixaria o campo `undefined` e nenhuma sessão bateria.
 *
 * O `agencyId` segue a mesma ideia: conta anterior ao multi-tenant só tem o
 * nome da agência, e o id sai do slug desse nome — determinístico, então toda
 * leitura chega no mesmo tenant sem precisar gravar nada antes. A conta
 * semeada ("Estúdio Norte") cai exatamente no id para onde vão as tarefas e os
 * lotes antigos.
 */
function normalize(raw: User): User {
  return {
    ...raw,
    passwordVersion:
      typeof raw.passwordVersion === "number" ? raw.passwordVersion : 1,
    agencyId: raw.agencyId ?? agencyIdFromName(raw.agency || LEGACY_AGENCY_NAME),
  };
}

const store = createJsonStore<User[]>({
  file: "users.json",
  seed: seedUsers,
  revive: (raw) => (raw as User[]).map(normalize),
});

export const read = store.read;
export const transaction = store.transaction;

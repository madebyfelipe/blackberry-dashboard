import { agencyIdFromName, agencyScope } from "../../src/lib/agency/id";
import type { AgencyScope } from "../../src/lib/agency/types";

/*
 * Escopos de agência para os testes.
 *
 * No app um `AgencyScope` só nasce da sessão do servidor. Aqui ele é montado
 * na mão de propósito: é o teste fazendo o papel das duas pontas para provar
 * que uma não enxerga nem altera o que é da outra.
 */
export function escopo(nome: string): AgencyScope {
  return agencyScope({ agencyId: agencyIdFromName(nome), agency: nome });
}

/** As duas agências do teste de isolamento. */
export const AGENCIA_A = escopo("Agência A");
export const AGENCIA_B = escopo("Agência B");

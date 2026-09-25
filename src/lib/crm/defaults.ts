import type { AgencyId } from "@/lib/agency/types";
import type { ClientAccount, Contract } from "./types";

/** Contrato de quem ainda não preencheu nada. */
export const NO_CONTRACT: Contract = {
  startDate: null,
  fidelityMonths: null,
  cycle: "mensal",
  adjustmentIndex: "",
};

/** A ficha em branco — o que um cliente sem conta gravada mostra. */
export function blankAccount(agencyId: AgencyId, clientId: string): ClientAccount {
  return {
    clientId,
    agencyId,
    contract: { ...NO_CONTRACT },
    payment: null,
    services: [],
    invoices: [],
    files: [],
    events: [],
  };
}

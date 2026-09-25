import { createStore } from "@/lib/store";
import { normalizeAgencySettings, type AgencySettings } from "./settings";

/*
 * Os ajustes de cada agência, por `agencyId`. Mesma cadeia das outras áreas:
 * a tela fala com `repository.ts`, que fala só com este arquivo, e
 * `lib/store/index.ts` escolhe Postgres ou arquivo por `DATABASE_URL`.
 *
 * Agência que nunca abriu a aba não tem linha aqui — o repositório devolve o
 * padrão (`DEFAULT_AGENCY_SETTINGS`), que não muda nada no produto.
 */

const store = createStore<Record<string, AgencySettings>>({
  file: "agency.json",
  seed: () => ({}),
  revive: (raw) => {
    const out: Record<string, AgencySettings> = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [agencyId, value] of Object.entries(raw as Record<string, unknown>)) {
        out[agencyId] = normalizeAgencySettings(value);
      }
    }
    return out;
  },
});

export const read = store.read;
export const transaction = store.transaction;

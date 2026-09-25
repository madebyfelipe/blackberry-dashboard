import type { AgencyScope } from "./types";
import { read, transaction } from "./store";
import {
  DEFAULT_AGENCY_SETTINGS,
  isMediaUrl,
  normalizeClientDefaults,
  AgencySettingsError,
  type AgencySettings,
} from "./settings";

/*
 * Leitura e gravação dos ajustes da agência. Quem pode gravar (Admin e
 * Gerente) é decidido na rota, pela função da pessoa no time — aqui só entra
 * o escopo da sessão, como em toda área.
 */

export { AgencySettingsError };

export async function getAgencySettings(scope: AgencyScope): Promise<AgencySettings> {
  return structuredClone((await read())[scope.agencyId] ?? DEFAULT_AGENCY_SETTINGS);
}

export type AgencySettingsPatch = {
  logoUrl?: string | null;
  clientDefaults?: unknown;
};

export async function updateAgencySettings(
  scope: AgencyScope,
  patch: AgencySettingsPatch,
): Promise<AgencySettings> {
  if (patch.logoUrl !== undefined && patch.logoUrl !== null && !isMediaUrl(patch.logoUrl)) {
    throw new AgencySettingsError("Logo inválido.");
  }
  // Valida antes de abrir a transação: valor ruim não chega a gravar nada.
  const clientDefaults =
    patch.clientDefaults === undefined ? undefined : normalizeClientDefaults(patch.clientDefaults, true);
  return transaction((all) => {
    const current = all[scope.agencyId] ?? structuredClone(DEFAULT_AGENCY_SETTINGS);
    if (patch.logoUrl !== undefined) current.logoUrl = patch.logoUrl;
    if (clientDefaults) current.clientDefaults = clientDefaults;
    all[scope.agencyId] = current;
    return structuredClone(current);
  });
}

/** Tira a agência inteira daqui — parte de "Excluir agência". */
export async function dropAgencySettings(agencyId: string): Promise<void> {
  await transaction((all) => {
    delete all[agencyId];
  });
}

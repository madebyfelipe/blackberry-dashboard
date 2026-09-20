import type { AgencyId, AgencyScope } from "./types";

/*
 * De onde vem o id da agência.
 *
 * O nome da agência (`user.agency`) sempre existiu como texto livre. O id sai
 * dele por um slug — sem acento, sem pontuação — porque a migração dos dados
 * já gravados precisa chegar ao mesmo id em toda leitura, sem guardar estado à
 * parte e sem depender da ordem em que os arquivos são lidos.
 *
 * O id nasce do nome, mas não é o nome: depois de gravado ele não muda mais.
 * `updateProfile` renomeia a agência sem tocar no `agencyId` — se mudasse, a
 * agência trocaria de tenant ao se renomear e todo o trabalho dela sumiria da
 * tela.
 */

/**
 * Agência do usuário semeado (README: `felipe@blackberry.app`). É para cá que
 * a migração manda tarefas e lotes gravados antes do multi-tenant: dado antigo
 * não pode sumir nem cair no colo de outra agência.
 */
export const LEGACY_AGENCY_NAME = "Estúdio Norte";

/** Slug estável do nome: "Estúdio Norte" → "estudio-norte". */
export function agencyIdFromName(name: string): AgencyId {
  const slug = (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return (slug || "agencia") as AgencyId;
}

/** Id da agência do usuário semeado — o destino da migração. */
export const LEGACY_AGENCY_ID = agencyIdFromName(LEGACY_AGENCY_NAME);

/**
 * Id de uma agência nova (cadastro): slug + sufixo aleatório.
 *
 * O slug é para o id continuar legível dentro dos dados. O sufixo existe
 * porque ainda não há convite de equipe: sem ele, bastaria digitar "Estúdio
 * Norte" no cadastro para cair dentro do tenant do Estúdio Norte. Entrar numa
 * agência existente vai ser um convite, não uma coincidência de nome.
 */
export function newAgencyId(name: string): AgencyId {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${agencyIdFromName(name)}-${suffix}` as AgencyId;
}

/**
 * Migração de leitura dos stores: registro sem `agencyId` é registro de antes
 * do multi-tenant, e antes do multi-tenant só existia a agência semeada.
 */
export function agencyIdOrLegacy(value: unknown): AgencyId {
  return typeof value === "string" && value !== ""
    ? (value as AgencyId)
    : LEGACY_AGENCY_ID;
}

/**
 * Escopo a partir da conta logada. Recebe a forma mínima (e não `PublicUser`)
 * para este módulo não depender da camada de contas.
 */
export function agencyScope(user: {
  agencyId: AgencyId;
  agency: string;
}): AgencyScope {
  return { agencyId: user.agencyId, agencyName: user.agency };
}

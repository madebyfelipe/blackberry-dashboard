/**
 * Salvaram algo do próprio perfil (Configurações, menu da conta): o `detail`
 * traz o que mudou — `{ notify?, presence?, photoUrl? }`. O notificador, a
 * lateral e o tempo real aplicam na hora, sem esperar a página recarregar.
 *
 * Mora sozinho para não criar ciclo de import entre quem avisa e quem ouve.
 */
export const PROFILE_CHANGED = "bb:perfil-mudou";

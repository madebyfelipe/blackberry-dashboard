import type { Conversation } from "./types";

/*
 * Quem está de fato na chamada — a régua, em funções puras.
 *
 * Quem está numa chamada avisa o servidor a cada `CALL_HEARTBEAT_MS` ("ainda
 * estou aqui"). Quem para de avisar por mais de `CALL_MEMBER_STALE_MS` saiu,
 * tenha apertado encerrar ou não: navegador que trava, bateria que acaba e
 * rede que cai não mandam despedida nenhuma. Antes a regra era um prazo fixo
 * (4h desde o início), que ao mesmo tempo prendia o fantasma por horas e
 * apagava a chamada de verdade que passasse disso.
 *
 * A duração que vai para o histórico, quando a chamada fecha sozinha, conta
 * até o último sinal de vida — não até o instante em que alguém notou.
 */

export type CallState = NonNullable<Conversation["call"]>;

/** De quanto em quanto tempo quem está na chamada avisa que continua. */
export const CALL_HEARTBEAT_MS = 30_000;

/**
 * Silêncio que conta como saída. Quatro avisos perdidos: folga para aba em
 * segundo plano (o Chrome segura timers de aba escondida) e rede instável.
 */
export const CALL_MEMBER_STALE_MS = 2 * 60_000;

/** Teto do que uma chamada registra — 8h é jornada, não conversa. */
export const CALL_MAX_SECONDS = 8 * 60 * 60;

function lastSeen(call: CallState, memberId: string): number {
  const seen = Date.parse(call.seenAt[memberId] ?? "");
  if (!Number.isNaN(seen)) return seen;
  const started = Date.parse(call.startedAt);
  return Number.isNaN(started) ? 0 : started;
}

/** Quem deu sinal de vida recentemente. */
export function activeCallMembers(call: CallState | null, now: number): string[] {
  if (!call) return [];
  return call.memberIds.filter((id) => now - lastSeen(call, id) <= CALL_MEMBER_STALE_MS);
}

function secondsBetween(fromIso: string, to: number): number {
  const from = Date.parse(fromIso);
  if (Number.isNaN(from)) return 0;
  return Math.min(CALL_MAX_SECONDS, Math.max(0, Math.round((to - from) / 1000)));
}

export type Settled = {
  /** A chamada depois da limpeza — `null` quando não sobrou ninguém. */
  call: CallState | null;
  /** Preenchido quando a limpeza fechou a chamada: vira a linha do histórico. */
  ended?: { startedBy: string; seconds: number };
  /** Algo mudou e precisa ser gravado. */
  changed: boolean;
};

/**
 * Tira da chamada quem sumiu. Se ninguém sobrou, a chamada fecha, com a
 * duração medida até o último sinal de vida de quem ficou por último.
 */
export function settleCall(call: CallState | null, now: number): Settled {
  if (!call) return { call: null, changed: false };
  const active = activeCallMembers(call, now);
  if (active.length === call.memberIds.length) return { call, changed: false };

  if (active.length === 0) {
    const last = Math.max(...call.memberIds.map((id) => lastSeen(call, id)));
    return {
      call: null,
      ended: { startedBy: call.startedBy, seconds: secondsBetween(call.startedAt, last) },
      changed: true,
    };
  }

  const seenAt: Record<string, string> = {};
  for (const id of active) if (call.seenAt[id]) seenAt[id] = call.seenAt[id];
  return { call: { ...call, memberIds: active, seenAt }, changed: true };
}

/** Entra (ou continua) na chamada; abre uma se não houver. */
export function joinedCall(
  call: CallState | null,
  memberId: string,
  now: number,
): CallState {
  const iso = new Date(now).toISOString();
  if (!call) {
    return { startedBy: memberId, startedAt: iso, memberIds: [memberId], seenAt: { [memberId]: iso } };
  }
  return {
    ...call,
    memberIds: call.memberIds.includes(memberId) ? call.memberIds : [...call.memberIds, memberId],
    seenAt: { ...call.seenAt, [memberId]: iso },
  };
}

/**
 * Sai da chamada. A última pessoa a sair fecha, e a duração vai de ponta a
 * ponta — é uma chamada só, e o histórico conta uma coisa só.
 */
export function leftCall(call: CallState, memberId: string, now: number): Settled {
  const memberIds = call.memberIds.filter((id) => id !== memberId);
  if (memberIds.length === call.memberIds.length) return { call, changed: false };
  if (memberIds.length === 0) {
    return {
      call: null,
      ended: { startedBy: call.startedBy, seconds: secondsBetween(call.startedAt, now) },
      changed: true,
    };
  }
  const seenAt = { ...call.seenAt };
  delete seenAt[memberId];
  return { call: { ...call, memberIds, seenAt }, changed: true };
}

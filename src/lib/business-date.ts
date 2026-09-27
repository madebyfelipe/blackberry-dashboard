/*
 * O "hoje" da operação é o de Brasília, não o do servidor.
 *
 * O servidor roda em UTC; a agência trabalha em horário de Brasília (UTC-3).
 * Entre 21h e meia-noite daqui, em UTC já é o dia seguinte — e, no último dia
 * do mês, o mês seguinte. Por isso toda conta de negócio que depende do dia —
 * o mês das entregas, a competência da fatura, o dia útil do prazo — tira
 * dia/mês/ano daqui, nunca do `getDate()` cru do `Date`, que responde no fuso
 * de quem roda o código. Funciona igual no servidor e no navegador.
 *
 * Exibição de data na tela é outra conversa (ver `lib/format.ts`).
 */

export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** O dia do calendário em Brasília no instante `at`. `month` vai de 1 a 12; `weekday`, 0 = domingo. */
export type BusinessDay = { year: number; month: number; day: number; weekday: number };

export function businessDay(at: Date = new Date()): BusinessDay {
  const parts: Record<string, number> = {};
  for (const p of PARTS.formatToParts(at)) {
    if (p.type === "year" || p.type === "month" || p.type === "day") parts[p.type] = Number(p.value);
  }
  const { year, month, day } = parts;
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

/**
 * O dia de hoje em Brasília como `Date` à meia-noite **local** — para as
 * réguas que leem `getFullYear`/`getMonth`/`getDate` (as de `crm/view.ts`):
 * elas passam a enxergar o dia de Brasília seja qual for o fuso do processo.
 * Serve para conta de calendário, não como instante (`createdAt` continua
 * sendo o `now` de verdade).
 */
export function businessToday(at: Date = new Date()): Date {
  const { year, month, day } = businessDay(at);
  return new Date(year, month - 1, day);
}

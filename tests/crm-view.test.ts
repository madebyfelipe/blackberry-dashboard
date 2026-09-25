import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  activityTime,
  buildActivities,
  clientCode,
  clientHealth,
  formatDuration,
  formatMoney,
  formatMoneyCompact,
  groupActivities,
  invoiceBadge,
  invoicesCsv,
  monthDeliveries,
  monthlyTotal,
  monthsAsClient,
  monthSummary,
  mrrDelta,
  nextAdjustment,
  nextBillingDate,
  nextDelivery,
  nextInvoice,
  openInvoices,
  parseMoney,
  receivedInYear,
  relativeAgo,
  renewalDate,
  serviceProgress,
  upcomingEvents,
  type ActivityBatch,
  type ActivityTask,
} from "../src/lib/crm/view";
import type { ClientService, Contract, Invoice } from "../src/lib/crm/types";

/*
 * A régua da ficha do cliente (export "Clientes · Detalhe"): dinheiro em
 * centavos, datas no calendário de quem olha, e os números dos cartões.
 * Um erro aqui mostra cobrança errada para o cliente — sem erro na tela.
 */

// 25 set 2026, 10h (sexta) — o "hoje" de todos os testes.
const NOW = new Date(2026, 8, 25, 10, 0);

function svc(over: Partial<ClientService> = {}): ClientService {
  return {
    id: "s",
    name: "Serviço",
    kind: "instagram",
    scope: "",
    responsibleId: null,
    monthlyValue: 100000,
    status: "ativo",
    quota: null,
    unit: "",
    delivered: 0,
    deliveredMonth: "2026-09",
    stage: "",
    createdAt: "",
    ...over,
  };
}

function inv(over: Partial<Invoice> = {}): Invoice {
  return {
    id: "i",
    competence: "2026-09",
    dueDate: "2026-09-05",
    amount: 850000,
    method: "pix",
    status: "pago",
    paidAt: "2026-09-04T14:00:00.000Z",
    createdAt: "2026-08-25T12:00:00.000Z",
    ...over,
  };
}

const contract = (over: Partial<Contract> = {}): Contract => ({
  startDate: "2025-01-01",
  fidelityMonths: 12,
  cycle: "mensal",
  adjustmentIndex: "IPCA",
  ...over,
});

describe("dinheiro", () => {
  test("formata sem centavo quando não há", () => {
    assert.equal(formatMoney(850000), "R$ 8.500");
    assert.equal(formatMoney(850050), "R$ 8.500,50");
    assert.equal(formatMoney(0), "R$ 0");
  });

  test("LTV compacto", () => {
    assert.equal(formatMoneyCompact(17850000), "R$ 179k");
    assert.equal(formatMoneyCompact(150000000), "R$ 1,5 mi");
    assert.equal(formatMoneyCompact(500000), "R$ 5.000");
  });

  test("lê o que a pessoa digita", () => {
    assert.equal(parseMoney("3200"), 320000);
    assert.equal(parseMoney("3.200"), 320000);
    assert.equal(parseMoney("3.200,50"), 320050);
    assert.equal(parseMoney("R$ 800"), 80000);
    assert.equal(parseMoney("12.5"), 1250);
    assert.equal(parseMoney("abc"), null);
    assert.equal(parseMoney(""), null);
  });
});

describe("serviços", () => {
  test("pausado não entra no total", () => {
    const list = [svc({ monthlyValue: 320000 }), svc({ monthlyValue: 80000, status: "setup" }), svc({ monthlyValue: 99900, status: "pausado" })];
    assert.equal(monthlyTotal(list), 400000);
  });

  test("progresso com meta conta só o mês corrente", () => {
    const s = svc({ quota: 12, unit: "posts", delivered: 10 });
    assert.deepEqual(serviceProgress(s, NOW), { label: "10/12 posts", ratio: 10 / 12 });
    assert.equal(serviceProgress({ ...s, deliveredMonth: "2026-08" }, NOW).label, "0/12 posts", "virou o mês: zera");
  });

  test("sem meta: a situação, e a barra pelo status", () => {
    assert.deepEqual(serviceProgress(svc({ stage: "Em veiculação" }), NOW), { label: "Em veiculação", ratio: 1 });
    assert.equal(serviceProgress(svc({ status: "setup" }), NOW).ratio, 0.5);
    assert.equal(serviceProgress(svc({ status: "pausado" }), NOW).ratio, 0);
  });

  test("entregas do mês somam só serviço faturado com meta", () => {
    const list = [
      svc({ quota: 12, delivered: 10 }),
      svc({ quota: 4, delivered: 9 }), // acima da meta conta até a meta
      svc({ quota: 5, delivered: 5, status: "pausado" }),
      svc({ quota: null }),
    ];
    assert.deepEqual(monthDeliveries(list, NOW), { done: 14, total: 16 });
  });
});

describe("faturas", () => {
  test("selo: paga, a vencer, atrasada", () => {
    assert.equal(invoiceBadge(inv(), NOW), "pago");
    assert.equal(invoiceBadge(inv({ status: "aberto", paidAt: null, dueDate: "2026-09-25" }), NOW), "a-vencer", "vence hoje ainda não atrasou");
    assert.equal(invoiceBadge(inv({ status: "aberto", paidAt: null, dueDate: "2026-09-24" }), NOW), "atrasado");
  });

  test("em aberto e recebido no ano", () => {
    const list = [
      inv(),
      inv({ id: "a", status: "aberto", paidAt: null, dueDate: "2026-09-01", amount: 1000 }),
      inv({ id: "b", status: "aberto", paidAt: null, dueDate: "2026-10-05", amount: 2000 }),
      inv({ id: "c", paidAt: "2025-12-04T12:00:00.000Z" }),
    ];
    assert.deepEqual(openInvoices(list, NOW), { cents: 3000, count: 2, overdue: 1 });
    assert.deepEqual(receivedInYear(list, 2026), { cents: 850000, count: 1 });
  });

  test("variação contra a fatura do mês passado", () => {
    assert.equal(mrrDelta(950000, [inv({ competence: "2026-08", amount: 850000 })], NOW), 12);
    assert.equal(mrrDelta(850000, [inv({ competence: "2026-07" })], NOW), null, "sem fatura de agosto, sem comparação");
  });

  test("próxima cobrança pelo dia do faturamento", () => {
    assert.equal(nextBillingDate(5, NOW)?.toDateString(), new Date(2026, 9, 5).toDateString());
    assert.equal(nextBillingDate(25, NOW)?.toDateString(), new Date(2026, 8, 25).toDateString(), "hoje conta");
    assert.equal(nextBillingDate(31, new Date(2026, 1, 10))?.getDate(), 28, "fevereiro não tem 31");
    assert.equal(nextBillingDate(null, NOW), null);
  });

  test("próxima fatura: a aberta, ou a que o 'Gerar cobrança' criaria", () => {
    const open = inv({ id: "o", status: "aberto", paidAt: null, competence: "2026-10", dueDate: "2026-10-05" });
    assert.equal(nextInvoice([inv(), open], 900000, 5, NOW).existing?.id, "o");

    const projected = nextInvoice([inv()], 900000, 5, NOW);
    assert.equal(projected.existing, null);
    assert.equal(projected.competence, "2026-10");
    assert.equal(projected.amount, 900000);

    // Outubro já faturado (pago): a nova é novembro.
    const paidOct = inv({ competence: "2026-10", dueDate: "2026-10-05" });
    assert.equal(nextInvoice([paidOct], 900000, 5, NOW).competence, "2026-11");
  });

  test("CSV com ponto e vírgula e o status do dia", () => {
    const csv = invoicesCsv([inv(), inv({ id: "x", competence: "2026-10", dueDate: "2026-10-05", status: "aberto", paidAt: null })], NOW);
    const lines = csv.split("\n");
    assert.equal(lines[0], "Competência;Vencimento;Método;Valor;Status;Pago em");
    assert.equal(lines[1], "Outubro 2026;05/10/2026;Pix;8.500,00;A vencer;");
    assert.match(lines[2], /^Setembro 2026;05\/09\/2026;Pix;8\.500,00;Pago;\d{2}\/09\/2026$/);
  });
});

describe("contrato", () => {
  test("renova no próximo fim de fidelidade", () => {
    assert.equal(renewalDate(contract(), NOW)?.toDateString(), new Date(2027, 0, 1).toDateString());
    assert.equal(renewalDate(contract({ fidelityMonths: null }), NOW), null);
  });

  test("reajuste no próximo aniversário, só com índice", () => {
    assert.equal(nextAdjustment(contract(), NOW)?.getFullYear(), 2027);
    assert.equal(nextAdjustment(contract({ adjustmentIndex: "" }), NOW), null);
  });

  test("meses de relação contam o mês corrente", () => {
    assert.equal(monthsAsClient("2025-01-01T12:00:00", NOW), 21);
    assert.equal(monthsAsClient("2026-09-20T12:00:00", NOW), 1);
  });
});

describe("identidade e saúde", () => {
  test("código estável, da última palavra", () => {
    const a = clientCode({ id: "c05", name: "Clínica Aurora" });
    assert.match(a, /^AUR-\d{4}$/);
    assert.equal(clientCode({ id: "c05", name: "Clínica Aurora" }), a);
    assert.match(clientCode({ id: "x", name: "Óptica Lumen" }), /^LUM-/);
  });

  test("saúde rebaixa com fatura atrasada", () => {
    assert.deepEqual(clientHealth("ativo", 9.2, 0), { label: "Boa", tone: "good", sub: "NPS 9,2 · Sem pendências" });
    assert.equal(clientHealth("ativo", null, 2).label, "Atenção");
    assert.equal(clientHealth("ativo", null, 2).sub, "2 faturas atrasadas");
    assert.equal(clientHealth("risco", 5, 0).tone, "bad");
  });
});

describe("tempo", () => {
  test("há quanto tempo, no tom do export", () => {
    assert.equal(relativeAgo(new Date(2026, 8, 25, 8, 0).toISOString(), NOW), "há 2h");
    assert.equal(relativeAgo(new Date(2026, 8, 25, 9, 55).toISOString(), NOW), "há 5 min");
    assert.equal(relativeAgo(new Date(2026, 8, 24, 23, 0).toISOString(), NOW), "ontem");
    assert.equal(relativeAgo(new Date(2026, 8, 20).toISOString(), NOW), "5 dias");
    assert.equal(relativeAgo(new Date(2026, 8, 11).toISOString(), NOW), "2 sem");
    assert.equal(relativeAgo(new Date(2026, 0, 12).toISOString(), NOW), "12 jan");
    assert.equal(relativeAgo(new Date(2025, 0, 12).toISOString(), NOW), "12 jan 2025");
  });

  test("hora da atividade", () => {
    assert.equal(activityTime(new Date(2026, 8, 25, 9, 24).toISOString(), NOW), "09:24");
    assert.equal(activityTime(new Date(2026, 8, 21, 15, 0).toISOString(), NOW), "seg, 15:00");
    assert.equal(activityTime(new Date(2026, 7, 12, 10, 0).toISOString(), NOW), "12 ago, 10:00");
  });

  test("duração da resposta média", () => {
    assert.equal(formatDuration(2 * 3_600_000), "2h");
    assert.equal(formatDuration(35 * 60_000), "35min");
    assert.equal(formatDuration(28 * 3_600_000), "1d 4h");
    assert.equal(formatDuration(null), "—");
  });
});

describe("atividades", () => {
  const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).toISOString();
  const batch: ActivityBatch = {
    id: "b1",
    label: "Lote setembro",
    pieces: [1, 2, 3].map((n) => ({
      id: `p${n}`,
      name: `Post ${n}`,
      history: [
        { title: "Aprovada pelo cliente", who: "Helena · 25 set · 09:24", at: at(25, 9, 24) },
        { title: "Enviada para aprovação", who: "Estúdio · 24 set · 17:02", at: at(24, 17, 2) },
        // Evento antigo, sem data ISO: fica de fora.
        { title: "Peça criada no lote", who: "Estúdio · 09 set · 10:40" },
      ],
    })),
  };
  const task: ActivityTask = {
    id: "t1",
    title: "Campanha Dia dos Pais",
    status: "a-fazer",
    dueDate: null,
    completedAt: null,
    comments: [
      { id: "c1", author: "Marcos", text: "Podemos reforçar o CTA?", createdAt: at(23, 8, 10) },
      { id: "c2", author: "black berry", text: "Entrou no fluxo", createdAt: at(23, 8, 0) },
    ],
  };

  test("decisões em lote viram uma linha só, e a nota do fluxo fica de fora", () => {
    const list = buildActivities({
      batches: [batch],
      tasks: [task],
      account: { files: [], invoices: [inv({ paidAt: at(4, 11, 5) })], events: [] },
      now: NOW,
    });
    assert.deepEqual(
      list.map((a) => a.title),
      [
        "Aprovou 3 peças",
        "Enviou 3 peças para aprovação",
        "Comentou em Campanha Dia dos Pais",
        "Pagamento de setembro confirmado",
        "Cobrança de setembro gerada",
      ],
    );
    assert.equal(list[0].who, "Helena");
    assert.equal(list[0].body, "Lote setembro");
    assert.equal(list[2].body, "“Podemos reforçar o CTA?”");
  });

  test("evento futuro é agenda, não atividade", () => {
    const list = buildActivities({
      batches: [],
      tasks: [],
      account: {
        files: [],
        invoices: [],
        events: [
          { id: "e1", kind: "reuniao", title: "Passada", at: at(22, 15), place: "Online", createdBy: "F", createdAt: "" },
          { id: "e2", kind: "reuniao", title: "Futura", at: at(30, 15), place: "Online", createdBy: "F", createdAt: "" },
        ],
      },
      now: NOW,
    });
    assert.deepEqual(list.map((a) => a.title), ["Passada"]);
  });

  test("agrupa por hoje, ontem, semana, mês e antes", () => {
    const mk = (d: Date) => ({ id: d.toISOString(), kind: "arquivo" as const, title: "", body: "", who: "", at: d.toISOString() });
    const groups = groupActivities(
      [mk(new Date(2026, 8, 25, 9)), mk(new Date(2026, 8, 24, 9)), mk(new Date(2026, 8, 21)), mk(new Date(2026, 8, 2)), mk(new Date(2026, 7, 2))],
      NOW,
    );
    assert.deepEqual(groups.map((g) => g.label), ["Hoje", "Ontem", "Esta semana", "Este mês", "Antes"]);
  });

  test("resumo do mês: aprovação, resposta a ajuste e prazo", () => {
    const withAdjust: ActivityBatch = {
      id: "b2",
      label: "Lote",
      pieces: [
        {
          id: "x",
          name: "X",
          history: [
            { title: "Marcada como refeita", who: "Estúdio", at: at(20, 12) },
            { title: "Ajuste pedido pelo cliente", who: "Helena", at: at(20, 10) },
          ],
        },
      ],
    };
    const tasks: ActivityTask[] = [
      { ...task, id: "a", status: "concluido", dueDate: at(10, 12), completedAt: at(10, 18), comments: [] },
      { ...task, id: "b", status: "concluido", dueDate: at(10, 12), completedAt: at(11, 9), comments: [] },
      { ...task, id: "c", status: "a-fazer", dueDate: at(12, 12), comments: [] },
      { ...task, id: "d", status: "a-fazer", dueDate: at(29, 12), comments: [] }, // ainda não venceu
    ];
    const s = monthSummary({ activities: [], batches: [batch, withAdjust], tasks, now: NOW });
    assert.equal(s.approvalRate, 3 / 4);
    assert.equal(s.responseMs, 2 * 3_600_000);
    assert.deepEqual(s.onTime, { done: 1, total: 3 });
  });

  test("próxima entrega: a tarefa aberta que vence primeiro", () => {
    const base = { ...task, comments: [] };
    assert.deepEqual(nextDelivery([{ ...base, dueDate: at(25, 18) }], NOW), { label: "Hoje", sub: "Campanha Dia dos Pais" });
    assert.equal(nextDelivery([{ ...base, dueDate: at(20, 18) }], NOW)?.label, "Atrasada");
    assert.equal(nextDelivery([{ ...base, dueDate: new Date(2026, 9, 5).toISOString() }], NOW)?.label, "05/out");
    assert.equal(nextDelivery([{ ...base, status: "concluido", dueDate: at(26, 9) }], NOW), null);
  });

  test("próximos eventos com a cobrança no meio, em ordem", () => {
    const items = upcomingEvents(
      [
        { id: "g", kind: "gravacao", title: "Gravação", at: new Date(2026, 9, 8, 14).toISOString(), place: "Estúdio", createdBy: "", createdAt: "" },
        { id: "old", kind: "reuniao", title: "Passada", at: at(20, 10), place: "", createdBy: "", createdAt: "" },
      ],
      { dueDate: new Date(2026, 9, 5), competence: "2026-10" },
      NOW,
    );
    assert.deepEqual(items.map((i) => [i.day, i.month, i.title, i.sub]), [
      ["05", "OUT", "Cobrança mensal", "Fatura de outubro"],
      ["08", "OUT", "Gravação", "14:00 · Estúdio"],
    ]);
  });
});

import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A } from "./helpers/agency";
import {
  agenda,
  approvalStats,
  deliveryStats,
  financeStats,
  operationStats,
  portfolioStats,
  previousMonth,
  recentMonths,
  teamStats,
  type DashboardInput,
} from "../src/lib/dashboard/metrics";
import { DEFAULT_NOTIFY_PREFS } from "../src/lib/inbox/notifyPrefs";
import type { Batch, Piece } from "../src/lib/approval/types";
import type { Client } from "../src/lib/clients/types";
import type { ClientAccount, ClientService, Invoice } from "../src/lib/crm/types";
import type { InboxMember } from "../src/lib/inbox/types";
import type { Task } from "../src/lib/tasks/types";

/*
 * O painel da agência em números: cada bloco com uma base pequena montada à
 * mão, com "hoje" fixo em 25/09/2026 ao meio-dia.
 */

const NOW = new Date(2026, 8, 25, 12, 0);
const A = AGENCIA_A.agencyId;
const iso = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

function task(p: Partial<Task> & { id: string }): Task {
  return {
    agencyId: A,
    title: p.id,
    client: "Aurora",
    clientId: "c1",
    status: "a-fazer",
    assignee: "Marina",
    createdAt: iso(2026, 9, 2),
    description: "",
    priority: "media",
    labels: [],
    creator: "Felipe",
    dueDate: null,
    completedAt: null,
    comments: [],
    flowId: null,
    stepId: null,
    source: null,
    ...p,
  } as Task;
}

function client(p: Partial<Client> & { id: string }): Client {
  return {
    agencyId: A,
    name: p.id,
    segment: "",
    services: [],
    city: "",
    email: "",
    phone: "",
    contactName: "",
    nps: null,
    owner: "—",
    billingDay: null,
    status: "ativo",
    squad: [],
    flowId: "f1",
    createdAt: iso(2026, 1, 1),
    ...p,
  };
}

function service(p: Partial<ClientService>): ClientService {
  return {
    id: Math.random().toString(36),
    name: "Instagram",
    kind: "social" as ClientService["kind"],
    scope: "",
    responsibleId: null,
    monthlyValue: 100_000,
    status: "ativo",
    quota: null,
    unit: "",
    delivered: 0,
    deliveredMonth: "2026-09",
    stage: "",
    createdAt: iso(2026, 1, 1),
    ...p,
  };
}

function invoice(p: Partial<Invoice>): Invoice {
  return {
    id: Math.random().toString(36),
    competence: "2026-09",
    dueDate: "2026-09-10",
    amount: 100_000,
    method: "pix",
    status: "aberto",
    paidAt: null,
    createdAt: iso(2026, 9, 1),
    ...p,
  };
}

function account(clientId: string, p: Partial<ClientAccount>): ClientAccount {
  return {
    clientId,
    agencyId: A,
    contract: { startDate: null, fidelityMonths: null, cycle: "mensal", adjustmentIndex: "" },
    payment: null,
    services: [],
    invoices: [],
    files: [],
    events: [],
    ...p,
  };
}

function piece(id: string, status: Piece["status"], history: { title: string; at: string }[]): Piece {
  return {
    id,
    name: id,
    size: "1080 x 1080",
    date: iso(2026, 9, 1),
    status,
    kind: "Feed",
    history: [...history].reverse().map((h, i) => ({ id: `${id}-${i}`, who: "x", ...h })),
  };
}

function batch(p: Partial<Batch> & { id: string }): Batch {
  return {
    agencyId: A,
    client: "Aurora",
    clientId: "c1",
    label: "Lote 07",
    stage: "em-aprovacao",
    token: p.id,
    pieces: [],
    ...p,
  } as Batch;
}

function member(p: Partial<InboxMember> & { id: string }): InboxMember {
  return {
    agencyId: A,
    name: p.id,
    email: `${p.id}@x.com`,
    handle: p.id,
    presence: "offline",
    role: "editor",
    status: "ativo",
    lastSeenAt: null,
    createdAt: iso(2026, 9, 1),
    invite: null,
    joinRequest: false,
    title: "",
    photoUrl: null,
    notify: DEFAULT_NOTIFY_PREFS,
    ...p,
  };
}

const base = (p: Partial<DashboardInput>): DashboardInput => ({
  tasks: [],
  batches: [],
  clients: [],
  accounts: [],
  members: [],
  month: "2026-09",
  clientId: null,
  person: null,
  now: NOW,
  ...p,
});

describe("meses do filtro", () => {
  test("anterior e os últimos 12", () => {
    assert.equal(previousMonth("2026-01"), "2025-12");
    const months = recentMonths(NOW);
    assert.equal(months.length, 12);
    assert.equal(months[0], "2026-09");
    assert.equal(months[11], "2025-10");
  });
});

describe("operação", () => {
  const tasks = [
    task({ id: "aberta-atrasada", dueDate: "2026-09-20" }),
    task({ id: "aberta-no-prazo", dueDate: "2026-09-30", assignee: "Ana", status: "em-progresso" }),
    task({ id: "feita-no-prazo", status: "concluido", dueDate: "2026-09-15", completedAt: iso(2026, 9, 15, 18) }),
    task({ id: "feita-atrasada", status: "concluido", dueDate: "2026-09-10", completedAt: iso(2026, 9, 12) }),
    task({ id: "de-agosto", status: "concluido", createdAt: iso(2026, 8, 1), completedAt: iso(2026, 8, 20) }),
    task({ id: "de-outro-cliente", clientId: "c2", status: "pausado" }),
  ];

  test("abertas, atrasadas, no prazo e o que esteve no mês", () => {
    const s = operationStats(base({ tasks }));
    assert.equal(s.open, 2);
    assert.equal(s.late, 1);
    assert.equal(s.onTime, 50);
    assert.equal(s.inMonth, 5); // a de agosto terminou antes de setembro começar
    assert.equal(s.byStatus.find((b) => b.status === "concluido")!.count, 2);
    assert.deepEqual(s.load, [
      { name: "Ana", open: 1 },
      { name: "Marina", open: 1 },
    ]);
  });

  test("filtro de cliente e de pessoa recortam as tarefas", () => {
    assert.equal(operationStats(base({ tasks, clientId: "c2" })).inMonth, 1);
    assert.equal(operationStats(base({ tasks, person: "ana" })).open, 1);
  });

  test("sem concluída com prazo, o 'no prazo' fica vazio em vez de 0%", () => {
    assert.equal(operationStats(base({ tasks: [task({ id: "x" })] })).onTime, null);
  });
});

describe("aprovação", () => {
  const SENT = "Enviada para aprovação";
  const batches = [
    batch({
      id: "l1",
      pieces: [
        piece("p1", "aprovado", [
          { title: SENT, at: iso(2026, 9, 10) },
          { title: "Aprovada pelo cliente", at: iso(2026, 9, 12) },
        ]),
        piece("p2", "ajuste", [
          { title: SENT, at: iso(2026, 9, 10) },
          { title: "Ajuste pedido pelo cliente", at: iso(2026, 9, 14) },
        ]),
        piece("p3", "pendente", [{ title: SENT, at: iso(2026, 9, 21) }]),
      ],
    }),
    batch({ id: "rascunho", stage: "rascunho", pieces: [piece("p4", "pendente", [])] }),
    batch({
      id: "agosto",
      pieces: [
        piece("p5", "aprovado", [
          { title: SENT, at: iso(2026, 8, 1) },
          { title: "Aprovada pelo cliente", at: iso(2026, 8, 2) },
        ]),
      ],
    }),
  ];

  test("decisões do mês, tempo médio, taxa de ajuste e quem espera", () => {
    const s = approvalStats(base({ batches }));
    assert.equal(s.approved, 1);
    assert.equal(s.adjust, 1);
    assert.equal(s.avgDecisionDays, 3);
    assert.equal(s.prevAvgDecisionDays, 1);
    assert.equal(s.adjustRate, 50);
    assert.equal(s.pending, 1); // o rascunho não foi para o cliente
    assert.equal(s.waitingBatches, 1);
    assert.deepEqual(s.waiting[0], { id: "l1", client: "Aurora", label: "Lote 07", pending: 1, days: 4 });
  });
});

describe("financeiro", () => {
  const clients = [client({ id: "c1", name: "Aurora" }), client({ id: "c2", name: "Trigo" })];
  const accounts = [
    account("c1", {
      services: [service({ monthlyValue: 800_000 }), service({ monthlyValue: 50_000, status: "pausado" })],
      invoices: [
        invoice({ status: "pago", paidAt: iso(2026, 9, 5), amount: 800_000, dueDate: "2026-09-05" }),
        invoice({ dueDate: "2026-09-30", amount: 800_000, competence: "2026-10" }),
      ],
      contract: { startDate: "2025-10-10", fidelityMonths: 12, cycle: "mensal", adjustmentIndex: "" },
    }),
    account("c2", {
      services: [service({ monthlyValue: 300_000, status: "setup" })],
      invoices: [invoice({ dueDate: "2026-09-01", amount: 300_000 })],
    }),
    account("fantasma", { services: [service({ monthlyValue: 999_999 })] }),
  ];

  test("recorrente, recebido, em aberto, vencido e o que vem por aí", () => {
    const f = financeStats(base({ clients, accounts }));
    assert.equal(f.mrr, 1_100_000); // pausado não fatura; ficha sem cliente não conta
    assert.equal(f.payingClients, 2);
    assert.equal(f.received, 800_000);
    assert.equal(f.expected, 1_900_000);
    assert.deepEqual(f.open, { cents: 800_000, count: 1 });
    assert.deepEqual(f.overdue, { cents: 300_000, count: 1, clients: 1 });
    assert.equal(f.upcoming[0].client, "Aurora");
    assert.deepEqual(f.fidelity, [{ clientId: "c1", client: "Aurora", months: 12, days: 15 }]);
  });

  test("filtrar um cliente recorta o dinheiro", () => {
    assert.equal(financeStats(base({ clients, accounts, clientId: "c2" })).mrr, 300_000);
  });
});

describe("carteira", () => {
  test("por status, sem fluxo e em risco com o motivo", () => {
    const clients = [
      client({ id: "c1", name: "Café Alto", nps: 4 }),
      client({ id: "c2", name: "Construtora", status: "risco", flowId: null }),
      client({ id: "c3", name: "Tranquila", status: "vip" }),
    ];
    const accounts = [account("c2", { invoices: [invoice({ dueDate: "2026-09-13" })] })];
    const batches = [
      batch({
        id: "l1",
        clientId: "c1",
        pieces: [piece("p", "ajuste", [{ title: "Ajuste pedido pelo cliente", at: iso(2026, 9, 20) }])],
      }),
    ];
    const s = portfolioStats(base({ clients, accounts, batches }));
    assert.equal(s.total, 3);
    assert.equal(s.withoutFlow, 1);
    assert.equal(s.byStatus.find((b) => b.status === "vip")!.count, 1);
    assert.deepEqual(s.atRisk, [
      { clientId: "c1", client: "Café Alto", reason: "NPS 4 · 1 lote com ajuste" },
      { clientId: "c2", client: "Construtora", reason: "Fatura vencida há 12 dias" },
    ]);
  });
});

describe("entregas", () => {
  test("somadas por unidade; entrega de outro mês conta zero", () => {
    const accounts = [
      account("c1", {
        services: [
          service({ quota: 12, unit: "posts", delivered: 8 }),
          service({ quota: 4, unit: "Posts", delivered: 9 }),
          service({ quota: 4, unit: "reels", delivered: 4, deliveredMonth: "2026-08" }),
          service({ quota: 10, unit: "stories", delivered: 5, status: "pausado" }),
        ],
      }),
    ];
    const s = deliveryStats(base({ accounts }));
    assert.deepEqual(s.lines, [
      { unit: "posts", done: 12, quota: 16 },
      { unit: "reels", done: 0, quota: 4 },
    ]);
    assert.equal(s.done, 12);
    assert.equal(s.quota, 20);
  });
});

describe("equipe e agenda", () => {
  test("ativos, online, convites, pedidos e último acesso", () => {
    const s = teamStats([
      member({ id: "ana", presence: "disponivel", lastSeenAt: iso(2026, 9, 25), title: "Designer" }),
      member({ id: "bia", presence: "offline", lastSeenAt: iso(2026, 9, 20) }),
      member({ id: "convidado", status: "convite" }),
      member({ id: "pedido", status: "convite", joinRequest: true }),
      member({ id: "fora", status: "arquivado", presence: "disponivel" }),
    ]);
    assert.equal(s.active, 2);
    assert.equal(s.online, 1);
    assert.equal(s.invites, 1);
    assert.deepEqual(s.requests.map((r) => r.id), ["pedido"]);
    assert.deepEqual(s.lastSeen.map((m) => m.id), ["ana", "bia"]);
  });

  test("agenda: de hoje em diante, em ordem", () => {
    const clients = [client({ id: "c1", name: "Aurora" })];
    const ev = (id: string, at: string) => ({ id, kind: "reuniao" as const, title: id, at, place: "", createdBy: "", createdAt: at });
    const accounts = [account("c1", { events: [ev("ontem", iso(2026, 9, 24)), ev("depois", iso(2026, 9, 30)), ev("hoje-cedo", iso(2026, 9, 25, 8))] })];
    assert.deepEqual(agenda(base({ clients, accounts })).map((e) => e.id), ["hoje-cedo", "depois"]);
  });
});

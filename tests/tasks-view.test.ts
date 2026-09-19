import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  DEFAULT_DISPLAY,
  EMPTY_FILTERS,
  applyFilters,
  countActiveFilters,
  distinct,
  distinctLabels,
  groupTasks,
  isOverdue,
  sortTasks,
  toggleIn,
  type Display,
  type Filters,
} from "../src/lib/tasks/view";
import type { Task } from "../src/lib/tasks/types";
import { DIA, emDias, fimDeHoje, makeTask } from "./helpers/tasks";

const filtros = (over: Partial<Filters> = {}): Filters => ({
  ...EMPTY_FILTERS,
  ...over,
});
const display = (over: Partial<Display> = {}): Display => ({
  ...DEFAULT_DISPLAY,
  ...over,
});

const filtrar = (tasks: Task[], f: Partial<Filters> = {}, busca = "", d: Partial<Display> = {}) =>
  applyFilters(tasks, filtros(f), busca, display(d)).map((t) => t.id);

/* --- massa de teste --- */

const T = {
  aFazerAlta: makeTask({
    id: "a",
    title: "Arte do carrossel",
    status: "a-fazer",
    priority: "alta",
    labels: ["arte", "reels"],
    assignee: "MD",
    client: "Clínica Aurora",
    creator: "Felipe",
    createdAt: emDias(-1),
    dueDate: emDias(-2), // vencido e ainda em jogo → atrasada
  }),
  concluidaVencida: makeTask({
    id: "b",
    title: "Briefing de setembro",
    status: "concluido",
    priority: "baixa",
    labels: ["texto"],
    assignee: "RS",
    client: "Montê bar",
    creator: "Marina",
    createdAt: emDias(-10),
    dueDate: emDias(-3), // vencido, mas concluída → não é atrasada
  }),
  canceladaSemPrazo: makeTask({
    id: "c",
    title: "Campanha antiga",
    status: "cancelado",
    priority: "urgente",
    labels: [],
    assignee: "MD",
    client: "Montê bar",
    creator: "Marina",
    createdAt: emDias(-40),
    dueDate: null,
  }),
  emProgressoHoje: makeTask({
    id: "d",
    title: "Reels da promoção",
    description: "Gravar no estúdio",
    status: "em-progresso",
    priority: "media",
    labels: ["reels"],
    assignee: "JP",
    client: "Clínica Aurora",
    creator: "Felipe",
    createdAt: emDias(0),
    dueDate: fimDeHoje(), // vence hoje, e não durante o teste
  }),
  futura: makeTask({
    id: "e",
    title: "Zebra final",
    status: "em-revisao",
    priority: "sem",
    labels: ["arte"],
    assignee: "RS",
    client: "Padaria Sol",
    creator: "Ana",
    createdAt: emDias(-3),
    dueDate: emDias(20),
  }),
};
const TODAS = Object.values(T);

/* --- filtros --- */

describe("applyFilters", () => {
  test("sem filtro nenhum devolve tudo", () => {
    assert.deepEqual(filtrar(TODAS).sort(), ["a", "b", "c", "d", "e"]);
  });

  test("status", () => {
    assert.deepEqual(filtrar(TODAS, { status: ["a-fazer", "em-progresso"] }), ["a", "d"]);
  });

  test("prioridade", () => {
    assert.deepEqual(filtrar(TODAS, { priority: ["alta", "urgente"] }), ["a", "c"]);
  });

  test("etiquetas casam por OU (basta uma)", () => {
    assert.deepEqual(filtrar(TODAS, { labels: ["reels"] }), ["a", "d"]);
    assert.deepEqual(filtrar(TODAS, { labels: ["texto", "arte"] }), ["a", "b", "e"]);
    assert.deepEqual(filtrar(TODAS, { labels: ["inexistente"] }), []);
  });

  test("criador, responsável e cliente", () => {
    assert.deepEqual(filtrar(TODAS, { creator: ["Felipe"] }), ["a", "d"]);
    assert.deepEqual(filtrar(TODAS, { assignee: ["RS"] }), ["b", "e"]);
    assert.deepEqual(filtrar(TODAS, { client: ["Montê bar"] }), ["b", "c"]);
  });

  test("filtros diferentes se somam (E entre campos)", () => {
    assert.deepEqual(filtrar(TODAS, { client: ["Clínica Aurora"], labels: ["reels"] }), ["a", "d"]);
    assert.deepEqual(filtrar(TODAS, { client: ["Montê bar"], labels: ["reels"] }), []);
  });

  test("busca olha título, cliente, responsável, descrição e etiquetas", () => {
    assert.deepEqual(filtrar(TODAS, {}, "carrossel"), ["a"]);
    assert.deepEqual(filtrar(TODAS, {}, "montê"), ["b", "c"]);
    assert.deepEqual(filtrar(TODAS, {}, "jp"), ["d"]);
    assert.deepEqual(filtrar(TODAS, {}, "estúdio"), ["d"], "descrição");
    assert.deepEqual(filtrar(TODAS, {}, "TEXTO"), ["b"], "etiqueta, sem diferenciar maiúsculas");
    assert.deepEqual(filtrar(TODAS, {}, "   "), ["a", "b", "c", "d", "e"], "busca em branco não filtra");
  });

  test("showArchived=false esconde as canceladas", () => {
    assert.deepEqual(filtrar(TODAS, {}, "", { showArchived: false }), ["a", "b", "d", "e"]);
  });

  test("janela de criação", () => {
    assert.deepEqual(filtrar(TODAS, { created: "hoje" }), ["d"]);
    assert.deepEqual(filtrar(TODAS, { created: "7d" }), ["a", "d", "e"]);
    assert.deepEqual(filtrar(TODAS, { created: "30d" }), ["a", "b", "d", "e"]);
    assert.deepEqual(filtrar(TODAS, { created: "qualquer" }).length, 5);
  });

  test("janela de prazo", () => {
    assert.deepEqual(filtrar(TODAS, { due: "atrasadas" }), ["a"]);
    assert.deepEqual(filtrar(TODAS, { due: "hoje" }), ["d"]);
    assert.deepEqual(filtrar(TODAS, { due: "sem-prazo" }), ["c"]);
    /*
     * "Próximos 7 dias" hoje não tem piso: pega o que vence em até 7 dias E o
     * que já venceu (inclusive de tarefas concluídas). É o comportamento atual
     * — se a intenção for só o que está por vir, é decisão de produto.
     */
    assert.deepEqual(filtrar(TODAS, { due: "7d" }), ["a", "b", "d"]);
  });

  test("tarefa com prazo ilegível não entra em janela nenhuma", () => {
    const quebrada = [makeTask({ id: "x", dueDate: "não é data" })];
    assert.deepEqual(filtrar(quebrada, { due: "atrasadas" }), []);
    assert.deepEqual(filtrar(quebrada, { due: "hoje" }), []);
    assert.deepEqual(filtrar(quebrada, { due: "sem-prazo" }), [], "tem prazo, só que inválido");
    assert.deepEqual(filtrar(quebrada, { due: "qualquer" }), ["x"]);
  });
});

/* --- isOverdue --- */

describe("isOverdue", () => {
  test("prazo vencido em tarefa em jogo é atraso", () => {
    assert.equal(isOverdue(makeTask({ status: "a-fazer", dueDate: emDias(-1) })), true);
    assert.equal(isOverdue(makeTask({ status: "em-progresso", dueDate: emDias(-1) })), true);
    assert.equal(isOverdue(makeTask({ status: "pausado", dueDate: emDias(-1) })), true);
  });

  test("concluída ou cancelada nunca está atrasada", () => {
    assert.equal(isOverdue(makeTask({ status: "concluido", dueDate: emDias(-5) })), false);
    assert.equal(isOverdue(makeTask({ status: "cancelado", dueDate: emDias(-5) })), false);
  });

  test("sem prazo ou prazo futuro não é atraso", () => {
    assert.equal(isOverdue(makeTask({ dueDate: null })), false);
    assert.equal(isOverdue(makeTask({ dueDate: emDias(1) })), false);
  });
});

/* --- ordenação --- */

const ids = (tasks: Task[], d: Partial<Display>) => sortTasks(tasks, display(d)).map((t) => t.id);

describe("sortTasks", () => {
  test("não altera o array recebido", () => {
    const entrada = [...TODAS];
    const antes = entrada.map((t) => t.id);
    sortTasks(entrada, display({ sort: "az" }));
    assert.deepEqual(entrada.map((t) => t.id), antes);
  });

  test("A–Z usa a colação pt-BR", () => {
    assert.deepEqual(ids(TODAS, { sort: "az" }), ["a", "b", "c", "d", "e"]);
    const acentos = [
      makeTask({ id: "z", title: "Zebra" }),
      makeTask({ id: "a1", title: "Ápice" }),
      makeTask({ id: "a2", title: "Arte" }),
    ];
    assert.deepEqual(ids(acentos, { sort: "az" }), ["a1", "a2", "z"]);
  });

  test("prioridade segue a régua de priority.ts (urgente primeiro, 'sem' por último)", () => {
    assert.deepEqual(ids(TODAS, { sort: "prioridade" }), ["c", "a", "d", "b", "e"]);
  });

  test("prazo: mais próximo primeiro, sem prazo no fim", () => {
    assert.deepEqual(ids(TODAS, { sort: "prazo" }), ["b", "a", "d", "e", "c"]);
  });

  test("pendentes: o que está em jogo vem antes, na ordem do pipeline", () => {
    const ordem = ids(TODAS, { sort: "pendentes" });
    assert.deepEqual(ordem.slice(0, 3), ["a", "d", "e"], "a-fazer, em-progresso, em-revisão");
    assert.deepEqual(ordem.slice(3).sort(), ["b", "c"], "concluída e cancelada no fim");
  });

  test("recentes e antigas são espelhos", () => {
    assert.deepEqual(ids(TODAS, { sort: "recentes" }), ["d", "a", "e", "b", "c"]);
    assert.deepEqual(ids(TODAS, { sort: "antigas" }), ["c", "b", "e", "a", "d"]);
  });

  test("dentro do mesmo dia, o desempate obedece ao toggle de recência", () => {
    const base = new Date();
    base.setHours(9, 0, 0, 0);
    const mesmoDia = [
      makeTask({ id: "cedo", title: "Zebra", status: "concluido", createdAt: base.toISOString() }),
      makeTask({
        id: "tarde",
        title: "Abelha",
        status: "a-fazer",
        createdAt: new Date(base.getTime() + 3600_000).toISOString(),
      }),
    ];
    assert.deepEqual(
      ids(mesmoDia, { sort: "recentes", recencyTiebreak: true }),
      ["tarde", "cedo"],
      "mais recente primeiro",
    );
    assert.deepEqual(
      ids(mesmoDia, { sort: "recentes", recencyTiebreak: false }),
      ["tarde", "cedo"],
      "sem recência: ordem do pipeline (a-fazer antes de concluído)",
    );
  });
});

/* --- agrupamento --- */

describe("groupTasks", () => {
  test("'nenhum' devolve um grupo só", () => {
    const g = groupTasks(TODAS, "nenhum");
    assert.equal(g.length, 1);
    assert.equal(g[0].key, "todas");
    assert.equal(g[0].tasks.length, 5);
  });

  test("por status, na ordem do pipeline, sem grupos vazios", () => {
    const g = groupTasks(TODAS, "status");
    assert.deepEqual(g.map((x) => x.key), ["a-fazer", "em-progresso", "em-revisao", "concluido", "cancelado"]);
    assert.deepEqual(g.map((x) => x.label)[0], "A fazer");
  });

  test("showEmpty inclui todo o pipeline, mesmo sem tarefa", () => {
    const g = groupTasks([T.aFazerAlta], "status", { showEmpty: true });
    assert.equal(g.length, 6, "os seis status de constants.ts");
    assert.deepEqual(g.find((x) => x.key === "pausado")?.tasks, []);
  });

  test("por prioridade, na ordem de urgência", () => {
    const g = groupTasks(TODAS, "priority");
    assert.deepEqual(g.map((x) => x.key), ["urgente", "alta", "media", "baixa", "sem"]);
    const comVazios = groupTasks([T.aFazerAlta], "priority", { showEmpty: true });
    assert.equal(comVazios.length, 5);
  });

  test("por responsável e cliente, em ordem alfabética", () => {
    assert.deepEqual(groupTasks(TODAS, "assignee").map((x) => x.key), ["JP", "MD", "RS"]);
    assert.deepEqual(
      groupTasks(TODAS, "client").map((x) => x.key),
      ["Clínica Aurora", "Montê bar", "Padaria Sol"],
    );
  });

  test("campo em branco vira grupo 'Sem …'", () => {
    const g = groupTasks([makeTask({ id: "x", assignee: "", client: "" })], "assignee");
    assert.equal(g[0].key, "—");
    assert.equal(g[0].label, "Sem responsável");
    assert.equal(groupTasks([makeTask({ id: "x", client: "" })], "client")[0].label, "Sem cliente");
  });
});

/* --- utilitários dos menus --- */

describe("apoio aos menus", () => {
  test("distinct ignora vazios e ordena", () => {
    assert.deepEqual(distinct(TODAS, "assignee"), ["JP", "MD", "RS"]);
    assert.deepEqual(distinct(TODAS, "creator"), ["Ana", "Felipe", "Marina"]);
    assert.deepEqual(distinct([makeTask({ client: "" }), makeTask({ client: "B" })], "client"), ["B"]);
  });

  test("distinctLabels junta e ordena sem repetir", () => {
    assert.deepEqual(distinctLabels(TODAS), ["arte", "reels", "texto"]);
    assert.deepEqual(distinctLabels([]), []);
  });

  test("countActiveFilters conta itens e as duas janelas de data", () => {
    assert.equal(countActiveFilters(EMPTY_FILTERS), 0);
    assert.equal(countActiveFilters(filtros({ status: ["a-fazer", "pausado"] })), 2);
    assert.equal(countActiveFilters(filtros({ created: "7d", due: "atrasadas" })), 2);
    assert.equal(
      countActiveFilters(filtros({ labels: ["reels"], creator: ["Felipe"], due: "hoje" })),
      3,
    );
  });

  test("toggleIn liga e desliga sem mutar a lista original", () => {
    const base = ["a"];
    assert.deepEqual(toggleIn(base, "b"), ["a", "b"]);
    assert.deepEqual(toggleIn(base, "a"), []);
    assert.deepEqual(base, ["a"]);
  });

  test("DIA é o passo usado nos prazos relativos", () => {
    assert.equal(DIA, 86_400_000);
  });
});

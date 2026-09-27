import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A } from "./helpers/agency";
import { businessDay, businessToday } from "../src/lib/business-date";
import { blankStep } from "../src/lib/flows/constants";
import { seedFlows, socialMediaTemplate } from "../src/lib/flows/seed";
import type { Flow, FlowStep } from "../src/lib/flows/types";
import {
  addBusinessDays,
  assigneeFor,
  duplicateStep,
  flowMeta,
  moveStep,
  nextStep,
  pickFlowForClient,
  removeStep,
  startStep,
  stepNumber,
} from "../src/lib/flows/view";

/*
 * A régua dos fluxos decide de quem é a tarefa depois de cada etapa — um erro
 * aqui entrega trabalho à pessoa errada sem nada aparecer na tela.
 */

function flow(steps: FlowStep[], over: Partial<Flow> = {}): Flow {
  return {
    id: "f",
    agencyId: AGENCIA_A.agencyId,
    name: "Fluxo",
    description: "",
    category: "outro",
    icon: "zap",
    color: "indigo",
    appliesTo: "todos",
    status: "ativo",
    steps,
    startStepId: null,
    updatedAt: "",
    updatedBy: "",
    createdAt: "",
    ...over,
  };
}

const s = (id: string, over: Partial<FlowStep> = {}): FlowStep => ({ ...blankStep(id, id), ...over });

describe("startStep", () => {
  test("a primeira ligada, ou a marcada como início", () => {
    const f = flow([s("a", { disabled: true }), s("b"), s("c")]);
    assert.equal(startStep(f)?.id, "b");
    assert.equal(startStep({ ...f, startStepId: "c" })?.id, "c");
  });
});

describe("nextStep", () => {
  test("segue a ordem, e a última encerra", () => {
    const f = flow([s("a"), s("b"), s("c")]);
    assert.equal(nextStep(f, "a")?.id, "b");
    assert.equal(nextStep(f, "c"), null);
  });

  test("a próxima escolhida vence a ordem", () => {
    const f = flow([s("a", { nextStepId: "c" }), s("b"), s("c")]);
    assert.equal(nextStep(f, "a")?.id, "c");
  });

  test("pula etapa desativada", () => {
    const f = flow([s("a"), s("b", { disabled: true }), s("c")]);
    assert.equal(nextStep(f, "a")?.id, "c");
  });

  test("laço de próximas não prende a tarefa", () => {
    const f = flow([s("a", { nextStepId: "b" }), s("b", { nextStepId: "a", disabled: true })]);
    assert.equal(nextStep(f, "a"), null);
  });

  test("o fluxo padrão vai de Redação para Design", () => {
    const padrao = seedFlows()[0];
    assert.equal(nextStep(padrao, "redacao")?.name, "Design");
    assert.equal(stepNumber(padrao, "design"), "03");
    assert.equal(flowMeta(padrao), "6 etapas · Ativo");
  });
});

describe("assigneeFor", () => {
  const time = [{ id: "ana" }, { id: "marina" }];

  test("membro fixo, se ainda estiver no time", () => {
    assert.equal(assigneeFor({ kind: "membro", memberId: "ana" }, [], time), "ana");
    assert.equal(assigneeFor({ kind: "membro", memberId: "saiu" }, [], time), null);
  });

  test("squad: o primeiro do squad que está no time", () => {
    assert.equal(assigneeFor({ kind: "squad" }, ["saiu", "marina", "ana"], time), "marina");
  });

  test("etapa do cliente fica com o squad", () => {
    assert.equal(assigneeFor({ kind: "cliente" }, ["ana"], time), "ana");
    assert.equal(assigneeFor({ kind: "cliente" }, [], time), null);
  });
});

describe("edição do pipeline", () => {
  test("mover troca com a vizinha e para na ponta", () => {
    const steps = [s("a"), s("b"), s("c")];
    assert.deepEqual(moveStep(steps, "b", -1).map((x) => x.id), ["b", "a", "c"]);
    assert.deepEqual(moveStep(steps, "a", -1).map((x) => x.id), ["a", "b", "c"]);
  });

  test("remover conserta quem apontava para a removida", () => {
    const f = flow([s("a", { nextStepId: "b" }), s("b", { nextStepId: "d" }), s("c"), s("d")], {
      startStepId: "b",
    });
    const out = removeStep(f, "b");
    assert.deepEqual(out.steps.map((x) => x.id), ["a", "c", "d"]);
    assert.equal(out.steps[0].nextStepId, "d");
    assert.equal(out.startStepId, null);
  });

  test("duplicar põe a cópia logo depois, sem herdar a próxima", () => {
    const out = duplicateStep([s("a", { nextStepId: "c" }), s("c")], "a", "a2");
    assert.deepEqual(out.map((x) => x.id), ["a", "a2", "c"]);
    assert.equal(out[1].name, "a (cópia)");
    assert.equal(out[1].nextStepId, null);
  });
});

describe("addBusinessDays", () => {
  test("pula o fim de semana", () => {
    // Sexta, 18 set 2026 + 1 dia útil = segunda, 21 set.
    const d = addBusinessDays(new Date(2026, 8, 18, 10), 1);
    assert.equal(d.getDate(), 21);
    assert.equal(addBusinessDays(new Date(2026, 8, 18, 10), 0).getDate(), 18);
  });

  test("o dia da semana é o de Brasília, seja qual for o fuso do servidor (#97)", () => {
    // Quinta, 24 set, 22h em Brasília = sexta 01h em UTC. +1 dia útil = sexta
    // 22h — contado em UTC, caía no domingo.
    const d = addBusinessDays(new Date("2026-09-24T22:00:00-03:00"), 1);
    assert.equal(d.toISOString(), "2026-09-26T01:00:00.000Z");
    assert.equal(businessDay(d).weekday, 5, "sexta");
    // Sexta 22h + 1 dia útil = segunda 22h.
    assert.equal(
      addBusinessDays(new Date("2026-09-25T22:00:00-03:00"), 1).toISOString(),
      "2026-09-29T01:00:00.000Z",
    );
  });
});

describe("businessDay / businessToday (#97)", () => {
  test("22h em Brasília ainda é hoje, mesmo com o UTC já no dia (e no mês) seguinte", () => {
    const noite = new Date("2026-09-30T22:00:00-03:00");
    assert.deepEqual(businessDay(noite), { year: 2026, month: 9, day: 30, weekday: 3 });
    const hoje = businessToday(noite);
    assert.deepEqual([hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), hoje.getHours()], [2026, 8, 30, 0]);
  });

  test("meia-noite em Brasília já é o dia seguinte", () => {
    assert.deepEqual(businessDay(new Date("2026-10-01T00:00:00-03:00")), { year: 2026, month: 10, day: 1, weekday: 4 });
  });
});

describe("modelo Social Media", () => {
  test("mesmas etapas do padrão, sem ninguém fixo", () => {
    const steps = socialMediaTemplate();
    assert.deepEqual(
      steps.map((s) => s.name),
      ["Briefing", "Redação", "Design", "Revisão", "Aprovação", "Publicação"],
    );
    assert.ok(steps.every((s) => s.assignee.kind !== "membro"));
    assert.equal(steps.find((s) => s.name === "Aprovação")?.assignee.kind, "cliente");
    assert.ok(steps.every((s) => s.approvers.every((a) => a.memberId === null)));
  });
});

describe("pickFlowForClient", () => {
  const todos = flow([s("a")], { id: "todos", appliesTo: "todos" });
  const espec = flow([s("a")], { id: "espec", appliesTo: "especificos" });

  test("o fluxo da ficha vence, se estiver ativo", () => {
    assert.equal(pickFlowForClient([todos, espec], "espec")?.id, "espec");
    assert.equal(pickFlowForClient([todos, { ...espec, status: "inativo" }], "espec")?.id, "todos");
  });

  test("sem fluxo próprio: só um 'Todos os clientes' pega o cliente", () => {
    assert.equal(pickFlowForClient([espec, todos], null)?.id, "todos");
    assert.equal(pickFlowForClient([espec], null), undefined, "específico não pega cliente de fora");
  });

  test("rascunho e fluxo sem etapa ligada ficam de fora", () => {
    assert.equal(pickFlowForClient([{ ...todos, status: "rascunho" }], null), undefined);
    assert.equal(pickFlowForClient([{ ...todos, steps: [] }], null), undefined);
    assert.equal(pickFlowForClient([{ ...todos, steps: [s("a", { disabled: true })] }], null), undefined);
  });
});

describe("rascunho", () => {
  test("é um status de verdade, com rótulo", () => {
    assert.equal(flowMeta(flow([s("a")], { status: "rascunho" })), "1 etapa · Rascunho");
  });
});

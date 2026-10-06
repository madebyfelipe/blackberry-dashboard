import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

// Antes de qualquer import do store: diretório de dados só deste teste, vazio.
usarDataDirTemporario("flows-automation");

const { createFlow, getFlow, updateFlow, ValidationError } = await import("../src/lib/flows/repository");
const { createClient } = await import("../src/lib/clients/repository");
const { ensureMember } = await import("../src/lib/inbox/repository");
const { createBatch, addPiece, decidePiece, approvePieceByAgency } = await import(
  "../src/lib/approval/repository"
);
const { taskForPiece, onClientDecision, onAgencyApproval, advanceTask, scopeOfBatch } = await import(
  "../src/lib/flows/automation"
);
const { getTask, updateTaskAtStep } = await import("../src/lib/tasks/repository");

/*
 * O motor dos fluxos (automation.ts) nunca teve teste próprio — as decisões
 * do cliente e da agência eram verificadas só subindo o app. Este arquivo
 * reproduz os seis achados da issue #81 (ultra review de 25/09) contra o
 * modelo "Social Media - Padrão": Briefing → Redação → Design → Revisão →
 * Aprovação (cliente) → Publicação.
 */

function zerar() {
  escreverData("flows.json", []);
  escreverData("clients.json", []);
  escreverData("batches.json", []);
  escreverData("tasks.json", []);
  escreverData("inbox.json", { members: [], conversations: [] });
}

/** Time, cliente, fluxo ativo e uma peça com tarefa já na primeira etapa (Briefing). */
async function cenario() {
  zerar();
  const ana = await ensureMember(AGENCIA_A, { name: "Ana", email: "ana@agencia.com" });
  const flow = await createFlow(AGENCIA_A, {
    name: "Social Media",
    by: "Felipe",
    template: "social-media",
    appliesTo: "todos",
    status: "ativo",
  });
  const cliente = await createClient(AGENCIA_A, { name: "Clínica Aurora", squad: [ana.id], owner: ana.name });
  const batch = await createBatch(AGENCIA_A, { client: cliente.name, title: "Lote outubro" });
  const piece = await addPiece(AGENCIA_A, batch!.id);
  const task = await taskForPiece(AGENCIA_A, batch!, piece!, "Felipe");
  return { flow, cliente, batch: batch!, piece: piece!, task, ana };
}

/** Conclui a etapa atual da tarefa e deixa o motor andar para a próxima. */
async function concluirEtapa(taskId: string, por = "Ana") {
  const antes = await getTask(AGENCIA_A, taskId);
  const r = await updateTaskAtStep(AGENCIA_A, taskId, { status: "concluido" }, { expectStepId: antes!.stepId });
  assert.ok(r?.completedNow, "a tarefa precisa ter sido concluída agora, não repetida");
  return advanceTask(AGENCIA_A, taskId, por, r!.task.stepId!);
}

/** Anda a tarefa até a etapa de nome `nomeEtapa` (inclusive), concluindo uma etapa por vez. */
async function andarAte(taskId: string, nomeEtapa: string, flowSteps: { id: string; name: string }[]) {
  let atual = (await getTask(AGENCIA_A, taskId))!;
  while (flowSteps.find((s) => s.id === atual.stepId)?.name !== nomeEtapa) {
    const moved = await concluirEtapa(taskId);
    if (!moved) break;
    atual = moved;
  }
  return atual;
}

describe("decisão antecipada: cliente decide antes da tarefa chegar na Aprovação (achado 1)", () => {
  test("aprovação dada cedo é aplicada quando a tarefa entra na etapa do cliente", async () => {
    const { flow, batch, piece, task } = await cenario();
    assert.equal(flow.steps.find((s) => s.id === task.stepId)?.name, "Briefing");

    // O cliente já pode decidir a peça (ela está visível no link) mesmo com a
    // tarefa ainda em Briefing — hoje isso é descartado em silêncio.
    await decidePiece(batch.token, piece.id, "aprovado", { who: "Marina" });
    await onClientDecision(scopeOfBatch(batch), piece.id, "aprovado");

    let atual = (await getTask(AGENCIA_A, task.id))!;
    assert.equal(flow.steps.find((s) => s.id === atual.stepId)?.name, "Briefing", "não avançou sozinha ainda");

    // Redação, Design, Revisão — a cada conclusão, o motor volta a verificar.
    atual = (await concluirEtapa(task.id))!; // Briefing → Redação
    assert.equal(flow.steps.find((s) => s.id === atual.stepId)?.name, "Redação");
    atual = (await concluirEtapa(task.id))!; // Redação → Design
    atual = (await concluirEtapa(task.id))!; // Design → Revisão
    assert.equal(flow.steps.find((s) => s.id === atual.stepId)?.name, "Revisão");

    // Revisão → Aprovação: a decisão antiga é aplicada na hora, pulando direto
    // para Publicação, sem esperar uma decisão que já tinha chegado.
    atual = (await concluirEtapa(task.id))!;
    assert.equal(
      flow.steps.find((s) => s.id === atual.stepId)?.name,
      "Publicação",
      "a aprovação antecipada deveria ter mandado a tarefa direto para Publicação",
    );
    const nota = atual.comments.at(-1)?.text ?? "";
    assert.match(nota, /Aprovada pelo cliente/);
  });
});

describe("ajuste depois da aprovação não fica perdido (achado 2)", () => {
  test("cliente aprova, depois pede ajuste: a tarefa volta para antes da Aprovação", async () => {
    const { flow, batch, piece, task } = await cenario();
    await andarAte(task.id, "Aprovação", flow.steps);

    await decidePiece(batch.token, piece.id, "aprovado", { who: "Marina" });
    await onClientDecision(scopeOfBatch(batch), piece.id, "aprovado");
    let atual = (await getTask(AGENCIA_A, task.id))!;
    assert.equal(flow.steps.find((s) => s.id === atual.stepId)?.name, "Publicação");

    // O cliente reabre o link e pede ajuste — a peça já estava "aprovada".
    await decidePiece(batch.token, piece.id, "ajuste", { who: "Marina", reason: "Trocar a cor do fundo" });
    await onClientDecision(scopeOfBatch(batch), piece.id, "ajuste", "Trocar a cor do fundo");

    atual = (await getTask(AGENCIA_A, task.id))!;
    assert.equal(
      flow.steps.find((s) => s.id === atual.stepId)?.name,
      "Revisão",
      "deveria voltar para a etapa anterior à Aprovação, não ficar em Publicação",
    );
    assert.match(atual.comments.at(-1)?.text ?? "", /pediu ajuste.*Trocar a cor do fundo/);
  });
});

describe("decisão repetida não duplica histórico nem conta duas vezes (achado 3)", () => {
  test("decidePiece com a mesma decisão é ignorado", async () => {
    const { batch, piece } = await cenario();
    // A peça já nasce com 1 evento ("Peça criada no lote"); a decisão soma 1.
    const antes = piece.history.length;
    const p1 = await decidePiece(batch.token, piece.id, "aprovado", { who: "Marina" });
    assert.equal(p1 && typeof p1 === "object" ? p1.history.length : 0, antes + 1);

    // Reload do link + re-swipe da mesma peça: mesma decisão, de novo.
    const p2 = await decidePiece(batch.token, piece.id, "aprovado", { who: "Marina" });
    assert.equal(
      p2 && typeof p2 === "object" ? p2.history.length : 0,
      antes + 1,
      "não deveria ter gravado um segundo evento",
    );
  });
});

describe("aprovação pela agência anda a tarefa (achado 4)", () => {
  test("'Aprovar peça' no painel avança a etapa como a decisão do cliente avançaria", async () => {
    const { flow, batch, piece, task } = await cenario();
    await andarAte(task.id, "Aprovação", flow.steps);

    await approvePieceByAgency(AGENCIA_A, batch.id, piece.id);
    await onAgencyApproval(AGENCIA_A, piece.id);

    const atual = (await getTask(AGENCIA_A, task.id))!;
    assert.equal(flow.steps.find((s) => s.id === atual.stepId)?.name, "Publicação");
    assert.match(atual.comments.at(-1)?.text ?? "", /Aprovada pela agência/);
  });
});

describe("ajuste quando a etapa do cliente é a primeira do fluxo (achado 5)", () => {
  test("sem etapa anterior, a nota fica registrada e a tarefa continua na etapa do cliente", async () => {
    zerar();
    const ana = await ensureMember(AGENCIA_A, { name: "Ana", email: "ana@agencia.com" });
    const flow = await createFlow(AGENCIA_A, { name: "Só aprovação", by: "Felipe", template: "zero" });
    const pronto = await updateFlow(
      AGENCIA_A,
      flow.id,
      {
        status: "ativo",
        appliesTo: "todos",
        steps: [
          {
            id: "aprovacao",
            name: "Aprovação",
            icon: "check-check",
            assignee: { kind: "cliente" },
            backupId: null,
            slaDays: null,
            alertDaysBefore: null,
            entryStatus: "",
            exitStatus: "",
            approvers: [],
            automations: { notificar: true, postar: false, historico: true, agendar: false },
            nextStepId: null,
            disabled: false,
          },
        ],
      },
      "Felipe",
    );
    const cliente = await createClient(AGENCIA_A, { name: "Casa Bloom", squad: [ana.id], owner: ana.name });
    const batch = await createBatch(AGENCIA_A, { client: cliente.name, title: "Lote único" });
    const piece = await addPiece(AGENCIA_A, batch!.id);
    const task = await taskForPiece(AGENCIA_A, batch!, piece!, "Felipe");
    assert.equal(pronto?.steps[0].id, task.stepId, "a tarefa já nasce na única etapa");

    await decidePiece(batch!.token, piece!.id, "ajuste", { who: "Marina", reason: "Mudar a legenda" });
    await onClientDecision(scopeOfBatch(batch!), piece!.id, "ajuste", "Mudar a legenda");

    const atual = (await getTask(AGENCIA_A, task.id))!;
    assert.equal(atual.stepId, task.stepId, "continua na etapa do cliente — não há etapa anterior para voltar");
    assert.match(atual.comments.at(-1)?.text ?? "", /pediu ajuste.*Mudar a legenda/);
  });
});

describe("remover etapa com tarefa aberta é recusado (achado 6)", () => {
  test("updateFlow rejeita tirar uma etapa que ainda tem tarefa não concluída nela", async () => {
    const { flow, task } = await cenario();
    assert.equal(flow.steps.find((s) => s.id === task.stepId)?.name, "Briefing");

    const semBriefing = flow.steps.filter((s) => s.id !== "briefing");
    await assert.rejects(
      () => updateFlow(AGENCIA_A, flow.id, { steps: semBriefing }, "Felipe"),
      ValidationError,
    );

    const intacto = await getFlow(AGENCIA_A, flow.id);
    assert.equal(intacto?.steps.length, flow.steps.length, "o fluxo não foi alterado");
    const aindaLa = await getTask(AGENCIA_A, task.id);
    assert.equal(aindaLa?.stepId, "briefing");
  });

  test("etapa sem tarefa aberta pode ser removida normalmente", async () => {
    const { flow } = await cenario();
    const semPublicacao = flow.steps.filter((s) => s.id !== "publicacao");
    const out = await updateFlow(AGENCIA_A, flow.id, { steps: semPublicacao }, "Felipe");
    assert.equal(out?.steps.length, flow.steps.length - 1);
  });
});

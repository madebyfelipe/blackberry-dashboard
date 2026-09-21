import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

// Antes de qualquer import do store: diretório de dados só deste teste, vazio.
usarDataDirTemporario("tasks");
escreverData("tasks.json", []);

const {
  ValidationError,
  addTaskComment,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} = await import("../src/lib/tasks/repository");

/*
 * Um único tenant neste arquivo: aqui se testa a régua de validação e
 * normalização. Que a agência A não enxerga a B é assunto de
 * `multi-tenant.test.ts`.
 */
const criar = (over: Partial<Parameters<typeof createTask>[1]> = {}) =>
  createTask(AGENCIA_A, { title: "Tarefa", client: "Clínica Aurora", ...over });

describe("createTask", () => {
  test("preenche os padrões de quem não mandou nada", async () => {
    const t = await criar({ title: "  Arte do carrossel  " });
    assert.equal(t.title, "Arte do carrossel", "título é aparado");
    assert.equal(t.status, "a-fazer");
    assert.equal(t.priority, "sem");
    assert.equal(t.assignee, "—");
    assert.equal(t.creator, "—");
    assert.deepEqual(t.labels, []);
    assert.equal(t.dueDate, null);
    assert.equal(t.description, "");
    assert.ok(Date.parse(t.createdAt) > 0, "createdAt é ISO");
  });

  test("título obrigatório", async () => {
    await assert.rejects(() => criar({ title: "" }), ValidationError);
    await assert.rejects(() => criar({ title: "   " }), ValidationError);
  });

  test("status e prioridade desconhecidos caem no padrão em vez de quebrar", async () => {
    const t = await criar({
      status: "inventado" as never,
      priority: "altíssima" as never,
    });
    assert.equal(t.status, "a-fazer");
    assert.equal(t.priority, "sem");
  });

  test("status e prioridade válidos passam", async () => {
    const t = await criar({ status: "em-revisao", priority: "urgente" });
    assert.equal(t.status, "em-revisao");
    assert.equal(t.priority, "urgente");
  });

  test("o criador vem de quem chamou e é aparado", async () => {
    assert.equal((await criar({ creator: "  Felipe " })).creator, "Felipe");
    assert.equal((await criar({ creator: "   " })).creator, "—");
  });
});

describe("normalização de etiquetas", () => {
  const etiquetas = async (labels: unknown) =>
    (await criar({ labels: labels as never })).labels;

  test("tira o '#', apara e descarta vazias", async () => {
    assert.deepEqual(await etiquetas(["#reels", "  arte  ", "", "   ", "#"]), ["reels", "arte"]);
  });

  test("não repete", async () => {
    assert.deepEqual(await etiquetas(["reels", "reels", "#reels"]), ["reels"]);
  });

  test("aceita string separada por espaço ou vírgula", async () => {
    assert.deepEqual(await etiquetas("reels, arte  texto"), ["reels", "arte", "texto"]);
    assert.deepEqual(await etiquetas("#reels,#arte"), ["reels", "arte"]);
  });

  test("corta em 8 etiquetas", async () => {
    const dez = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    assert.deepEqual(await etiquetas(dez), ["a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  test("corta cada etiqueta em 24 caracteres", async () => {
    const longa = "x".repeat(40);
    assert.deepEqual(await etiquetas([longa]), ["x".repeat(24)]);
  });

  test("valor sem sentido vira lista vazia, não erro", async () => {
    assert.deepEqual(await etiquetas(null), []);
    assert.deepEqual(await etiquetas(undefined), []);
    assert.deepEqual(await etiquetas(42), []);
    assert.deepEqual(await etiquetas({ a: 1 }), []);
  });
});

describe("prazo", () => {
  test("vazio, nulo e ausente viram null", async () => {
    assert.equal((await criar({ dueDate: null })).dueDate, null);
    assert.equal((await criar({ dueDate: "" })).dueDate, null);
    assert.equal((await criar({})).dueDate, null);
  });

  test("data válida vira ISO", async () => {
    assert.equal((await criar({ dueDate: "2026-10-01" })).dueDate, "2026-10-01T00:00:00.000Z");
  });

  test("data inválida é erro, não silêncio", async () => {
    await assert.rejects(() => criar({ dueDate: "não é data" }), ValidationError);
    await assert.rejects(() => criar({ dueDate: "2026-13-45" }), ValidationError);
  });
});

describe("updateTask", () => {
  test("aplica só os campos enviados", async () => {
    const t = await criar({ title: "Original", client: "A", priority: "baixa" });
    const up = await updateTask(AGENCIA_A, t.id, { title: "  Novo  " });
    assert.equal(up?.title, "Novo");
    assert.equal(up?.client, "A", "o resto fica como estava");
    assert.equal(up?.priority, "baixa");
  });

  test("recusa status, prioridade e título inválidos", async () => {
    const t = await criar();
    await assert.rejects(() => updateTask(AGENCIA_A, t.id, { status: "voando" as never }), ValidationError);
    await assert.rejects(() => updateTask(AGENCIA_A, t.id, { priority: "meh" as never }), ValidationError);
    await assert.rejects(() => updateTask(AGENCIA_A, t.id, { title: "   " }), ValidationError);
    await assert.rejects(() => updateTask(AGENCIA_A, t.id, { dueDate: "ontem de manhã" }), ValidationError);
  });

  test("valida o prazo antes de mexer no arquivo", async () => {
    const t = await criar({ title: "Intacta" });
    await assert.rejects(() => updateTask(AGENCIA_A, t.id, { title: "Mudou", dueDate: "xx" }), ValidationError);
    assert.equal((await getTask(AGENCIA_A, t.id))?.title, "Intacta", "nada foi gravado");
  });

  test("renormaliza as etiquetas do patch", async () => {
    const t = await criar({ labels: ["a"] });
    const up = await updateTask(AGENCIA_A, t.id, { labels: ["#b", "b", "  c  "] });
    assert.deepEqual(up?.labels, ["b", "c"]);
  });

  test("responsável e criador em branco voltam para '—'", async () => {
    const t = await criar({ assignee: "MD", creator: "Felipe" });
    const up = await updateTask(AGENCIA_A, t.id, { assignee: "  ", creator: "" });
    assert.equal(up?.assignee, "—");
    assert.equal(up?.creator, "—");
  });

  test("id que não existe devolve undefined", async () => {
    assert.equal(await updateTask(AGENCIA_A, "nao-existe", { title: "x" }), undefined);
  });

  test("a resposta não compartilha o array de etiquetas com o store", async () => {
    const t = await criar({ labels: ["a", "b"] });
    const up = await updateTask(AGENCIA_A, t.id, { title: "Mesma" });
    up!.labels.push("intruso");
    assert.deepEqual((await getTask(AGENCIA_A, t.id))?.labels, ["a", "b"]);
  });
});

describe("deleteTask e leitura", () => {
  test("apaga uma vez e devolve false na segunda", async () => {
    const t = await criar();
    assert.equal(await deleteTask(AGENCIA_A, t.id), true);
    assert.equal(await deleteTask(AGENCIA_A, t.id), false);
    assert.equal(await getTask(AGENCIA_A, t.id), undefined);
  });

  test("listTasks devolve as mais recentes primeiro", async () => {
    const a = await criar({ title: "Primeira" });
    await new Promise((r) => setTimeout(r, 2));
    const b = await criar({ title: "Segunda" });
    const lista = await listTasks(AGENCIA_A);
    const posA = lista.findIndex((t) => t.id === a.id);
    const posB = lista.findIndex((t) => t.id === b.id);
    assert.ok(posB < posA, "a mais nova vem antes");
  });

  test("mexer no resultado de listTasks não altera o store", async () => {
    const t = await criar({ title: "Estável" });
    const lista = await listTasks(AGENCIA_A);
    lista.find((x) => x.id === t.id)!.title = "Mexido";
    assert.equal((await getTask(AGENCIA_A, t.id))?.title, "Estável");
  });
});

describe("addTaskComment", () => {
  test("acrescenta ao fim, com autor e carimbo de quem chamou", async () => {
    const t = await criar({ title: "Com conversa" });
    assert.deepEqual(t.comments, [], "tarefa nasce sem conversa");

    await addTaskComment(AGENCIA_A, t.id, {
      author: "Ana Costa",
      text: "  Primeiro  ",
    });
    const depois = await addTaskComment(AGENCIA_A, t.id, {
      author: "Felipe Silva",
      text: "Segundo",
    });

    assert.deepEqual(
      depois?.comments.map((c) => [c.author, c.text]),
      [
        ["Ana Costa", "Primeiro"],
        ["Felipe Silva", "Segundo"],
      ],
      "ordem é a da conversa, e o texto é aparado",
    );
    assert.ok(Date.parse(depois!.comments[0].createdAt) > 0, "createdAt é ISO");
    assert.ok(depois!.comments[0].id, "cada comentário tem id próprio");
  });

  test("comentário vazio é erro, não linha em branco", async () => {
    const t = await criar();
    await assert.rejects(
      () => addTaskComment(AGENCIA_A, t.id, { author: "Ana", text: "   " }),
      ValidationError,
    );
    assert.deepEqual((await getTask(AGENCIA_A, t.id))?.comments, []);
  });

  test("texto longo demais é recusado", async () => {
    const t = await criar();
    await assert.rejects(
      () =>
        addTaskComment(AGENCIA_A, t.id, {
          author: "Ana",
          text: "x".repeat(2001),
        }),
      ValidationError,
    );
  });

  test("tarefa inexistente devolve undefined, não cria nada", async () => {
    assert.equal(
      await addTaskComment(AGENCIA_A, "nao-existe", {
        author: "Ana",
        text: "oi",
      }),
      undefined,
    );
  });

  test("autor sem nome vira o traço de sempre", async () => {
    const t = await criar();
    const up = await addTaskComment(AGENCIA_A, t.id, { author: "  ", text: "oi" });
    assert.equal(up?.comments[0].author, "—");
  });

  test("mexer no resultado não altera o store", async () => {
    const t = await criar();
    const up = await addTaskComment(AGENCIA_A, t.id, {
      author: "Ana",
      text: "oi",
    });
    up!.comments.push({
      id: "x",
      author: "Intruso",
      text: "fora",
      createdAt: new Date().toISOString(),
    });
    assert.equal((await getTask(AGENCIA_A, t.id))?.comments.length, 1);
  });
});

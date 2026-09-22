import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A, AGENCIA_B } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

// Antes de qualquer import do store: diretório de dados só deste teste.
usarDataDirTemporario("inbox");

const membro = (
  id: string,
  name: string,
  agencyId: string,
  email = "",
  presence = "disponivel",
) => ({ id, agencyId, name, email, presence });

escreverData("inbox.json", {
  members: [
    membro("felipe", "Felipe", AGENCIA_A.agencyId, "felipe@blackberry.app"),
    membro("marina", "Marina", AGENCIA_A.agencyId, "", "ocupado"),
    membro("ana", "Ana", AGENCIA_A.agencyId, "", "offline"),
    membro("bia", "Bia", AGENCIA_B.agencyId, "bia@outra.app"),
  ],
  conversations: [
    {
      id: "g-monte",
      agencyId: AGENCIA_A.agencyId,
      kind: "grupo",
      name: "Montê bar",
      memberIds: ["felipe", "marina"],
      messages: [
        {
          id: "m1",
          authorId: "marina",
          text: "Subi os artes",
          createdAt: "2026-09-18T12:00:00.000Z",
          kind: "texto",
        },
      ],
      mutedBy: [],
      readAt: {},
      createdAt: "2026-09-18T12:00:00.000Z",
    },
    {
      // Da agência A, mas sem o Felipe dentro: estar na casa não é estar na sala.
      id: "g-sem-felipe",
      agencyId: AGENCIA_A.agencyId,
      kind: "grupo",
      name: "Só Marina e Ana",
      memberIds: ["marina", "ana"],
      messages: [],
      mutedBy: [],
      readAt: {},
      createdAt: "2026-09-18T12:00:00.000Z",
    },
    {
      id: "g-da-b",
      agencyId: AGENCIA_B.agencyId,
      kind: "grupo",
      name: "Time da B",
      memberIds: ["bia"],
      messages: [],
      mutedBy: [],
      readAt: {},
      createdAt: "2026-09-18T12:00:00.000Z",
    },
  ],
});

const {
  ValidationError,
  ensureMember,
  getConversation,
  joinCall,
  leaveCall,
  listConversations,
  listMembers,
  openDirect,
  registerCall,
  sendMessage,
  setMuted,
  setPresence,
  setRead,
} = await import("../src/lib/inbox/repository");

describe("a equipe", () => {
  test("quem já existe é reconhecido pelo e-mail, não duplicado", async () => {
    const me = await ensureMember(AGENCIA_A, {
      name: "Felipe",
      email: "Felipe@Blackberry.app",
    });
    assert.equal(me.id, "felipe");
    assert.equal((await listMembers(AGENCIA_A)).length, 3);
  });

  test("quem entra pela primeira vez vira membro da agência dele", async () => {
    const novo = await ensureMember(AGENCIA_B, {
      name: "Rafael",
      email: "rafael@outra.app",
    });
    assert.equal(novo.agencyId, AGENCIA_B.agencyId);
    assert.equal(novo.presence, "disponivel");
    const nomes = (await listMembers(AGENCIA_B)).map((m) => m.name);
    assert.deepEqual(nomes, ["Bia", "Rafael"]);
    // E a agência A não ganhou ninguém no caminho.
    assert.equal((await listMembers(AGENCIA_A)).length, 3);
  });

  test("trocar o nome na conta atualiza o nome na conversa", async () => {
    const me = await ensureMember(AGENCIA_A, {
      name: "Felipe Ragick",
      email: "felipe@blackberry.app",
    });
    assert.equal(me.id, "felipe");
    assert.equal(me.name, "Felipe Ragick");
    await ensureMember(AGENCIA_A, { name: "Felipe", email: "felipe@blackberry.app" });
  });

  test("a disponibilidade é só sua, e só existe se for da escala", async () => {
    assert.equal((await setPresence(AGENCIA_A, "felipe", "ausente"))?.presence, "ausente");
    await assert.rejects(
      () => setPresence(AGENCIA_A, "felipe", "invisível" as never),
      ValidationError,
    );
    // Membro de outra agência não muda por aqui.
    assert.equal(await setPresence(AGENCIA_A, "bia", "offline"), undefined);
    await setPresence(AGENCIA_A, "felipe", "disponivel");
  });
});

describe("quem enxerga qual conversa", () => {
  test("a lista traz só as conversas em que a pessoa está", async () => {
    const minhas = await listConversations(AGENCIA_A, "felipe");
    assert.deepEqual(minhas.map((c) => c.id), ["g-monte"]);
  });

  test("conversa da mesma agência sem você dentro responde como inexistente", async () => {
    assert.equal(
      await getConversation(AGENCIA_A, "felipe", "g-sem-felipe"),
      undefined,
    );
  });

  test("conversa de outra agência também é inexistente", async () => {
    assert.equal(await getConversation(AGENCIA_A, "felipe", "g-da-b"), undefined);
    assert.equal(await getConversation(AGENCIA_B, "bia", "g-monte"), undefined);
  });

  test("e nem escrever nela dá", async () => {
    assert.equal(
      await sendMessage(AGENCIA_A, "felipe", "g-da-b", "oi"),
      undefined,
    );
    assert.equal(await setMuted(AGENCIA_A, "felipe", "g-sem-felipe", true), undefined);
  });
});

describe("mandar mensagem", () => {
  test("o autor é quem chama, e a conversa volta com ela no fim", async () => {
    const c = await sendMessage(AGENCIA_A, "felipe", "g-monte", "  combinado  ");
    const ultima = c!.messages[c!.messages.length - 1];
    assert.equal(ultima.authorId, "felipe");
    assert.equal(ultima.text, "combinado", "o texto é aparado");
    assert.equal(ultima.kind, "texto");
    assert.equal(c!.unread, 0, "quem escreve já leu o que escreveu");
  });

  test("mensagem vazia e mensagem gigante não entram", async () => {
    await assert.rejects(
      () => sendMessage(AGENCIA_A, "felipe", "g-monte", "   "),
      ValidationError,
    );
    await assert.rejects(
      () => sendMessage(AGENCIA_A, "felipe", "g-monte", "x".repeat(4001)),
      ValidationError,
    );
  });
});

describe("chamada", () => {
  test("deixa no histórico a linha de sistema, com o nome vindo da sessão", async () => {
    const c = await registerCall(AGENCIA_A, "felipe", "g-monte", 12 * 60);
    const ultima = c!.messages[c!.messages.length - 1];
    assert.equal(ultima.kind, "chamada");
    assert.equal(ultima.text, "Felipe iniciou uma chamada que durou 12 minutos.");
  });

  test("duração impossível não vira registro", async () => {
    await assert.rejects(
      () => registerCall(AGENCIA_A, "felipe", "g-monte", -5),
      ValidationError,
    );
    await assert.rejects(
      () => registerCall(AGENCIA_A, "felipe", "g-monte", Number.NaN),
      ValidationError,
    );
  });

  test("chamada de dias é cortada no teto", async () => {
    const c = await registerCall(AGENCIA_A, "felipe", "g-monte", 99 * 60 * 60);
    const ultima = c!.messages[c!.messages.length - 1];
    assert.equal(ultima.text, "Felipe iniciou uma chamada que durou 480 minutos.");
  });
});

describe("lida, não lida e silenciada", () => {
  test("marcar como não lida traz o badge de volta", async () => {
    await sendMessage(AGENCIA_A, "marina", "g-monte", "e aí?");
    assert.equal((await setRead(AGENCIA_A, "felipe", "g-monte", true))?.unread, 0);
    assert.equal((await setRead(AGENCIA_A, "felipe", "g-monte", false))?.unread, 1);
    await setRead(AGENCIA_A, "felipe", "g-monte", true);
  });

  test("silenciar vale para quem silenciou, não para a conversa", async () => {
    assert.equal((await setMuted(AGENCIA_A, "felipe", "g-monte", true))?.muted, true);
    const daMarina = await listConversations(AGENCIA_A, "marina");
    assert.equal(daMarina.find((c) => c.id === "g-monte")?.muted, false);
    assert.equal((await setMuted(AGENCIA_A, "felipe", "g-monte", false))?.muted, false);
  });
});

describe("abrir uma direta", () => {
  test("a segunda vez devolve a mesma conversa, não um histórico paralelo", async () => {
    const primeira = await openDirect(AGENCIA_A, "felipe", "ana");
    await sendMessage(AGENCIA_A, "felipe", primeira!.id, "oi Ana");
    const segunda = await openDirect(AGENCIA_A, "felipe", "ana");
    assert.equal(segunda!.id, primeira!.id);
    assert.equal(segunda!.messages.length, 1);
    assert.equal(segunda!.title, "Ana");
  });

  test("com alguém de outra agência não abre", async () => {
    assert.equal(await openDirect(AGENCIA_A, "felipe", "bia"), undefined);
  });

  test("consigo mesmo não existe", async () => {
    await assert.rejects(
      () => openDirect(AGENCIA_A, "felipe", "felipe"),
      ValidationError,
    );
  });
});

describe("chamada em andamento", () => {
  test("quem entra abre a chamada; entrar de novo não duplica ninguém", async () => {
    const um = await joinCall(AGENCIA_A, "felipe", "g-monte");
    assert.deepEqual(um!.callMemberIds, ["felipe"]);
    const outra = await joinCall(AGENCIA_A, "marina", "g-monte");
    assert.deepEqual(outra!.callMemberIds, ["felipe", "marina"]);
    const denovo = await joinCall(AGENCIA_A, "marina", "g-monte");
    assert.deepEqual(denovo!.callMemberIds, ["felipe", "marina"]);
  });

  test("sair não fecha a chamada enquanto ainda tem gente nela", async () => {
    const antes = (await getConversation(AGENCIA_A, "felipe", "g-monte"))!.messages.length;
    const saiu = await leaveCall(AGENCIA_A, "marina", "g-monte");
    assert.deepEqual(saiu!.callMemberIds, ["felipe"]);
    assert.equal(saiu!.messages.length, antes, "ninguém escreveu no histórico ainda");
  });

  test("o último a sair fecha, e a linha fica com o nome de quem começou", async () => {
    const fim = await leaveCall(AGENCIA_A, "felipe", "g-monte");
    assert.deepEqual(fim!.callMemberIds, []);
    const ultima = fim!.messages[fim!.messages.length - 1];
    assert.equal(ultima.kind, "chamada");
    assert.match(ultima.text, /^Felipe iniciou uma chamada que durou/);
  });

  test("sair de uma chamada que não existe não inventa registro", async () => {
    const antes = (await getConversation(AGENCIA_A, "felipe", "g-monte"))!.messages.length;
    const c = await leaveCall(AGENCIA_A, "felipe", "g-monte");
    assert.equal(c!.messages.length, antes);
  });

  test("chamada de outra agência (ou de conversa alheia) não existe", async () => {
    assert.equal(await joinCall(AGENCIA_A, "felipe", "g-da-b"), undefined);
    assert.equal(await joinCall(AGENCIA_A, "felipe", "g-sem-felipe"), undefined);
  });
});

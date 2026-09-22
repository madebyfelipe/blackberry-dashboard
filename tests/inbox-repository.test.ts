import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A, AGENCIA_B } from "./helpers/agency";
import { escreverData, usarDataDirTemporario } from "./helpers/data-dir";

// Antes de qualquer import do store: diretório de dados só deste teste.
usarDataDirTemporario("inbox");

const HORA = 60 * 60 * 1000;

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
      // Todo mundo calou há 3h: chamada abandonada, fecha na próxima leitura.
      id: "g-fantasma",
      agencyId: AGENCIA_A.agencyId,
      kind: "grupo",
      name: "Fantasma",
      memberIds: ["felipe", "marina"],
      messages: [],
      mutedBy: [],
      readAt: {},
      call: {
        startedBy: "marina",
        startedAt: new Date(Date.now() - 5 * HORA).toISOString(),
        memberIds: ["felipe", "marina"],
        seenAt: {
          felipe: new Date(Date.now() - 4 * HORA).toISOString(),
          marina: new Date(Date.now() - 3 * HORA).toISOString(),
        },
      },
      createdAt: "2026-09-18T12:00:00.000Z",
    },
    {
      // Começou há 5h e todo mundo segue dando sinal: é chamada, não fantasma.
      id: "g-longa",
      agencyId: AGENCIA_A.agencyId,
      kind: "grupo",
      name: "Longa",
      memberIds: ["felipe", "marina"],
      messages: [],
      mutedBy: [],
      readAt: {},
      call: {
        startedBy: "felipe",
        startedAt: new Date(Date.now() - 5 * HORA).toISOString(),
        memberIds: ["felipe", "marina"],
        seenAt: { felipe: new Date().toISOString(), marina: new Date().toISOString() },
      },
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
  addGroupMember,
  createGroup,
  ensureMember,
  getConversation,
  joinCall,
  leaveCall,
  touchCall,
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
    assert.deepEqual(minhas.map((c) => c.id), ["g-monte", "g-fantasma", "g-longa"]);
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
    assert.equal(ultima.text, "Felipe iniciou uma chamada que durou 8 horas.");
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

describe("chamada longa e chamada abandonada", () => {
  test("chamada de 5h com todo mundo dando sinal continua de pé", async () => {
    const c = await getConversation(AGENCIA_A, "felipe", "g-longa");
    assert.deepEqual(c!.callMemberIds, ["felipe", "marina"]);
    const lista = await listConversations(AGENCIA_A, "felipe");
    assert.deepEqual(lista.find((x) => x.id === "g-longa")!.callMemberIds, ["felipe", "marina"]);
  });

  test("chamada em que todo mundo sumiu fecha sozinha, com a duração até o último sinal", async () => {
    const c = await getConversation(AGENCIA_A, "felipe", "g-fantasma");
    assert.deepEqual(c!.callMemberIds, []);
    const ultima = c!.messages[c!.messages.length - 1];
    assert.equal(ultima.kind, "chamada");
    // Começou há 5h, último sinal há 3h: durou 2h, não 5h.
    assert.equal(ultima.text, "Marina iniciou uma chamada que durou 2 horas.");
    // E fechar não duplica a linha na leitura seguinte.
    const denovo = await getConversation(AGENCIA_A, "felipe", "g-fantasma");
    assert.equal(denovo!.messages.length, c!.messages.length);
  });

  test("o sinal de vida mantém você na chamada; fora dela, não reabre nada", async () => {
    await joinCall(AGENCIA_A, "felipe", "g-monte");
    const dentro = await touchCall(AGENCIA_A, "felipe", "g-monte");
    assert.equal(dentro!.inCall, true);
    assert.equal(dentro!.changed, false);
    await leaveCall(AGENCIA_A, "felipe", "g-monte");
    const fora = await touchCall(AGENCIA_A, "felipe", "g-monte");
    assert.equal(fora!.inCall, false);
    assert.deepEqual(fora!.conversation.callMemberIds, []);
  });

  test("o sinal de vida de conversa alheia não existe", async () => {
    assert.equal(await touchCall(AGENCIA_A, "felipe", "g-da-b"), undefined);
    assert.equal(await touchCall(AGENCIA_A, "felipe", "g-sem-felipe"), undefined);
  });
});

describe("grupos", () => {
  test("adicionar alguém numa direta cria um grupo com as três pessoas", async () => {
    const g = await createGroup(AGENCIA_A, "felipe", ["marina", "ana"]);
    assert.equal(g!.kind, "grupo");
    assert.deepEqual(g!.memberIds, ["felipe", "marina", "ana"]);
    // Sem nome, o título é quem está nele — sem você.
    assert.equal(g!.title, "Marina e Ana");
    assert.equal(g!.initials[0], "MA");
    assert.equal(g!.messages[0].kind, "aviso");
    assert.equal(g!.messages[0].text, "Felipe criou o grupo.");
    // E quem foi incluído vê o grupo na lista dele.
    const daAna = await listConversations(AGENCIA_A, "ana");
    assert.ok(daAna.some((c) => c.id === g!.id));
  });

  test("você entra sempre, e repetição não duplica ninguém", async () => {
    const g = await createGroup(AGENCIA_A, "felipe", ["marina", "ana", "ana", "felipe"]);
    assert.deepEqual(g!.memberIds, ["felipe", "marina", "ana"]);
  });

  test("grupo precisa de pelo menos mais duas pessoas", async () => {
    await assert.rejects(() => createGroup(AGENCIA_A, "felipe", ["marina"]), ValidationError);
  });

  test("gente de outra agência derruba o grupo inteiro — nada é criado pela metade", async () => {
    const antes = (await listConversations(AGENCIA_A, "felipe")).length;
    assert.equal(await createGroup(AGENCIA_A, "felipe", ["marina", "bia"]), undefined);
    assert.equal((await listConversations(AGENCIA_A, "felipe")).length, antes);
  });

  test("adicionar a um grupo: entra, com aviso de quem trouxe quem", async () => {
    const c = await addGroupMember(AGENCIA_A, "felipe", "g-monte", "ana");
    assert.deepEqual(c!.memberIds, ["felipe", "marina", "ana"]);
    const ultima = c!.messages[c!.messages.length - 1];
    assert.equal(ultima.kind, "aviso");
    assert.equal(ultima.text, "Felipe adicionou Ana.");
    // E agora a Ana lê o grupo.
    assert.ok(await getConversation(AGENCIA_A, "ana", "g-monte"));
  });

  test("quem já está não entra de novo", async () => {
    await assert.rejects(
      () => addGroupMember(AGENCIA_A, "felipe", "g-monte", "marina"),
      ValidationError,
    );
  });

  test("numa direta, adicionar não mexe nela: é outro caminho", async () => {
    const d = await openDirect(AGENCIA_A, "felipe", "marina");
    await assert.rejects(() => addGroupMember(AGENCIA_A, "felipe", d!.id, "ana"), ValidationError);
  });

  test("grupo alheio, de outra agência, ou pessoa de fora: não existe", async () => {
    assert.equal(await addGroupMember(AGENCIA_A, "felipe", "g-sem-felipe", "ana"), undefined);
    assert.equal(await addGroupMember(AGENCIA_A, "felipe", "g-da-b", "ana"), undefined);
    assert.equal(await addGroupMember(AGENCIA_A, "felipe", "g-longa", "bia"), undefined);
  });
});

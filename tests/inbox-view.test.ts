import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A } from "./helpers/agency";
import {
  callClock,
  callSummary,
  conversationTitle,
  dayLabel,
  groupByDay,
  listTime,
  matchesQuery,
  previewOf,
  searchMessages,
  sortSummaries,
  splitByKind,
  startsBlock,
  summarize,
  unreadCount,
} from "../src/lib/inbox/view";
import type {
  Conversation,
  ConversationSummary,
  InboxMember,
  Message,
} from "../src/lib/inbox/types";

/*
 * A régua da tela do Inbox: título, prévia, não lidas, ordem, agrupamento por
 * dia e os carimbos de hora. Tudo função pura — é o que permite conferir o
 * comportamento sem subir o app nem abrir uma conversa.
 */

const MEMBROS: InboxMember[] = [
  { id: "felipe", agencyId: AGENCIA_A.agencyId, name: "Felipe", email: "f@bb.app", presence: "disponivel" },
  { id: "marina", agencyId: AGENCIA_A.agencyId, name: "Marina", email: "", presence: "ocupado" },
  { id: "ana", agencyId: AGENCIA_A.agencyId, name: "Ana", email: "", presence: "offline" },
];

function msg(over: Partial<Message> & { id: string }): Message {
  return {
    authorId: "marina",
    text: "oi",
    createdAt: "2026-09-18T12:00:00.000Z",
    kind: "texto",
    ...over,
  };
}

function conversa(over: Partial<Conversation> = {}): Conversation {
  return {
    id: "c1",
    agencyId: AGENCIA_A.agencyId,
    kind: "grupo",
    name: "Montê bar",
    memberIds: ["felipe", "marina", "ana"],
    messages: [],
    mutedBy: [],
    readAt: {},
    call: null,
    createdAt: "2026-09-18T12:00:00.000Z",
    ...over,
  };
}

/** Local, para o teste não depender do fuso da máquina que roda. */
function local(dia: number, hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  return new Date(2026, 8, dia, h, m, 0, 0).toISOString();
}

describe("título da conversa", () => {
  test("grupo mostra o nome do grupo", () => {
    assert.equal(conversationTitle(conversa(), MEMBROS, "felipe"), "Montê bar");
  });

  test("direta mostra quem está do outro lado — e o outro lado depende de quem olha", () => {
    const dm = conversa({ kind: "direta", name: "", memberIds: ["felipe", "marina"] });
    assert.equal(conversationTitle(dm, MEMBROS, "felipe"), "Marina");
    assert.equal(conversationTitle(dm, MEMBROS, "marina"), "Felipe");
  });
});

describe("prévia da lista", () => {
  test("no grupo, a prévia diz quem falou", () => {
    const c = conversa({ messages: [msg({ id: "m1", text: "fechei o export ok" })] });
    assert.equal(previewOf(c, MEMBROS, "felipe"), "Marina: fechei o export ok");
  });

  test("o que você mesmo escreveu vem com 'Você:'", () => {
    const c = conversa({
      messages: [msg({ id: "m1", authorId: "felipe", text: "subi os artes" })],
    });
    assert.equal(previewOf(c, MEMBROS, "felipe"), "Você: subi os artes");
  });

  test("na direta o nome do outro não se repete a cada linha", () => {
    const c = conversa({
      kind: "direta",
      memberIds: ["felipe", "marina"],
      messages: [msg({ id: "m1", text: "boa, deixa comigo" })],
    });
    assert.equal(previewOf(c, MEMBROS, "felipe"), "boa, deixa comigo");
  });

  test("linha de sistema vai inteira, sem autor grudado na frente", () => {
    const c = conversa({
      messages: [
        msg({ id: "m1", kind: "chamada", text: "Marina iniciou uma chamada que durou 12 minutos." }),
      ],
    });
    assert.equal(
      previewOf(c, MEMBROS, "felipe"),
      "Marina iniciou uma chamada que durou 12 minutos.",
    );
  });

  test("conversa sem mensagem não inventa prévia", () => {
    assert.equal(previewOf(conversa(), MEMBROS, "felipe"), "");
  });
});

describe("não lidas", () => {
  const c = conversa({
    messages: [
      msg({ id: "m1", createdAt: local(18, "09:00") }),
      msg({ id: "m2", createdAt: local(18, "10:00") }),
      msg({ id: "m3", authorId: "felipe", createdAt: local(18, "11:00") }),
      msg({ id: "m4", kind: "aviso", text: "Marina fixou uma mensagem.", createdAt: local(18, "12:00") }),
    ],
    readAt: { felipe: local(18, "09:30") },
  });

  test("conta o que chegou depois da última leitura", () => {
    assert.equal(unreadCount(c, "felipe"), 1);
  });

  test("o que você escreveu não conta como não lido", () => {
    assert.equal(unreadCount({ ...c, readAt: {} }, "felipe"), 2);
  });

  test("linha de sistema não gera badge", () => {
    const so = conversa({
      messages: [msg({ id: "m1", kind: "chamada", text: "…" })],
      readAt: {},
    });
    assert.equal(unreadCount(so, "felipe"), 0);
  });

  test("quem nunca leu vê tudo que é dos outros", () => {
    assert.equal(unreadCount(c, "ana"), 3);
  });
});

describe("resumo da conversa", () => {
  test("grupo: duas iniciais, contagem de gente e de quem está online", () => {
    const s = summarize(conversa(), MEMBROS, "felipe");
    assert.equal(s.title, "Montê bar");
    assert.deepEqual(s.initials, ["MB", "M"]);
    assert.equal(s.memberCount, 3);
    // Ana está offline; ocupado continua sendo estar por perto.
    assert.equal(s.onlineCount, 2);
    assert.equal(s.presence, null);
  });

  test("direta: uma inicial e a presença de quem está do outro lado", () => {
    const s = summarize(
      conversa({ kind: "direta", memberIds: ["felipe", "ana"] }),
      MEMBROS,
      "felipe",
    );
    assert.equal(s.title, "Ana");
    assert.deepEqual(s.initials, ["A"]);
    assert.equal(s.presence, "offline");
  });

  test("silenciada é por pessoa, não pela conversa toda", () => {
    const c = conversa({ mutedBy: ["felipe"] });
    assert.equal(summarize(c, MEMBROS, "felipe").muted, true);
    assert.equal(summarize(c, MEMBROS, "marina").muted, false);
  });
});

describe("ordem e seções da lista", () => {
  const item = (over: Partial<ConversationSummary>): ConversationSummary => ({
    id: "x",
    kind: "grupo",
    title: "X",
    initials: ["X"],
    preview: "",
    lastAt: null,
    unread: 0,
    muted: false,
    presence: null,
    memberIds: ["felipe", "marina"],
    memberCount: 2,
    onlineCount: 1,
    callMemberIds: [],
    ...over,
  });

  test("mais recente primeiro; conversa sem mensagem fica no fim", () => {
    const ordered = sortSummaries([
      item({ id: "antiga", lastAt: local(10, "09:00") }),
      item({ id: "vazia" }),
      item({ id: "nova", lastAt: local(20, "09:00") }),
    ]);
    assert.deepEqual(
      ordered.map((c) => c.id),
      ["nova", "antiga", "vazia"],
    );
  });

  test("grupos e diretas são duas seções", () => {
    const { grupos, diretas } = splitByKind([
      item({ id: "g" }),
      item({ id: "d", kind: "direta" }),
    ]);
    assert.deepEqual(grupos.map((c) => c.id), ["g"]);
    assert.deepEqual(diretas.map((c) => c.id), ["d"]);
  });

  test("a busca ignora acento e caixa, e também procura na prévia", () => {
    const c = item({ title: "Montê bar", preview: "Marina: fechei o export" });
    assert.equal(matchesQuery(c, "monte"), true);
    assert.equal(matchesQuery(c, "MONTÊ"), true);
    assert.equal(matchesQuery(c, "export"), true);
    assert.equal(matchesQuery(c, "aurora"), false);
    assert.equal(matchesQuery(c, "   "), true, "busca vazia não filtra nada");
  });
});

describe("histórico", () => {
  test("a busca dentro da conversa acha o que ficou salvo", () => {
    const messages = [
      msg({ id: "m1", text: "Subi os artes revisados" }),
      msg({ id: "m2", text: "cliente pediu ajuste na laranja" }),
    ];
    assert.deepEqual(
      searchMessages(messages, "LARANJA").map((m) => m.id),
      ["m2"],
    );
    assert.equal(searchMessages(messages, "").length, 2);
  });

  test("as mensagens se agrupam por dia de calendário", () => {
    const days = groupByDay([
      msg({ id: "m1", createdAt: local(18, "23:50") }),
      msg({ id: "m2", createdAt: local(19, "00:10") }),
      msg({ id: "m3", createdAt: local(19, "09:00") }),
    ]);
    assert.equal(days.length, 2);
    assert.deepEqual(days[1].messages.map((m) => m.id), ["m2", "m3"]);
  });

  test("a divisória diz HOJE e ONTEM antes de dizer a data", () => {
    const agora = new Date(2026, 8, 22, 10, 0, 0).getTime();
    assert.equal(dayLabel(new Date(2026, 8, 22, 8, 0, 0).toISOString(), agora), "HOJE");
    assert.equal(dayLabel(new Date(2026, 8, 21, 23, 0, 0).toISOString(), agora), "ONTEM");
    assert.equal(
      dayLabel(new Date(2026, 8, 18, 9, 0, 0).toISOString(), agora),
      "SEXTA, 18 DE SETEMBRO",
    );
  });

  test("falas seguidas do mesmo autor viram um bloco só", () => {
    const a = msg({ id: "m1", createdAt: local(18, "09:14") });
    const b = msg({ id: "m2", createdAt: local(18, "09:16") });
    const c = msg({ id: "m3", createdAt: local(18, "09:40") });
    const outro = msg({ id: "m4", authorId: "ana", createdAt: local(18, "09:17") });

    assert.equal(startsBlock(a, undefined), true, "a primeira sempre abre");
    assert.equal(startsBlock(b, a), false, "dois minutos depois, é continuação");
    assert.equal(startsBlock(c, b), true, "meia hora depois, abre de novo");
    assert.equal(startsBlock(outro, a), true, "outra pessoa sempre abre");
    assert.equal(
      startsBlock(msg({ id: "m5", kind: "chamada", createdAt: local(18, "09:15") }), a),
      true,
      "linha de sistema nunca entra no bloco de ninguém",
    );
  });
});

describe("carimbos de hora", () => {
  const agora = new Date(2026, 8, 22, 12, 0, 0).getTime();

  test("a lista escreve a hora hoje, 'ontem' ontem, o dia da semana na semana e a data depois", () => {
    assert.equal(listTime(new Date(agora - 30_000).toISOString(), agora), "agora");
    assert.equal(listTime(new Date(2026, 8, 22, 10, 24, 0).toISOString(), agora), "10:24");
    assert.equal(listTime(new Date(2026, 8, 21, 18, 0, 0).toISOString(), agora), "ontem");
    assert.equal(listTime(new Date(2026, 8, 19, 18, 0, 0).toISOString(), agora), "sáb");
    assert.equal(listTime(new Date(2026, 8, 12, 18, 0, 0).toISOString(), agora), "12/09");
    assert.equal(listTime(null, agora), "");
  });
});

describe("chamada", () => {
  test("a frase do histórico é a do desenho", () => {
    assert.equal(
      callSummary("Marina", 12 * 60),
      "Marina iniciou uma chamada que durou 12 minutos.",
    );
    assert.equal(
      callSummary("Felipe", 60),
      "Felipe iniciou uma chamada que durou 1 minuto.",
    );
  });

  test("abaixo de um minuto a conta é em segundos — 0 minutos seria dizer que não houve chamada", () => {
    assert.equal(callSummary("Ana", 48), "Ana iniciou uma chamada que durou 48 segundos.");
    assert.equal(callSummary("Ana", 1), "Ana iniciou uma chamada que durou 1 segundo.");
  });

  test("o cronômetro só mostra hora quando passa de uma", () => {
    assert.equal(callClock(0), "00:00");
    assert.equal(callClock(42), "00:42");
    assert.equal(callClock(723), "12:03");
    assert.equal(callClock(3735), "1:02:15");
  });
});

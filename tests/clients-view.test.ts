import assert from "node:assert/strict";
import test, { describe } from "node:test";

import type { Client, ClientStatus } from "../src/lib/clients/types";
import {
  billingLabel,
  clientStatusLabel,
  isClientStatus,
  servicesLabel,
} from "../src/lib/clients/constants";
import {
  applyClientFilters,
  countActiveClientFilters,
  distinctServices,
  distinctValues,
  groupClients,
  sortClients,
  toggleClientColumn,
  CLIENT_COLUMN_OPTIONS,
  EMPTY_CLIENT_FILTERS,
  DEFAULT_CLIENT_DISPLAY,
} from "../src/lib/clients/view";
import { AGENCIA_A } from "./helpers/agency";

function cliente(over: Partial<Client> = {}): Client {
  return {
    id: "c0",
    agencyId: AGENCIA_A.agencyId,
    name: "Clínica Aurora",
    segment: "Estética facial",
    services: ["Instagram", "Blog"],
    city: "",
    email: "",
    phone: "",
    owner: "Fernanda",
    billingDay: 5,
    status: "ativo",
    squad: [],
    flowId: null,
    createdAt: "2026-09-01T09:00:00.000Z",
    ...over,
  };
}

const CARTEIRA: Client[] = [
  cliente({ id: "c1", name: "Café Raízes", segment: "Alimentação", owner: "Fernanda", services: ["Instagram", "Influencers"], billingDay: 8, status: "risco", createdAt: "2026-09-03T09:00:00.000Z" }),
  cliente({ id: "c2", name: "Auto Peças União", segment: "Automotivo", owner: "Marcos", services: ["Google Ads"], billingDay: 12, status: "pausado", createdAt: "2026-09-01T09:00:00.000Z" }),
  cliente({ id: "c3", name: "Tech Norte", segment: "Tecnologia", owner: "Rafael", services: ["LinkedIn", "Ads", "Site"], billingDay: 28, status: "vip", createdAt: "2026-09-05T09:00:00.000Z" }),
  cliente({ id: "c4", name: "Óptica Lumen", segment: "Óptica", owner: "Rafael", services: ["Google Ads", "Site"], billingDay: null, status: "novo", createdAt: "2026-09-04T09:00:00.000Z" }),
];

describe("régua de status do cliente", () => {
  test("os seis degraus do export existem e se reconhecem", () => {
    const ids: ClientStatus[] = [
      "ativo",
      "renovacao",
      "risco",
      "pausado",
      "novo",
      "vip",
    ];
    for (const id of ids) assert.ok(isClientStatus(id), `${id} é status`);
    assert.equal(isClientStatus("campeao"), false);
    assert.equal(clientStatusLabel("renovacao"), "Renovação");
    assert.equal(clientStatusLabel("risco"), "Em risco");
  });
});

describe("rótulos das células", () => {
  test("faturamento vira 'Dia 08' e traço quando não há dia", () => {
    assert.equal(billingLabel(8), "Dia 08");
    assert.equal(billingLabel(28), "Dia 28");
    assert.equal(billingLabel(null), "—");
  });

  test("serviços mostram dois e contam o resto", () => {
    assert.equal(servicesLabel(["Instagram", "Blog", "E-mail"]), "Instagram, Blog +1");
    assert.equal(servicesLabel(["Instagram", "Blog"]), "Instagram, Blog");
    assert.equal(servicesLabel(["Google Ads"]), "Google Ads");
    assert.equal(servicesLabel([]), "—");
    assert.equal(
      servicesLabel(["Instagram", "Blog", "E-mail", "Site"], 3),
      "Instagram, Blog, E-mail +1",
      "o card mostra três",
    );
  });
});

describe("filtros", () => {
  test("sem filtro e sem busca, passa tudo", () => {
    const out = applyClientFilters(CARTEIRA, EMPTY_CLIENT_FILTERS, "");
    assert.equal(out.length, CARTEIRA.length);
    assert.equal(countActiveClientFilters(EMPTY_CLIENT_FILTERS), 0);
  });

  test("status, segmento e responsável se somam (E entre dimensões)", () => {
    const out = applyClientFilters(
      CARTEIRA,
      { ...EMPTY_CLIENT_FILTERS, owner: ["Rafael"], status: ["vip"] },
      "",
    );
    assert.deepEqual(out.map((c) => c.name), ["Tech Norte"]);
  });

  test("serviço casa se o cliente tiver qualquer um dos escolhidos", () => {
    const out = applyClientFilters(
      CARTEIRA,
      { ...EMPTY_CLIENT_FILTERS, service: ["Site"] },
      "",
    );
    assert.deepEqual(out.map((c) => c.id).sort(), ["c3", "c4"]);
  });

  test("busca olha nome, segmento, responsável e serviços", () => {
    const busca = (q: string) =>
      applyClientFilters(CARTEIRA, EMPTY_CLIENT_FILTERS, q).map((c) => c.id);
    assert.deepEqual(busca("raízes"), ["c1"], "nome, sem caso");
    assert.deepEqual(busca("automotivo"), ["c2"], "segmento");
    assert.deepEqual(busca("marcos"), ["c2"], "responsável");
    assert.deepEqual(busca("influencers"), ["c1"], "serviço");
    assert.deepEqual(busca("   "), ["c1", "c2", "c3", "c4"], "busca em branco não filtra");
  });

  test("a contagem de filtros ativos soma as quatro dimensões", () => {
    assert.equal(
      countActiveClientFilters({
        status: ["ativo", "vip"],
        segment: ["Óptica"],
        owner: [],
        service: ["Site"],
      }),
      4,
    );
  });
});

describe("ordenação", () => {
  const nomes = (sort: (typeof DEFAULT_CLIENT_DISPLAY)["sort"]) =>
    sortClients(CARTEIRA, { ...DEFAULT_CLIENT_DISPLAY, sort }).map((c) => c.name);

  test("A–Z é o padrão e respeita acento do português", () => {
    assert.deepEqual(nomes("az"), [
      "Auto Peças União",
      "Café Raízes",
      "Óptica Lumen",
      "Tech Norte",
    ]);
  });

  test("Z–A é o inverso", () => {
    assert.deepEqual(nomes("za"), [...nomes("az")].reverse());
  });

  test("por dia de faturamento, quem não tem dia vai para o fim", () => {
    assert.deepEqual(nomes("faturamento"), [
      "Café Raízes",
      "Auto Peças União",
      "Tech Norte",
      "Óptica Lumen",
    ]);
  });

  test("mais recentes primeiro", () => {
    assert.deepEqual(nomes("recentes")[0], "Tech Norte");
  });

  test("ordenar não altera a lista de origem", () => {
    const antes = CARTEIRA.map((c) => c.id);
    sortClients(CARTEIRA, { ...DEFAULT_CLIENT_DISPLAY, sort: "za" });
    assert.deepEqual(CARTEIRA.map((c) => c.id), antes);
  });
});

describe("valores distintos para os menus", () => {
  test("segmento e responsável saem ordenados e sem repetição", () => {
    assert.deepEqual(distinctValues(CARTEIRA, "owner"), [
      "Fernanda",
      "Marcos",
      "Rafael",
    ]);
    assert.deepEqual(distinctValues(CARTEIRA, "segment"), [
      "Alimentação",
      "Automotivo",
      "Óptica",
      "Tecnologia",
    ]);
  });

  test("o traço de 'sem responsável' não vira opção de filtro", () => {
    const comVazio = [...CARTEIRA, cliente({ id: "c9", owner: "—" })];
    assert.equal(distinctValues(comVazio, "owner").includes("—"), false);
  });

  test("serviços distintos juntam os de todos os clientes", () => {
    assert.deepEqual(distinctServices(CARTEIRA), [
      "Ads",
      "Google Ads",
      "Influencers",
      "Instagram",
      "LinkedIn",
      "Site",
    ]);
  });
});

describe("agrupamento da lista de clientes", () => {
  test("sem agrupamento é um grupo só, com todos", () => {
    const grupos = groupClients(CARTEIRA, "nenhum");
    assert.equal(grupos.length, 1);
    assert.equal(grupos[0].clients.length, CARTEIRA.length);
  });

  test("por status segue a ordem da régua de saúde, não o alfabeto", () => {
    const grupos = groupClients(CARTEIRA, "status");
    const ordem = grupos.map((g) => g.key);
    assert.deepEqual(
      ordem,
      ordem.slice().sort(
        (a, b) =>
          ["ativo", "renovacao", "risco", "pausado", "novo", "vip"].indexOf(a) -
          ["ativo", "renovacao", "risco", "pausado", "novo", "vip"].indexOf(b),
      ),
    );
  });

  test("grupo vazio só aparece quando o menu pede", () => {
    const so = CARTEIRA.filter((c) => c.status === "risco");
    assert.equal(groupClients(so, "status").length, 1);
    assert.equal(
      groupClients(so, "status", { showEmpty: true }).length,
      6,
      "os seis degraus da régua, mesmo sem cliente",
    );
  });

  test("segmento e responsável vazios ganham rótulo próprio", () => {
    const orfao = cliente({ id: "cx", segment: "", owner: "—" });
    assert.equal(groupClients([orfao], "segment")[0].label, "Sem segmento");
    assert.equal(groupClients([orfao], "owner")[0].label, "Sem responsável");
  });

  test("todo cliente cai em exatamente um grupo", () => {
    for (const key of ["status", "segment", "owner"] as const) {
      const total = groupClients(CARTEIRA, key).reduce(
        (n, g) => n + g.clients.length,
        0,
      );
      assert.equal(total, CARTEIRA.length, `agrupando por ${key}`);
    }
  });
});

describe("opções da lista de clientes", () => {
  test("'Mostrar arquivados' desligado esconde os pausados", () => {
    const comPausado = applyClientFilters(CARTEIRA, EMPTY_CLIENT_FILTERS, "", {
      showArchived: true,
    });
    const sem = applyClientFilters(CARTEIRA, EMPTY_CLIENT_FILTERS, "", {
      showArchived: false,
    });
    assert.ok(comPausado.some((c) => c.status === "pausado"));
    assert.equal(sem.some((c) => c.status === "pausado"), false);
  });

  test("o padrão da tela mostra os cinco chips acesos do desenho", () => {
    assert.deepEqual(DEFAULT_CLIENT_DISPLAY.columns, [
      "segment",
      "services",
      "owner",
      "billing",
      "status",
    ]);
  });

  test("todo chip do menu é uma coluna que a lista sabe desenhar", () => {
    for (const opt of CLIENT_COLUMN_OPTIONS) {
      assert.ok(
        toggleClientColumn([], opt.id).includes(opt.id),
        `${opt.id} liga e desliga`,
      );
    }
  });

  test("ligar e desligar a mesma coluna volta ao começo", () => {
    const uma = toggleClientColumn(["status"], "segment");
    assert.deepEqual(uma, ["status", "segment"]);
    assert.deepEqual(toggleClientColumn(uma, "segment"), ["status"]);
  });

  test("a busca também acha pela cidade e pelo e-mail do contato", () => {
    const comContato = cliente({
      id: "cc",
      name: "Studio Raiz",
      city: "Sorocaba",
      email: "alo@studioraiz.com",
    });
    const carteira = [...CARTEIRA, comContato];
    assert.deepEqual(
      applyClientFilters(carteira, EMPTY_CLIENT_FILTERS, "sorocaba").map((c) => c.id),
      ["cc"],
    );
    assert.deepEqual(
      applyClientFilters(carteira, EMPTY_CLIENT_FILTERS, "alo@studio").map((c) => c.id),
      ["cc"],
    );
  });
});

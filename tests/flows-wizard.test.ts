import assert from "node:assert/strict";
import test, { describe } from "node:test";

import { AGENCIA_A } from "./helpers/agency";
import { FLOW_TEMPLATES, flowTemplate, templateBlurb, templateStepCount } from "../src/lib/flows/templates";
import {
  clientColor,
  clientsHint,
  draftError,
  draftFor,
  draftFromFlow,
  switchTemplate,
  toggleClient,
} from "../src/lib/flows/wizard";
import type { Flow } from "../src/lib/flows/types";

/*
 * O Novo fluxo (exports "Novo Fluxo · 1/2/3"): o que cada modelo traz, o que
 * sobrevive a uma troca de modelo e o que impede de seguir.
 */

describe("modelos", () => {
  test("os quatro cards do export, na ordem", () => {
    assert.deepEqual(
      FLOW_TEMPLATES.map((t) => t.label),
      ["Começar do zero", "Social Media", "Blog & Conteúdo", "Paid Media"],
    );
  });

  test("o selo e o texto saem das etapas de verdade", () => {
    assert.equal(templateStepCount(flowTemplate("zero")), "Sem etapas");
    assert.equal(templateStepCount(flowTemplate("social-media")), "6 etapas");
    assert.equal(templateStepCount(flowTemplate("blog")), "5 etapas");
    assert.equal(templateStepCount(flowTemplate("paid-media")), "4 etapas");
    assert.equal(templateBlurb(flowTemplate("blog")), "Pauta → Redação → SEO → Revisão → Publicação.");
    assert.equal(templateBlurb(flowTemplate("paid-media")), "Estratégia → Criativos → Setup → Aprovação.");
    assert.equal(templateBlurb(flowTemplate("zero")), "Monte um fluxo customizado etapa por etapa.");
  });

  test("ninguém fixo: squad do cliente, e a aprovação é do cliente", () => {
    for (const t of FLOW_TEMPLATES) {
      for (const s of t.steps()) {
        assert.notEqual(s.assignee.kind, "membro", `${t.label} · ${s.name}`);
        if (s.name === "Aprovação") assert.equal(s.assignee.kind, "cliente");
      }
      const ids = t.steps().map((s) => s.id);
      assert.equal(new Set(ids).size, ids.length, `${t.label}: ids de etapa únicos`);
    }
  });

  test("cada chamada devolve etapas novas — mexer numa não suja o modelo", () => {
    const a = flowTemplate("blog").steps();
    a[0].name = "Mexido";
    assert.equal(flowTemplate("blog").steps()[0].name, "Pauta");
  });
});

describe("rascunho do Novo fluxo", () => {
  test("começa com a identidade do modelo", () => {
    const d = draftFor("paid-media");
    assert.equal(d.name, "Paid Media");
    assert.equal(d.icon, "target");
    assert.equal(d.color, "orange");
    assert.equal(d.category, "midia-paga");
    assert.equal(d.activate, true);
    assert.equal(d.appliesTo, "especificos");
    assert.equal(draftFor("zero").activate, false, "fluxo sem etapa não nasce ligado");
  });

  test("trocar de modelo leva o que ainda é padrão e respeita o que a pessoa mexeu", () => {
    const d = { ...draftFor("social-media"), color: "green" as const, description: "Pautas", clientIds: ["c1"] };
    const out = switchTemplate(d, "blog");
    assert.equal(out.template, "blog");
    assert.equal(out.name, "Blog & Conteúdo", "nome era o padrão: troca");
    assert.equal(out.icon, "pen-line");
    assert.equal(out.color, "green", "cor foi escolhida: fica");
    assert.equal(out.description, "Pautas");
    assert.deepEqual(out.clientIds, ["c1"]);

    const renomeado = switchTemplate({ ...draftFor("social-media"), name: "Meu fluxo" }, "zero");
    assert.equal(renomeado.name, "Meu fluxo");
    assert.equal(renomeado.activate, false);
  });

  test("o mesmo modelo não mexe em nada", () => {
    const d = draftFor("blog");
    assert.equal(switchTemplate(d, "blog"), d);
  });

  test("não segue sem nome, nem sem cliente em 'Clientes específicos'", () => {
    assert.equal(draftError({ ...draftFor("zero") })?.field, "name");
    assert.equal(draftError({ ...draftFor("blog"), name: "   " })?.field, "name");
    assert.equal(draftError(draftFor("blog"))?.field, "clients");
    assert.equal(draftError({ ...draftFor("blog"), appliesTo: "todos" }), null);
    assert.equal(draftError({ ...draftFor("blog"), clientIds: ["c1"] }), null);
  });

  test("o pé do passo Detalhes", () => {
    assert.equal(clientsHint(draftFor("blog")), "Nenhum cliente selecionado");
    assert.equal(clientsHint({ ...draftFor("blog"), clientIds: ["a"] }), "1 cliente selecionado");
    assert.equal(clientsHint({ ...draftFor("blog"), clientIds: ["a", "b", "c"] }), "3 clientes selecionados");
    assert.equal(clientsHint({ ...draftFor("blog"), appliesTo: "todos" }), "Todos os clientes sem fluxo próprio");
  });

  test("marcar e desmarcar cliente", () => {
    assert.deepEqual(toggleClient([], "a"), ["a"]);
    assert.deepEqual(toggleClient(["a", "b"], "a"), ["b"]);
  });

  test("editar parte do fluxo como ele está", () => {
    const f: Flow = {
      id: "f1",
      agencyId: AGENCIA_A.agencyId,
      name: "Blog",
      description: "Artigos",
      category: "marketing",
      icon: "pen-line",
      color: "rose",
      appliesTo: "especificos",
      status: "ativo",
      steps: [],
      startStepId: null,
      updatedAt: "",
      updatedBy: "",
      createdAt: "",
    };
    const d = draftFromFlow(f, ["c1"]);
    assert.equal(d.name, "Blog");
    assert.equal(d.color, "rose");
    assert.deepEqual(d.clientIds, ["c1"]);
  });

  test("a cor do avatar é estável e sempre um token", () => {
    assert.equal(clientColor("clinica-aurora"), clientColor("clinica-aurora"));
    assert.match(clientColor("x"), /^var\(--color-flow-[a-z]+\)$/);
  });
});

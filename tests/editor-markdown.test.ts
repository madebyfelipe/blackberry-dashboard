import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  applyTrigger,
  currentBlock,
  duplicateSelection,
  insertLink,
  insertText,
  isEmptyLine,
  lineAt,
  lineIndexAt,
  matchesQuery,
  parseInline,
  parseMarkdown,
  removeFormatting,
  toggleBlock,
  toggleCodeBlock,
  toggleInlineMark,
  triggerAt,
} from "../src/lib/editor/markdown";

/** Açúcar para ler os testes: "ab|cd" é o cursor, "a[bc]d" é a seleção. */
function parse(marked: string) {
  if (marked.includes("[")) {
    const start = marked.indexOf("[");
    const end = marked.indexOf("]") - 1;
    return {
      text: marked.replace("[", "").replace("]", ""),
      selection: { start, end },
    };
  }
  const at = marked.indexOf("|");
  return {
    text: marked.replace("|", ""),
    selection: { start: at, end: at },
  };
}

const show = (r: { text: string; selection: { start: number; end: number } }) =>
  r.selection.start === r.selection.end
    ? r.text.slice(0, r.selection.start) + "|" + r.text.slice(r.selection.start)
    : r.text.slice(0, r.selection.start) +
      "[" +
      r.text.slice(r.selection.start, r.selection.end) +
      "]" +
      r.text.slice(r.selection.end);

describe("marcas no meio do texto", () => {
  test("negrito cerca a seleção e a mantém selecionada", () => {
    const { text, selection } = parse("faz o [briefing] hoje");
    assert.equal(
      show(toggleInlineMark(text, selection, "bold")),
      "faz o **[briefing]** hoje",
    );
  });

  test("negrito de novo desfaz, não empilha", () => {
    const { text, selection } = parse("faz o **[briefing]** hoje");
    assert.equal(
      show(toggleInlineMark(text, selection, "bold")),
      "faz o [briefing] hoje",
    );
  });

  test("seleção que inclui as marcas também desfaz", () => {
    const { text, selection } = parse("faz o [**briefing**] hoje");
    assert.equal(
      show(toggleInlineMark(text, selection, "bold")),
      "faz o [briefing] hoje",
    );
  });

  test("sem seleção, abre o par e deixa o cursor dentro", () => {
    const { text, selection } = parse("escreve |aqui");
    assert.equal(show(toggleInlineMark(text, selection, "italic")), "escreve *|*aqui");
  });

  test("cada marca tem o seu par", () => {
    const { text, selection } = parse("[x]");
    assert.equal(toggleInlineMark(text, selection, "strike").text, "~~x~~");
    assert.equal(toggleInlineMark(text, selection, "code").text, "`x`");
    assert.equal(toggleInlineMark(text, selection, "underline").text, "__x__");
  });

  test("itálico dentro de negrito soma, e negrito ali desfaz só o negrito", () => {
    const { text, selection } = parse("**[x]**");
    const italico = toggleInlineMark(text, selection, "italic");
    assert.equal(italico.text, "***x***", "negrito + itálico, como no markdown");
    assert.equal(
      toggleInlineMark(italico.text, italico.selection, "bold").text,
      "*x*",
      "tirar o negrito deixa o itálico",
    );
    assert.equal(
      toggleInlineMark(italico.text, italico.selection, "italic").text,
      "**x**",
      "tirar o itálico deixa o negrito",
    );
  });
});

describe("blocos da linha", () => {
  test("H2 vira prefixo e o menu passa a reconhecer a linha", () => {
    const { text, selection } = parse("Objetivo do mês|");
    const h2 = toggleBlock(text, selection, "h2");
    assert.equal(h2.text, "## Objetivo do mês");
    assert.equal(currentBlock(h2.text, 3), "h2");
  });

  test("H2 na linha que já é H2 volta a parágrafo", () => {
    const r = toggleBlock("## Objetivo", { start: 3, end: 3 }, "h2");
    assert.equal(r.text, "Objetivo");
    assert.equal(currentBlock(r.text, 0), "paragrafo");
  });

  test("H3 numa linha H2 troca o nível, não soma prefixos", () => {
    const r = toggleBlock("## Objetivo", { start: 3, end: 3 }, "h3");
    assert.equal(r.text, "### Objetivo");
  });

  test("lista numerada conta as linhas", () => {
    const text = "um\ndois\ntrês";
    const r = toggleBlock(text, { start: 0, end: text.length }, "numbered");
    assert.equal(r.text, "1. um\n2. dois\n3. três");
  });

  test("bullet e citação também ligam e desligam em bloco", () => {
    const text = "um\ndois";
    const bullet = toggleBlock(text, { start: 0, end: text.length }, "bullet");
    assert.equal(bullet.text, "- um\n- dois");
    assert.equal(
      toggleBlock(bullet.text, bullet.selection, "bullet").text,
      "um\ndois",
    );
    assert.equal(
      toggleBlock(text, { start: 0, end: text.length }, "quote").text,
      "> um\n> dois",
    );
  });

  test("linha em branco no meio da seleção não ganha marcador solto", () => {
    const text = "um\n\ndois";
    const r = toggleBlock(text, { start: 0, end: text.length }, "bullet");
    assert.equal(r.text, "- um\n\n- dois");
  });

  test("bloco em linha vazia insere o marcador e leva o cursor para depois", () => {
    const r = toggleBlock("Objetivo\n", { start: 9, end: 9 }, "h2");
    assert.equal(show(r), "Objetivo\n## |");
  });

  test("lista em linha vazia também começa vazia, pronta para digitar", () => {
    const r = toggleBlock("", { start: 0, end: 0 }, "bullet");
    assert.equal(show(r), "- |");
  });

  test("currentBlock lê os cinco tipos que o menu mostra", () => {
    assert.equal(currentBlock("# T", 0), "h1");
    assert.equal(currentBlock("## T", 0), "h2");
    assert.equal(currentBlock("### T", 0), "h3");
    assert.equal(currentBlock("> T", 0), "quote");
    assert.equal(currentBlock("- T", 0), "bullet");
    assert.equal(currentBlock("2. T", 0), "numbered");
    assert.equal(currentBlock("T", 0), "paragrafo");
    assert.equal(currentBlock("#semrespiro", 0), "paragrafo");
  });
});

describe("bloco de código, link, duplicar e limpar", () => {
  test("bloco de código cerca e descerca", () => {
    const r = toggleCodeBlock("npm run build", { start: 0, end: 13 });
    assert.equal(r.text, "```\nnpm run build\n```");
    assert.equal(toggleCodeBlock(r.text, r.selection).text, "npm run build");
  });

  test("link deixa o endereço selecionado para digitar em cima", () => {
    const { text, selection } = parse("ver o [site] do cliente");
    const r = insertLink(text, selection);
    assert.equal(show(r), "ver o [site]([url]) do cliente");
  });

  test("link sem seleção nasce com rótulo provisório", () => {
    const r = insertLink("", { start: 0, end: 0 });
    assert.equal(r.text, "[texto](url)");
  });

  test("duplicar repete o trecho; sem seleção, repete a linha", () => {
    const { text, selection } = parse("[Clínica Aurora]");
    assert.equal(duplicateSelection(text, selection).text, "Clínica AuroraClínica Aurora");
    const linha = duplicateSelection("uma linha|".replace("|", ""), { start: 3, end: 3 });
    assert.equal(linha.text, "uma linha\numa linha");
  });

  test("limpar formatação tira marca de meio e de começo de linha", () => {
    const text = "## **Objetivo** do ~~mês~~ e o [site](https://x.com)";
    const r = removeFormatting(text, { start: 0, end: text.length });
    assert.equal(r.text, "Objetivo do mês e o site");
  });

  test("limpar sem seleção limpa a linha do cursor", () => {
    const text = "- **um**\n- dois";
    const r = removeFormatting(text, { start: 4, end: 4 });
    assert.equal(r.text, "um\n- dois");
  });

  test("inserir texto põe o cursor depois do que entrou", () => {
    const r = insertText("ola ", { start: 4, end: 4 }, "@Marina ");
    assert.equal(show(r), "ola @Marina |");
  });
});

describe("linhas e o hint da linha vazia", () => {
  test("linha vazia é vazia mesmo com espaços", () => {
    assert.equal(isEmptyLine("um\n   \ndois", 4), true);
    assert.equal(isEmptyLine("um\n   \ndois", 1), false);
  });

  test("a linha e o índice dela saem certos no meio do texto", () => {
    const text = "um\ndois\ntrês";
    assert.equal(lineAt(text, 5), "dois");
    assert.equal(lineIndexAt(text, 5), 1);
    assert.equal(lineIndexAt(text, 0), 0);
    assert.equal(lineIndexAt(text, text.length), 2);
  });
});

describe("gatilhos / e @", () => {
  test("a barra no começo da linha abre os comandos", () => {
    const t = triggerAt("/", 1);
    assert.deepEqual(t, { kind: "comando", from: 0, query: "" });
  });

  test("a barra depois de um espaço também abre, com o que foi digitado", () => {
    assert.deepEqual(triggerAt("faz /head", 9), {
      kind: "comando",
      from: 4,
      query: "head",
    });
  });

  test("barra no meio de palavra não abre menu (e/ou segue sendo texto)", () => {
    assert.equal(triggerAt("e/ou", 4), null);
  });

  test("arroba de e-mail não abre menção", () => {
    assert.equal(triggerAt("alo@studioraiz.com", 18), null);
    assert.deepEqual(triggerAt("chama @mar", 10), {
      kind: "mencao",
      from: 6,
      query: "mar",
    });
  });

  test("espaço depois do gatilho fecha o menu", () => {
    assert.equal(triggerAt("/ para formatação", 17), null);
  });

  test("escolher no menu troca o gatilho pelo que foi escolhido", () => {
    const text = "chama @mar";
    const t = triggerAt(text, 10)!;
    const r = applyTrigger(text, t, 10, "@Marina ");
    assert.equal(show(r), "chama @Marina |");
  });
});

describe("filtro dos menus", () => {
  test("acha sem acento e sem caixa", () => {
    assert.equal(matchesQuery("Bloco de código", "codigo"), true);
    assert.equal(matchesQuery("Heading 2", "HEAD"), true);
    assert.equal(matchesQuery("Bullet point", "numerada"), false);
  });
});

describe("leitura do markdown (o texto salvo virando tela)", () => {
  test("negrito, itálico, riscado, sublinhado e código viram estilo", () => {
    assert.deepEqual(parseInline("um **dois** *três* ~~quatro~~ __cinco__ `seis`"), [
      { text: "um " },
      { text: "dois", bold: true },
      { text: " " },
      { text: "três", italic: true },
      { text: " " },
      { text: "quatro", strike: true },
      { text: " " },
      { text: "cinco", underline: true },
      { text: " " },
      { text: "seis", code: true },
    ]);
  });

  test("negrito com itálico dentro guarda os dois", () => {
    assert.deepEqual(parseInline("***x***"), [{ text: "x", bold: true, italic: true }]);
  });

  test("link vira texto com endereço", () => {
    assert.deepEqual(parseInline("veja o [site](https://x.com)"), [
      { text: "veja o " },
      { text: "site", href: "https://x.com" },
    ]);
  });

  test("marca sem par continua sendo texto", () => {
    assert.deepEqual(parseInline("2 * 3 = 6"), [{ text: "2 * 3 = 6" }]);
  });

  test("títulos, listas, citação e bloco de código viram blocos", () => {
    const blocks = parseMarkdown(
      [
        "# Um",
        "## Dois",
        "texto",
        "- a",
        "- b",
        "1. x",
        "2. y",
        "> citado",
        "```",
        "npm test",
        "```",
      ].join("\n"),
    );
    assert.deepEqual(
      blocks.map((b) => (b.kind === "list" ? `list:${b.ordered}` : b.kind)),
      [
        "heading",
        "heading",
        "paragraph",
        "list:false",
        "list:true",
        "quote",
        "code",
      ],
    );
    const lista = blocks[3];
    assert.equal(lista.kind === "list" && lista.items.length, 2);
    const codigo = blocks[6];
    assert.equal(codigo.kind === "code" && codigo.text, "npm test");
  });

  test("o nível do título vem do número de #", () => {
    const [h1, h2, h3] = parseMarkdown("# a\n## b\n### c");
    assert.equal(h1.kind === "heading" && h1.level, 1);
    assert.equal(h2.kind === "heading" && h2.level, 2);
    assert.equal(h3.kind === "heading" && h3.level, 3);
  });

  test("o que o menu escreve é o que a leitura entende", () => {
    // A ida e a volta: formatar com os comandos e ler o resultado.
    const negrito = toggleInlineMark("prazo curto", { start: 0, end: 5 }, "bold");
    const titulo = toggleBlock(negrito.text, { start: 0, end: 0 }, "h2");
    const [bloco] = parseMarkdown(titulo.text);
    assert.equal(bloco.kind, "heading");
    assert.deepEqual(bloco.kind === "heading" && bloco.spans, [
      { text: "prazo", bold: true },
      { text: " curto" },
    ]);
  });
});

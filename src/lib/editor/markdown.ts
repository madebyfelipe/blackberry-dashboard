/*
 * A formatação do texto do briefing — tudo que os menus de formatação fazem
 * com a descrição da tarefa, como função pura sobre `(texto, seleção)`.
 *
 * Por que markdown e não texto rico
 * ---------------------------------
 * A descrição é uma `string` e continua sendo: ela nasce assim, é o que a
 * busca varre, o que a lista mostra em prévia e o que o Postgres guarda. Um
 * editor de HTML mudaria o dado (e pediria sanitização, migração e prévia
 * nova) para entregar a mesma coisa — então o negrito é `**negrito**`, o
 * título é `## Título`, a lista é `- item`. Convenção que a pessoa lê mesmo
 * sem render, que sobrevive a copiar e colar, e que um dia vira render sem
 * migrar nada.
 *
 * Os menus são o desenho do Felipe (exports "menu_formatacao",
 * "menu_comando_tarefas", "formatacao_hover"); a régua de marcas é decisão
 * técnica minha, registrada aqui.
 */

export type Selection = { start: number; end: number };

/** O resultado de qualquer comando: texto novo e onde o cursor fica. */
export type EditResult = { text: string; selection: Selection };

export type InlineMark = "bold" | "italic" | "strike" | "code" | "underline";

export const INLINE_MARKERS: Record<InlineMark, string> = {
  bold: "**",
  italic: "*",
  strike: "~~",
  code: "`",
  // Markdown não tem sublinhado; `__` é a convenção de texto puro para ele.
  underline: "__",
};

export type BlockKind =
  | "paragrafo"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "numbered"
  | "quote";

export const BLOCK_PREFIXES: Record<Exclude<BlockKind, "paragrafo">, string> = {
  h1: "# ",
  h2: "## ",
  h3: "### ",
  bullet: "- ",
  numbered: "1. ",
  quote: "> ",
};

/* ------------------------------------------------------------------ linhas */

/** Começo e fim (sem o "\n") da linha em que a posição está. */
export function lineRange(text: string, pos: number): Selection {
  const at = Math.max(0, Math.min(pos, text.length));
  const start = text.lastIndexOf("\n", at - 1) + 1;
  const nl = text.indexOf("\n", at);
  return { start, end: nl === -1 ? text.length : nl };
}

export function lineAt(text: string, pos: number): string {
  const { start, end } = lineRange(text, pos);
  return text.slice(start, end);
}

/** A linha do cursor está vazia (ou só com espaços)? É onde o hint aparece. */
export function isEmptyLine(text: string, pos: number): boolean {
  return lineAt(text, pos).trim() === "";
}

/** Índice (base 0) da linha em que a posição está — o hint precisa dele. */
export function lineIndexAt(text: string, pos: number): number {
  const at = Math.max(0, Math.min(pos, text.length));
  let count = 0;
  for (let i = 0; i < at; i++) if (text[i] === "\n") count++;
  return count;
}

/** As linhas que a seleção toca, inteiras. */
function selectedLines(text: string, sel: Selection): Selection {
  const first = lineRange(text, Math.min(sel.start, sel.end));
  const last = lineRange(text, Math.max(sel.start, sel.end));
  return { start: first.start, end: last.end };
}

/* ------------------------------------------------------- marcas na linha */

/** Que bloco é a linha do cursor — é o rótulo que o menu de formatação mostra. */
export function currentBlock(text: string, pos: number): BlockKind {
  const line = lineAt(text, pos);
  if (/^###\s/.test(line)) return "h3";
  if (/^##\s/.test(line)) return "h2";
  if (/^#\s/.test(line)) return "h1";
  if (/^>\s/.test(line)) return "quote";
  if (/^[-*]\s/.test(line)) return "bullet";
  if (/^\d+[.)]\s/.test(line)) return "numbered";
  return "paragrafo";
}

/** Tira do começo da linha qualquer marca de bloco. */
function stripBlock(line: string): string {
  return line.replace(/^\s*(?:#{1,3}\s+|>\s+|[-*]\s+|\d+[.)]\s+)/, "");
}

/**
 * Liga ou desliga um bloco nas linhas da seleção. Aplicar o mesmo bloco duas
 * vezes volta para parágrafo — é o que o menu faz quando a linha já é H2 e a
 * pessoa escolhe H2 de novo.
 *
 * Em lista numerada as linhas ganham 1., 2., 3.… e não todas "1.".
 */
export function toggleBlock(
  text: string,
  sel: Selection,
  kind: BlockKind,
): EditResult {
  const range = selectedLines(text, sel);
  const block = text.slice(range.start, range.end);
  const lines = block.split("\n");
  /*
   * Linha vazia é o caso do menu `/`: quem escolheu "Heading 2" numa linha em
   * branco quer começar a escrever em H2. Só quando há conteúdo em volta é que
   * a linha em branco fica em branco — marcador solto no meio de uma lista é
   * lixo, não bloco.
   */
  const hasContent = lines.some((l) => l.trim() !== "");
  const marked = hasContent ? lines.filter((l) => l.trim() !== "") : lines;
  const already =
    hasContent && marked.every((l) => currentBlock(l, 0) === kind);
  const target: BlockKind = already ? "paragrafo" : kind;

  let n = 0;
  const out = lines.map((line) => {
    const bare = stripBlock(line);
    if (hasContent && bare.trim() === "") return bare;
    if (target === "paragrafo") return bare;
    if (target === "numbered") return `${++n}. ${bare}`;
    return BLOCK_PREFIXES[target] + bare;
  });

  const next = out.join("\n");
  const end = range.start + next.length;
  return {
    text: text.slice(0, range.start) + next + text.slice(range.end),
    // Com conteúdo, a seleção cobre o bloco reescrito e dá para trocar H2 por
    // H3 na sequência; sem conteúdo, o cursor vai para depois do marcador,
    // que é onde se escreve.
    selection: hasContent
      ? { start: range.start, end }
      : { start: end, end },
  };
}

/* -------------------------------------------------------- marcas no meio */

/** Quantos caracteres `ch` existem seguidos, andando de `pos` na direção dada. */
function run(text: string, pos: number, step: -1 | 1, ch: string): number {
  let n = 0;
  for (let i = pos; i >= 0 && i < text.length && text[i] === ch; i += step) n++;
  return n;
}

/**
 * A seleção já está cercada pela marca?
 *
 * O caso que obriga a contar em vez de comparar strings é `*` dentro de `**`:
 * em `**x**` o caractere ao lado de `x` é um `*`, mas o que está ligado ali é
 * negrito, não itálico. Com a contagem, marca de um caractere está ligada
 * quando o cerco é ímpar (1 = itálico, 3 = negrito+itálico) e a de dois,
 * quando há pelo menos dois de cada lado — que é exatamente a leitura do
 * markdown.
 */
function wrapped(text: string, sel: Selection, marker: string): boolean {
  const ch = marker[0];
  const before = run(text, sel.start - 1, -1, ch);
  const after = run(text, sel.end, 1, ch);
  return marker.length === 1
    ? before % 2 === 1 && after % 2 === 1
    : before >= marker.length && after >= marker.length;
}

/**
 * Liga ou desliga negrito, itálico, riscado, código ou sublinhado.
 *
 * Três casos, e todos importam: a marca já cerca a seleção (desliga), a
 * seleção *é* o texto marcado (desliga por dentro), ou não há marca (liga).
 * Sem seleção, insere o par e põe o cursor no meio — quem clicou em negrito
 * antes de escrever quer escrever em negrito.
 */
export function toggleInlineMark(
  text: string,
  sel: Selection,
  mark: InlineMark,
): EditResult {
  const m = INLINE_MARKERS[mark];
  const start = Math.min(sel.start, sel.end);
  const end = Math.max(sel.start, sel.end);
  const chosen = text.slice(start, end);

  if (wrapped(text, { start, end }, m)) {
    return {
      text: text.slice(0, start - m.length) + chosen + text.slice(end + m.length),
      selection: { start: start - m.length, end: end - m.length },
    };
  }

  if (
    chosen.length > 2 * m.length &&
    chosen.startsWith(m) &&
    chosen.endsWith(m)
  ) {
    const bare = chosen.slice(m.length, -m.length);
    return {
      text: text.slice(0, start) + bare + text.slice(end),
      selection: { start, end: start + bare.length },
    };
  }

  return {
    text: text.slice(0, start) + m + chosen + m + text.slice(end),
    selection: chosen
      ? { start: start + m.length, end: end + m.length }
      : { start: start + m.length, end: start + m.length },
  };
}

/** "Limpar formatação": tira marcas de meio e de começo de linha da seleção. */
export function removeFormatting(text: string, sel: Selection): EditResult {
  const start = Math.min(sel.start, sel.end);
  const end = Math.max(sel.start, sel.end);
  const range = start === end ? selectedLines(text, sel) : { start, end };
  const clean = text
    .slice(range.start, range.end)
    .split("\n")
    .map((line) => stripBlock(line))
    .join("\n")
    .replace(/\*\*|__|~~|`|\*/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  return {
    text: text.slice(0, range.start) + clean + text.slice(range.end),
    selection: { start: range.start, end: range.start + clean.length },
  };
}

/** Bloco de código: cerca as linhas da seleção com ``` — ou desfaz. */
export function toggleCodeBlock(text: string, sel: Selection): EditResult {
  const range = selectedLines(text, sel);
  const block = text.slice(range.start, range.end);
  const fenced = /^```[^\n]*\n([\s\S]*)\n```$/.exec(block);
  const next = fenced ? fenced[1] : "```\n" + block + "\n```";
  return {
    text: text.slice(0, range.start) + next + text.slice(range.end),
    selection: { start: range.start, end: range.start + next.length },
  };
}

/**
 * Link markdown com o endereço já selecionado: a pessoa clica em "link" e
 * digita o endereço em cima de "url", sem caixa de diálogo no caminho.
 */
export function insertLink(text: string, sel: Selection): EditResult {
  const start = Math.min(sel.start, sel.end);
  const end = Math.max(sel.start, sel.end);
  const label = text.slice(start, end) || "texto";
  const inserted = `[${label}](url)`;
  const urlAt = start + label.length + 3;
  return {
    text: text.slice(0, start) + inserted + text.slice(end),
    selection: { start: urlAt, end: urlAt + 3 },
  };
}

/** Duplicar: o trecho escolhido (ou a linha) aparece logo abaixo/ao lado. */
export function duplicateSelection(text: string, sel: Selection): EditResult {
  const start = Math.min(sel.start, sel.end);
  const end = Math.max(sel.start, sel.end);
  if (start !== end) {
    const chosen = text.slice(start, end);
    return {
      text: text.slice(0, end) + chosen + text.slice(end),
      selection: { start: end, end: end + chosen.length },
    };
  }
  const range = lineRange(text, start);
  const line = text.slice(range.start, range.end);
  return {
    text: text.slice(0, range.end) + "\n" + line + text.slice(range.end),
    selection: {
      start: range.end + 1,
      end: range.end + 1 + line.length,
    },
  };
}

/** Insere texto no lugar da seleção, deixando o cursor depois dele. */
export function insertText(
  text: string,
  sel: Selection,
  insert: string,
): EditResult {
  const start = Math.min(sel.start, sel.end);
  const end = Math.max(sel.start, sel.end);
  return {
    text: text.slice(0, start) + insert + text.slice(end),
    selection: { start: start + insert.length, end: start + insert.length },
  };
}

/* ------------------------------------------------------------- gatilhos */

export type Trigger = {
  /** "/" abre os comandos; "@" abre as pessoas. */
  kind: "comando" | "mencao";
  /** Onde o gatilho começa — é o que se apaga ao escolher no menu. */
  from: number;
  /** O que foi digitado depois dele. */
  query: string;
};

/**
 * O que está sendo digitado no cursor: um comando (`/`) ou uma menção (`@`).
 *
 * O gatilho só vale no começo da linha ou depois de um espaço — assim `e/ou` e
 * `alo@studioraiz.com` não abrem menu nenhum. Um espaço depois do gatilho
 * fecha: quem escreveu "/ para" está escrevendo, não comandando.
 */
export function triggerAt(text: string, caret: number): Trigger | null {
  const { start } = lineRange(text, caret);
  for (let i = caret - 1; i >= start; i--) {
    const ch = text[i];
    if (ch === " " || ch === "\t") return null;
    if (ch === "/" || ch === "@") {
      const before = i > start ? text[i - 1] : "";
      if (before && before !== " " && before !== "\t") return null;
      return {
        kind: ch === "/" ? "comando" : "mencao",
        from: i,
        query: text.slice(i + 1, caret),
      };
    }
  }
  return null;
}

/** Troca o gatilho (e o que foi digitado nele) pelo texto escolhido. */
export function applyTrigger(
  text: string,
  trigger: Trigger,
  caret: number,
  insert: string,
): EditResult {
  const at = trigger.from + insert.length;
  return {
    text: text.slice(0, trigger.from) + insert + text.slice(caret),
    selection: { start: at, end: at },
  };
}

/** Filtro dos menus: sem acento, sem caixa — "codigo" acha "Bloco de código". */
export function matchesQuery(label: string, query: string): boolean {
  const fold = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  return fold(label).includes(fold(query.trim()));
}

/* --------------------------------------------------------------- leitura */

/*
 * A outra ponta da escolha lá de cima: se o texto guarda markdown, alguém
 * precisa lê-lo. Estas funções transformam a string em blocos e trechos, e o
 * campo mostra isso quando não está sendo editado — clicou, volta a ser o
 * texto cru que se digita.
 *
 * É um markdown pequeno de propósito: exatamente o que os menus do desenho
 * sabem escrever, nada além. Sem HTML no meio do caminho, então também não há
 * o que sanitizar.
 */

export type Inline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  code?: boolean;
  href?: string;
};

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; spans: Inline[] }
  | { kind: "paragraph"; spans: Inline[] }
  | { kind: "quote"; spans: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "code"; text: string };

const INLINE_RE =
  /(`[^`]+`)|(\*\*\*[^*]+\*\*\*)|(\*\*[^*]+\*\*)|(__[^_]+__)|(~~[^~]+~~)|(\*[^*]+\*)|(\[[^\]]*\]\([^)]*\))/;

/** Quebra um trecho em pedaços com estilo, respeitando marcas aninhadas. */
export function parseInline(text: string, style: Inline = { text: "" }): Inline[] {
  const out: Inline[] = [];
  let rest = text;

  while (rest) {
    const m = INLINE_RE.exec(rest);
    if (!m || m.index === undefined) break;
    if (m.index > 0) out.push({ ...style, text: rest.slice(0, m.index) });
    const token = m[0];

    if (token.startsWith("```")) break;
    if (token.startsWith("`")) {
      out.push({ ...style, code: true, text: token.slice(1, -1) });
    } else if (token.startsWith("***")) {
      out.push(
        ...parseInline(token.slice(3, -3), { ...style, bold: true, italic: true }),
      );
    } else if (token.startsWith("**")) {
      out.push(...parseInline(token.slice(2, -2), { ...style, bold: true }));
    } else if (token.startsWith("__")) {
      out.push(...parseInline(token.slice(2, -2), { ...style, underline: true }));
    } else if (token.startsWith("~~")) {
      out.push(...parseInline(token.slice(2, -2), { ...style, strike: true }));
    } else if (token.startsWith("*")) {
      out.push(...parseInline(token.slice(1, -1), { ...style, italic: true }));
    } else {
      const link = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(token);
      if (link) {
        out.push({ ...style, text: link[1] || link[2], href: link[2] });
      } else {
        out.push({ ...style, text: token });
      }
    }
    rest = rest.slice(m.index + token.length);
  }

  if (rest) out.push({ ...style, text: rest });
  return out.filter((span) => span.text !== "");
}

/** O texto inteiro em blocos, na ordem em que foram escritos. */
export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        spans: parseInline(heading[2]),
      });
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = !bullet;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const next = ordered
          ? /^\d+[.)]\s+(.*)$/.exec(lines[i])
          : /^[-*]\s+(.*)$/.exec(lines[i]);
        if (!next) break;
        items.push(parseInline(next[1]));
        i++;
      }
      i--;
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      blocks.push({ kind: "quote", spans: parseInline(quote[1]) });
      continue;
    }

    blocks.push({ kind: "paragraph", spans: parseInline(line) });
  }

  return blocks;
}
